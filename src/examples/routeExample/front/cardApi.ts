/* Client for the cards backend in ../back (ASP.NET, `dotnet run` serves it on
   http://localhost:5067). One function per controller endpoint, each takes an
   optional AbortSignal so a model can cancel what it no longer needs. */

import axios from 'axios'

/** Mirrors CardDTO from Controller.cs. Dates arrive as ISO strings. */
export type CardDTO = {
    id: number
    title: string
    createdAt: string
    lastClicked: string | null
}

/** Mirrors UserDTO from Controller.cs. */
export type UserDTO = {
    nick: string
    code: string
}

export type NewCard = {
    userId: number
    title: string
    text: string
    image: Blob
}

export const API_URL = 'http://localhost:5067'

const http = axios.create({ baseURL: API_URL })

/** GET /user/:id */
export async function fetchUser(id: number, signal?: AbortSignal): Promise<UserDTO> {
    const { data } = await http.get<UserDTO>(`/user/${id}`, { signal })
    return data
}

/** GET /?userId= — only the cards that belong to that user. */
export async function fetchCards(userId: number, signal?: AbortSignal): Promise<CardDTO[]> {
    const { data } = await http.get<CardDTO[]>('/', { params: { userId }, signal })
    return data
}

/** GET /:id/text — the server also stamps lastClicked. */
export async function fetchCardText(id: number, signal?: AbortSignal): Promise<string> {
    const { data } = await http.get<string>(`/${id}/text`, { signal, responseType: 'text' })
    return data
}

/** GET /:id/image */
export async function fetchCardImage(id: number, signal?: AbortSignal): Promise<Blob> {
    const { data } = await http.get<Blob>(`/${id}/image`, { signal, responseType: 'blob' })
    return data
}

/** The same image, as a URL an <img src> can point at directly. */
export function cardImageUrl(id: number): string {
    return `${API_URL}/${id}/image`
}

/** POST / (multipart/form-data) */
export async function createCard(card: NewCard, signal?: AbortSignal): Promise<CardDTO> {
    const form = new FormData()
    form.append('UserId', String(card.userId))
    form.append('Title', card.title)
    form.append('Text', card.text)
    form.append('Image', card.image)

    const { data } = await http.post<CardDTO>('/', form, { signal })
    return data
}

/** DELETE /:id */
export async function deleteCard(id: number, signal?: AbortSignal): Promise<void> {
    await http.delete(`/${id}`, { signal })
}

/** PATCH /:id/text */
export async function updateCardText(id: number, text: string, signal?: AbortSignal): Promise<CardDTO> {
    const { data } = await http.patch<CardDTO>(`/${id}/text`, { text }, { signal })
    return data
}

/** PATCH /:id/title */
export async function updateCardTitle(id: number, title: string, signal?: AbortSignal): Promise<CardDTO> {
    const { data } = await http.patch<CardDTO>(`/${id}/title`, { title }, { signal })
    return data
}
