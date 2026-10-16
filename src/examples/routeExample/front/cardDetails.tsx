import { useEffect } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useROn, useRValues } from 'rvmodel'
import { cardImageUrl } from './cardApi'
import { confirmDelete, formatDate } from './cardUtils'
import { useCardsApi, useCardsKey } from './rvmodel'
import { ErrorBanner } from './errorBanner'
import { Loading } from './loading'
import './palette.css'
import './cards.css'

// Route: /cards/:id
export function CardDetails() {
    const key = useCardsKey()
    const api = useCardsApi()
    const navigate = useNavigate()

    const cardId = Number(useParams().id)
    const { cards, detailsId, detailsText } = useRValues(key, ['cards', 'detailsId', 'detailsText'])
    const card = cards?.find((c) => c.id === cardId)
    const exists = card !== undefined

    // Fetches the text; the cancel it returns is the cleanup when the id changes or the page is left
    useEffect(() => (exists ? api.openDetails(cardId) : undefined), [api, cardId, exists])

    // Deleted here or anywhere else — this page has nothing left to show
    useROn(key, 'deleted', (id) => {
        if (id === cardId) navigate('/')
    })

    if (cards === null) return <div className="content-page"><Loading label="Ładowanie karty…" /></div>

    if (!card) return <div className="content-page card-details">
        <Link className="card-details-back" to="/">← Wszystkie karty</Link>
        <p className="card-muted">Nie ma takiej karty.</p>
    </div>

    // Until openDetails has run, the text in the model may still belong to the previous card
    const text = detailsId === cardId ? detailsText : null

    return <div className="content-page card-details">
        <Link className="card-details-back" to="/">← Wszystkie karty</Link>

        <img className="card-info-image" src={cardImageUrl(card.id)} alt="" />
        <h1 className="card-details-title">{card.title}</h1>

        <ErrorBanner />

        <p className="card-info-text">{text ?? <Loading />}</p>

        <dl className="card-info-meta">
            <dt>Utworzono</dt>
            <dd>{formatDate(card.createdAt)}</dd>
            <dt>Ostatnio otwarta</dt>
            <dd>{formatDate(card.lastClicked)}</dd>
        </dl>

        <div className="card-details-actions">
            <button type="button" className="card-btn card-btn-ghost" onClick={() => api.openEdit(card)}>Edytuj</button>
            <button type="button" className="card-btn card-btn-danger" onClick={() => confirmDelete(card) && api.remove(card)}>Usuń</button>
        </div>
    </div>
}
