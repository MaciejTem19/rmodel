/* The model of the async example: everything the page can read, everything it
   can do, and the two rules that make an async model behave — one search in
   flight at a time, and every write in one go. */
import {
    DataApi,
    shallowEqual,
    StoreSelectors,
    storeKey,
    useRDataApi,
    useRKey,
} from 'rvmodel'
import { fetchIssues, saveIssue, type Issue } from './fakeApi'

export type Status = 'idle' | 'loading' | 'error'

export type Filter = 'all' | 'open' | 'done'

export type BoardState = {
    query: string
    issues: Issue[]
    status: Status
    error: string | null
    filter: Filter
    selectedId: number | null
    loadedAt: string | null
}

export const BOARD_DEFAULT: BoardState = {
    query: '',
    issues: [],
    status: 'idle',
    error: null,
    filter: 'all',
    selectedId: null,
    loadedAt: null,
}

/**
 * The write half. The two async ones return their cancel, so a component can
 * hand it straight to React:
 *
 *   useEffect(() => api.search(), [api])
 */
export class BoardApi extends DataApi<BoardState> {
    /** The search in flight, so the next one can call it off. */
    #cancelSearch: (() => void) | null = null

    setQuery = (query: string) => this.setValue('query', query)

    setFilter = (filter: Filter) => this.setValue('filter', filter)

    select = (selectedId: number | null) => this.setValue('selectedId', selectedId)

    /**
     * GET the list. One at a time: the search in flight is cancelled before
     * this one starts, so a slow answer to an old query can never land on top
     * of a fresh one. Cancelling first also puts the flag back before this
     * search sets it — the rollback is synchronous, so the order holds.
     */
    search = () => {
        this.#cancelSearch?.()
        this.setValues(['status', 'error'], ['loading', null])

        this.#cancelSearch = this.runTask(
            async (signal) => {
                try {
                    const issues = await fetchIssues(this.data.query, signal)

                    return { issues, status: 'idle' as const, error: null, loadedAt: stamp() }
                } catch (error) {
                    // An abort is not a failure — it is this task being called off.
                    if (signal.aborted) return

                    return { status: 'error' as const, error: message(error) }
                }
            },
            // Called off halfway: the list stays as it was, only the flag goes back.
            { status: 'idle' },
        )

        return this.#cancelSearch
    }

    cancelSearch = () => this.#cancelSearch?.()

    /**
     * An optimistic write: the row flips now, the backend hears about it after.
     * The list from before goes into both ways back — the one for a failure,
     * and the `onCancel` one for a task called off before it settled.
     */
    toggle = (id: number) => {
        const before = this.data.issues
        const done = !before.find((issue) => issue.id === id)?.done

        this.setValues({
            issues: before.map((issue) => (issue.id === id ? { ...issue, done } : issue)),
            error: null,
        })

        return this.runTask(
            async (signal) => {
                try {
                    await saveIssue(id, done, signal)

                    return
                } catch (error) {
                    if (signal.aborted) return

                    return { issues: before, error: `${message(error)} — put back` }
                }
            },
            { issues: before },
        )
    }
}

/**
 * The read half. Each one names the fields it reads, so a write to `query`
 * wakes nothing here, and the two that build a fresh object say how to tell
 * whether it actually moved.
 */
export class BoardSelectors extends StoreSelectors<BoardState> {
    visible = this.select(
        ({ issues, filter }) =>
            issues.filter((issue) => filter === 'all' || (filter === 'done') === issue.done),
        ['issues', 'filter'],
        shallowEqual,
    )

    counts = this.select(
        ({ issues }) => {
            const done = issues.filter((issue) => issue.done).length

            return { all: issues.length, done, open: issues.length - done }
        },
        ['issues'],
        shallowEqual,
    )

    selected = this.select(
        ({ issues, selectedId }) => issues.find((issue) => issue.id === selectedId) ?? null,
        ['issues', 'selectedId'],
    )

    /** A boolean out of the status: the toolbar sleeps through idle → error. */
    busy = this.select(({ status }) => status === 'loading', ['status'])
}

/** One instance per storage, built here rather than in JSX. */
export const boardApi = new BoardApi()
export const boardSelectors = new BoardSelectors()

export const BOARD_KEY = storeKey<{ data: BoardState, api: BoardApi, selectors: BoardSelectors }>('board')

/** The key of the storage this subtree sits in, carrying the board's types. */
export const useBoardKey = () => useRKey<{ data: BoardState, api: BoardApi, selectors: BoardSelectors }>()

/** The write half, for a component that acts on the data without showing it. */
export const useBoardApi = () => useRDataApi(useBoardKey())

const stamp = () => new Date().toLocaleTimeString()

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))
