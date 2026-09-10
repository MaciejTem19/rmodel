import { useLayoutEffect, useRef } from "react"
import { useRenderLog } from "../example/useRenderLog"
import { useRDataApi, useRRef, useRSelector, useRSetter, useRValue } from "rmodel"
import { APP_KEY, NEWS_KEY } from "./dataModel"

/**
 * The news page, on the storage <NewsApp /> mounted.
 *
 *   NewsPage       ← reads nothing: pure layout
 *   ├─ Filter      ← data.filterInput + api.clearFilter
 *   └─ Headlines   ← selectors.filterShow + refs.newsScroll
 *
 * Typing wakes both of them, and neither for the same reason: the input holds
 * the field itself, the list holds the answer worked out from it. A letter that
 * leaves the same headlines showing rerenders the input and not the list —
 * shallowEqual on the selector is what decides that.
 */
export function NewsPage() {

    useRenderLog("NewsPage")

    return (
        <div>
            <div className="page-top">
                <h2>News</h2>
                <BackHome />
            </div>

            <Filter />
            <Headlines />
        </div>
    )
}

/** The app model, written from inside the news storage — see MailPage. */
function BackHome() {

    const app = useRDataApi(APP_KEY)

    useRenderLog("BackHome (news)")

    return <button className="btn push-right" onClick={() => app.setPage("home")}>← Home</button>
}

function Filter() {

    const filterInput = useRValue(NEWS_KEY, "filterInput")
    const setFilter = useRSetter(NEWS_KEY, "filterInput")
    const api = useRDataApi(NEWS_KEY)

    //Every keystroke: this is the component holding the field itself.
    useRenderLog("Filter", { filterInput })

    return (
        <div className="filter-row">
            <input
                className="input"
                value={filterInput}
                placeholder="filter the headlines"
                onChange={(event) => setFilter(event.target.value)}
            />
            {/* An arrow field on the api, so it goes to onClick as it is. */}
            <button className="btn" onClick={api.clearFilter} disabled={filterInput === ""}>Clear</button>
        </div>
    )
}

function Headlines() {

    const headlines = useRSelector(NEWS_KEY, "filterShow")

    //A field of the storage's refs, as a real ref: writing `current` writes the
    //storage's own object, nothing is notified, and nothing rerenders for a
    //scroll. It outlives this page too — the object is the one the model was
    //built with, so leaving News and coming back finds the list where it was.
    const newsScroll = useRRef(NEWS_KEY, "newsScroll")
    const list = useRef<HTMLDivElement | null>(null)

    //A letter that leaves the same headlines showing logs nothing here: the
    //selector recomputed, shallowEqual said it was the same answer, and this
    //component was never woken. Scrolling logs nothing either — that is a ref.
    useRenderLog("Headlines", headlines)

    //Put back before the browser paints, so the jump is never seen.
    useLayoutEffect(() => {
        if (list.current) list.current.scrollTop = newsScroll.current
    }, [newsScroll])

    return (
        <div
            ref={list}
            className="headlines"
            // oxlint-disable-next-line react/immutability -- writing the refs is the point of useRRef()
            onScroll={(event) => { newsScroll.current = event.currentTarget.scrollTop }}
        >
            {headlines.length === 0 && <p className="muted">Nothing matches that.</p>}

            {headlines.map((headline) => (
                <p key={headline} className="headline">{headline}</p>
            ))}
        </div>
    )
}
