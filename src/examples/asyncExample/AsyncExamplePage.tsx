import { useEffect, useState } from 'react'
import { RVModel, useRSelector, useRValue, useRValues } from 'rvmodel'
import Button from '../template/ui/Button'
import Checkbox from '../template/ui/Checkbox'
import NumberInput from '../template/ui/NumberInput'
import TextInput from '../template/ui/TextInput'
import '../template/template.css'
import { useRenderLog } from '../example/useRenderLog'
import {
    BOARD_DEFAULT,
    BOARD_KEY,
    boardApi,
    boardSelectors,
    useBoardApi,
    useBoardKey,
    type Filter,
} from './boardModel'
import { backend, type Issue } from './fakeApi'

/**
 * The same model as the first example, one step further out: the data arrives
 * from a fake backend, so every write is late, cancellable, and allowed to
 * fail. Four things are worth watching in the console while clicking around.
 *
 *   1. Search twice in a row. The first task is called off before the second
 *      starts, so a slow answer to an old query never lands on a fresh one.
 *   2. Hit Cancel mid-search. The list is untouched and the flag goes back —
 *      the task hands its data back at the end, so there is no half write to
 *      catch.
 *   3. Turn Fail on and toggle a row. The row flips at once, the failure puts
 *      it back, and both moves are one write each: one render, not two.
 *   4. Unmount the board mid-search. The storage is dropped, the task is
 *      cancelled with it, and nothing is written or thrown.
 *
 *   AsyncExamplePage      ← the mount switch and the backend knobs; reads nothing
 *   └─ Board              ← mounts the storage
 *      ├─ SearchBar       ← data.query + api.search/cancelSearch
 *      ├─ StatusLine      ← status, error, loadedAt
 *      ├─ FilterBar       ← data.filter + selectors.counts
 *      ├─ IssueList       ← selectors.visible + data.selectedId
 *      │  └─ IssueRow     ← props only
 *      └─ Details         ← selectors.selected
 */
function AsyncExamplePage() {
    const [mounted, setMounted] = useState(true)

    useRenderLog('AsyncExamplePage')

    return (
        <main className="page">
            <header className="header">
                <h1 className="title">Issue board</h1>
                <Button variant={mounted ? 'ghost' : 'primary'} onClick={() => setMounted(!mounted)}>
                    {mounted ? 'Unmount the board' : 'Mount it back'}
                </Button>
            </header>

            <BackendPanel />

            {mounted ? (
                <Board />
            ) : (
                <p className="empty">
                    Unmounted. The storage went with it, and so did anything it had in flight —
                    mount it back for a fresh one.
                </p>
            )}
        </main>
    )
}

/** Mounts the storage. Unmounting it is what drops it and cancels the tasks. */
function Board() {
    useRenderLog('Board')

    return (
        <RVModel
            storageKey={BOARD_KEY}
            defaultValue={BOARD_DEFAULT}
            dataApi={boardApi}
            selectors={boardSelectors}
        >
            <SearchBar />
            <StatusLine />
            <FilterBar />
            <IssueList />
            <Details />
        </RVModel>
    )
}

function SearchBar() {
    const query = useRValue(useBoardKey(), 'query')
    const busy = useRSelector(useBoardKey(), 'busy')
    const api = useBoardApi()

    useRenderLog('SearchBar', { query, busy })

    // search() hands back its own cancel, which is exactly what React wants a
    // cleanup to be: leave the page mid-request and the request is called off.
    useEffect(() => api.search(), [api])

    return (
        <form
            className="row"
            onSubmit={(event) => {
                event.preventDefault()
                api.search()
            }}
        >
            <TextInput
                value={query}
                onValueChange={api.setQuery}
                placeholder="title, author or tag…"
            />
            <Button type="submit" variant="primary">
                Search
            </Button>
            <Button disabled={!busy} onClick={api.cancelSearch}>
                Cancel
            </Button>
        </form>
    )
}

