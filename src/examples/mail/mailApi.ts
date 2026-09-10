/* The server side of the mail app, faked. Latency, an offline switch and abort
   support, so the model has something to be async about. Nothing here knows
   about the store — it is the seam a real fetch() would sit behind. */

export type Thread = {
    id: number
    from: string
    subject: string
    preview: string
    at: string
    read: boolean
    starred: boolean
    folder: 'inbox' | 'sent'
}

/** What the toolbar's switches turn. */
export const network = {
    latency: 700,
    offline: false,
}

const INBOX: Thread[] = [
    thread(1, 'Ada Lovelace', 'Re: the selector recomputes twice', 'It only renders once, though — the second run is React checking whether the snapshot moved.'),
    thread(2, 'Grace Hopper', 'Release notes for 0.4', 'Storage is dropped on unmount unless you pass remember. Draft attached.'),
    thread(3, 'Linus T.', 'That rerender you asked about', 'The row reads nothing from the store, so it sits still while the list around it moves.'),
    thread(4, 'CI', 'Build #482 passed', 'tsc clean, 0 warnings, 198 kB gzipped.'),
    thread(5, 'Barbara Liskov', 'Substitution, again', 'Every part is written against the data, never against the store it happens to sit in.'),
]

const SENT: Thread[] = [
    { ...thread(90, 'me', 'Re: Release notes for 0.4', 'Sending it your way this afternoon.'), folder: 'sent', read: true },
]

let nextId = 100

/** GET /threads?query= */
export function fetchThreads(query: string, signal: AbortSignal): Promise<Thread[]> {
    const wanted = query.trim().toLowerCase()

    return call(signal, () =>
        [...INBOX, ...SENT]
            .filter(({ from, subject, preview }) =>
                !wanted || `${from} ${subject} ${preview}`.toLowerCase().includes(wanted),
            )
            .map((row) => ({ ...row })),
    )
}

/** PATCH /threads/:id */
export function saveThread(id: number, changes: Partial<Thread>, signal: AbortSignal) {
    return call(signal, () => {
        const row = INBOX.find((item) => item.id === id) ?? SENT.find((item) => item.id === id)

        if (row) Object.assign(row, changes)
    })
}

/** POST /messages */
export function sendMail(
    to: string,
    subject: string,
    body: string,
    signal: AbortSignal,
): Promise<Thread> {
    return call(signal, () => {
        const sent: Thread = {
            ...thread(nextId++, 'me', subject || '(no subject)', body.slice(0, 90)),
            folder: 'sent',
            read: true,
        }

        SENT.unshift({ ...sent, from: to })

        return sent
    })
}

/** The next message the mailbox will "receive" while the app is live. */
export function nextIncoming(): Thread {
    const [from, subject, preview] = INCOMING[Math.floor(Math.random() * INCOMING.length)]
    const fresh = thread(nextId++, from, subject, preview)

    INBOX.unshift({ ...fresh })

    return fresh
}

const INCOMING: [string, string, string][] = [
    ['Ada Lovelace', 'One more thing', 'setValues writes both fields in one go — one notification, one render.'],
    ['CI', 'Build failed', 'The task threw. It is a rejection, not a swallowed error.'],
    ['Grace Hopper', 'Draft kept?', 'Close the composer and open it again — remember holds the draft.'],
    ['Linus T.', 'Undo send', 'Four seconds is plenty. The cancel is the same function React uses as a cleanup.'],
]

function thread(id: number, from: string, subject: string, preview: string): Thread {
    return {
        id,
        from,
        subject,
        preview,
        at: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        read: false,
        starred: false,
        folder: 'inbox',
    }
}

/**
 * One round trip: it takes `network.latency`, it fails while the app is
 * "offline", and it rejects with the signal's own reason when the caller gives
 * up — which is what lets a cancelled task stop instead of finishing work
 * nobody will read.
 */
function call<R>(signal: AbortSignal, produce: () => R): Promise<R> {
    return new Promise<R>((resolve, reject) => {
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

            if (network.offline) {
                reject(new Error('offline — no connection'))

                return
            }

            resolve(produce())
        }, network.latency)

        signal.addEventListener('abort', onAbort, { once: true })
    })
}
