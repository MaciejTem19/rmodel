import { useState, type FormEvent } from 'react'
import { useRSelector, useRValue } from 'rvmodel'
import type { CardDTO } from './cardApi'
import { useCardsApi, useCardsKey } from './rvmodel'
import { Loading } from './loading'
import Modal from './modal'
import './palette.css'
import './cards.css'

/* The forms live in their own components, rendered only while the modal is
   open, so their state starts fresh every time a modal opens. */

// --- Dodawanie ---

export function AddCardModal() {

    const isOpen = useRSelector(useCardsKey(), 'isAddOpen')
    const api = useCardsApi()

    return <Modal isOpen={isOpen} onCancel={api.closeModal}>
        <AddCardForm />
    </Modal>
}

function AddCardForm() {

    const api = useCardsApi()

    const [title, setTitle] = useState('')
    const [text, setText] = useState('')
    const [image, setImage] = useState<File | null>(null)

    const canSubmit = title.trim() !== '' && text.trim() !== '' && image !== null

    const submit = (event: FormEvent) => {
        event.preventDefault()
        if (image && canSubmit) api.add({ title: title.trim(), text: text.trim(), image })
    }

    return <form className="card-form" onSubmit={submit}>
        <h2 className="card-form-heading">Nowa karta</h2>

        <label className="card-form-field">
            <span>Tytuł</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>

        <label className="card-form-field">
            <span>Tekst</span>
            <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
        </label>

        <label className="card-form-field">
            <span>Zdjęcie</span>
            <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} />
        </label>

        <div className="card-form-actions">
            <button type="button" className="card-btn card-btn-ghost" onClick={api.closeModal}>Anuluj</button>
            <button type="submit" className="card-btn card-btn-primary" disabled={!canSubmit}>Dodaj</button>
        </div>
    </form>
}

// --- Edycja ---

export function EditCardModal() {
    
    const key = useCardsKey()
    const card = useRSelector(key, 'editing')
    const text = useRValue(key, 'editText')
    const api = useCardsApi()

    return <Modal isOpen={card !== null} onCancel={api.closeModal}>
        {card && text !== null
            ? <EditCardForm key={card.id} card={card} initialText={text} />
            : <Loading />}
    </Modal>
}

// card and initialText only seed the form state, once, when it mounts
function EditCardForm({ card, initialText }: { card: CardDTO, initialText: string }) {
    const api = useCardsApi()

    const [title, setTitle] = useState(card.title)
    const [text, setText] = useState(initialText)

    const canSave = title.trim() !== '' && text.trim() !== ''

    const submit = (event: FormEvent) => {
        event.preventDefault()
        if (canSave) api.save(card.id, { title: title.trim(), text: text.trim() })
    }

    return <form className="card-form" onSubmit={submit}>
        <h2 className="card-form-heading">Edycja karty</h2>

        <label className="card-form-field">
            <span>Tytuł</span>
            <input value={title} onChange={(e) => setTitle(e.target.value)} autoFocus />
        </label>

        <label className="card-form-field">
            <span>Tekst</span>
            <textarea rows={4} value={text} onChange={(e) => setText(e.target.value)} />
        </label>

        <div className="card-form-actions">
            <button type="button" className="card-btn card-btn-ghost" onClick={api.closeModal}>Anuluj</button>
            <button type="submit" className="card-btn card-btn-primary" disabled={!canSave}>Zapisz</button>
        </div>
    </form>
}
