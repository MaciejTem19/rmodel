/* What the nearest <RVModel /> above provides. The context lives here rather
   than next to the component so that the hooks can read it without importing
   <RVModel /> itself. */
import { createContext } from 'react'
import type { DataApi } from './DataApi.js'
import type { StoreSelectors } from './StoreSelectors.js'

/**
 * What <RVModel /> provides: the key it mounted the storage under, and the
 * value it built it with. Values are given, becouse of data flow before first rerender
*/

export type StoreScope = {
    key: string
    defaultValue: object
    //Provides defaaults for mounting and creatring rvmodel
    dataApi?: DataApi<any, any, any>
    selectors?: StoreSelectors<any, any>
    refs?: object
}

export const StoreKeyContext = createContext<StoreScope | null>(null)
