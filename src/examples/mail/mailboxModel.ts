/* The mailbox: what the app shows and what it can do to it. One storage, one
   api, one set of selectors — the composer next door is a storage of its own. */
import {
    DataApi,
    getStore,
    shallowEqual,
    StoreSelectors,
    storeApi,
    storeKey,
    useRDataApi,
    useRKey,
} from 'rvmodel'
import { fetchThreads, nextIncoming, saveThread, type Thread } from './mailApi'

export type Folder = 'inbox' | 'unread' | 'starred' | 'sent'

export type MailboxState = {
    threads: Thread[]
    query: string
    folder: Folder
    openId: number | null
    status: 'idle' | 'loading' | 'error'
    error: string | null
}

export const MAILBOX_DEFAULT: MailboxState = {
    threads: [],
    query: '',
    folder: 'inbox',
    openId: null,
    status: 'idle',
    error: null,
}

export const MAILBOX_KEY = storeKey<{ data: MailboxState, api: MailboxApi, selectors: MailboxSelectors }>('mailbox')

export class MailboxApi extends DataApi<MailboxState> {
    /** The load in flight, so the next one can call it off. */
    #cancelLoad: (() => void) | null = null

    setQuery = (query: string) => this.setValue('query', query)

    setFolder = (folder: Folder) => this.setValue('folder', folder)

    /**
     * Loads the list. One at a time: typing quickly cancels the request for
     * the query you have already moved past, so a slow answer can never land
     * on top of a fresh one.
     */
    load = () => {
        this.#cancelLoad?.()
        this.setValues(['status', 'error'], ['loading', null])

        this.#cancelLoad = this.runTask(
            async (signal) => {
                try {
                    const threads = await fetchThreads(this.data.query, signal)

                    return { threads, status: 'idle' as const, error: null }
                } catch (error) {
                    // An abort is this load being called off, not a failure.
                    if (signal.aborted) return

                    return { status: 'error' as const, error: message(error) }
                }
            },
            // Called off halfway: the list stays as it was, only the flag goes back.
            { status: 'idle' },
        )

        return this.#cancelLoad
    }

    cancelLoad = () => this.#cancelLoad?.()

    /** Opens a thread and marks it read on the way — the server hears after. */
    open = (id: number | null) => {
        this.setValue('openId', id)

        if (id === null || this.data.threads.find((thread) => thread.id === id)?.read) return

        this.#write(id, { read: true })
    }

    toggleStar = (id: number) => {
        const starred = !this.data.threads.find((thread) => thread.id === id)?.starred

        this.#write(id, { starred })
    }

    /** A message arriving from outside — the push below, or a sent copy. */
    receive = (thread: Thread) => this.updateValue('threads', (threads) => [thread, ...threads])

    /**
     * The optimistic write both toggles use: the row changes now, the server is
     * told after, and the list from before goes into both ways back — the one
     * for a failure and the one for a task called off before it settled.
     */
    #write(id: number, changes: Partial<Thread>) {
        const before = this.data.threads

        this.setValues({
            threads: before.map((thread) => (thread.id === id ? { ...thread, ...changes } : thread)),
            error: null,
        })

        return this.runTask(
            async (signal) => {
                try {
                    await saveThread(id, changes, signal)

                    return
                } catch (error) {
                    if (signal.aborted) return

                    return { threads: before, error: `${message(error)} — put back` }
                }
            },
            { threads: before },
        )
    }
}

export class MailboxSelectors extends StoreSelectors<MailboxState> {
    /** The rows the list shows. A fresh array, so it says how to compare one. */
    visible = this.select(
        ({ threads, folder }) => threads.filter((thread) => inFolder(thread, folder)),
        ['threads', 'folder'],
        shallowEqual,
    )

    /** What the sidebar puts next to each folder. */
    tallies = this.select(
        ({ threads }) => ({
            inbox: threads.filter((thread) => thread.folder === 'inbox').length,
            unread: threads.filter((thread) => !thread.read && thread.folder === 'inbox').length,
            starred: threads.filter((thread) => thread.starred).length,
            sent: threads.filter((thread) => thread.folder === 'sent').length,
        }),
        ['threads'],
        shallowEqual,
    )

    /** Just the number, so the reader's header sleeps through a star being flipped. */
    unread = this.select(
        ({ threads }) => threads.filter((thread) => !thread.read && thread.folder === 'inbox').length,
        ['threads'],
    )

    open = this.select(
        ({ threads, openId }) => threads.find((thread) => thread.id === openId) ?? null,
        ['threads', 'openId'],
    )
}

export const mailboxApi = new MailboxApi()
export const mailboxSelectors = new MailboxSelectors()

export const useMailboxKey = () => useRKey<{ data: MailboxState, api: MailboxApi, selectors: MailboxSelectors }>()

export const useMailboxApi = () => useRDataApi(useMailboxKey())

/* ------------------------------------------------------------------ *
 * Two things the app does without rendering anything.
 * ------------------------------------------------------------------ */

/**
 * New mail, arriving from outside React entirely: a plain interval that reaches
 * the storage through the registry. Only the components reading `threads` wake
 * up — the composer next to them does not notice.
 */
let push: ReturnType<typeof setInterval> | null = null

export function startPush(everyMs = 6000) {
    if (push) return

    push = setInterval(() => {
        getStore(MAILBOX_KEY)?.dataApi.receive(nextIncoming())
    }, everyMs)
}

export function stopPush() {
    if (!push) return

    clearInterval(push)
    push = null
}

export function pushRunning() {
    return push !== null
}

/**
 * The unread count in the browser tab. A reaction, not a render: it listens on
 * one field and writes to the document, so no component has to hold the number
 * just to keep the title honest.
 */
export function watchTitle() {
    const write = () => {
        const store = getStore(MAILBOX_KEY)
        // The same selector the sidebar renders from, by the same name, run
        // outside React — the rule for what counts as unread lives in one place.
        const unread = store ? store.selectors.read('unread') : 0

        document.title = unread ? `Inbox (${unread})` : 'Inbox'
    }

    const stop = storeApi<MailboxState>(MAILBOX_KEY).subscribe(write, ['threads'])

    write()

    return stop
}

function inFolder(thread: Thread, folder: Folder) {
    if (folder === 'sent') return thread.folder === 'sent'
    if (folder === 'unread') return thread.folder === 'inbox' && !thread.read
    if (folder === 'starred') return thread.starred

    return thread.folder === 'inbox'
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))
