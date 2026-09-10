/* The vocabulary the rest of the model is written in. Nothing here runs except
   storeKey(), which hands back the string it was given — the types ride along
   with it. The imports are type-only, so the cycle back to Store and the two
   halves of a model is erased before it reaches the bundle. */
import type { DataApi } from './DataApi.js'
import type { StoreSelectors } from './StoreSelectors.js'
import type { Store } from './Store.js'

export type Listener = () => void



/**
 * Values matched positionally to a tuple of keys: `values[i]` has to fit
 * `data[keys[i]]`.
 *
 *   ValuesOf<{ name: string, qty: number }, ['name', 'qty']>  // [string, number]
 */
export type ValuesOf<T, K extends readonly (keyof T)[]> = {
    [I in keyof K]: K[I] extends keyof T ? T[K[I]] : never
}

/**
 * What a setter takes for one field: the value itself, or a callback handed
 * what is in the store right now and handing back what replaces it — the shape
 * of React's setState.
 *
 *   setQty(3)
 *   setQty((qty) => qty + 1)
 *
 * A field whose own type is a function cannot be written by value this way, the
 * callback form being what a function is taken for: wrap it, setHandler(() => handler).
 */
export type ValueUpdate<V> = V | ((previous: V) => V)

/**
 * The same for several fields: the fields to write, or a callback handed the
 * whole data and handing back the fields to write. Fields it leaves out are
 * left alone.
 *
 *   setValues({ name: 'Tea', qty: 5 })
 *   setValues(({ qty }) => ({ qty: qty + 1 }))
 */
export type ValuesUpdate<T> = Partial<T> | ((data: T) => Partial<T>)

/**
 * A computed view of the data. `selector` runs over the fields named in
 * `dependencies` — those and only those wake it — and `isEqual` decides
 * whether a fresh result counts as a change. A result that compares equal is
 * handed back as the previous one, so the component sits still even though the
 * fields it depends on moved.
 *
 *   const doneCount: Selector<PageState, number> = {
 *     dependencies: ['items'],
 *     selector: ({ items }) => items.filter((item) => item.done).length,
 *   }
 *
 * The second argument is the storage's refs — `R` is their type, and is only
 * worth naming for a view that reads one:
 *
 *   const pages: Selector<PageState, number, PageRefs> = {
 *     dependencies: ['items'],
 *     selector: ({ items }, { pageSize }) => Math.ceil(items.length / (pageSize ?? 20)),
 *   }
 *
 * Handed over, not depended on: nothing notifies when a ref moves, so what a
 * selector reads there is whatever it held at the recompute its dependencies
 * caused. A view that has to be current the moment it changes is data, and
 * belongs in the store. Whatever it hands back has to settle — a result built
 * fresh out of a ref on every call is what React's snapshot check objects to.
 */
export type Selector<T extends object, V, R extends object = StoreRefs> = {
    selector: (data: T, refs: R) => V
    dependencies: readonly (keyof T)[]
    /** Defaults to Object.is. Use shallowEqual() for a freshly built array or object. */
    isEqual?: (previous: V, next: V) => boolean
}

/**
 * The names a set of selectors offers: the fields of `S` built with select(),
 * and nothing else — its methods and anything else it carries are left out.
 * What useRSelector() takes as its second argument.
 *
 *   SelectorName<Cart, CartSelectors>   // 'count' | 'total'
 */
export type SelectorName<T extends object, S> = {
    [K in keyof S]: S[K] extends Selector<T, any, any> ? K : never
}[keyof S]

/** What the selector named `K` on `S` hands back — the V of its Selector. */
export type SelectorValue<S, K extends keyof S> =
    S[K] extends Selector<any, infer V, any> ? V : never

/**
 * The body of an async task. It computes and hands back the fields to write —
 * it does not write itself. That is what makes cancelling safe: runTask() is
 * the only place that writes, it writes once, and it writes every field in one
 * go, so a cancel either stops the whole write or arrives after it landed.
 *
 *   const load: StoreTask<PageState> = async (signal) => ({
 *     items: await fetchItems(signal),
 *     loading: false,
 *   })
 *
 * Returning nothing writes nothing. The signal is aborted by the cancel
 * runTask() hands back and by the storage being dropped — pass it to fetch()
 * so the work stops as well as the write.
 */
export type StoreTask<T extends object> = (signal: AbortSignal) => Promise<Partial<T> | void>

/**
 * The refs half of a storage: a plain object nobody renders from. Fields here
 * are read and written in place, no listener hears about it, and nothing
 * re-renders — a DOM node the subtree shares, a scroll position, the id of a
 * timer still running. The default is an empty one, so a storage that names no
 * refs has no ref to take.
 */
