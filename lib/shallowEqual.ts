/** Entry-by-entry comparison, for selectors that build a fresh array or object out of unchanged parts. */
export function shallowEqual(a: unknown, b: unknown): boolean {
    if (Object.is(a, b)) return true
    if (typeof a !== 'object' || typeof b !== 'object' || !a || !b) return false
    if (Array.isArray(a) !== Array.isArray(b)) return false

    const keys = Object.keys(a)

    if (keys.length !== Object.keys(b).length) return false

    return keys.every((key) =>
        Object.is((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key]),
    )
}
