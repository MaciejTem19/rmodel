/* The bridge the two halves of a model reach their store through — DataApi.ts
   and StoreSelectors.ts are the halves built on it. A part is written against
   the data and gets to its store through the protected members below, so it
   never has a store threaded into it.

   Those members are pass-throughs, deliberately: the bridge holds the
   attachment and nothing else. Everything that lives as long as the storage —
   the data, the listeners, the tasks in flight — is held by the Store, in one
   place, and ended in one place by its dispose(). */
import type { AnyStore, Listener, StoreRefs } from './types.js'

/**
 * What binds half of a model — the api or the selectors — to the store it
 * belongs to. The Store hands itself to every part it is built with, so an
 * author writes a part against the data and never threads a store reference
 * around; this is the whole of what a part may do with the store it got.
 *
 * `R` is the refs of the storage it belongs to, and is optional because most
 * parts never touch them: leave it out and there are none to reach for. Name
 * it — the same type the key names — and `this.refs` is that object.
 */
export abstract class StoreApiBridge<T extends object, R extends object = StoreRefs> {
    #store: AnyStore<T> | null = null
    /** Told apart from "not built yet", so the error can say which one it is. */
    #dropped = false

    /** Called by the Store this part is built into. Not meant for callers. */
    attach(store: AnyStore<T>) {
        this.#store = store
        this.#dropped = false
    }

    /**
     * Called by Store.dispose() when the storage this part belongs to is cut
     * loose. A no-op once the part has been attached to a newer store — that
     * one is live, and this is an older storage being cleaned up.
     *
     * Only the attachment is let go of here. What the part started against
     * that storage — its tasks, its subscriptions — belongs to the store, and
     * the same dispose() ends it a line later.
     */
    detach(store: AnyStore<T>) {
        if (this.#store !== store) return

        this.#store = null
        this.#dropped = true
    }

    /**
     * Cancels every task in flight on this part's storage. Silent while there
     * is no storage: there is nothing left running to call off.
     */
    cancelTasks() {
        this.#store?.cancelTasks()
    }

    /** The store this part belongs to. */
    protected get store(): AnyStore<T> {
        if (!this.#store) this.#noStore()

        return this.#store
    }

    /** Why there is no store to work with — the two cases read very differently. */
    #noStore(): never {
        throw new Error(
            this.#dropped
                ? `${this.constructor.name} was used after its storage was dropped — the `
                  + `<RModel /> holding it unmounted, or another storage took the key. `
                  + `<RModel remember /> keeps one alive across unmounts.`
                : `${this.constructor.name} was used before its Store was built`,
        )
    }

    /** Whether this part still has a storage — a check that does not throw. */
    protected get attached(): boolean {
        return this.#store !== null
    }

    /** The data as of right now. */
    protected get data(): T {
        return this.store.getData()
    }

    /**
     * The refs of this part's storage — the very object <RModel refs={…} /> was
     * given, not a copy, and the same one useRRef() hands to the components.
     *
     * The opposite of the data in every way: written in place, listened to by
     * nobody, and never the reason anything re-renders. So it is where a part
     * keeps what belongs to the storage but is not state — the cancel of a task
     * still in flight, a DOM node a handler reaches for, the last time it ran.
     * Anything the app should re-render for is a field of the data instead.
     *
     *   class SearchApi extends DataApi<Search, SearchRefs> {
     *     run = (term: string) => {
     *       this.refs.cancelSearch?.()
     *       this.refs.cancelSearch = this.setValueByTask('hits', (signal) => find(term, signal))
     *     }
     *   }
     *
     * Throws while the part has no storage, on the same terms as `data`: the
     * refs belong to the storage, so there is no object to write into until
     * there is one. Empty by default — a part built without `R` names no refs
     * and has none to take.
     */
    protected get refs(): R {
        return this.store.refs as R
    }

    /**
     * Runs `body` as a task of this part's storage — Store.trackTask() is what
     * does it, and what holds it until it settles. Returns the cancel.
     *
     * `onDone` is handed what the task returned, and only if it was still
     * running when it finished — a task called off never reaches it. See
     * Store.trackTask() for why that gate is where it is.
     *
     * Reading `store` is what makes a task on a part with no storage fail
     * here, at the call site, rather than as a rejection nobody is holding
     * once the task gets round to finishing: there is nowhere to write the
     * result, so there is no point running.
     */
    protected trackTask<V>(
        body: (signal: AbortSignal) => Promise<V>,
        onDone?: (value: V) => void,
    ): () => void {
        return this.store.trackTask(body, onDone)
    }

    /**
     * Reacts to writes without going through a render. The subscription
     * belongs to the store, which drops it when the storage is dropped, so it
     * cannot outlive the attachment it was made against. Returns the
     * unsubscribe, for letting go sooner.
     */
    protected subscribe(listener: Listener, keys?: readonly (keyof T)[]) {
        return this.store.subscribe(listener, keys)
    }
}
