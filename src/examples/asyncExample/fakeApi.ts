/* A stand-in for a backend: latency, abort support and a failure switch. It
   knows nothing about the store — it is the seam a real fetch() would sit
   behind, so the model can be written against something that answers late,
   fails, and can be called off halfway. */

export type Issue = {
    id: number
    title: string
    author: string
    tag: 'bug' | 'chore' | 'feature'
    done: boolean
}

/** Knobs the page turns to make the "network" behave. */
export const backend = {
    /** How long every call takes, in ms. */
    latency: 1200,
    /** While on, every call fails once its latency is up. */
    failing: false,
}

/** The rows the fake backend serves. saveIssue() writes into them. */
const TABLE: Issue[] = [
    { id: 1, title: 'Selector fires twice on a batched write', author: 'ada', tag: 'bug', done: false },
    { id: 2, title: 'Document the remember prop', author: 'linus', tag: 'chore', done: true },
    { id: 3, title: 'Cancel in-flight tasks on unmount', author: 'ada', tag: 'feature', done: false },
    { id: 4, title: 'Split RVModel into modules', author: 'grace', tag: 'chore', done: true },
    { id: 5, title: 'Throw instead of returning undefined', author: 'grace', tag: 'feature', done: false },
    { id: 6, title: 'Row re-renders when a sibling changes', author: 'linus', tag: 'bug', done: false },
]

/** GET /issues?query= */
export function fetchIssues(query: string, signal: AbortSignal): Promise<Issue[]> {
    const wanted = query.trim().toLowerCase()

    return call(signal, () =>
        TABLE.filter(({ title, author, tag }) =>
            !wanted || `${title} ${author} ${tag}`.toLowerCase().includes(wanted),
        ).map((issue) => ({ ...issue })),
    )
}

/** PATCH /issues/:id { done } */
export function saveIssue(id: number, done: boolean, signal: AbortSignal): Promise<void> {
    return call(signal, () => {
        const row = TABLE.find((issue) => issue.id === id)

        if (row) row.done = done
    })
}

/**
 * One round trip: it takes `backend.latency`, it rejects with the signal's own
 * reason when the caller gives up, and it rejects with a 500 while the failure
 * switch is on. Rejecting on abort is what a real fetch() does, and it is what
 * lets a cancelled task stop instead of finishing work nobody will read.
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

            if (backend.failing) {
                reject(new Error('500 — the backend is having a moment'))

                return
            }

            resolve(produce())
        }, backend.latency)

        signal.addEventListener('abort', onAbort, { once: true })
    })
}
