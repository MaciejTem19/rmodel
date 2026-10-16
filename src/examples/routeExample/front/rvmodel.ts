/* The cards page: the user, their cards, which modal is open and the text the
   open card needs. Every call to the backend goes through the api below, so the
   components only read fields and call methods. */
import { DataApi, StoreSelectors, storeKey, useRDataApi, useRKey, type StoreRefs } from 'rvmodel'
import {
    createCard,
    deleteCard,
    fetchCards,
    fetchCardText,
    fetchUser,
    updateCardText,
    updateCardTitle,
    type CardDTO,
    type UserDTO,
} from './cardApi'

// Testowe api nie ma logowania, więc user jest na sztywno
export const USER_ID = 1

export type CardFormValues = {
    title: string
    text: string
}

/** What a card in the list shows, picked out of CardDTO by the cardsInfo selector. */
export type CardInfo = {
    id: number,
    title: string,
    lastCreated: string | null
}

/** How the list is narrowed and ordered — one object, so the selector wakes on one field. */
export type CardsFilter = {
    query: string
    sortBy: 'title' | 'lastCreated'
}

export type CardsModal =
    | { type: 'add' }
    | { type: 'edit', cardId: number }
    | null

export type CardsState = {
    user: UserDTO | null
    cards: CardDTO[] | null
    error: string | null
    userRequestPending: boolean,
    cardsRequestPending: boolean,
    modal: CardsModal
    filter: CardsFilter
    editText: string | null
    detailsId: number | null
    detailsText: string | null
    /** Tylko do testów: losowa liczba, którą ustawia wyłącznie model, nie backend ani komponenty. */
    testValue: number
    /** Tylko do debugowania: licznik podbijany guzikiem nad listą kart. */
    debugCounter: number
}

export const CARDS_DEFAULT: CardsState = {
    user: null,
    cards: null,
    error: null,
    modal: null,
    filter: { query: '', sortBy: 'title' },
    cardsRequestPending: true,
    userRequestPending: true,
    editText: null,
    detailsId: null,
    detailsText: null,
    testValue: 0,
    debugCounter: 0,
}

export type CardsEvents = {
    /** A card is gone — the details route leaves when it was the one shown. */
    deleted: number
}

type CardsShape = { data: CardsState, api: CardsApi, selectors: CardsSelectors, events: CardsEvents }

export const CARDS_KEY = storeKey<CardsShape>('cards')

export class CardsApi extends DataApi<CardsState, StoreRefs, CardsEvents> {
    /** The edit text in flight, so closing the modal can call it off. */
    #cancelEditText: (() => void) | null = null

    /** User and cards in one go. Returns the cancel, so it fits a useEffect cleanup. */
    load = () => this.runTask(async (signal) => {
        try {
            const [user, cards] = await Promise.all([fetchUser(USER_ID, signal), fetchCards(USER_ID, signal)])

            return { user, cards, error: null, cardsRequestPending: false }
        } catch (error) {
            if (signal.aborted) return
            return { error: `Nie udało się pobrać danych: ${message(error)}` }
        }
    })

    /** Reading a card's text stamps lastClicked on the server, so the list is fetched again after. */
    refreshCards = () => this.runTask(async (signal) => {
        try {
            return { cards: await fetchCards(USER_ID, signal) }
        } catch (error) {
            if (signal.aborted) return

            return { error: `Nie udało się odświeżyć kart: ${message(error)}` }
        }
    })

    /** Tylko do testów: wpisuje nową losową wartość do testValue. */
    rollTestValue = () => this.setValue('testValue', Math.random())

    /** Tylko do debugowania: podbija debugCounter o 1. */
    incrementDebugCounter = () => this.setValue('debugCounter', this.data.debugCounter + 1)

    dismissError = () => this.setValue('error', null)

    /** Only the given fields change, the rest of the filter stays. */
    setFilter = (patch: Partial<CardsFilter>) => this.setValue('filter', { ...this.data.filter, ...patch })

    openAdd = () => this.setValue('modal', { type: 'add' })

    closeModal = () => {
        this.#cancelEditText?.()
        this.setValue('modal', null)
    }

