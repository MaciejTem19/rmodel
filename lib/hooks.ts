/* What a component reads the model through. Every hook here promises a value:
   it falls back to what <RVModel /> is about to build the storage with, and
   throws for a key with nothing behind it at all. */
import {
    useCallback, useContext, useLayoutEffect, useMemo, useRef, useSyncExternalStore,
    type RefObject,
} from 'react'
import { StoreKeyContext, type StoreScope } from './scope.js'
import { shallowEqual } from './shallowEqual.js'
import { getStore, subscribeStorage, type StorageListener } from './storage.js'
import { storeApi, type StoreApi } from './storeApi.js'
import type { DataApi } from './DataApi.js'
import { selectorNamed, type StoreSelectors } from './StoreSelectors.js'
import type { Store } from './Store.js'
import type {
    AnyStore, ApiOf, DataOf, EventsOf, KeyOf, Listener, RefsOf, Selector, SelectorName,
    SelectorValue, SelectorsOf, StoreKey, StoreRefs, ValidShape, ValueUpdate, ValuesOf,
    ValuesUpdate,
} from './types.js'


/**
 * Build in function to throw error when storage is not found
 */
function noStorage(hook: string, key: string): never {
    throw new Error(
        `${hook}() found no storage under '${key}'. Mount <RVModel storageKey="${key}" /> above it, `
        + `or create the storage with createStore('${key}', …) before reading it.`,
    )
}


/**
 * Hook which retreives the built in api of a store under given key - reads and writes without the
 * data itself. Everything it does resolves at call time, so it works before the storage exists and
 * survives it being rebuilt under the same key.
 *
 * The api subscribes to nothing on its own, so holding it **do not** cause rerender.
 * @type T data type of store
 * @param key store key
 * @returns store api, stable as long as the key is
 */
export function useRStoreApi<T extends object>(key: StoreKey<T>): StoreApi<T> {
    return useMemo(() => storeApi<T>(key), [key])
}


/**
 * The key of the storage the nearest <RVModel /> above created. Name the types
 * it holds and every key-taking hook below infers from it:
 *
 *   const key = useRKey<{ data: PageState, api: PageApi }>()
 *   const draft = useRValue(key, 'draft')
 *
 * The shape is the one storeKey() takes, and names the same parts. A part left
 * out is a storage that carries none of it, so a key taken without `refs` is a
 * compile error at useRRef() rather than a key that claims there is nothing to
 * reach:
 *
 *   const key = useRKey<{ data: PageState, refs: PageRefs, events: PageEvents }>()
 *   const list = useRRef(key, 'list')
 *   useROn(key, 'itemAdded', ({ id }) => …)
 */
export function useRKey<Sh extends ValidShape<Sh>>(): KeyOf<Sh> {
    const scope = useContext(StoreKeyContext)

    if (!scope) {
        throw new Error('useRKey() must be called inside <RVModel />')
    }

    return scope.key as KeyOf<Sh>
}

/**
 * What the <RVModel /> above was given, while its storage does not exist yet —
 * and only when it is the same key. A storage built by createStore() needs
 * none of this: it exists before anything gets a chance to read.
 */
function useStoreScope(key: string): StoreScope | undefined {
    const scope = useContext(StoreKeyContext)

    return scope && scope.key === key ? scope : undefined
}

/** The value `key` will be built with, for a render that comes before the storage. 
 * Mainly used by built-in hooks, to instantly retreive default values before first rerender.
 * 
 * @type T store data type
 * @param key of a store
 * @returns default value of a store 
*/
function useStoreDefaultValue<T extends object>(key: string): T | undefined {
    return useStoreScope(key)?.defaultValue as T | undefined
}


/**
 * Hook which retreives whole store under given key, or `undefined` when there is none yet.
 * It rerenders when storage is built, dropped or replaced, but **not** when its data changes -
 * to read values use `useRValue` or `useRValues`.
 *
 * Unlike other hooks it promises nothing: there is no fallback to the default value of <RVModel />,
 * because before the storage exists there is no store to hand back.
 * @type Sh shape of the store
 * @param key store key
 * @returns store, or undefined when nothing is under the key
 */