/** The three fields that say what the last round trip did. */
function StatusLine() {
    const { status, error, loadedAt } = useRValues(useBoardKey(), [
        'status',
        'error',
        'loadedAt',
    ])

    useRenderLog('StatusLine', { status, error, loadedAt })

    if (status === 'loading') return <p className="empty">Loading…</p>

    if (status === 'error') return <p className="empty">⚠ {error}</p>

    return (
        <p className="empty">
            {error ? `⚠ ${error}` : loadedAt ? `Loaded at ${loadedAt}` : 'Nothing loaded yet'}
        </p>
    )
}

const FILTERS: Filter[] = ['all', 'open', 'done']

function FilterBar() {
    const filter = useRValue(useBoardKey(), 'filter')
    const counts = useRSelector(useBoardKey(), 'counts')
    const api = useBoardApi()

    useRenderLog('FilterBar', { filter, ...counts })

    return (
        <div className="row toolbar">
            {FILTERS.map((name) => (
                <Button
                    key={name}
                    variant={filter === name ? 'primary' : 'ghost'}
                    onClick={() => api.setFilter(name)}
                >
                    {name}
                </Button>
            ))}
            <span className="label push-right">
                {counts.open} open · {counts.done} done
            </span>
        </div>
    )
}

function IssueList() {
    // A fresh array on every recompute, so shallowEqual is what keeps this list
    // still when a write leaves the same rows in the same order.
    const issues = useRSelector(useBoardKey(), 'visible')
    const selectedId = useRValue(useBoardKey(), 'selectedId')

    useRenderLog('IssueList', issues.map((issue) => issue.id))

    if (!issues.length) return <p className="empty">No issues match.</p>

    return (
        <ul className="list">
            {issues.map((issue) => (
                <IssueRow key={issue.id} issue={issue} selected={issue.id === selectedId} />
            ))}
        </ul>
    )
}

/** Props only — the row is handed everything it shows. */
function IssueRow({ issue, selected }: { issue: Issue; selected: boolean }) {
    const api = useBoardApi()

    useRenderLog('IssueRow', { id: issue.id, done: issue.done, selected })

    return (
        <li className={`item${issue.done ? ' item-done' : ''}`}>
            <Checkbox checked={issue.done} onCheckedChange={() => api.toggle(issue.id)} />
            <span className="item-name">{issue.title}</span>
            <span className="label">{issue.tag}</span>
            <Button
                variant={selected ? 'primary' : 'ghost'}
                onClick={() => api.select(selected ? null : issue.id)}
            >
                {selected ? 'Hide' : 'Open'}
            </Button>
        </li>
    )
}

function Details() {
    const issue = useRSelector(useBoardKey(), 'selected')

    useRenderLog('Details', issue && { id: issue.id })

    if (!issue) return <p className="stats">Nothing selected.</p>

    return (
        <footer className="stats">
            #{issue.id} · {issue.title} — {issue.author} · {issue.tag} ·{' '}
            {issue.done ? 'done' : 'open'}
        </footer>
    )
}

/**
 * The knobs on the fake backend. They are module state, not model state — the
 * store holds what the page is about, not how the network is behaving today.
 */
function BackendPanel() {
    const [latency, setLatency] = useState(backend.latency)
    const [failing, setFailing] = useState(backend.failing)

    useRenderLog('BackendPanel')

    return (
        <div className="row toolbar">
            <label className="field">
                <span className="label">Latency</span>
                <NumberInput
                    value={latency}
                    step={100}
                    min={0}
                    onValueChange={(value) => {
                        backend.latency = value
                        setLatency(value)
                    }}
                />
            </label>
            <label className="field">
                <span className="label">Fail every call</span>
                <Checkbox
                    checked={failing}
                    onCheckedChange={(value) => {
                        backend.failing = value
                        setFailing(value)
                    }}
                />
            </label>
        </div>
    )
}

export default AsyncExamplePage
