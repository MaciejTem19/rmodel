import { DataApi, shallowEqual, storeKey, StoreSelectors } from "rvmodel"

//App model

export type AppData = {
    accountName: string | undefined
    language: "english" | "polish"
    page: "home" | "news" | "mail" 
}

export class AppDataApi extends DataApi<AppData> {

    toogleLanguage() {
        this.updateValue("language", (l) => l == "english" ? "polish" : "english")
    }
    setPage(page: "home" | "news" | "mail") {
        this.setValue("page", page)
    }
}

export const APP_KEY = storeKey<{
    api: AppDataApi,
    data: AppData
}>("app")

//News model

export type NewsData = {

    newsHeadlines: string[]
    filterInput: string
}

export type NewsRefs = {
    newsScroll: number
}

export class NewsDataApi extends DataApi<NewsData, NewsRefs> {

    clearFilter = () => {
        this.setValue("filterInput", "")
    }
}

export class NewsSelector extends StoreSelectors<NewsData, NewsRefs> {

    // A fresh array on every recompute, so it needs a comparison of its own:
    // shallowEqual is what keeps a write that leaves the same headlines showing
    // from rerendering the list.
    filterShow = this.select(({ newsHeadlines, filterInput }) => {

        const target = filterInput.trim().toLowerCase()

        // Nothing typed, nothing to filter — and the list itself comes back, so
        // clearing the input costs no new array either.
        if (target === "") return newsHeadlines

        return newsHeadlines.filter((headline) => headline.toLowerCase().includes(target))

    }, ["filterInput", "newsHeadlines"], shallowEqual)
}

export const NEWS_KEY = storeKey<{
    data: NewsData,
    api: NewsDataApi,
    refs: NewsRefs,
    selectors: NewsSelector
}>("news")



//Mail model

export type Mail = {
    id: number
    from: string
    subject: string
}

export type MailData = {

    inbox: Mail[]
    openedId: number | null
    /** The body of the opened mail, or null while it is still on its way. */
    body: string | null
}

export type MailRefs = {

    /** The body request still in flight, so opening another mail calls it off. */
    cancelBody: (() => void) | null
}

export class MailDataApi extends DataApi<MailData, MailRefs> {

    /**
     * Opening a mail is two things happening at two speeds. Which row is open
     * is known right now, so it is written right now; the body has to be
     * fetched, so setValueByTask() writes it when it arrives — and writes
     * nothing at all if this open was called off first.
     */
    open = (id: number) => {

        //The row now, and the body back to "on its way" — the selector below
        //reads that null rather than a loading flag someone has to keep in step.
        this.setValues({ openedId: id, body: null })

        //The cancel of the previous body, kept in the refs: clicking through the
        //inbox quickly must not let a slow answer land on a mail you left.
        this.refs.cancelBody?.()
        this.refs.cancelBody = this.setValueByTask("body", async (signal) => {

            try {
                return await fetchBody(id, signal)
            }
            catch (error) {

                //An abort is this open being called off, not a failure: the
                //write is dropped either way, so there is nothing to show.
                if (signal.aborted) throw error

                return "Could not load this message."
            }
        })
    }

    close = () => {

        this.refs.cancelBody?.()
        this.refs.cancelBody = null

        this.setValues({ openedId: null, body: null })
    }
}

export class MailSelector extends StoreSelectors<MailData, MailRefs> {

    /** The row that is open, or null — the list and the id in one answer. */
    openedMail = this.select(
        ({ inbox, openedId }) => inbox.find(({ id }) => id === openedId) ?? null,
        ["inbox", "openedId"],
    )

    /** Something is open and its body has not arrived yet. */
    loadingBody = this.select(
        ({ openedId, body }) => openedId !== null && body === null,
        ["openedId", "body"],
    )
}

export const MAIL_KEY = storeKey<{
    data: MailData
    api: MailDataApi
    selectors: MailSelector
    refs: MailRefs
}>("mail")

/**
 * What the fake backend has to serve: one body per row of the inbox, kept out
 * of the data on purpose. A list is what the page shows at once, a body is what
 * it asks for when you open one — which is the whole reason there is a task
 * here rather than another field of MAIL_DEF.
 */
const BODIES: Record<number, string> = {

    1: "A selector is woken by the fields it depends on, and a ref is not one of "
        + "them. Read one from a selector all you like — just do not expect it to "
        + "be the reason anything recomputes.",

    2: "Third time this week. The <RVModel /> above it unmounted, so the storage "
        + "went with it, and every write since has been saying so. Try remember, "
        + "or stop unmounting the thing.",

    3: "setValues() writes them all in one go: one notification, one render, "
        + "however many fields it names. Two setValue() calls in a row are two "
        + "renders, and the page flickers through a state that never really was.",
}

/** How long the fake backend takes to answer, in ms. Long enough that opening a
 *  mail visibly waits for its body — which is the state the task is there for. */
const LATENCY = 1000

/**
 * A stand-in for GET /mail/:id — it serves out of BODIES a second after it was
 * asked, and it stops when the caller gives up: rejecting on abort is what a
 * real fetch() does, and it is what lets a cancelled open drop its work instead
 * of finishing it for nobody. An id nothing was written for is the 404, and it
 * is what the catch in open() is there to show.
 */
function fetchBody(id: number, signal: AbortSignal): Promise<string> {

    return new Promise<string>((resolve, reject) => {

        const timer = setTimeout(() => {

            const body = BODIES[id]

            if (body === undefined) reject(new Error(`no message ${id}`))
            else resolve(body)

        }, LATENCY)

        signal.addEventListener("abort", () => {

            clearTimeout(timer)
            reject(signal.reason)

        }, { once: true })
    })
}


//singletons and defaults

//One instance per storage, built here rather than in the JSX: <RVModel /> reads
//each of them once, when it creates the storage, so they have to be stable
//objects. A part belongs to the one storage it was attached to.

export const APP_DEF = {accountName: "", language: "english", page: "home"} as AppData
export const APP_API = new AppDataApi();


//Nothing typed into the filter to start with, so filterShow hands the whole
//list straight back until someone does.
export const NEWS_DEF = {
    filterInput: "",
    newsHeadlines: [
        "Storage dropped mid-write, nobody notices for a week",
        "Local weather model rerenders on every keystroke",
        "Selectors declared to be the calm ones after all",
        "Refs seen leaving the render pass without a word",
        "Weather warning: heavy re-render expected by Friday",
        "Council votes to keep the draft across unmounts",
        "One write, one render — organisers call turnout modest",
        "Task cancelled halfway, arrives anyway, is turned away",
    ],
} as NewsData

export const NEWS_API = new NewsDataApi()
export const NEWS_SELECTOR = new NewsSelector()

//The refs are the one object the whole subtree writes into — read once, then
//written in place — so a fresh one per render would throw away the scroll
//position someone already put there.
export const NEWS_REFS: NewsRefs = { newsScroll: 0 }


export const MAIL_DEF: MailData = {

    inbox: [
        { id: 1, from: "ada", subject: "Selectors do not wake for refs" },
        { id: 2, from: "grace", subject: "Your storage was dropped again" },
        { id: 3, from: "linus", subject: "One write, one render" },
    ],
    //Nothing open to start with, and so nothing to fetch a body for.
    openedId: null,
    body: null,
}

export const MAIL_API = new MailDataApi()
export const MAIL_SELECTOR = new MailSelector()

//The cancel of the body request in flight lives here: nothing renders from it,
//and open() writes it in place every time it starts one.
export const MAIL_REFS: MailRefs = { cancelBody: null }