export function useRStore<Sh extends ValidShape<Sh>>(
    key: string,
): Store<DataOf<Sh>, ApiOf<Sh>, SelectorsOf<Sh>, RefsOf<Sh>, EventsOf<Sh>> | undefined {
    const subscribe = useCallback(
        (onStoreChange: StorageListener) => subscribeStorage(key, onStoreChange),
        [key],
    )

    const getSnapshot = useCallback(
        () => getStore<DataOf<Sh>, ApiOf<Sh>, SelectorsOf<Sh>, RefsOf<Sh>, EventsOf<Sh>>(key),
        [key],
    )

    return useSyncExternalStore(subscribe, getSnapshot)
}

/**
 * Hook wich retreives specified value from a store. Value is updated and couse rerender every time 
 * it changes value in store.
 *  
 * On conceptual level, it works as value from `useState` hook from React
 * @type T data type of the store
* @type K data type behind field `name` from T
* @param key store key
 * @param name name of a retreived value
*/
export function useRValue<T extends object, K extends keyof T>(key: StoreKey<T>, name: K): T[K] {
    // Explicit T: the phantom on StoreKey<T> is unresolved inside a generic, so
    // inference would land on the constraint instead of the data type.
    // Through the api rather than useRStore(): its subscription survives the
    // storage being built, so the arrival of a store that holds the value the
    // default value already showed costs no render at all.
    const store = useRStoreApi<T>(key)
    const defaultValue = useStoreDefaultValue<T>(key)

    const subscribe = useCallback(
        (onStoreChange: Listener) => store.subscribe(onStoreChange, [name]),
        [store, name],
    )

    // Before the storage exists the default value stands in for it, so the first
    // render already shows the value the storage is about to be built with.
    const getSnapshot = useCallback(() => {
        const data = store.getData() ?? defaultValue

        if (!data) noStorage('useRValue', key)

        return data[name]
    }, [store, defaultValue, name, key])

    return useSyncExternalStore(subscribe, getSnapshot)
}

/**
* Hook wich retreives single data from store and returns it as an object ref. Returned ref value is updated every time, when store value is changed.
* Value change of retreived data **do not** couse rerender, however data is always fresh. Returned ref is **readonly**
* 
* On conceptual level, it works similiar as useRef from React.
* @type T data type of store
* @type K data type behind field `name` from T

* @param key store key
* @param name name of a field
 
* @returns readonly ref
*/
export function useRValueAsRef<T extends object, K extends keyof T>(
    key: StoreKey<T>,
    name: K,
): Readonly<RefObject<T[K]>> {
    const store = useRStoreApi<T>(key)
    const defaultValue = useStoreDefaultValue<T>(key)

    // Same fallback as useRValue(): until <RVModel /> has built the storage, the
    // value it is about to be built with is the value.
    const data = store.getData() ?? defaultValue

    if (!data) noStorage('useRValueAsRef', key)

    const ref = useRef(data[name])

    useLayoutEffect(() => followValue(store, name, ref), [store, name])

    return ref
}

/**
 * Hook which retreives several fields from store at once and returns them as a single object ref.
 * Ref is updated every time, when any of named fields is changed in store. Value change of retreived
 * data **do not** cause rerender, however data is always fresh. Returned ref is **readonly**
 *
 * `current` is replaced, not written into, the same way store replaces its data - so read fields
 * through the ref (`draft.current.body`), instead of holding on to a slice taken out of it.
 *
 * On conceptual level, it works as useRValueAsRef, but for many fields at once.
 * @type T data type of store
 * @type K names of retreived fields
 * @param key store key
 * @param names names of fields
 * @returns readonly ref with a slice of store data
 */
export function useRValuesAsRef<T extends object, const K extends readonly (keyof T)[]>(
    key: StoreKey<T>,
    names: K,
): Readonly<RefObject<Pick<T, K[number]>>> {
    const store = useRStoreApi<T>(key)
    const defaultValue = useStoreDefaultValue<T>(key)

    const data = store.getData() ?? defaultValue

    if (!data) noStorage('useRValuesAsRef', key)

    const ref = useRef(sliceOf(data, names))

    // The names as one string, so a fresh array on every render — which is what
    // a list written inline is — does not tear the subscription down and build
    // it again. The same trick useRCustomSelector() plays with its dependencies.
    const namesId = names.map(String).join(' ')

    // oxlint-disable-next-line react-hooks/exhaustive-deps -- namesId stands in for names
    useLayoutEffect(() => followValues(store, names, ref), [store, namesId])

    return ref
}

