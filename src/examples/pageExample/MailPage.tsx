import { useRenderLog } from "../example/useRenderLog"
import { useRDataApi, useRSelector, useRValue } from "rmodel"
import { APP_KEY, MAIL_KEY } from "./dataModel"

/**
 * The mail page, on the storage <MailApp /> mounted.
 *
 *   MailPage      ← reads nothing: pure layout
 *   ├─ Inbox      ← data.inbox + data.openedId + api.open
 *   └─ Reader     ← selectors.openedMail, selectors.loadingBody, data.body
 *
 * The two halves move at different speeds, which is the whole point of the
 * model underneath: clicking a row writes `openedId` at once, and the body of
 * that mail is written a second later, by the task api.open() started.
 */
export function MailPage() {

    useRenderLog("MailPage")

    return (
        <div>
            <div className="page-top">
                <h2>Inbox</h2>
                <BackHome />
            </div>

            <Inbox />
            <Reader />
        </div>
    )
}

/**
 * Written to the app storage from inside the mail one: a key is looked up in
 * the registry rather than in the nearest <RModel /> above, so the page below
 * reaches the model that mounted it without anything being handed down.
 */
function BackHome() {

    const app = useRDataApi(APP_KEY)

    useRenderLog("BackHome (mail)")

    return <button className="btn push-right" onClick={() => app.setPage("home")}>← Home</button>
}

function Inbox() {

    const inbox = useRValue(MAIL_KEY, "inbox")
    const openedId = useRValue(MAIL_KEY, "openedId")
    const api = useRDataApi(MAIL_KEY)

    //Wakes for the list and for which row is open — never for the body, which
    //is the field that lands a second later.
    useRenderLog("Inbox", { openedId, mails: inbox.length })

    return (
        <ul className="inbox">
            {inbox.map((mail) => (
                <li key={mail.id}>
                    {/* One click, one open: the previous body request is called
                        off inside open(), so clicking through the list fast
                        cannot leave an older answer on a newer mail. */}
                    <button
                        className="inbox-row"
                        onClick={() => api.open(mail.id)}
                        disabled={mail.id === openedId}
                    >
                        <span className="inbox-from">{mail.from}</span>
                        {mail.subject}
                    </button>
                </li>
            ))}
        </ul>
    )
}

function Reader() {

    //Which mail is open comes from a selector rather than from the two fields
    //it is worked out from: this rerenders when the row changes, not when the
    //id and the list each move.
    const opened = useRSelector(MAIL_KEY, "openedMail")
    const loading = useRSelector(MAIL_KEY, "loadingBody")
    const body = useRValue(MAIL_KEY, "body")
    const api = useRDataApi(MAIL_KEY)

    //Two lines per open: one for the click, one when the body arrives.
    useRenderLog("Reader", { opened: opened?.subject ?? null, loading, body })

    if (opened === null) return <p className="muted">Pick a message to read it.</p>

    return (
        <article className="reader">
            <h3>{opened.subject}</h3>
            <p className="muted">from {opened.from}</p>

            {/* No loading flag in the data: `body` being null while a mail is
                open is what "still on its way" means, and loadingBody is that
                question asked once, in the model. */}
            <div className="reader-body">
                {loading ? <p className="loading">loading the body…</p> : <p>{body}</p>}
            </div>

            <button className="btn" onClick={api.close}>Close</button>
        </article>
    )
}
