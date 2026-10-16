import { useRValue } from 'rvmodel'
import { useCardsApi, useCardsKey, type CardsFilter } from './rvmodel'
import './palette.css'
import './cards.css'

// Reads the filter object and changes one field of it at a time
export function CardsFilterBar() {
    const filter = useRValue(useCardsKey(), 'filter')
    const api = useCardsApi()

    return <div className="card-filter">
        <input
            type="search"
            placeholder="Szukaj po tytule…"
            value={filter.query}
            onChange={(e) => api.setFilter({ query: e.target.value })}
        />
        <select
            value={filter.sortBy}
            onChange={(e) => api.setFilter({ sortBy: e.target.value as CardsFilter['sortBy'] })}
        >
            <option value="title">Tytuł A–Z</option>
            <option value="lastCreated">Ostatnio otwierane</option>
        </select>
    </div>
}