/**
 * Keeps given ref on a single field of a store: fills it in with the current value, then follows
 * every write to that field until returned unsubscribe is called. It is what useRValueAsRef does
 * once it is mounted, written apart from the hook, so following can be used without a component.
 *
 * Missing storage leaves the ref as it is - sync runs inside a notification, so a throw would land
 * on the writer, not on the holder of the ref.
 * @type T data type of store
 * @type K data type behind field `name` from T
 * @param store store api
 * @param name name of a followed field
 * @param ref ref to keep updated
 * @returns unsubscribe function
 */
export function followValue<T extends object, K extends keyof T>(
    store: StoreApi<T>,
    name: K,
    ref: { current: T[K] },
): () => void {
    const sync = () => {
        const data = store.getData()

        if (data) ref.current = data[name]
    }

    // Anything written between the render that made the ref and the effect that
    // gets here is picked up now — the subscription only covers what follows it.
    sync()

    return store.subscribe(sync, [name])
}

/**
 * The same for a slice of several fields - what useRValuesAsRef does once it is mounted. Whole slice
 * is rebuilt on every write to a named field, so the ref never points at a half updated object.
 * @type T data type of store
 * @type K names of followed fields
 * @param store store api
 * @param names names of followed fields
 * @param ref ref to keep updated
 * @returns unsubscribe function
 */
export function followValues<T extends object, const K extends readonly (keyof T)[]>(
    store: StoreApi<T>,
    names: K,
    ref: { current: Pick<T, K[number]> },
): () => void {
    const sync = () => {
        const data = store.getData()

        if (data) ref.current = sliceOf(data, names)
    }

    sync()

    return store.subscribe(sync, names)
}

/**
 * Hook which retreives single field of store refs - the part of a store nothing renders from. Every
 * component asking for the same field gets the same slot, so a whole subtree can share a DOM node,
 * a scroll position or an id of a running timer, without any of it going through a render.
 *
 * Data is aquired from **store refs, not data** 
 *
 * On conceptual level, it works as useRef from React, shared by the whole subtree.
 * @type R type of store refs
 * @type K data type behind field `name` from R
 * @param key store key
 * @param name name of a ref
 * @returns writable ref, stable as long as key and name are
 */
export function useRRef<R extends object, K extends keyof R>(
    key: StoreKey<any, any, any, R>,
    name: K,
): RefObject<R[K]> {
    // What <RVModel /> is holding while its storage does not exist yet. The same
    // object the storage will carry, so a ref attached before it was built is
    // not lost when it is.
    const pending = useStoreScope(key)?.refs as R | undefined

    // What the accessors below read. A memo would do for the reading, but the
    // object handed back has to be the same one for as long as the component
    // lives — React detaches whatever DOM node a ref is on the moment its
    // identity moves — and a memo is free to throw its result away. So the
    // answer is held in a ref, and what the answer is made of in another.
    const target = useRef({ key, name, pending })

    useLayoutEffect(() => {
        target.current = { key, name, pending }
    })

    // Built on every render and kept from the first: the accessors read `target`
    // rather than this render's values, so the one that is kept is never stale.
    const ref = useRef<RefObject<R[K]>>({
        get current(): R[K] {
            const { key: on, name: field, pending: waiting } = target.current

            return refsOf<R>(on, waiting)[field] as R[K]
        },

        set current(value: R[K]) {
            const { key: on, name: field, pending: waiting } = target.current

            refsOf<R>(on, waiting)[field] = value
        },
    })

    // oxlint-disable-next-line react/refs -- this ref is the hook's result, not state it renders from
    return ref.current
}

/**
 * Refs of a store under `key`, or the ones <RVModel /> is about to build the storage with.
 * @type R type of store refs
 * @param key store key
 * @param pending refs held by <RVModel /> while its storage does not exist yet
 * @returns refs object shared by the subtree
 */
