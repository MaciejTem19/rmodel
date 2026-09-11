/* The composer is a storage of its own, next to the mailbox rather than inside
   it: a draft belongs to the window you are typing in, not to the mailbox, and
   keeping it apart means a keystroke here wakes nothing over there.

   Its <RVModel /> is mounted with `remember`, so closing the window keeps both
   the draft and a send already on its way. */
import { DataApi, getStore, storeKey, useRDataApi, useRKey } from 'rvmodel'
import { MAILBOX_KEY } from './mailboxModel'
import { sendMail } from './mailApi'

/** How long "Undo" stays on screen before the message actually goes out. */
const UNDO_WINDOW = 4000

export type ComposerState = {
    to: string
    subject: string
    body: string
    sending: boolean
    sentAt: string | null
    error: string | null
}

export const COMPOSER_DEFAULT: ComposerState = {
    to: '',
    subject: '',
    body: '',
    sending: false,
    sentAt: null,
    error: null,
}

export const COMPOSER_KEY = storeKey<{ data: ComposerState, api: ComposerApi }>('composer')

export class ComposerApi extends DataApi<ComposerState> {
    /** The send on its way, so Undo can reach it even after the window was closed. */
    #cancelSend: (() => void) | null = null

    setTo = (to: string) => this.setValue('to', to)

    setSubject = (subject: string) => this.setValue('subject', subject)

    setBody = (body: string) => this.setValue('body', body)

    /**
     * Send, with the undo window every mail client has. The returned cancel is
     * what the Undo button calls: press it and nothing was written — the draft
     * is still exactly as you left it, because the task hands its result back
     * at the end instead of writing as it goes.
     */
    send = () => {
        this.#cancelSend?.()
        this.setValues(['sending', 'error', 'sentAt'], [true, null, null])

        this.#cancelSend = this.runTask(
            async (signal) => {
                try {
                    await hold(UNDO_WINDOW, signal)

                    const { to, subject, body } = this.data
                    const sent = await sendMail(to, subject, body, signal)

                    // The other storage, reached through the registry: no prop,
                    // no context, and it works from here because the mailbox is
                    // mounted, not because this component knows about it.
                    getStore(MAILBOX_KEY)?.dataApi.receive(sent)

                    return { ...COMPOSER_DEFAULT, sentAt: new Date().toLocaleTimeString() }
                } catch (error) {
                    if (signal.aborted) return

                    return { sending: false, error: message(error) }
                }
            },
            // Undone, or the window closed without remember: the draft stays,
            // only the flag goes back.
            { sending: false },
        )

        return this.#cancelSend
    }

    /** Calls the send off. The draft is untouched: nothing was written yet. */
    undo = () => this.#cancelSend?.()

    discard = () => this.setValues(COMPOSER_DEFAULT)
}

export const composerApi = new ComposerApi()

export const useComposerKey = () => useRKey<{ data: ComposerState, api: ComposerApi }>()

export const useComposerApi = () => useRDataApi(useComposerKey())

/** A wait that gives up the moment the send is undone. */
function hold(ms: number, signal: AbortSignal) {
    return new Promise<void>((resolve, reject) => {
        if (signal.aborted) {
            reject(signal.reason)

            return
        }

        const onAbort = () => {
            clearTimeout(timer)
            reject(signal.reason)
        }

        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort)
            resolve()
        }, ms)

        signal.addEventListener('abort', onAbort, { once: true })
    })
}

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))
