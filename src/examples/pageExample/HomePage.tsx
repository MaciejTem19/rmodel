import { useRenderLog } from "../example/useRenderLog"
import { useRDataApi } from "rmodel"
import { APP_KEY } from "./dataModel"

export function HomePage() {

    const api = useRDataApi(APP_KEY)

    //The api subscribes to nothing, so this page renders once and never again.
    useRenderLog("HomePage")


    return ( 
    <div className="card">
        <div>Welcome on our page. This is main page. Lorem ipsum etc., right?</div>
        <p className="muted">Two storages, mounted one page at a time.</p>
        <button className="btn" onClick={() => api.setPage("mail")}>
            Go to Mail
        </button>
        {" "}
        <button className="btn" onClick={() => api.setPage("news")}>
            Go to News
        </button>
    </div>
    )
}