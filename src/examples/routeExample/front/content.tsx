import { useRDataApi, useRSelector, useRValue } from "rvmodel"
import { Card } from "./card"
import { useCardsKey, type CardInfo } from "./rvmodel"
import { CardsFilterBar } from "./cardsFilterBar"
import { DebugCounter } from "./debugCounter"
import { ErrorBanner } from "./errorBanner"
import { Loading } from "./loading"
import { useEffect } from "react"

export function Content() {
    const key = useCardsKey()
    // const cards = useRSelector(key, "cardsInfo")
    
    const someSelected = useRSelector(key, "toReq");
    const api = useRDataApi(key)
    // const cards = useRSelector(key, "visibleCards")
    const cards = useRValue(key, "cards")?.map(e => {
        return {
            id: e.id,
            lastCreated: e.lastClicked,
            title: e.title
        } as CardInfo
    })
    const test = useRSelector(key, "toReq")
    const test2 = useRSelector(key, "obj")
    // console.log(test)

    const error = useRValue(key, "error")
    const pending = useRValue(key, "cardsRequestPending")

    console.log(someSelected)

    useEffect(
        () => {
            console.log("reload")
            // load() returns its cancel — leaving the page mid-request calls it off
            const cancel = api.load()
            return () => {
                cancel()
                api.setValue("cardsRequestPending", true);
            }
        }, 
    [api])

    return <div className="content-page">
        <h1>To jest se aplikacja</h1>
        {/* <div>{test ? test[0].title : "nie ma"}</div> */}
        <DebugCounter />
        <ErrorBanner />
        <CardsFilterBar />
        
        {pending && !error && <Loading label="Ładowanie kart…" />}

        {cards?.length === 0 && <p className="card-muted">Nie masz jeszcze żadnych kart.</p>}

        {!pending && cards && cards.length > 0 && <div className="content-grid">
            {cards.map((card) => <Card key={card.id} card={card} />)}
        </div>}
    </div>
}
