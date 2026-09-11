import { RVModel, useRDataApi, useRValue } from "rvmodel";
import { useRenderLog } from "../example/useRenderLog";
import "./page.css";
import { APP_API, APP_DEF, APP_KEY, MAIL_API, MAIL_DEF, MAIL_KEY, MAIL_REFS, MAIL_SELECTOR, NEWS_API, NEWS_DEF, NEWS_KEY, NEWS_REFS, NEWS_SELECTOR } from "./dataModel";
import { HomePage } from "./HomePage";
import { MailPage } from "./MailPage";
import { NewsPage } from "./NewsPage";

export function PageApp() {

    //The spine: it mounts the app storage and reads nothing out of it, so this
    //logs once and stays put however much the pages below move.
    useRenderLog("PageApp")

    return (<>
        <RVModel
            storageKey={APP_KEY} 
            defaultValue={APP_DEF}
            dataApi={APP_API}
            remember
        >
            <div className="site">
                <Nav />
                {<Router />}
            </div>
        </RVModel>
    </>)

}

/**
 * The way back out of a page, and the only place the app model is written from.
 * It reads `page` to say which button you are standing on — one field, so
 * nothing here rerenders for anything the news or the mail storage does.
 */
function Nav() {

    const page = useRValue(APP_KEY, "page")
    const language = useRValue(APP_KEY, "language")
    const api = useRDataApi(APP_KEY)

    useRenderLog("Nav", { page, language })

    return (
        <nav className="site-nav">
            {(["home", "news", "mail"] as const).map((name) => (
                <button
                    key={name}
                    className="btn"
                    aria-current={page === name}
                    onClick={() => api.setPage(name)}
                >
                    {name}
                </button>
            ))}

            {/* Wrapped in an arrow because setPage and toogleLanguage are plain
                methods rather than arrow fields: handed to onClick as they are,
                they would lose their `this`. */}
            <button className="btn push-right" onClick={() => api.toogleLanguage()}>
                {language}
            </button>
        </nav>
    )
}

function Router() {

    const page = useRValue(APP_KEY, "page")

    useRenderLog("Router", { page })

    if (page == "news") return <NewsApp />
    else if (page == "mail") return <MailApp />
    else return <HomePage />
}


export function MailApp() {

    useRenderLog("MailApp")

    return <RVModel
        storageKey={MAIL_KEY}
        defaultValue={MAIL_DEF}
        dataApi={MAIL_API}
        refs={MAIL_REFS}
        selectors={MAIL_SELECTOR}
        remember
    >
        <MailPage />
    </RVModel>

}

export function NewsApp() {

    useRenderLog("NewsApp")

    return <RVModel
        storageKey={NEWS_KEY}
        defaultValue={NEWS_DEF}
        dataApi={NEWS_API}
        refs={NEWS_REFS}
        selectors={NEWS_SELECTOR}
        remember
    >
        <NewsPage />
    </RVModel>

}

