import { useRSelector, useRValue } from 'rvmodel'
import { useCardsApi, useCardsKey } from './rvmodel'
import './palette.css'
import './styles.css'

// Tylko do debugowania: guzik podbija licznik w modelu
export function DebugCounter() {
    const counter = useRValue(useCardsKey(), 'debugCounter')
    const api = useCardsApi()

    console.log('render DebugCounter, debugCounter =', counter)

    return <div className="content-debug">
        <span>debugCounter: {counter}</span>
        <DebugOne />
        <button type="button" className="card-btn card-btn-ghost" onClick={api.incrementDebugCounter}>
            +1 (debug)
        </button>
    </div>
}

// Czyta tylko selektor debugOne — powinien się wyrenderować raz, mimo kliknięć
function DebugOne() {
    const one = useRSelector(useCardsKey(), 'debugOne')

    console.log('render DebugOne, debugOne =', one)

    return <span>debugOne: {one}</span>
}
