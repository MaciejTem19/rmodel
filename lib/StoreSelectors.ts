/* The read half of a model, in a file of its own on the same terms as
   DataApi: it reads through the store the bridge underneath is attached to,
   and holds nothing itself. */
import { StoreApiBridge } from './StoreApiBridge.js'
import type { Selector, SelectorName, SelectorValue, StoreRefs } from './types.js'

/**
 * The read half of a model: computed views, each built by select() so it carries
 * its dependencies and its comparison with it. Every field built that way is a
 * name useRSelector() reads by — a view belonging to one component goes to
 * useRCustomSelector() instead.
 *
 * Selectors are handed the storage's refs after the data, read but never
 * depended on: anything which has to be current the moment it changes is data.
 * @type T data type of store
 * @type R type of store refs
 */
export abstract class StoreSelectors<
    T extends object,
    R extends object = StoreRefs,
> extends StoreApiBridge<T, R> {
    /** A phantom, the way DataApi has one: it puts the refs where the checker can see them. */
    protected declare readonly parts?: [R]

    /**
     * Builds a selector: what to read, then the fields which wake it — those and
     * only those. Safe in a field initialiser: it touches no data.
     * @type V type of a selected value
     * @param selector what to compute, from the data and the refs
     * @param dependencies fields which wake the selector
     * @param isEqual how results are compared (`Object.is` by default)
     * @returns selector object
     */
    protected select<V>(
        selector: (data: T, refs: R) => V,
        dependencies: readonly (keyof T)[],
        isEqual?: (previous: V, next: V) => boolean,
    ): Selector<T, V, R> {
        return { dependencies, selector, isEqual }
    }

    /**
     * Runs a selector once, outside React: one of this model's own by name — the
     * same names useRSelector() takes — or one built on the spot. No
     * subscription and no comparison: this is the value as of right now.
     * @type K name of a selector
     * @type V type of a selected value
     * @param selector name of a selector, or the selector itself
     * @returns value the selector hands back
     */
    read<K extends SelectorName<T, this>>(name: K): SelectorValue<this, K>
    read<V>(selector: Selector<T, V, R>): V
    read(selector: Selector<T, any, any> | PropertyKey) {
        const resolved = typeof selector === 'object'
            ? selector
            : selectorNamed<T, unknown>(this, selector, 'read()')

        return resolved.selector(this.data, this.refs)
    }
}

/**
 * The selector a name stands for: one of the fields built with select(), and
 * nothing else the instance happens to carry. Throws where the name stands for
 * no selector.
 * @type T data type of store
 * @type V type of a selected value
 * @param selectors selectors to look the name up on
 * @param name name of a selector
 * @param where caller's name, so the error points at the call which used the name
 * @returns selector under the name
 */
export function selectorNamed<T extends object, V>(
    selectors: StoreSelectors<T, any>,
    name: PropertyKey,
    where: string,
): Selector<T, V, any> {
    const selector = (selectors as unknown as Record<PropertyKey, unknown>)[name]

    if (!isSelector<T, V>(selector)) {
        throw new Error(
            `${where} found no selector named '${String(name)}' on ${selectors.constructor.name}. `
            + `The names it takes are the fields built with this.select() — a selector built `
            + `anywhere else is passed as the object itself.`,
        )
    }

    return selector
}

/**
 * Whether `value` is one of the objects select() builds.
 * @type T data type of store
 * @type V type of a selected value
 * @param value value to check
 * @returns true for a selector
 */
function isSelector<T extends object, V>(value: unknown): value is Selector<T, V, any> {
    return typeof value === 'object'
        && value !== null
        && typeof (value as Selector<T, V, any>).selector === 'function'
        && Array.isArray((value as Selector<T, V, any>).dependencies)
}