export type StoreRefs = Record<never, never>

/**
 * The events half of a storage: the names it can announce, and what each of
 * them carries. A container of types and nothing else — no event is stored
 * anywhere, so there is no value here to read, only a shape to name.
 *
 *   export type PageEvents = {
 *     itemAdded: { id: string }
 *     scrolledToTop: void
 *   }
 *
 * That is what the data cannot say. A write that changes nothing notifies
 * nobody — setValue() drops a value equal to the one already there — so
 * "it happened again" has no shape as a field.
 *
 * The default is an empty map, so a storage that names no events has none.
 */
export type StoreEvents = Record<never, never>


declare const STORE_KEY: unique symbol

/**
 * A storage key that remembers what lives under it. At runtime it is the plain
 * string it looks like — the types ride along in a phantom field, which is what
 * lets useRValue(key, 'name') know its own result without type arguments.
 *
 * The five parts are positional here, and named where a key is declared: see
 * StoreShape and storeKey() below, which is what anyone writing a model uses.
 */
export type StoreKey<
    T extends object,
    A extends DataApi<T> = DataApi<T>,
    S extends StoreSelectors<T, any> = StoreSelectors<T, any>,
    R extends object = StoreRefs,
    E extends object = StoreEvents,
> = string & { readonly [STORE_KEY]?: [T, A, S, R, E] }

/**
 * What a storage is made of, named rather than counted: the data it holds, and
 * the four optional parts around it.
 *
 *   { data: PageState, api: PageApi, selectors: PageSelectors, refs: PageRefs, events: PageEvents }
 *
 * Only `data` is required. A part left out is not "unknown" — it is a storage
 * that carries none of that, so a key with no `events` is one useROn() will not
 * take, rather than one that quietly claims to carry anything.
 */
export type StoreShape = {
    data: object
    api?: DataApi<any, any, any>
    selectors?: StoreSelectors<any, any>
    refs?: object
    events?: object
}

/** The data of a shape. */
export type DataOf<Sh> = Sh extends { data: infer T extends object } ? T : never
/** Its api, or the empty one for a shape that names none. */
export type ApiOf<Sh> = Sh extends { api: infer A extends DataApi<any, any, any> } ? A : DataApi<DataOf<Sh>>
/** Its selectors, on the same terms. */
export type SelectorsOf<Sh> = Sh extends { selectors: infer S extends StoreSelectors<any, any> } ? S : StoreSelectors<DataOf<Sh>>
/** Its refs, or none. */
export type RefsOf<Sh> = Sh extends { refs: infer R extends object } ? R : StoreRefs
/** Its events, or none. */
export type EventsOf<Sh> = Sh extends { events: infer E extends object } ? E : StoreEvents

/** The key of a storage of that shape — the positional StoreKey, worked out. */
export type KeyOf<Sh> = StoreKey<DataOf<Sh>, ApiOf<Sh>, SelectorsOf<Sh>, RefsOf<Sh>, EventsOf<Sh>>

/**
 * What a shape has to satisfy, and where the parts are checked **against each
 * other** rather than one at a time: the api is required to be an api over this
 * shape's data, refs and events, and the selectors over its data and refs. A
 * key can no longer promise events its api does not announce.
 *
 * The second half of it rejects a field the shape does not know — a misspelled
 * `refz` is an error rather than a part silently left out.
 */
export type ValidShape<Sh> = {
    data: DataOf<Sh>
    api?: DataApi<DataOf<Sh>, RefsOf<Sh>, EventsOf<Sh>>
    selectors?: StoreSelectors<DataOf<Sh>, RefsOf<Sh>>
    refs?: object
    events?: object
} & { [K in Exclude<keyof Sh, keyof StoreShape>]: never }

/**
 * Names a storage and what it holds. A string literal works too; this only
 * spells the types.
 *
 *   export const PAGE_KEY = storeKey<{ data: PageState }>('page')
 *
 *   export const PAGE_KEY = storeKey<{
 *       data: PageState
 *       api: PageApi
 *       selectors: PageSelectors
 *       refs: PageRefs
 *       events: PageEvents
 *   }>('page')
 *
 * Order does not matter and everything but `data` may be left out, so a model
 * that has events and no selectors says exactly that.
 */
export function storeKey<Sh extends ValidShape<Sh>>(key: string): KeyOf<Sh> {
    return key as KeyOf<Sh>
}

/** A store over T carrying any api, selectors, refs and events — what every
 *  reader wants. The parts attach to it through this, and a part is written
 *  against the data alone: it has no business knowing which events the storage
 *  it was handed happens to name. */
export type AnyStore<T extends object> = Store<T, any, any, any, any>


