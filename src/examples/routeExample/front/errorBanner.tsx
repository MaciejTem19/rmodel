import { useRValue } from 'rvmodel'
import { useCardsApi, useCardsKey } from './rvmodel'

export function ErrorBanner() {
    const error = useRValue(useCardsKey(), 'error')
    const api = useCardsApi()

    if (!error) return null

    return <div className="content-error" role="alert">
        <span>{error}</span>
        <button type="button" className="card-btn card-btn-ghost" onClick={api.dismissError}>OK</button>
    </div>
}
