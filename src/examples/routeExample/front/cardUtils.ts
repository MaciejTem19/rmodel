import type { CardInfo } from './rvmodel'

export function formatDate(iso: string | null) {
    return iso ? new Date(iso).toLocaleString('pl-PL') : '—'
}

export function confirmDelete(card: Pick<CardInfo, 'title'>) {
    return confirm(`Usunąć kartę "${card.title}"?`)
}
