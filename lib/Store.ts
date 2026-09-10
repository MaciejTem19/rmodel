/* The store itself: one data object, synchronous writes, per-field listeners,
   and the tasks running against them. Everything with the storage's lifetime
   is held here, so dispose() is the one place that ends all of it. It knows
   nothing about React or about the registry — createStore() in storage.ts is
   what puts one where the hooks can find it. */
import { DataApi } from './DataApi.js'
import { StoreSelectors } from './StoreSelectors.js'
import type { Listener, StoreEvents, StoreRefs, ValueUpdate, ValuesOf } from './types.js'

/** Stand-ins for a store built without an api, or without selectors. */
class NoApi<T extends object> extends DataApi<T> {}
class NoSelectors<T extends object> extends StoreSelectors<T> {}

/**
 * Holds one data object and writes into it synchronously: once setValues()
 * returns, getData() already gives the new data and every subscriber has run.
 *
 *   const store = new Store('page', { name: 'Coffee', qty: 2, done: false })
 *   store.setValues({ name: 'Tea', qty: 5 })
 *   store.getData()                        // { name: 'Tea', qty: 5, done: false }
 *
 * The api and the selectors are two composed parts, each attached to the store
 * on construction; leave either out and the store carries an empty one.
 *
 * Listeners sit on single fields, so a write only reaches the fields it
 * actually changed: setValue('done', true) never wakes a listener on 'name'.
 *
 * The data object itself is replaced, never mutated, so a snapshot taken
 * before the write keeps the values it was taken with.
 *
 * Beside the data it carries `refs`: an object of the same lifetime that
 * nothing renders from. See the field below.
 *
 * `E` is the third thing it names: the events it can announce. Types only —
 * the store holds no value for them.
 */
export class Store<
    T extends object,
    A extends DataApi<T> = DataApi<T>,
    S extends StoreSelectors<T, any> = StoreSelectors<T, any>,
    R extends object = StoreRefs,
    E extends object = StoreEvents,
