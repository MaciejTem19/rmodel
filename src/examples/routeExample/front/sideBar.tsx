import { useRValue } from 'rvmodel'
import { useCardsApi, useCardsKey } from './rvmodel'
import './palette.css'
import './styles.css'

export function SideBar() {
    const user = useRValue(useCardsKey(), 'user')
    const api = useCardsApi()

    return <div className="sidebar">
        {user && <>
            <span className="sidebar-nick">{user.nick}</span>
            <span className="sidebar-code">{user.code}</span>
        </>}

        <button type="button" className="button-sidebar" onClick={api.openAdd}>
            Dodaj kartę
        </button>
    </div>
}
