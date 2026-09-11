import { useEffect, useState } from 'react'
import { RVModel, useRSelector, useRValue, useRValues } from 'rvmodel'
import Button from '../template/ui/Button'
import TextInput from '../template/ui/TextInput'
import '../template/template.css'
import './mail.css'
import { useRenderLog } from '../example/useRenderLog'
import { network, type Thread } from './mailApi'
import {
    MAILBOX_DEFAULT,
    MAILBOX_KEY,
    mailboxApi,
    mailboxSelectors,
    pushRunning,
    startPush,
    stopPush,
    useMailboxApi,
    useMailboxKey,
    watchTitle,
    type Folder,
} from './mailboxModel'
import {
    COMPOSER_DEFAULT,
    COMPOSER_KEY,
    composerApi,
    useComposerApi,
    useComposerKey,
} from './composerModel'

/**
 * A small mail client, written the way an app would be — and every part of the
 * library ends up used because a mail client needs all of them.
 *
 *   MailApp            ← mounts the mailbox storage; reads nothing
 *   └─ Mailbox         ← runs the load and the title reaction; reads nothing
 *      ├─ Toolbar      ← data.query, data.status
 *      ├─ Sidebar      ← data.folder + selectors.tallies
 *      ├─ ThreadList   ← selectors.visible + data.openId
 *      │  └─ ThreadRow ← props only
 *      ├─ Reader       ← selectors.open
 *      ├─ ComposerPanel← its own storage, mounted with remember
 *      │  └─ Composer  ← sending, sentAt, error
 *      │     ├─ ToField / SubjectField / BodyField   ← one field each
 *      └─ StatusBar    ← status, error + selectors.unread
 *
 * Open the console and watch the [render] lines while you use it:
 *
 *   · Type in the search box — only Toolbar renders. The list, the reader and
 *     the composer sit still.
 *   · Type in the composer — only that one field renders. The mailbox next to
 *     it does not know anything happened.
 *   · Star a thread — that row renders, and the sidebar, because a tally moved.
 *     The other rows do not.
 *   · Let a message arrive (Live) — the list and the sidebar render; the reader
 *     and the composer do not.
 *   · Press Send, then Undo — nothing was written, the draft is untouched.
 *   · Close the composer mid-send — remember keeps both the draft and the send.
 */
function MailApp() {
    useRenderLog('MailApp')

    return (
        <RVModel
            storageKey={MAILBOX_KEY}
            defaultValue={MAILBOX_DEFAULT}
            dataApi={mailboxApi}
            selectors={mailboxSelectors}
        >
            <Mailbox />
        </RVModel>
    )
}

/** The frame. It reads nothing, so it renders once and then sits out the app. */
function Mailbox() {
    const api = useMailboxApi()

    useRenderLog('Mailbox')

    // load() hands back its own cancel, which is exactly what React wants a
    // cleanup to be: leave the mailbox mid-request and the request is called off.
    useEffect(() => api.load(), [api])

    // A reaction rather than a render: the tab title follows the unread count
    // without any component holding it.
    useEffect(() => watchTitle(), [])

    return (
        <div className="mail">
            <Toolbar />
            <div className="mail-body">
                <Sidebar />
                <main className="mail-main">
                    <ThreadList />
                    <Reader />
                    <ComposerPanel />
                </main>
            </div>
            <StatusBar />
        </div>
    )
}

function Toolbar() {
    const query = useRValue(useMailboxKey(), 'query')
    const status = useRValue(useMailboxKey(), 'status')
    const api = useMailboxApi()

    // Not model data: how the fake network behaves belongs to the demo, not to
    // the mailbox.
    const [live, setLive] = useState(pushRunning())
    const [offline, setOffline] = useState(network.offline)

    useRenderLog('Toolbar', { query, status })

    return (
        <div className="mail-top">
            <h1 className="mail-title">Inbox</h1>

            <form
                className="row"
                onSubmit={(event) => {
                    event.preventDefault()
                    api.load()
                }}
            >
                <TextInput value={query} onValueChange={api.setQuery} placeholder="Search mail…" />
                <Button type="submit" variant="primary">
                    Search
                </Button>
            </form>

            <Button disabled={status !== 'loading'} onClick={api.cancelLoad}>
                Cancel
            </Button>

            <Button
                className="push-right"
                variant={live ? 'primary' : 'ghost'}
                onClick={() => {
                    if (live) stopPush()
                    else startPush()

                    setLive(!live)
                }}
            >
                {live ? 'Live · on' : 'Live · off'}
            </Button>

            <Button
                variant={offline ? 'primary' : 'ghost'}
                onClick={() => {
                    network.offline = !offline

                    // Pulling the plug calls off whatever the mailbox has in
                    // flight, rather than leaving it to time out into an error.
                    if (network.offline) api.cancelTasks()

                    setOffline(!offline)
                }}
            >
                {offline ? 'Offline' : 'Online'}
            </Button>
        </div>
    )
}

const FOLDERS: Folder[] = ['inbox', 'unread', 'starred', 'sent']

function Sidebar() {
    const folder = useRValue(useMailboxKey(), 'folder')
    const tallies = useRSelector(useMailboxKey(), 'tallies')
    const api = useMailboxApi()

    useRenderLog('Sidebar', { folder, ...tallies })

    return (
        <nav className="mail-side">
            {FOLDERS.map((name) => (
                <button
                    key={name}
                    className={`folder${folder === name ? ' folder-on' : ''}`}
                    onClick={() => api.setFolder(name)}
                >
                    {name}
                    <span className="badge">{tallies[name]}</span>
                </button>
            ))}
        </nav>
    )
}