function refsOf<R extends object>(key: string, pending: R | undefined): R {
    const refs = (getStore(key) as AnyStore<any> | undefined)?.refs as R | undefined ?? pending

    if (!refs) {
        throw new Error(
            `useRRef() found no refs under '${key}'. Mount `
            + `<RVModel storageKey="${key}" refs={…} /> above it, or create the storage with `
            + `createStore('${key}', data, api, selectors, refs) before taking a ref of it.`,
        )
    }

    return refs
}

/**

 * Hook wich retreives value computed by named selector from `StoreSelectores` declared in target store. Every change in computed 
 * by selector value couse component to be rerender. Key factor is the "value change", becouse even if dependecies of selector changes 
 * but computed value don't change, rerender won't happen.
 *  
 * by default, storage carrying no selectors to look the name up in.
 * @type T data type of store
 * @type S type of store selectors
 * @type K name of a selector
 * @param key store key
 * @param name name of a selector
 * @returns value returned by the selector
 */
export function useRSelector<
    T extends object,
    S extends StoreSelectors<T, any>,
    K extends SelectorName<T, S>,
>(key: StoreKey<T, any, S, any>, name: K): SelectorValue<S, K> {
    // What <RVModel /> is about to build the storage with, for the render that
    // comes before it exists — the very same instance, so a name resolves to
    // the same selector on both sides of the storage appearing.
    const pending = useStoreScope(key)?.selectors as S | undefined

    return useRCustomSelector<T, SelectorValue<S, K>>(key, namedSelector(key, name, pending))
}

function namedSelector<T extends object, V>(
    key: string,
    name: PropertyKey,
    pending: StoreSelectors<T, any> | undefined,
): Selector<T, V> {
    const selectors = getStore<T>(key)?.selectors ?? pending

    if (!selectors) {
        throw new Error(
            `useRSelector() found no selectors under '${key}' to look '${String(name)}' up in. `
            + `Mount <RVModel storageKey="${key}" selectors={…} /> above it, or create the storage `
            + `with createStore('${key}', data, api, selectors) before reading it by name.`,
        )
    }

    // The same lookup read() does, so a name means one thing and misses read
    // the same way on both sides of React.
    return selectorNamed<T, V>(selectors, name, 'useRSelector()')
}

/**
 * Hook wich retreive value computed by custom selector declared in `pending` argument. Works as a named selector, but only localy. Every change in computed 
 * by selector value couse component to be rerender. Key factor is the "value change", becouse even if dependecies of selector changes 
 * but computed value don't change, rerender won't happen.
 * 
 * Selector lives as long, as component is mounted. 
 *
 * As useRValue, data is taken to be there: key with no storage behind it throws.
 * @type T data type of store
 * @type V type of a selected value
 * @type R type of store refs
 * @param key store key
 * @param selector what to read, its dependencies, and how to compare results (`Object.is` by default)
 * @returns selected value
 */
export function useRCustomSelector<T extends object, V, R extends object = StoreRefs>(
    key: StoreKey<T, any, any, R>,
    { selector, dependencies, isEqual = Object.is }: Selector<T, V, R>,
): V {
    // Same as useRValue(): the api's subscription outlives the storage being
    // built, so a result read off the default value that turns out to be the
    // real one is free.
    const store = useRStoreApi<T>(key)
    const defaultValue = useStoreDefaultValue<T>(key)

    // The refs the storage will be built with, for the renders before it
    // exists — the same object it is about to carry, as useRRef() takes it.
    const pendingRefs = useStoreScope(key)?.refs

    const dependencyId = dependencies.map(String).join(' ')

    // useSyncExternalStore compares snapshots by identity, so an equal result
    // has to come back as the very same value it came back as last time.
    const cache = useRef<{ value: V } | null>(null)

    const subscribe = useCallback(
        (onStoreChange: Listener) => store.subscribe(onStoreChange, dependencies),
        // oxlint-disable-next-line react-hooks/exhaustive-deps -- dependencyId stands in for dependencies
        [store, dependencyId],
    )

    // Deliberately not memoised: it has to run the selector this render was
    // handed, and the cache above is what keeps the snapshot stable.
    const getSnapshot = () => {
        // The default value stands in until the storage is built; the cache
        // below is what keeps that first result stable, selectors being free to
        // build fresh objects out of it.
        const data = store.getData() ?? defaultValue

        if (!data) noStorage('useRCustomSelector', key)

        // Read here rather than subscribed to: no write announces a ref, so
        // these are whatever they hold at the recompute the dependencies above
        // caused. A storage carries an empty object when it names none.
        const refs = (getStore(key) as AnyStore<any> | undefined)?.refs ?? pendingRefs ?? {}

        const next = selector(data, refs as R)
        const current = cache.current

        if (current && isEqual(current.value, next)) return current.value

        cache.current = { value: next }

        return next
    }

    return useSyncExternalStore(subscribe, getSnapshot)
}

