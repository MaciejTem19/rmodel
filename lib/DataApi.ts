/* The write half of a model, in a file of its own: the two halves share a
   base and nothing else, so neither has to be read to follow the other. Every
   write here goes through the store the bridge underneath is attached to. */
import { StoreApiBridge } from './StoreApiBridge.js'
import type { StoreEvents, StoreRefs, StoreTask, ValueUpdate, ValuesOf } from './types.js'


/**
 * Class representing API of Storage. It is used as an imperative api for storage actions. 
 * Also contains primitive methods used for data manipulation. 
 * Fields should be written as arrow functions.
 * Those functions should represent actions made on data within the storage.
 * 
 * @argument T data of the storage this api writes to
 * @argument R refs of the storage, when the api reaches them through `this.refs`. Empty by default
 * @argument E events of the storage, naming what `this.emit()` may announce. Empty by default
*/
export abstract class DataApi<
    T extends object,
    R extends object = StoreRefs,
    E extends object = StoreEvents,
> extends StoreApiBridge<T, R> {
    /**
     * A phantom: `declare`, so it is types and nothing at runtime. The refs and
     * the events of an api are otherwise named only where the checker lets them
     * slide — the refs in protected members, the events in method parameters it
     * compares loosely — this is what makes an api over one set of events fail
     * to fit a key that names another.
     */
    protected declare readonly parts?: [R, E]

    /**
     * Announces store event to all listeners of event specified by `name` with `argument`. 
     * If no listeners are listening for event - no one gets notified. 
     * 
     * throws Error, if Store doesn't have event named `name` or argument of event is different type than required by store. 
     * 
     * @param name event type name from `E` class.
     * @param argument event data passed to argument of handler callback
     */
    emit<K extends keyof E>(name: K, argument: E[K]) {
        this.store.emit(name, argument)
    }


    /**
     * Sets Store field named `name` and sets its value with `value`. This action causes a rerender if the value changes. If not - nothing happens.
     * 
     * @param name name of a field to be set
     * @param value new value of the field
     */
    setValue<K extends keyof T>(name: K, value: T[K]) {
        this.store.setValue(name, value)
    }


    /**
     * Writes several values under specified fields in one go. Every new value causes its own rerender, but only for the fields that changed
     * @param names names of values represented as an`array`
     * @param values new values represented as an`array`
     */
    setValues<const K extends readonly (keyof T)[]>(names: K, values: ValuesOf<T, K>): void
    /**
     * Writes several values under specified fields in one go. Every new value causes its own rerender, but only for the fields that changed
     * @param values object representing what values under which fields should be set
     */
    setValues(values: Partial<T>): void
    setValues(names: readonly (keyof T)[] | Partial<T>, values?: readonly unknown[]) {
        // Handed over as it came: the store takes both forms and is the one
        // place that flattens them, so taking an object apart here would only
        // be building the pair it is about to build again.
        if (!Array.isArray(names)) return this.store.setValues(names as Partial<T>)

        this.store.setValues(names as (keyof T)[], values as ValuesOf<T, (keyof T)[]>)
    }

    /**
     * Updates one value under `name` with value resulted by calling `next` with old value as an argument. The update causes a rerender, if the value changes.
     * @param name name of a field to be updated
     * @param next update callback 
    */
    updateValue<K extends keyof T>(name: K, next: (value: T[K]) => T[K]) {
        this.store.setValue(name, next(this.data[name]))
    }

    /**
     * Updates multiple values in one go with one rerender. Updated values are acquired by calling the `next` callback with the old data as its argument. 
     * The returned object represents what fields should be set with what values.
    * @param next update callback, returning what fields should be set with what values
    */
    updateValues(next: (data: T) => Partial<T>) {
        this.store.setValues(next(this.data))
    }

    
    /**
     * Sets value under field `name` with the result of async `task`, which is immediately called.
     * 
     * If the task is cancelled, value stays the same.
     * @param name name of a field to be set
     * @param task callback returning data to be set
     * @param onCancel value set under `name` the moment the task gets cancelled. Left out, a cancelled
     * task writes nothing at all. A cancel caused by dropping the storage writes nothing either way.
     * @returns function, which cancels task execution. If task is already cancelled or is done, does nothing.
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
        // Branched rather than spread, so a field whose type allows undefined
        // keeps "no rollback" and "put undefined back" apart.
        return onCancel.length === 0
            ? this.store.setValueByTask(name, task)
            : this.store.setValueByTask(name, task, onCancel[0])
    }

    /**
     * Updates value under field `name` with result of async `task`, which is immediately called.
     *
     * The task decides which of the two it does by what it returns: a value is set as it stands,
     * a callback is called with the field as it stands **at the write** and its result is set instead.
     * That second form is the one to reach for after an `await` — a value read before the request
     * went out is old news by the time the answer lands.
     *
     * If the task is cancelled, nothing is written.
     *
     * @param name name of a field to be updated
     * @param task callback returning the new value, or a callback building it from the current one
     * @param onCancel value set under `name` the moment the task gets cancelled. Left out, a cancelled
     * task writes nothing at all. A cancel caused by dropping the storage writes nothing either way.
     * @returns function, which cancels task execution. If task is already cancelled or is done, does nothing.
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
        return onCancel.length === 0
            ? this.store.updateByTask(name, task)
            : this.store.updateByTask(name, task, onCancel[0])
    }

    /**
     * Sets values under fields named in `names` with values returned by async `task`, matched to the
     * names in that same order. One write when the task settles, so one rerender however many fields
     * it names.
     *
     * If the task is cancelled, none of the fields are written — there is no half-written set.
     *
     * @param names names of fields to be set, represented as an `array`
     * @param task callback returning new values as an `array`, in the order of `names`
     * @param onCancel fields to be set the moment the task gets cancelled — a loading flag put back,
     * say. Left out, a cancelled task writes nothing at all. It need not name the fields above.
     * @returns function, which cancels task execution. If task is already cancelled or is done, does nothing.
     */
    setValuesByTask<const K extends readonly (keyof T)[]>(
        names: K,
        task: (signal: AbortSignal) => Promise<ValuesOf<T, K>>,
        onCancel?: Partial<T>,
    ): () => void
    /**
     * The same in one object: async `task` returns what values should be set under which fields.
     * Fields it leaves out are left alone, and everything it names is written in one go.
     *
     * If the task is cancelled, nothing is written, unless `onCancel` fallback is setted.
     *
     * @param task callback returning object representing what values under which fields should be set
     * @param onCancel fields to be set the moment the task gets cancelled. Left out, a cancelled task
     * writes nothing at all.
     * @returns function, which cancels task execution. If task is already cancelled or is done, does nothing.
     */
    setValuesByTask(
        task: (signal: AbortSignal) => Promise<Partial<T>>,
        onCancel?: Partial<T>,
    ): () => void
    setValuesByTask(
        names: readonly (keyof T)[] | ((signal: AbortSignal) => Promise<Partial<T>>),
        task?: ((signal: AbortSignal) => Promise<readonly unknown[]>) | Partial<T>,
        onCancel?: Partial<T>,
    ): () => void {
        // Handed over as it came: the store takes both forms, and in the object
        // form the rollback is the second argument rather than the third.
        if (typeof names === 'function') return this.store.setValuesByTask(names, task as Partial<T>)

        const positional = task as (signal: AbortSignal) => Promise<ValuesOf<T, (keyof T)[]>>

        return this.store.setValuesByTask(names as (keyof T)[], positional, onCancel)
    }

    /**
     * Runs async `task` and sets whatever fields it returns, in one go. For writing own async actions
     * in an api — the methods above are this one with the write already decided.
     *
     * A cancel can never leave half of the write behind: the task only computes, this is the only
     * place that writes, and it writes once. A task returning nothing writes nothing.
     *
     * `onCancel` is for state set before the task started — a loading flag — and is written the
     * moment the cancel happens, not when the task settles. A cancel that comes from the storage
     * being dropped writes nothing at all: there is nowhere left to write it.
     *
     * @param task callback returning fields to be set, or nothing to write nothing
     * @param onCancel fields to be set the moment the task gets cancelled
     * @returns function, which cancels task execution. If task is already cancelled or is done, does nothing.
     */
    protected runTask(task: StoreTask<T>, onCancel?: Partial<T>): () => void {
        // The storage this task was started against. The rollback is checked
        // against it, so a task called off because its storage was replaced
        // cannot write into the storage that took its place.
        const owner = this.store

        return this.trackTask(async (signal) => {
            if (onCancel) {
                signal.addEventListener(
                    'abort',
                    () => {
                        if (this.attached && this.store === owner) this.setValues(onCancel)
                    },
                    { once: true },
                )
            }

            const values = await task(signal)

            // The rollback, if there was one, already went in above.
            if (signal.aborted) return

            if (values) this.setValues(values)
        })
    }
}