function ThreadList() {
    // A fresh array on every recompute, so shallowEqual is what keeps the list
    // still when a write leaves the same threads in the same order.
    const threads = useRSelector(useMailboxKey(), 'visible')
    const openId = useRValue(useMailboxKey(), 'openId')

    useRenderLog('ThreadList', threads.map((thread) => thread.id))

    if (!threads.length) return <p className="hint">Nothing here.</p>

    return (
        <ul className="threads">
            {threads.map((thread) => (
                <ThreadRow key={thread.id} thread={thread} open={thread.id === openId} />
            ))}
        </ul>
    )
}

/** Props only — the row is handed everything it shows. */
function ThreadRow({ thread, open }: { thread: Thread; open: boolean }) {
    const api = useMailboxApi()

    useRenderLog('ThreadRow', { id: thread.id, read: thread.read, starred: thread.starred })

    return (
        <li
            className={`thread${thread.read ? '' : ' thread-unread'}${open ? ' thread-on' : ''}`}
            onClick={() => api.open(open ? null : thread.id)}
        >
            <button
                className="star"
                onClick={(event) => {
                    event.stopPropagation()
                    api.toggleStar(thread.id)
                }}
            >
                {thread.starred ? '★' : '☆'}
            </button>
            <span className="thread-from">{thread.from}</span>
            <span className="thread-subject">
                {thread.subject} <span className="thread-preview">— {thread.preview}</span>
            </span>
            <span className="thread-at">{thread.at}</span>
        </li>
    )
}

function Reader() {
    const thread = useRSelector(useMailboxKey(), 'open')

    useRenderLog('Reader', thread && { id: thread.id })

    if (!thread) return <p className="hint">Open a thread to read it.</p>

    return (
        <article className="reader">
            <h2 className="reader-subject">{thread.subject}</h2>
            <span className="label">
                {thread.from} · {thread.at}
            </span>
            <p className="reader-body">{thread.preview}</p>
        </article>
    )
}

/**
 * The composer window. Its storage is mounted with `remember`, so closing it
 * keeps the draft — and keeps a send already on its way, instead of calling it
 * off the way an unmount normally would.
 */
function ComposerPanel() {
    const [open, setOpen] = useState(false)

    useRenderLog('ComposerPanel', { open })

    return (
        <>
            <div className="row">
                <Button variant={open ? 'ghost' : 'primary'} onClick={() => setOpen(!open)}>
                    {open ? 'Close composer' : 'Compose'}
                </Button>
                {!open && <span className="hint">Closing keeps the draft — remember is on.</span>}
            </div>

            {open && (
                <RVModel
                    storageKey={COMPOSER_KEY}
                    defaultValue={COMPOSER_DEFAULT}
                    dataApi={composerApi}
                    remember
                >
                    <Composer />
                </RVModel>
            )}
        </>
    )
}

function Composer() {
    const { sending, sentAt, error } = useRValues(useComposerKey(), [
        'sending',
        'sentAt',
        'error',
    ])
    const api = useComposerApi()

    useRenderLog('Composer', { sending, sentAt, error })

    return (
        <section className="composer">
            <ToField />
            <SubjectField />
            <BodyField />

            <div className="row">
                {sending ? (
                    <>
                        <Button variant="primary" onClick={api.undo}>
                            Undo send
                        </Button>
                        <span className="hint">Sending… four seconds to change your mind.</span>
                    </>
                ) : (
                    <>
                        <Button variant="primary" onClick={api.send}>
                            Send
                        </Button>
                        <Button onClick={api.discard}>Discard</Button>
                    </>
                )}
                {error && <span className="hint">⚠ {error}</span>}
                {!error && sentAt && <span className="hint">Sent at {sentAt}</span>}
            </div>
        </section>
    )
}

/* One component per field: a keystroke in one of them renders that one and
   nothing else — not its siblings, and not the mailbox next door. */

function ToField() {
    const to = useRValue(useComposerKey(), 'to')
    const api = useComposerApi()

    useRenderLog('ToField', { to })

    return (
        <label className="field">
            <span className="label">To</span>
            <TextInput value={to} onValueChange={api.setTo} placeholder="ada@example.com" />
        </label>
    )
}

function SubjectField() {
    const subject = useRValue(useComposerKey(), 'subject')
    const api = useComposerApi()

    useRenderLog('SubjectField', { subject })

    return (
        <label className="field">
            <span className="label">Subject</span>
            <TextInput value={subject} onValueChange={api.setSubject} placeholder="Subject" />
        </label>
    )
}

function BodyField() {
    const body = useRValue(useComposerKey(), 'body')
    const api = useComposerApi()

    useRenderLog('BodyField', { body })

    return (
        <textarea
            className="composer-body"
            value={body}
            placeholder="Write something…"
            onChange={(event) => api.setBody(event.target.value)}
        />
    )
}

function StatusBar() {
    const { status, error } = useRValues(useMailboxKey(), ['status', 'error'])
    // Just the number: this line sleeps through a star being flipped, because
    // flipping one does not change how many are unread.
    const unread = useRSelector(useMailboxKey(), 'unread')

    useRenderLog('StatusBar', { status, error, unread })

    return (
        <div className="statusbar">
            {status === 'loading' && <span>Loading…</span>}
            {status === 'error' && <span>⚠ {error}</span>}
            {status === 'idle' && <span>{unread} unread</span>}
            {status === 'idle' && error && <span>· ⚠ {error}</span>}
        </div>
    )
}

export default MailApp
