/* What the nearest <RModel /> above provides. The context lives here rather
   than next to the component so that the hooks can read it without importing
   <RModel /> itself. */
import { createContext } from 'react'
import type { DataApi } from './DataApi.js'
import type { StoreSelectors } from './StoreSelectors.js'

/**
 * What <RModel /> provides: the key it mounted the storage under, and the
 * value it built it with. The default value is here so that a hook has
 * something to read in the one render before the layout effect builds the
 * storage.
 *
 * Four of the five parts of a storage are here. The events are the fifth and
 * are not, because there is nothing of them to hand over: a container of types
 * holds no value, and neither event hook needs one to get through that first
 * render — useROn() puts its handler on whichever store takes the key next,
 * and useREmit() throws rather than announce into a storage that does not
 * exist yet.
 *
 * The parts are held over any refs and any events, not over none: this is
 * whatever the <RModel /> above was given, and the hooks below cast it to what
 * their key names. Writing DataApi<any> here would be naming the empty refs and
 * the empty events — which is not what a scope knows.
 */
export type StoreScope = {
    key: string
    defaultValue: object
    dataApi?: DataApi<any, any, any>
    /**
     * The read half the storage will be built with. Here for the same reason
     * the default value is: useRSelector() looks a name up in these for the
     * render that comes before the storage exists, and they are the very ones
     * it is about to carry.
     */
    selectors?: StoreSelectors<any, any>
    /**
     * The refs object the storage will be built with. Here for the same reason
     * the default value is: a ref taken below is attached in the commit, before
     * the layout effect above has built the storage, and it has to land in the
     * object that storage will carry rather than in one thrown away.
     */
    refs?: object
}

export const StoreKeyContext = createContext<StoreScope | null>(null)
