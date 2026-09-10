/* The registry: one store per key, and a subscription on the slot itself so a
   reader can wait for a store that does not exist yet. This is the only place
   that knows which store is current for a key. */
import { Store } from './Store.js'
import type { DataApi } from './DataApi.js'
import type { StoreSelectors } from './StoreSelectors.js'
import type { AnyStore, StoreEvents, StoreKey, StoreRefs } from './types.js'

export type StorageListener = () => void

export const extenralStorage: Map<string, Store<any>> = new Map
const storageListeners = new Map<string, Set<StorageListener>>()

/** Who is holding each storage — one entry per mounted <RModel />, so the last one out drops it. */
const storageHolders = new Map<string, Set<object>>()

/**
 * Wakes everyone watching the slot under `key`.
 * @param key store key
 */
const notifyStorage = (key: string) => {
    const listeners = storageListeners.get(key)

    if (listeners) [...listeners].forEach((listener) => listener())
}

/**
 * Watches one slot of the registry: fires when the store under `key` shows up or
 * goes away, so a component can render before <RModel /> built it.
 * @param key store key
 * @param listener called on every arrival and departure
 * @returns unsubscribe function
 */
export function subscribeStorage(key: string, listener: StorageListener) {
    const listeners = storageListeners.get(key) ?? new Set<StorageListener>()

    storageListeners.set(key, listeners)
    listeners.add(listener)

    return () => {
        listeners.delete(listener)

        if (listeners.size === 0) storageListeners.delete(key)
    }
}

/**
 * The store under `key`, for imperative access from outside React.
 * @type T data type of store
 * @type A type of store api
 * @type S type of store selectors
 * @type R type of store refs
 * @type E type of store events
 * @param key store key
 * @returns store, or undefined where there is none under the key
 */
export function getStore<
    T extends object,
    A extends DataApi<T> = DataApi<T>,
    S extends StoreSelectors<T, any> = StoreSelectors<T, any>,
    R extends object = StoreRefs,
    E extends object = StoreEvents,
>(key: StoreKey<T, A, S, R, E>) {
    return extenralStorage.get(key) as Store<T, A, S, R, E> | undefined
}

/**
 * Drops `store` from the registry and disposes it, so a write which arrives late
 * throws rather than landing in a store nobody can read. A no-op once a newer
 * store took the slot.
 * @type T data type of store
 * @param key store key
 * @param store store to drop
 */
export function unregisterStore<T extends object>(key: string, store: AnyStore<T>) {
    if (extenralStorage.get(key) !== store) return

    extenralStorage.delete(key)
    store.dispose()
    notifyStorage(key)
}

/**
 * How many <RModel /> are holding the storage under `key` right now.
 * @param key store key
 * @returns number of holders
 */
export function storeHolders(key: string): number {
    return storageHolders.get(key)?.size ?? 0
}

export type Claim<
    T extends object,
    A extends DataApi<T> = DataApi<T>,
    S extends StoreSelectors<T, any> = StoreSelectors<T, any>,
    R extends object = StoreRefs,
> = {
    key: string
    /** Whoever is claiming it — one <RModel />, identified by a stable object. */
    holder: object
    /** Whether an existing storage may be shared — with it off, a second holder is an error. */
    allowShared: boolean
    defaultValue: T
    dataApi?: A
    selectors?: S
    /** The refs object the storage carries — the very one, not a copy of it. */
    refs?: R
}

/**
 * Takes a hold on the storage under `key`, building it only where there is none.
 * A storage already in the registry is adopted, and the claim's parts and
 * default value are ignored — it keeps the ones it was built with.
 * @type T data type of store
 * @type A type of store api
 * @type S type of store selectors
 * @type R type of store refs
 * @type E type of store events
 * @param claim key, holder, and what to build the storage with
 * @returns store held under the key
 */
export function claimStore<
    T extends object,
    A extends DataApi<T> = DataApi<T>,
    S extends StoreSelectors<T, any> = StoreSelectors<T, any>,
    R extends object = StoreRefs,
    E extends object = StoreEvents,
>({
    key,
    holder,
    allowShared,
    defaultValue,
    dataApi,
    selectors,
    refs,
}: Claim<T, A, S, R>): Store<T, A, S, R, E> {
    const existing = extenralStorage.get(key) as Store<T, A, S, R, E> | undefined

    if (existing && !allowShared && storeHolders(key) > 0) {
        throw new Error(
            `<RModel storageKey="${key}" /> has allowSharedStore off, and another <RModel /> `
            + `is already holding that storage. Give this one a key of its own, or let them share it.`,
        )
    }

    const store = existing ?? buildStore<T, A, S, R, E>(key, defaultValue, dataApi, selectors, refs)
    const holders = storageHolders.get(key) ?? new Set<object>()

    storageHolders.set(key, holders)
    holders.add(holder)

    return store
}

