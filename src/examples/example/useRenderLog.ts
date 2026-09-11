import { useEffect, useRef } from 'react'

/**
 * Logs every render of a component, numbered per instance, together with what
 * it took out of the store on that render:
 *
 *   [render] Clicker #2 · clicked: 3
 *   [render] ProductList #3 · ["Coffee beans","Rubber duck","Tent"]
 *   [render] Products #1                     ← reads nothing from the store
 *
 * Pass the value the component read, or nothing when it reads none. Not passing
 * it and reading `undefined` are different lines: undefined is what a component
 * gets in the one pass before <RVModel /> has built the storage.
 *
 * The log sits in an effect, so a render React throws away (or repeats under
 * StrictMode) does not lie about what the user actually saw.
 */
export function useRenderLog(name: string, ...value: [] | [unknown]) {
  const count = useRef(0)

  useEffect(() => {
    count.current += 1

    const from = value.length === 0 ? '' : ` · ${describe(value[0])}`

    console.log(`[render] ${name} #${count.current}${from}`)
  })
}

/** One line's worth of a store value: entries by name, everything else as JSON. */
function describe(value: unknown): string {
  if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
    return Object.entries(value)
      .map(([name, entry]) => `${name}: ${short(entry)}`)
      .join(', ')
  }

  return short(value)
}

function short(value: unknown) {
  const text = typeof value === 'string' ? value : JSON.stringify(value)

  if (text === undefined) return String(value)

  return text.length > 60 ? `${text.slice(0, 59)}…` : text
}

export default useRenderLog