    openEdit = (card: Pick<CardInfo, 'id'>) => {
        this.#cancelEditText?.()
        this.setValues({ modal: { type: 'edit', cardId: card.id }, editText: null })

        this.#cancelEditText = this.runTask(async (signal) => {
            try {
                const editText = await fetchCardText(card.id, signal)
                this.refreshCards()

                return { editText }
            } catch (error) {
                if (signal.aborted) return

                return { error: `Nie udało się pobrać tekstu: ${message(error)}` }
            }
        })
    }

    /** The details route calls it on the way in; the returned cancel is its cleanup. */
    openDetails = (id: number) => {
        this.setValues({ detailsId: id, detailsText: null })

        return this.runTask(async (signal) => {
            try {
                const detailsText = await fetchCardText(id, signal)
                this.refreshCards()

                return { detailsText }
            } catch (error) {
                if (signal.aborted) return

                return { error: `Nie udało się pobrać tekstu: ${message(error)}` }
            }
        })
    }

    add = (values: CardFormValues & { image: File }) => this.runTask(async (signal) => {
        try {
            const card = await createCard({ userId: USER_ID, ...values }, signal)

            // this.data is read after the await, so a card added meanwhile is kept
            return { cards: [...(this.data.cards ?? []), card], modal: null }
        } catch (error) {
            if (signal.aborted) return

            return { error: `Nie udało się dodać karty: ${message(error)}` }
        }
    })

    save = (cardId: number, values: CardFormValues) => this.runTask(async (signal) => {
        try {
            await updateCardTitle(cardId, values.title, signal)
            const updated = await updateCardText(cardId, values.text, signal)
            const { cards, detailsId, detailsText } = this.data

            return {
                cards: cards?.map((c) => (c.id === updated.id ? updated : c)) ?? null,
                // The details page shows the text we have just saved — no need to ask for it
                detailsText: detailsId === cardId ? values.text : detailsText,
                modal: null,
            }
        } catch (error) {
            if (signal.aborted) return

            return { error: `Nie udało się zapisać karty: ${message(error)}` }
        }
    })

    remove = (card: Pick<CardInfo, 'id'>) => this.runTask(async (signal) => {
        try {
            await deleteCard(card.id, signal)
            this.emit('deleted', card.id)

            return { cards: this.data.cards?.filter((c) => c.id !== card.id) ?? null }
        } catch (error) {
            if (signal.aborted) return

            return { error: `Nie udało się usunąć karty: ${message(error)}` }
        }
    })
}

export class CardsSelectors extends StoreSelectors<CardsState> {
    isAddOpen = this.select(({ modal }) => modal?.type === 'add', ['modal'])
    cardsInfo = this.select(({ cards }) => {
        return cards?.map((card): CardInfo => ({
            id: card.id,
            title: card.title,
            lastCreated: card.lastClicked,
        })) ?? null
    }, ['cards'])

    /** cardsInfo narrowed by the query and ordered: by title, or the newest first (no date last). */
    visibleCards = this.select(({ cards }) => {
        return cards?.map(e => {
            return {
                id: e.id,
                lastCreated: e.lastClicked,
                title: e.title
            } as CardInfo
    })
    }, ['filter', "cards"])

    /** Looked up in the list, so the modal always has the card as it is now. */
    editing = this.select(
        ({ modal, cards }) => (modal?.type === 'edit' ? cards?.find((c) => c.id === modal.cardId) ?? null : null),
        ['modal', 'cards'],
    )
    /** Tylko do debugowania: zależy od debugCounter, ale zawsze zwraca 1 — wynik się nie zmienia, więc komponent nie powinien się renderować. */
    debugOne = this.select(({ debugCounter }) => {
        console.log('debugOne przeliczony, debugCounter =', debugCounter)
        return 1
    }, ['debugCounter'])

    toReq = this.select( ({cardsRequestPending, userRequestPending}) => {
        // return {f: cardsRequestPending, s: userRequestPending}
        return cardsRequestPending;
    }, ['cardsRequestPending', 'userRequestPending'])

    obj = this.select( ({debugCounter}) => {
        return {id: 1, some: "string"}
    }, ['cards'])
}

export const cardsApi = new CardsApi()
export const cardsSelectors = new CardsSelectors()

export const useCardsKey = () => useRKey<CardsShape>()

export const useCardsApi = () => useRDataApi(useCardsKey())

const message = (error: unknown) => (error instanceof Error ? error.message : String(error))