/**
 * Hook which retreives several values from store at once. One rerender per write, and only for
 * writes which touched one of `names` fields are compared entry by entry.
 *
 * On conceptual level, it works as useRValue, but for many fields at once.
 * @type T data type of store
 * @type K names of retreived fields
 * @param key store key
 * @param names names of retreived values
 * @returns slice of store data
 */
export function useRValues<T extends object, const K extends readonly (keyof T)[]>(
    key: StoreKey<T>,
    names: K,
): Pick<T, K[number]> {
    // A slice is just a selector over those fields, compared entry by entry.
    return useRCustomSelector<T, Pick<T, K[number]>>(key, {
        dependencies: names,
        selector: (data: T) => sliceOf(data, names),
        isEqual: shallowEqual,
    })
}

/**
 * Fields which `names` picks out of `data`, in an object of their own.
 * @type T data type of store
 * @type K names of picked fields
 * @param data store data
 * @param names names of picked fields
 * @returns slice of data
 */
function sliceOf<T extends object, const K extends readonly (keyof T)[]>(
    data: T,
    names: K,
): Pick<T, K[number]> {
    const slice = {} as Pick<T, K[number]>

    for (const name of names) slice[name] = data[name]

    return slice
}

/**
 * Retreives DataApi object associated with store under `key`. Object work as an API between store and component. Object returned by hook is stable in reference,
 * unless key is change - this will couse hook to resibscribe to new store and return new DataApi object associated with this new store.
 * 
 * DataApi should contains only methods, so no change in store data couse update to this object.  
 * 
 * @type T data type of store
 * @type A type of store api
 * @param key store key
 * @returns api of the store
 */
export function useRDataApi<T extends object, A extends DataApi<T>>(key: StoreKey<T, A>): A {
    const defaultDataApi = useStoreScope(key)?.dataApi as A | undefined

    const subscribe = useCallback(
        (onStoreChange: Listener) => subscribeStorage(key, onStoreChange),
        [key],
    )

    const getSnapshot = useCallback(() => {
        const dataApi = getStore<T, A>(key)?.dataApi ?? defaultDataApi

        // A built storage always carries an api — an empty one when it was made
        // without — so this is a key with no storage under it yet.
        if (!dataApi) {
            throw new Error(
                `useRDataApi() found no api under '${key}'. Mount `
                + `<RVModel storageKey="${key}" dataApi={…} /> above it, or create the storage `
                + `with createStore('${key}', data, api) before reading it.`,
            )
        }

        return dataApi
    }, [key, defaultDataApi])

    return useSyncExternalStore(subscribe, getSnapshot)
}

/**
 * Data an update callback is run against, or the reason there is none - setter with no storage under
 * it has nothing to build the next value from, and says so instead of handing the callback undefined.
 * @type T data type of store
 * @param api store api
 * @param hook name of a calling hook, used in the error message
 * @returns current store data
 */
function updatableData<T extends object>(api: StoreApi<T>, hook: string): T {
    const data = api.getData()

    if (!data) noStorage(hook, api.key)

    return data
}

/**
 * Hook which returns a setter of a single store field, for a component which writes it without
 * displaying it. Setter subscribes to nothing, so writing **do not** cause rerender of the holder,
 * and it keeps its identity as long as key and name do - safe to pass to a memoised child, or to
 * list as a dependency.
 *
 * It retunrs function, wich is setter for the declared field. Setter reuqires value or callback, similiar to setter from `useState` hook.
 * Every change to the value will couse rerender to all components subscribers reading this value. Also cost selectors using this field to recompute.
 *
 * On conceptual level, it works as a setter from `useState` hook from React, without the value.
 * @type T data type of store
 * @type K data type behind field `name` from T
 * @param key store key
 * @param name name of a written field
 * @returns setter of a single field
 */
