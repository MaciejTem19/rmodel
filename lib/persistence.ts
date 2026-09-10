/* Data that outlives the tab: a storage's data written to the browser as JSON,
   and the two ways back from it. Nothing here happens on its own — a store
   never saves itself, the app says when — and nothing here can fail loudly on
   the way back: a load that cannot find what it was after falls back to the
   default value it was handed. */
import { getStore } from './storage.js'
import { storeApi } from './storeApi.js'
import type { StoreKey } from './types.js'

/**
 * What a saved storage looks like in the browser: the data, and the key it was
 * saved under. The key travels with the data so a load can tell that what it
 * found is what it asked for — a leftover from a key that has since been
 * renamed reads as nothing saved, rather than as data for the current one.
 */
type SavedStore = { key: string, data: unknown }

/** What every saved storage sits under, so the keys cannot collide with the app's own. */
const BROWSER_PREFIX = 'rmodel:'

/**
 * Where the storage under `key` is saved in the browser.
 * @param key store key
 * @returns key the data sits under in the browser
 */
export function browserKey(key: string): string {
    return `${BROWSER_PREFIX}${key}`
}

/**
 * localStorage, or undefined where there is none to work with — a server render,
 * a browser with site data switched off.
 * @returns browser storage, or undefined where there is none
 */
function browserStorage(): Storage | undefined {
    try {
        return globalThis.localStorage ?? undefined
    } catch {
        return undefined
    }
}

/**
 * Saves what the storage under `key` holds, or the data handed in instead, with
 * the key saved alongside it. Throws for a key with nothing behind it and no
 * data handed in, the way the reading hooks do.
 * @type T data type of store
 * @param key store key
 * @param data what to save instead of what the storage holds
 * @returns whether the browser took it
 */
export function saveToBrowser<T extends object>(key: StoreKey<T>, data?: T): boolean {
    const value = data ?? getStore<T>(key)?.getData()

    if (!value) {
        throw new Error(
            `saveToBrowser('${key}') found no storage to save. Mount <RModel storageKey="${key}" />, `
            + `create the storage with createStore('${key}', …), or hand the data in: `
            + `saveToBrowser('${key}', data).`,
        )
    }

    const storage = browserStorage()

    if (!storage) return false

    // Outside the try on purpose: a value JSON cannot carry is a bug in the
    // caller, where a browser refusing the write below is a condition to
    // report back.
    const json = JSON.stringify({ key, data: value } satisfies SavedStore)

    try {
        storage.setItem(browserKey(key), json)

        return true
    } catch {
        return false
    }
}

/**
 * Keeps the storage under `key` saved: writes it to the browser as soon as there
 * is one, and again after every write to it. A key with nothing behind it saves
 * nothing rather than throwing.
 * @type T data type of store
 * @param key store key
 * @returns function which stops saving
 */
export function keepInBrowser<T extends object>(key: StoreKey<T>): () => void {
    const save = () => {
        // Guarded rather than trusted: this also runs for the notification that
        // says the storage has just been dropped, and there is nothing to save
        // then — saveToBrowser() would throw at whoever unmounted.
        if (getStore<T>(key)) saveToBrowser(key)
    }

    save()

    return storeApi<T>(key).subscribe(save)
}

/**
 * Reads JSON into T, falling back to `defaultValue` field by field — for data
 * which came from somewhere other than the browser. Without a default value the
 * parsed object is taken at its word, and broken JSON reads as undefined.
 * @type T type of the loaded data
 * @param json JSON to read
 * @param defaultValue what the result falls back to, field by field
 * @returns data as T, or undefined without a default value and nothing to read
 */
export function load<T extends object>(json: string, defaultValue: T): T
export function load<T extends object>(json: string): T | undefined
export function load<T extends object>(json: string, defaultValue?: T): T | undefined {
    return shape(parseObject(json), defaultValue)
}

/**
 * The same from the browser: what saveToBrowser() last wrote under `key`.
 * Nothing here is an error — never saved, saved under a key which has since been
 * renamed, or site data switched off all read as the default value.
 * @type T data type of store
 * @param key store key
 * @param defaultValue what the result falls back to, field by field
 * @returns saved data as T, or the default value where there is nothing to read
 */
export function loadFromBrowser<T extends object>(key: StoreKey<T>, defaultValue: T): T
export function loadFromBrowser<T extends object>(key: StoreKey<T>): T | undefined
export function loadFromBrowser<T extends object>(key: StoreKey<T>, defaultValue?: T): T | undefined {
    const json = read(browserKey(key))

    if (!json) return defaultValue

    const saved = parseObject(json)

    // Ours, saved under this very key, and holding an object: anything else is
    // not what this key was asked for.
    if (!saved || saved.key !== key || !isObject(saved.data)) return defaultValue

    return shape(saved.data, defaultValue)
}

/**
 * What the browser has under `browserKey` — reading it is allowed to fail.
 * @param browserKey key the data sits under in the browser
 * @returns saved JSON, or nothing where there is none to read
 */
function read(browserKey: string): string | null | undefined {
    try {
        return browserStorage()?.getItem(browserKey)
    } catch {
        return undefined
    }
}

/**
 * The JSON as a plain object, or undefined for anything else — broken, an array,
 * a number.
 * @param json JSON to parse
 * @returns parsed object, or undefined where the JSON is not one
 */
function parseObject(json: string): Record<string, unknown> | undefined {
    try {
        const value: unknown = JSON.parse(json)

        return isObject(value) ? value : undefined
    } catch {
        return undefined
    }
}

/**
 * Whether `value` is a plain object — the one shape loading works with.
 * @param value value to check
 * @returns true for a plain object
 */
function isObject(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/**
 * The parsed data as the default value's shape: fields the default names taken
 * from the data, everything else dropped. Without a default value there is no
 * shape to hold it to, and it is taken as it came.
 * @type T data type to shape into
 * @param value parsed data
 * @param defaultValue what the result falls back to, field by field
 * @returns data as T, or undefined where there is neither
 */
function shape<T extends object>(
    value: Record<string, unknown> | undefined,
    defaultValue?: T,
): T | undefined {
    if (!defaultValue) return value as T | undefined
    if (!value) return defaultValue

    const data = { ...defaultValue }

    for (const name of Object.keys(defaultValue) as (keyof T & string)[]) {
        if (name in value) data[name] = value[name] as T[keyof T & string]
    }

    return data
}
