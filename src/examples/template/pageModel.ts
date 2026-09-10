import { getStore, shallowEqual, storeKey, useRCustomSelector, type Selector } from 'rmodel'
import type { Filter, Item } from './types'

export const PAGE_KEY = storeKey<{ data: PageState }>('page')

/** The slice the storage actually holds — everything else is derived from it. */
export type PageState = {
  listName: string
  items: Item[]
  draft: string
  filter: Filter
}

export const DEFAULT_VALUE: PageState = {
  listName: 'Weekend backpack',
  draft: '',
  filter: 'all',
  items: [
    { id: 1, name: 'Coffee beans', qty: 2, done: false },
    { id: 2, name: 'Rubber duck', qty: 1, done: true },
    { id: 3, name: 'Sticky notes', qty: 3, done: false },
  ],
}

export type PageDerived = {
  visibleItems: Item[]
  doneCount: number
}

/** Each derived value is a selector: it names the fields it reads, and it says
 *  when a fresh result still counts as the old one. A component asking for
 *  'doneCount' therefore sleeps through an item edit that leaves the count. */
const DERIVED: { [K in keyof PageDerived]: Selector<PageState, PageDerived[K]> } = {
  visibleItems: {
    dependencies: ['items', 'filter'],
    selector: ({ items, filter }) =>
      items.filter((item) => {
        if (filter === 'todo') return !item.done
        if (filter === 'done') return item.done
        return true
      }),
    // A fresh array of the same rows in the same order is not a change.
    isEqual: shallowEqual,
  },
  doneCount: {
    dependencies: ['items'],
    selector: ({ items }) => items.filter((item) => item.done).length,
  },
}

export type PageActions = {
  setListName: (listName: string) => void
  setDraft: (draft: string) => void
  setFilter: (filter: Filter) => void
  addItem: () => void
  toggleItem: (id: number) => void
  changeQty: (id: number, qty: number) => void
  removeItem: (id: number) => void
  clearDone: () => void
}

/** The imperative side of the model. Plain functions on the storage — no
 *  component renders to hand them out, so their identity never changes. */
export const pageActions: PageActions = {
  setListName: (listName) => page()?.setValue('listName', listName),

  setDraft: (draft) => page()?.setValue('draft', draft),

  setFilter: (filter) => page()?.setValue('filter', filter),

  addItem: () => {
    const store = page()
    if (!store) return

    const { draft, items } = store.getData()
    const name = draft.trim()
    if (!name) return

    store.setValues(
      ['draft', 'items'],
      ['', [...items, { id: nextId(items), name, qty: 1, done: false }]],
    )
  },

  toggleItem: (id) => {
    updateItems((items) =>
      items.map((item) => (item.id === id ? { ...item, done: !item.done } : item)),
    )
  },

  changeQty: (id, qty) => {
    updateItems((items) =>
      items.map((item) => (item.id === id ? { ...item, qty: Math.max(1, qty) } : item)),
    )
  },

  removeItem: (id) => {
    updateItems((items) => items.filter((item) => item.id !== id))
  },

  clearDone: () => {
    updateItems((items) => items.filter((item) => !item.done))
  },
}

/** Everything a component can ask for by name: stored, derived, or an action. */
export type PageValues = PageState & PageDerived & PageActions

/**
 * Reads entries of the model by name. Only the stored fields behind those
 * names are subscribed to, so a component asking for 'draft' sits still while
 * the item list changes — and one asking for an action never subscribes at all.
 */
export function usePageValues<K extends keyof PageValues>(names: readonly K[]): Pick<PageValues, K> {
  // useRCustomSelector() falls back to the default value <RModel /> was given,
  // and throws for a component reading the model from outside it — so what
  // comes back here is always a full slice.
  return useRCustomSelector(PAGE_KEY, {
    dependencies: fieldsFor(names),
    selector: (data: PageState) => select(names, data),
    // The entries are compared one by one, each derived one by its own rule, so
    // a write that leaves every requested entry alone costs no render at all.
    isEqual: (previous, next) => names.every((name) => sameEntry(name, previous[name], next[name])),
  })
}

/** Single-entry form, for components that only need one. */
export function usePageValue<K extends keyof PageValues>(name: K): PageValues[K] {
  return usePageValues([name])[name]
}

function page() {
  return getStore<PageState>(PAGE_KEY)
}

function updateItems(update: (items: Item[]) => Item[]) {
  const store = page()

  if (store) store.setValue('items', update(store.getData().items))
}

function nextId(items: Item[]) {
  return items.reduce((max, item) => Math.max(max, item.id), 0) + 1
}

function isAction(name: keyof PageValues): name is keyof PageActions {
  return name in pageActions
}

function isDerived(name: keyof PageValues): name is keyof PageDerived {
  return name in DERIVED
}

/** The stored fields a set of names depends on, derived values included. */
function fieldsFor(names: readonly (keyof PageValues)[]) {
  const fields = new Set<keyof PageState>()

  for (const name of names) {
    if (isAction(name)) continue

    if (isDerived(name)) {
      for (const field of DERIVED[name].dependencies) fields.add(field)
      continue
    }

    fields.add(name)
  }

  return [...fields]
}

function resolve(name: keyof PageValues, data: PageState) {
  if (isAction(name)) return pageActions[name]
  // The page names no refs, so the second argument a selector takes is the
  // empty object its storage carries.
  if (isDerived(name)) return DERIVED[name].selector(data, {})

  return data[name]
}

function select<K extends keyof PageValues>(names: readonly K[], data: PageState) {
  return Object.fromEntries(names.map((name) => [name, resolve(name, data)])) as Pick<PageValues, K>
}

function sameEntry(name: keyof PageValues, previous: unknown, next: unknown) {
  if (!isDerived(name)) return Object.is(previous, next)

  const isEqual = DERIVED[name].isEqual as ((a: unknown, b: unknown) => boolean) | undefined

  return (isEqual ?? Object.is)(previous, next)
}