export function useRSetter<T extends object, K extends keyof T>(
    key: StoreKey<T>,
    name: K,
): (value: ValueUpdate<T[K]>) => void {
   
    //hooks is referencing store api wich is basic function set for the data change
    const api = useRStoreApi<T>(key)

    return useCallback(
        (value: ValueUpdate<T[K]>) => {
            const next = typeof value === 'function'
                ? (value as (previous: T[K]) => T[K])(updatableData(api, 'useRSetter')[name])
                : value

            api.setValue(name, next)
        },
        [api, name],
    )
}

/**
 * Hook which returns a setter of a single field with an async step in front of it: task computes,
 * and what it hands back is written when it finishes. Task is handed an AbortSignal, and returns the
 * value, or a callback - the same two forms useRSetter takes, arriving late.
 *
 * Callback runs at the write, not at the start, so it is handed the field as it stands **then** -
 * that is how a slow answer appends to a list, instead of clobbering whatever landed while it was
 * away.
 *
 * Every call returns its own cancel. Nothing is written when the task was called off - by that
 * cancel, or by the storage being dropped. 
 * 
 * If the `onCancel` fallback is provided, on task cancel this value will be set instead.
 * 
 * Same promise as useRSetter: nothing subscribed, stable identity, and a field which is itself a
 * function can be handed back only by the callback form.
 * @type T data type of store
 * @type K data type behind field `name` from T
 * @param key store key
 * @param name name of a written field
 * @returns setter which takes a task, optional value to write on cancel, and returns the cancel
 */
export function useRSetterByTask<T extends object, K extends keyof T>(
    key: StoreKey<T>,
    name: K,
): {
    (task: (signal: AbortSignal) => Promise<ValueUpdate<T[K]>>): () => void
    (task: (signal: AbortSignal) => Promise<ValueUpdate<T[K]>>, onCancel: T[K]): () => void
} {
    const api = useRStoreApi<T>(key)

    const setByTask = useCallback(
        // Branched rather than spread, so a field whose type allows undefined
        // keeps "no rollback" and "put undefined back" apart.
        (
            task: (signal: AbortSignal) => Promise<ValueUpdate<T[K]>>,
            ...onCancel: [] | [T[K]]
        ) => (onCancel.length === 0
            ? api.updateByTask(name, task)
            : api.updateByTask(name, task, onCancel[0])),
        [api, name],
    )

    // The two signatures an arrow cannot hold go back on the result, and
    // useCallback still gets the inline function it wants.
    return setByTask as (task: (signal: AbortSignal) => Promise<ValueUpdate<T[K]>>) => () => void
}

/**
 * Hook which returns a setter of a **multiple** fields with an async step in front of it: task computes,
 * and what it hands back is written when it finishes. Task is handed an AbortSignal, and returns the
 * values, or a callback - the same two forms useRValueSetter takes, arriving late.
 *
 * Callback runs at the write, not at the start, so it is handed the field as it stands **then** -
 * that is how a slow answer appends to a list, instead of clobbering whatever landed while it was
 * away.
 *
 * Every call returns its own cancel. Nothing is written when the task was called off - by that
 * cancel, or by the storage being dropped. 
 * 
 * If the `onCancel` fallback is provided, on task cancel this values will be set instead.
 * 
 * 
 * Same promise as useRValuesSetter: nothing subscribed, stable identity, and a field which is itself a
 * function can be handed back only by the callback form.
 * @type T data type of store
 * @type K data type behind field `name` from T
 * @param key store key
 * @returns setter which takes a task, optional value to write on cancel, and returns the cancel
 */
