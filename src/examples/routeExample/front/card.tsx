import { Link } from 'react-router'
import { cardImageUrl } from './cardApi'
import { useCardsApi, type CardInfo } from './rvmodel'
import { confirmDelete, formatDate } from './cardUtils'
import './palette.css'
import './cards.css'

// The one prop: which card of the list this is
export function Card({ card }: { card: CardInfo }) {
    const api = useCardsApi()

    return <article className="card-item">
        <Link className="card-item-body" to={`/cards/${card.id}`}>
            <img className="card-item-image" src={cardImageUrl(card.id)} alt="" />
            <span className="card-item-title">{card.title}</span>
            <span className="card-item-date">Utworzono: {formatDate(card.lastCreated)}</span>
        </Link>

        <div className="card-item-actions">
            <button type="button" className="card-btn card-btn-ghost" onClick={() => api.openEdit(card)}>
                Edytuj
            </button>
            <button type="button" className="card-btn card-btn-danger" onClick={() => confirmDelete(card) && api.remove(card)}>
                Usuń
            </button>
        </div>
    </article>
}
