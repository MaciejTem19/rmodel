/* The component that mounts a storage. It holds no data — it only creates the
   storage that everything else talks to, and puts its key in the scope
   (scope.ts) for the hooks below to find. */
import { useLayoutEffect, useMemo, useRef, type ReactNode } from 'react'
import { keepInBrowser, loadFromBrowser as loadSaved } from './persistence.js'
import { StoreKeyContext } from './scope.js'
import { claimStore, releaseStore, unregisterStore } from './storage.js'
import type { DataApi } from './DataApi.js'
import type { StoreSelectors } from './StoreSelectors.js'
import type { AnyStore, StoreEvents, StoreKey, StoreRefs } from './types.js'

/**
 * Prop required by `<RVModel />` component.
 * @type T data object representing standard data provided by store, wich works as a state collection across component scope.
 * @type A DataApi object used as a container for custom methods manipulating store. DataApi with objects `T`, `R`, `E` is associated with data, refs, events of a storage.
 * @type S StoreSelector object containing named selectors associated with data. and refs
 * @type R StoreRefs container representing data wich will work as a ref (wont couse rerenders at any time)
 * @type E StoreEvents container representing avaible events named after field name and associated event data provided to handlers.
 */
export type RVModelProp<
    T extends object,
    A extends DataApi<T, R, E> = DataApi<T, any, any>,
    S extends StoreSelectors<T, R> = StoreSelectors<T, any>,
    R extends object = StoreRefs,
    E extends object = StoreEvents,
> = {
    /**
     * Store key associated with components store.
     */
    storageKey: StoreKey<T, A, S, R, E>
    /**
     * Default value of data for store after creating it.
     */
    defaultValue: T
    /**
     * Should store be rembebered after `<RVModel />` unmounting.
     */
    remember?: boolean
    /**
     * Allows store to be used by more than one `<RVModel />` across app.
     */
    allowSharedStore?: boolean
    /**
     * Should component try to load store data from browser storage.
     */
    loadFromBrowser?: boolean
    /**
     * Should component save its data to browser storage.
     */
    saveToBrowser?: boolean
    children?: ReactNode
} & PartsOf<T, A, S, R, E>

/**
 * The three parts of a storage which have a prop: each is optional while the
 * empty stand-in still fits what the key named, and required the moment the key
 * narrows it. A bare string narrows nothing, so it leaves all three optional.
 * @type T data type of store
 * @type A type of store api
 * @type S type of store selectors
 * @type R type of store refs
 * @type E type of store events
 */
type PartsOf<
    T extends object,
    A extends DataApi<T, R, E>,
    S extends StoreSelectors<T, R>,
    R extends object,
    E extends object,
> =
    & (DataApi<T, any, any> extends A ? Partial<ApiProp<A>> : ApiProp<A>)
    & (StoreSelectors<T, any> extends S ? Partial<SelectorsProp<S>> : SelectorsProp<S>)
    & (StoreRefs extends R ? Partial<RefsProp<R>> : RefsProp<R>)

type ApiProp<A> = {
    /**
     * The write half, attached as the storage is built. Read once, at creation,
     * so hand it a stable instance — a part belongs to one storage.
     */
    dataApi: A
}

type SelectorsProp<S> = {
    /** The read half, on the same terms as dataApi. */
    selectors: S
}

type RefsProp<R> = {
    /**
     * The refs the storage carries: an object nothing renders from, which
     * useRRef() hands out fields of. Read once, when the storage is built, and
     * then written in place — the very object the subtree writes into.
     */
    refs: R
}

/**
 * Mounts a storage and provides it to everything below. It holds no data of its
 * own: it builds the storage the hooks, the api and the selectors talk to, and
 * puts its key in context so the subtree finds it without being handed anything.
 *
 * The storage is built in a layout effect, so children render once without it
 * and are woken the moment it lands. One storage per key: a second <RVModel /> on
 * a key which already has one adopts it, and the storage lives until the last
 * holder unmounts.
 * @type T data type of store
 * @type A type of store api
 * @type S type of store selectors
 * @type R type of store refs
 * @type E type of store events
 * @param props store key, default value, and the parts the key names
 * @returns children, with the storage's scope provided to them
 */
export function RVModel<
    T extends object,
    A extends DataApi<T, R, E> = DataApi<T, any, any>,
    S extends StoreSelectors<T, R> = StoreSelectors<T, any>,
    R extends object = StoreRefs,
    E extends object = StoreEvents,
>(props: RVModelProp<T, A, S, R, E>) {
    // Widened to the shape every branch of PartsOf has in common: which of the
    // three are required is a question about this mounting's key, and nothing
    // in here is answered differently either way.
    const {
        storageKey,
        defaultValue,
        dataApi,
        selectors,
        refs,
        children,
        remember = false,
        allowSharedStore = true,
        loadFromBrowser = false,
        saveToBrowser = false,
    } = props as RVModelProp<T, A, S, R, E> & Partial<ApiProp<A> & SelectorsProp<S> & RefsProp<R>>


    const initialValue = useMemo(
        () => (loadFromBrowser ? loadSaved<T>(storageKey, defaultValue) : defaultValue),
        [storageKey],
    )
    /* oxlint-enable react-hooks/exhaustive-deps */

    //storing refs in memo, so it has stable reference
    const storeRefs = useMemo(() => refs ?? ({} as R), [storageKey])

    // What this <RVModel /> holds the storage as. A ref rather than the key, so
    // two of them on one key are still two holders.
    const holder = useRef({})
    const rememberStorage = useRef(remember)

    useLayoutEffect(() => {
        rememberStorage.current = remember
    })

    useLayoutEffect(() => {
        const token = holder.current
        const storage: AnyStore<any> = claimStore({
            key: storageKey,
            holder: token,
            allowShared: allowSharedStore,
            defaultValue: initialValue,
            dataApi,
            selectors,
            refs: storeRefs,
        })

        return () => {
            // Someone else is still on this key: the storage is theirs to keep.
            if (releaseStore(storageKey, token) > 0) return

            if (!rememberStorage.current) unregisterStore(storageKey, storage)
        }
    }, [storageKey])

    // Its own effect, after the one that builds the storage: turning saving on
    // or off is not a reason to rebuild anything, and by the time this runs on
    // mount there is a storage to write out.
    useLayoutEffect(() => {
        if (!saveToBrowser) return

        return keepInBrowser(storageKey)
    }, [storageKey, saveToBrowser])

    // Memoised on the key alone, for the same reason the effect is: a fresh
    // defaultValue on the parent's next render must not ripple through here.
    /* oxlint-disable react-hooks/exhaustive-deps */
    const scope = useMemo(
        () => ({ key: storageKey, defaultValue: initialValue, dataApi, selectors, refs: storeRefs }),
        [storageKey],
    )

    // The scope is the whole o what is provided: children below never have to
    // be handed a store, and never have to name the storage they sit in.
    return <StoreKeyContext value={scope}>{children}</StoreKeyContext>
}