export function useRValuesSetterByTask<T extends object>(
    key: StoreKey<T>,
): StoreApi<T>['setValuesByTask'] {
    const api = useRStoreApi<T>(key)

    const setValuesByTask = useCallback((
        names: readonly (keyof T)[] | ((signal: AbortSignal) => Promise<Partial<T>>),
        task?: ((signal: AbortSignal) => Promise<readonly unknown[]>) | Partial<T>,
        onCancel?: Partial<T>,
    ) => {
        // In the object form the rollback is the second argument, not the third.
        if (typeof names === 'function') return api.setValuesByTask(names, task as Partial<T>)

        const positional = task as (signal: AbortSignal) => Promise<ValuesOf<T, (keyof T)[]>>

        return api.setValuesByTask(names as (keyof T)[], positional, onCancel)
    }, [api])

    // The cast is out here rather than around the callback: the two signatures
    // an arrow cannot hold go back on the result, and useCallback still gets
    // the inline function it wants.
    return setValuesByTask as StoreApi<T>['setValuesByTask']
}

/**
 * Hook which returns a setter of several store fields at once: one write per call, so one
 * notification and one rerender, however many fields it names.
 *
 * As a value it can be provided value or callback, where as an argument of a callback you get entire data object. 
 * Works similiar as `useState` hook from React. Values se
 *
 * On conceptual level, it works as useRSetter, but for many fields at once.
 * @type T data type of store
 * @param key store key
 * @returns setter of many fields
 */
export function useRValuesSetter<T extends object>(
    key: StoreKey<T>,
): (values: ValuesUpdate<T>) => void {
    const api = useRStoreApi<T>(key)

    return useCallback(
        (values: ValuesUpdate<T>) => {
            const written = typeof values === 'function'
                ? values(updatableData(api, 'useRValuesSetter'))
                : values

            // The fields as they are: setValues() takes a subset of the data,
            // so there is nothing here to take apart.
            api.setValues(written)
        },
        [api],
    )
}


/**
 * Hook wich returns emit function, wich can be used to triger store event. Return function contains event argument to be called with this call.
 * Every handler listening for this event will be triggered with provided param. If there is no listeners - nothing will happend.
 * 
 * Return function has stable reference, if key and name is not changed.
 * 
 * Hook throw an error if he dont find store under `key` 
 * 
 * @type E type of store events contained in provided store
 * @type K name of an event
 * @param key store key
 * @param name name of an emitted event
 * @returns emitter of a single event
 */
export function useREmit<E extends object, K extends keyof E>(
    key: StoreKey<any, any, any, any, E>,
    name: K,
): (argument: E[K]) => void {
    return useCallback(
        (argument: E[K]) => {
            const store = getStore(key)

            if (!store) noStorage('useREmit', key)

            store.emit(name, argument)
        },
        [key, name],
    )
}

/**
 * Hook which listens for one of the store events, for as long as the component is mounted. Handler
 * takes the single argument typed for that name, and runs inside the emit, in the emitter own stack.
 * Listening **do not** cause rerender by itself - component rerenders only when the handler makes it.
 * That is the point of an event over a field: a component can react to something without reading,
 * and so without rerendering for, anything at all.
 *
 * Handler is read fresh on every emit, so it may close over whatever this render has; it is not a
 * dependency, and changing it resubscribes nothing.
 *
 * Subscription survives the storage being built, dropped and rebuilt under the key, so listening
 * from a component mounted before <RVModel /> is not a race.
 * @type E type of store events
 * @type K name of an event
 * @param key store key
 * @param name name of a listened event
 * @param handler called with the event argument on every emit
 */
export function useROn<E extends object, K extends keyof E>(
    key: StoreKey<any, any, any, any, E>,
    name: K,
    handler: (argument: E[K]) => void,
): void {
    // The handler of the latest render, read at the emit rather than closed
    // over at the subscribe: it is what the component means right now, and
    // resubscribing on every render to keep it fresh would be the only other
    // way to have that.
    const held = useRef(handler)

    useLayoutEffect(() => {
        held.current = handler
    })

    useLayoutEffect(() => {
        const listener = (argument: E[K]) => held.current(argument)

        let drop = getStore(key)?.onEvent(name, listener)

        const unwatch = subscribeStorage(key, () => {
            // The old storage is gone or going; its handlers went with it, so
            // this is not an unsubscribe so much as letting go of a dead one.
            drop?.()
            drop = getStore(key)?.onEvent(name, listener)
        })

        return () => {
            drop?.()
            unwatch()
        }
    }, [key, name])
}