> {
    readonly key: string
    /** The api this store was built with — its writes go through this store. */
    readonly dataApi: A
    /** The selectors this store was built with. */
    readonly selectors: S
    /**
     * The other half of what a storage holds, and the opposite of the data in
     * every way that matters: written in place rather than replaced, listened
     * to by nobody, and never the reason anything re-renders. It is where a
     * subtree keeps what it shares but does not show — a DOM node, a scroll
     * position, the id of a timer still running — and useRRef() is how a
     * component takes a field of it as a ref.
     *
     * The object is the one it was built with, not a copy: whoever handed it in
     * is holding the very same thing the hooks write into.
     */
    readonly refs: R

    /** Set by dispose(), and read by the rollbacks below: a cancel that came
     *  with the storage has nobody left to write for. */
    #disposed = false

    #data: T
    #keyListeners = new Map<keyof T, Set<Listener>>()
    #allListeners = new Set<Listener>()
    /** One set of handlers per event name. Held here, so dispose() ends them. */
    #eventListeners = new Map<keyof E, Set<(argument: any) => void>>()
    /** One controller per task still in flight, so they can all be called off. */
    
    #tasks = new Set<AbortController>()

    constructor(key: string, defaultValue: T, dataApi?: A, selectors?: S, refs?: R) {
        this.key = key
        this.#data = defaultValue
        this.dataApi = dataApi ?? (new NoApi<T>() as A)
        this.selectors = selectors ?? (new NoSelectors<T>() as S)
        this.refs = refs ?? ({} as R)

        // Composition both ways: the store owns its parts, the parts read and
        // write through the store.
        this.dataApi.attach(this)
        this.selectors.attach(this)
    }

    /** The data as of right now — same object as getData(). */
    get data(): T {
        return this.#data
    }

    getData(): T {
        return this.#data
    }

    setValue<K extends keyof T>(name: K, value: T[K]) {
        this.setValues([name], [value] as ValuesOf<T, [K]>)
    }

    /**
     * Writes several fields in one go — one notification and one render however
     * many it names, and fields it leaves out are left alone.
     *
     * Either as the fields themselves:
     *
     *   store.setValues({ name: 'Tea', qty: 5 })
     *
     * or positionally, `values[i]` under `names[i]`:
     *
     *   store.setValues(['name', 'qty'], ['Tea', 5])
     *
     * The object is the form to write by hand — it is a subset of the data, and
     * TypeScript checks it as one, so a name and its value cannot drift apart.
     * The positional form is for callers that already hold the names as a list:
     * a setter built for a fixed set of fields, or a slice being written back.
     */
    setValues<const K extends readonly (keyof T)[]>(names: K, values: ValuesOf<T, K>): void
    setValues(values: Partial<T>): void
    setValues(names: readonly (keyof T)[] | Partial<T>, values?: readonly unknown[]) {
        // The two forms meet here and stop being two: below this line there is
        // only a list of names and a list of values in the same order.
        const [keys, written] = valuesToWrite<T>(names, values)

        if (keys.length !== written.length) {
            throw new Error(
                `setValues() got ${keys.length} keys but ${written.length} values`,
            )
        }

        const changed: (keyof T)[] = []
        let next: T | null = null

        keys.forEach((name, index) => {
            const value = written[index] as T[keyof T]

            if (Object.is(this.#data[name], value)) return

            next ??= { ...this.#data }
            next[name] = value
            changed.push(name)
        })

        if (!next) return

        this.#data = next
        this.#notify(changed)
    }

    /**
     * Runs `listener` after a write that changed something. With `keys` the
     * listener only hears about those fields; without them, about every
     * field. Returns the unsubscribe.
     *
     * This is the low-level entry, for the hooks and for storeApi(). App code
     * subscribes by key — storeApi(key).subscribe(), or a hook — so that the
     * subscription follows the key: a storage replaced under it takes the
     * listeners with it, where one held on this object would be left behind.
     */

    
    /**
     * Writes one field with what an async task hands back, and gives back the
     * cancel.
     *
     *   const cancel = store.setValueByTask('threads', (signal) => fetchThreads(signal))
     *
     * The task hands back the value, plainly. For one that may instead build
     * the new value out of the old, use updateByTask() below.
     *
     * Nothing is written until the task finishes, and nothing is written at all
     * if it was called off first — by that cancel, by cancelTasks(), or by the
     * storage being dropped. The task is handed the signal so it can stop the
     * work as well as the write; ignoring it is safe, the result is dropped
     * either way.
     */
    setValueByTask<K extends keyof T>(
        name: K,
        task: (signal: AbortSignal) => Promise<T[K]>,
    ): () => void
    setValueByTask<K extends keyof T>(
        name: K,
        task: (signal: AbortSignal) => Promise<T[K]>,
        onCancel: T[K],
    ): () => void
    setValueByTask<K extends keyof T>(
        name: K,
        task: (signal: AbortSignal) => Promise<T[K]>,
        ...onCancel: [] | [T[K]]
    ): () => void {
        // Branched rather than spread: a field whose type allows undefined would
        // otherwise have "no rollback" and "put undefined back" collapse into the
        // same call, and a spread of a union of tuples is not one call anyway.
        return onCancel.length === 0
            ? this.updateByTask(name, task)
            : this.updateByTask(name, task, onCancel[0])
    }

    /**
     * The same, for a task that decides which of the two it is doing by what it
     * hands back: a value is written as it stands, a callback is handed the
     * field and its result is written instead.
     *
     *   store.updateByTask('threads', (signal) => fetchThreads(signal))
     *
     *   store.updateByTask('threads', async (signal) => {
     *     const arrived = await fetchThreads(signal)
     *
     *     return (threads) => [...threads, ...arrived]
     *   })
     *
     * The callback is run at the write, not at the start, so it is handed the
     * field as it stands **then** — after whatever else landed while the task
     * was in flight. That is the difference that matters for a task: a value
     * read up front would be stale by the time it is written back, and this is
     * how a slow request appends to a list rather than clobbering it.
     *
     * A field whose own type is a function cannot be handed back by value here,
     * the callback form being what a function is taken for — hand back a
     * callback returning it, or use setValueByTask(), which takes no callback
     * and so has no such ambiguity.
     */
    updateByTask<K extends keyof T>(
        name: K,
        task: (signal: AbortSignal) => Promise<ValueUpdate<T[K]>>,
    ): () => void
    updateByTask<K extends keyof T>(
        name: K,
        task: (signal: AbortSignal) => Promise<ValueUpdate<T[K]>>,
        onCancel: T[K],
    ): () => void
    updateByTask<K extends keyof T>(
        name: K,
        task: (signal: AbortSignal) => Promise<ValueUpdate<T[K]>>,
        ...onCancel: [] | [T[K]]
    ): () => void {
        const rollback = this.#rollback(name, onCancel)

        return this.trackTask(this.#withRollback(task, rollback), (value) => {
            // Which of the two it was is decided here, on what actually
            // arrived — and the field is read right beside the write it feeds,
            // so nothing can land between them.
            const next = typeof value === 'function'
                ? (value as (previous: T[K]) => T[K])(this.data[name])
                : value

            this.setValue(name, next)
        })
    }

    /**
     * The same for several fields, in the two shapes setValues() itself takes.
     * Either the task hands back the fields to write:
     *
     *   store.setValuesByTask(async (signal) => ({
     *     threads: await fetchThreads(signal),
     *     status: 'idle',
     *   }))
     *
     * or the names are named up front and the task hands back their values in
     * that order:
     *
     *   store.setValuesByTask(['threads', 'status'], async (signal) => [
     *     await fetchThreads(signal),
     *     'idle',
     *   ])
     *
     * Either way it is one write when the task finishes — one notification and
     * one render, all the fields or none — and no write at all if it was
     * called off first. That is the whole point of computing first and writing
     * once: a cancel cannot leave half of it behind.
     */
    setValuesByTask<const K extends readonly (keyof T)[]>(
        names: K,
        task: (signal: AbortSignal) => Promise<ValuesOf<T, K>>,
        onCancel?: Partial<T>,
    ): () => void
    setValuesByTask(
        task: (signal: AbortSignal) => Promise<Partial<T>>,
        onCancel?: Partial<T>,
    ): () => void
    setValuesByTask(
        names: readonly (keyof T)[] | ((signal: AbortSignal) => Promise<Partial<T>>),
        task?: ((signal: AbortSignal) => Promise<readonly unknown[]>) | Partial<T>,
        onCancel?: Partial<T>,
    ): () => void {
        if (typeof names === 'function') {
            const rollback = task as Partial<T> | undefined

            return this.trackTask(
                this.#withRollback(names, rollback),
                (values) => this.setValues(values),
            )
        }

        const positional = task as (signal: AbortSignal) => Promise<ValuesOf<T, (keyof T)[]>>

        return this.trackTask(
            this.#withRollback(positional, onCancel),
            (values) => this.setValues(names as (keyof T)[], values),
        )
    }

    /** The fields a one-field rollback writes, or nothing where none was asked for. */
    #rollback<K extends keyof T>(name: K, onCancel: [] | [T[K]]): Partial<T> | undefined {
        if (onCancel.length === 0) return undefined

        const values: Partial<T> = {}

        values[name] = onCancel[0]

        return values
    }

    /**
     * The task with its rollback wired in: `values` are written the moment it is
     * called off, rather than whenever it gets round to settling. That ordering
     * is the point — a search that calls the previous one off and then sets its
     * own loading flag would otherwise have that flag wiped by the old task's
     * rollback landing late.
     *
     * A cancel that came from the storage being dropped writes nothing at all:
     * there is nobody left to write for.
     */
    #withRollback<V>(
        task: (signal: AbortSignal) => Promise<V>,
        values: Partial<T> | undefined,
    ): (signal: AbortSignal) => Promise<V> {
        if (!values) return task

        return (signal) => {
            signal.addEventListener('abort', () => {
                if (!this.#disposed) this.setValues(values)
            }, { once: true })

            return task(signal)
        }
    }

    subscribe(listener: Listener, keys?: readonly (keyof T)[]) {
        if (!keys) {
            this.#allListeners.add(listener)

            return () => {
                this.#allListeners.delete(listener)
            }
        }

        for (const name of keys) {
            const listeners = this.#keyListeners.get(name) ?? new Set<Listener>()

            this.#keyListeners.set(name, listeners)
            listeners.add(listener)
        }

        return () => {
            for (const name of keys) {
                const listeners = this.#keyListeners.get(name)

                if (!listeners) continue

                listeners.delete(listener)

                if (listeners.size === 0) this.#keyListeners.delete(name)
            }
        }
    }

    /**
     * Announces that something happened. The handlers listening for `name` run
     * there and then, in the caller's own stack, and nothing is written and
     * nothing is kept:
     *
     *   store.emit('touchedAt', Date.now())
     *   store.emit('itemAdded', { id })
     *
     * One argument, always, and its type is what the container says the name
     * carries: `{ touchedAt: number }` takes a number and nothing else. An
     * event that would rather carry nothing declares `null` or `void` and is
     * passed it — the argument is the payload, not an optional extra.
     *
     * This is the third thing a storage holds, and it is the one the other two
     * cannot say. A field cannot say "it happened again" — a write of the value
     * already there changes nothing and notifies nobody — and a ref says
     * nothing at all. An event is neither read nor stored: nobody can ask what
     * it was, only be there when it happens.
     *
     * Nothing rerenders by itself. A handler that sets React state renders the
     * component that owns it, and does so inside the write that emitted — one
     * render, not two.
     *
     * An event nobody is listening for is not an error; it goes nowhere.
     */
    emit<K extends keyof E>(name: K, argument: E[K]) {
        const listeners = this.#eventListeners.get(name)

        if (!listeners) return

        // A copy: a handler may unsubscribe itself, or a sibling, as it runs.
        for (const handler of [...listeners]) handler(argument)
    }

    /**
     * Listens for one event. Returns the unsubscribe.
     *
     * The handler takes the one argument the container types for that name —
     * the same thing emit() was handed, passed straight through.
     *
     * It belongs to this store, so the storage being dropped ends it — that is
     * the whole reason the handlers live here rather than in a registry of
     * their own. What outlives an unmount is the storage's business, and
     * <RModel remember /> is how that is asked for.
     *
     * Nothing is replayed: a handler added after an event was emitted hears
     * nothing about it. What has to be there for a latecomer is data.
     */
    onEvent<K extends keyof E>(name: K, handler: (argument: E[K]) => void): () => void {
        const listeners = this.#eventListeners.get(name) ?? new Set<(argument: any) => void>()

        this.#eventListeners.set(name, listeners)

        // The set is what dedupes: the same function on the same name twice is
        // the one handler it already was.
        listeners.add(handler)

        // Handlers come and go in effects, under a hook nobody calls by hand,
        // so both ends of that are printed.
        console.log(`[store ${this.key}] + handler on '${String(name)}'`)

        return () => {
            const current = this.#eventListeners.get(name)

            // Nothing to drop: no set left, or this handler is already off it
            // because the same unsubscribe was called twice.
            if (!current?.delete(handler)) return

            if (current.size === 0) this.#eventListeners.delete(name)

            console.log(`[store ${this.key}] - handler off '${String(name)}'`)
        }
    }

    /**
     * Runs `body` as a task of this store: hands it a signal, holds its
     * controller until it settles, and gives back the cancel. An abort is not
     * a failure and is swallowed; anything else `body` throws stays visible as
     * a rejection.
     *
     * `onDone` is handed what the task returned, and only for a task that was
     * still running when it finished. One that was called off — by the cancel
     * below, by cancelTasks(), or by the storage being dropped — never reaches
     * it, even when the promise it was waiting on resolves happily afterwards:
     * a body is free to ignore its signal, and this is where that result is
     * dropped rather than written. That is what makes the callback safe to
     * write from — a cancel means no write, always.
     *
     * The store owns the task rather than the part that started it — a task
     * outlives the call that began it, and what it is waiting to write into is
     * this store, so this is what its life is measured against.
     */
    trackTask<V>(body: (signal: AbortSignal) => Promise<V>, onDone?: (value: V) => void): () => void {
        const controller = new AbortController()

        this.#tasks.add(controller)

        void body(controller.signal)
            .then((value) => {
                // Read here, at the last possible moment, rather than trusted
                // to the body: whatever it was waiting on has landed, and this
                // is the one gate between it and the write.
                if (controller.signal.aborted) return

                onDone?.(value)
            })
            .catch((error) => {
                if (controller.signal.aborted) return

                throw error
            })
            .finally(() => {
                this.#tasks.delete(controller)
            })

        return () => {
            // Gone from the set means it already settled, or was cancelled
            // before: either way there is nothing left to call off.
            if (!this.#tasks.delete(controller)) return

            if (!controller.signal.aborted) controller.abort()
        }
    }

    /** Cancels every task this store still has in flight. */
    cancelTasks() {
        const running = [...this.#tasks]

        this.#tasks.clear()
        running.forEach((controller) => controller.abort())
    }

    /**
     * Cuts the store loose: its parts let go of it, the tasks running against
     * it are called off, and the listeners are dropped. The mirror of the
     * constructor, which is where the parts were attached — storage.ts calls
     * this when the storage leaves the registry.
     *
     * The parts go first, on purpose. A task cancelled here then finds its
     * part unattached and writes nothing, which is what tells a dropped
     * storage apart from an ordinary cancel — see DataApi.runTask().
     */
    dispose() {
        this.#disposed = true

        this.dataApi.detach(this)
        this.selectors.detach(this)

        this.cancelTasks()

        // Counted before the clear, since after it there is nothing to count.
        // They go all at once rather than one at a time, so this is the only
        // place their leaving is printed — onEvent() logs a handler dropped by
        // whoever added it, not one that went down with the storage.
        let handlers = 0

        for (const listeners of this.#eventListeners.values()) handlers += listeners.size

        console.log(`[store ${this.key}] dispose · ${handlers} handler(s) went with it`)

        // Nothing can reach this store to write to it any more, so a listener
        // left here would never hear anything again. The event handlers go the
        // same way and for the same reason: they were listening to this
        // storage, and there is no longer one to listen to.
        this.#keyListeners.clear()
        this.#allListeners.clear()
        this.#eventListeners.clear()
    }

    #notify(changed: (keyof T)[]) {
        // A listener can sit on several of the changed fields — `called` keeps
        // it to one call. Copies: a listener may unsubscribe itself, or a
        // sibling, while we are walking the sets.
        const called = new Set<Listener>()

        const run = (listener: Listener) => {
            if (called.has(listener)) return

            called.add(listener)
            listener()
        }

        for (const name of changed) {
            const listeners = this.#keyListeners.get(name)

            if (listeners) [...listeners].forEach(run)
        }

        for (const listener of [...this.#allListeners]) run(listener)
    }
}

/**
 * The two shapes a multi-field write comes in, flattened into the one pair the
 * store writes with: the names, and their values in the same order.
 *
 *   valuesToWrite({ name: 'Tea', qty: 5 })          // [['name', 'qty'], ['Tea', 5]]
 *   valuesToWrite(['name', 'qty'], ['Tea', 5])      // the same, untouched
 *
 * An object is only the pair it already spells out, so this is where the object
 * form stops being a second kind of write: everything below it — the change
 * detection, the one notification — sees a list of names either way.
 *
 * Only own enumerable keys count, so a field the object leaves out is left
 * alone. A field it names as undefined is written, which is what makes
 * { error: undefined } a way to clear one.
 */
function valuesToWrite<T extends object>(
    names: readonly (keyof T)[] | Partial<T>,
    values?: readonly unknown[],
): [readonly (keyof T)[], readonly unknown[]] {
    if (Array.isArray(names)) return [names, values ?? []]

    const written = names as Partial<T>
    const keys = Object.keys(written) as (keyof T)[]

    return [keys, keys.map((name) => written[name])]
}