/**
 * Gives up a hold taken by claimStore().
 * @param key store key
 * @param holder whoever is letting go
 * @returns how many holders are left
 */
export function releaseStore(key: string, holder: object): number {
    const holders = storageHolders.get(key)

    if (!holders) return 0

    holders.delete(holder)

    if (holders.size === 0) storageHolders.delete(key)

    return holders.size
}

/**
 * The parts createStore() takes after the default value: each is optional while
 * the empty stand-in still fits what the key named, and required the moment the
 * key narrows it. Positional, so a named part spells out the ones before it too.
 */
type StoreParts<
    T extends object,
    A extends DataApi<T>,
    S extends StoreSelectors<T, any>,
    R extends object,
> = StoreRefs extends R
    ? StoreSelectors<T, any> extends S
        ? DataApi<T, any, any> extends A
            ? [dataApi?: A, selectors?: S, refs?: R]
            : [dataApi: A, selectors?: S, refs?: R]
        : [dataApi: Skippable<T, A>, selectors: S, refs?: R]
    : [dataApi: Skippable<T, A>, selectors: SkippableSelectors<T, S>, refs: R]

/** A part the key does not name, but which has to be there positionally: `undefined` stands in. */
type Skippable<T extends object, A extends DataApi<T>> =
    DataApi<T, any, any> extends A ? A | undefined : A

type SkippableSelectors<T extends object, S extends StoreSelectors<T, any>> =
    StoreSelectors<T, any> extends S ? S | undefined : S

/**
 * Builds a store and puts it in the registry, waking whoever waits on the key.
 * The key says which parts it insists on, the way it does at a <RModel />. On a
 * key which already has a storage it takes the slot over and disposes the old
 * one, rather than sharing it the way claimStore() does.
 * @type T data type of store
 * @type A type of store api
 * @type S type of store selectors
 * @type R type of store refs
 * @type E type of store events
 * @param key store key
 * @param defaultValue data the store starts with
 * @param parts api, selectors and refs, as the key asks for them
 * @returns built store
 */
export function createStore<
    T extends object,
    A extends DataApi<T> = DataApi<T>,
    S extends StoreSelectors<T, any> = StoreSelectors<T, any>,
    R extends object = StoreRefs,
    E extends object = StoreEvents,
>(
    key: StoreKey<T, A, S, R, E>,
    defaultValue: T,
    ...parts: StoreParts<T, A, S, R>
): Store<T, A, S, R, E> {
    // The tuple above is three optional slots however the key shaped it, and
    // the build below takes them on exactly those terms.
    const [dataApi, selectors, refs] = parts as [A?, S?, R?]

    return buildStore<T, A, S, R, E>(key, defaultValue, dataApi, selectors, refs)
}

/**
 * The build itself, with the parts as they come — shared by createStore() and
 * claimStore(), which hold them on different terms.
 * @type T data type of store
 * @type A type of store api
 * @type S type of store selectors
 * @type R type of store refs
 * @type E type of store events
 * @param key store key
 * @param defaultValue data the store starts with
 * @param dataApi write half of the model
 * @param selectors read half of the model
 * @param refs refs object the storage carries
 * @returns built store
 */
function buildStore<
    T extends object,
    A extends DataApi<T> = DataApi<T>,
    S extends StoreSelectors<T, any> = StoreSelectors<T, any>,
    R extends object = StoreRefs,
    E extends object = StoreEvents,
>(key: string, defaultValue: T, dataApi?: A, selectors?: S, refs?: R): Store<T, A, S, R, E> {
    const previous = extenralStorage.get(key)
    const store = new Store<T, A, S, R, E>(key, defaultValue, dataApi, selectors, refs)

    // Built before the swap, so the key is never momentarily empty and nobody
    // wakes up to a storage that is not there. The registry erases the data
    // type: Store<T, A, S> only fits Store<any> after a cast, since subscribe()
    // narrows its keys to keyof T.
    extenralStorage.set(key, store as unknown as Store<any>)

    // After the new store attached the parts it was handed: detach() only lets
    // go of parts that still belong to the old one, so handing the same api to
    // both is not a way to lose it.
    previous?.dispose()

    notifyStorage(key)

    return store
}
