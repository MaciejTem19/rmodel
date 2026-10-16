import { BrowserRouter, Navigate, Route, Routes } from "react-router"
import { RVModel } from "rvmodel"
import { CardDetails } from "./cardDetails"
import { AddCardModal, EditCardModal } from "./cardModals"
import { CARDS_DEFAULT, CARDS_KEY, cardsApi, cardsSelectors } from "./rvmodel"
import { Content } from "./content"
import { SideBar } from "./sideBar"

/* Every component reads what it needs from the model itself — nothing is
   passed down as props except which card a list item is.

     MainPage         ← mounts the cards storage; reads nothing
     └─ CardsApp      ← lays out the page; reads nothing
        ├─ SideBar        ← user
        ├─ Content        ← starts the load; cards, error (route /)
        │  └─ Card        ← its card (prop)
        ├─ CardDetails    ← cards, details*, error    (route /cards/:id)
        ├─ AddCardModal   ← selectors.isAddOpen
        └─ EditCardModal  ← selectors.editing, editText */
export function MainPage() {
    return <RVModel
        storageKey={CARDS_KEY}
        defaultValue={CARDS_DEFAULT}
        dataApi={cardsApi}
        selectors={cardsSelectors}
    >
        <BrowserRouter>
            <CardsApp />
        </BrowserRouter>
    </RVModel>
}

function CardsApp() {
    return <div className="main-page">
        <SideBar />

        <Routes>
            <Route path="/" element={<Content />} />
            <Route path="/cards/:id" element={<CardDetails />} />
            <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>

        <AddCardModal />
        <EditCardModal />
    </div>
}
