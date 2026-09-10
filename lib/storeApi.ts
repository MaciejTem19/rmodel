/* The built-in api of a storage: reads and writes resolved on every call, so
   nothing about it changes when the data does. Usable outside React, and the
   subscription survives the storage being built or replaced. */
// import { useMemo } from 'react'
import { getStore, subscribeStorage } from './storage.js'
import type { Listener, StoreKey, ValueUpdate, ValuesOf } from './types.js'

/** Unsubscribe handed out while there is no store to subscribe to yet. */
const noop = () => {}

/**
 * The store's methods without its data: everything here is a read or a write
 * made at call time, so nothing about it changes when the data does.
 */
export type StoreApi<T extends object> = {
    key: string
    /** The data right now, or undefined while there is no storage under this key. */
    getData: () => T | undefined
    setValue: <K extends keyof T>(name: K, value: T[K]) => void
    /** Several fields in one go: the fields themselves, or names and values in order. */
    setValues: {
        <const K extends readonly (keyof T)[]>(names: K, values: ValuesOf<T, K>): void
        (values: Partial<T>): void
    }
    /**
     * One field, written with what an async task hands back. Returns the
     * cancel; a task called off before it finished writes nothing — unless
     * `onCancel` says what to put under the field instead.
     */
    setValueByTask: {
        <K extends keyof T>(name: K, task: (signal: AbortSignal) => Promise<T[K]>): () => void
        <K extends keyof T>(
            name: K,
            task: (signal: AbortSignal) => Promise<T[K]>,
            onCancel: T[K],
        ): () => void
    }
    /**
     * The same, for a task that says which of the two it is doing by what it
     * hands back: a value is set, a callback is handed the field as it stands
     * at the write and its result is written instead.
     */
    updateByTask: {
        <K extends keyof T>(
            name: K,
            task: (signal: AbortSignal) => Promise<ValueUpdate<T[K]>>,
        ): () => void
        <K extends keyof T>(
            name: K,
            task: (signal: AbortSignal) => Promise<ValueUpdate<T[K]>>,
            onCancel: T[K],
        ): () => void
    }
    /**
     * Several fields the same way, in the two shapes setValues() takes.
     * `onCancel` is the fields to put back if the task is called off, and need
     * not be the ones the task itself writes.
     */
    setValuesByTask: {
        <const K extends readonly (keyof T)[]>(
            names: K,
            task: (signal: AbortSignal) => Promise<ValuesOf<T, K>>,
            onCancel?: Partial<T>,
        ): () => void
        (task: (signal: AbortSignal) => Promise<Partial<T>>, onCancel?: Partial<T>): () => void
    }
    /**
     * Hand-rolled reaction, for work that should not go through a render.
     * Survives the storage being created or replaced under the key, and calls
     * the listener when that happens — the data behind the key just changed.
     */
    subscribe: (listener: Listener, keys?: readonly (keyof T)[]) => () => void
}

/** The built-in api of the storage under `key`, resolved on every call. Usable outside React. */
export function storeApi<T extends object>(key: StoreKey<T>): StoreApi<T> {
    return {
        key,

        // Reads stay optional: a component asking before <RModel /> has built
        // the storage falls back to the value it is about to be built with.
        getData: () => getStore<T>(key)?.getData(),

        setValue: (name, value) => writable<T>(key).setValue(name, value),

        // An arrow cannot carry the two signatures the type above declares, so
        // the cast puts them back on. The form itself goes to the store as it
        // came — that is where it is flattened.
        setValues: ((names: readonly (keyof T)[] | Partial<T>, values?: readonly unknown[]) => {
            const store = writable<T>(key)

            if (!Array.isArray(names)) return store.setValues(names as Partial<T>)

            store.setValues(names as (keyof T)[], values as ValuesOf<T, (keyof T)[]>)
        }) as StoreApi<T>['setValues'],

        // The rollback is forwarded by branching rather than spreading, so a field
        // whose type allows undefined keeps "no rollback" and "put undefined back"
        // apart — the same reason the store itself does it that way.
        setValueByTask: (<K extends keyof T>(
            name: K,
            task: (signal: AbortSignal) => Promise<T[K]>,
            ...onCancel: [] | [T[K]]
        ) => {
            const store = writable<T>(key)

            return onCancel.length === 0
                ? store.setValueByTask(name, task)
                : store.setValueByTask(name, task, onCancel[0])
        }) as StoreApi<T>['setValueByTask'],

        updateByTask: (<K extends keyof T>(
            name: K,
            task: (signal: AbortSignal) => Promise<ValueUpdate<T[K]>>,
            ...onCancel: [] | [T[K]]
        ) => {
            const store = writable<T>(key)

            return onCancel.length === 0
                ? store.updateByTask(name, task)
                : store.updateByTask(name, task, onCancel[0])
        }) as StoreApi<T>['updateByTask'],

        // Same shape as setValues() above: the form goes to the store as it
        // came, and the cast puts back the two signatures an arrow cannot hold.
        setValuesByTask: ((
            names: readonly (keyof T)[] | ((signal: AbortSignal) => Promise<Partial<T>>),
            task?: ((signal: AbortSignal) => Promise<readonly unknown[]>) | Partial<T>,
            onCancel?: Partial<T>,
        ) => {
            const store = writable<T>(key)

            // In the object form the rollback is the second argument, not the third.
            if (typeof names === 'function') return store.setValuesByTask(names, task as Partial<T>)

            const positional = task as (signal: AbortSignal) => Promise<ValuesOf<T, (keyof T)[]>>

            return store.setValuesByTask(names as (keyof T)[], positional, onCancel)
        }) as StoreApi<T>['setValuesByTask'],

        subscribe: (listener, keys) => {
            let unsubscribe = getStore<T>(key)?.subscribe(listener, keys) ?? noop

            const unwatch = subscribeStorage(key, () => {
                unsubscribe()
                unsubscribe = getStore<T>(key)?.subscribe(listener, keys) ?? noop
                listener()
            })

            return () => {
                unsubscribe()
                unwatch()
            }
        },
    }
}

/**
 * The store to write into, or the reason there is none. A write that lands
 * after the storage was dropped used to disappear without a word; it says so
 * now, the way the reading hooks and DataApi do.
 */
function writable<T extends object>(key: StoreKey<T>) {
    const store = getStore<T>(key)

    if (!store) {
        throw new Error(
            `storeApi('${key}') has no storage to write to. Mount <RModel storageKey="${key}" />, `
            + `or create the storage with createStore('${key}', …) before writing to it.`,
        )
    }

    return store
}

