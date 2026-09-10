/* The public surface. Everything the model offers is re-exported here, so a
   consumer imports from 'rmodel' and never has to know which file a piece
   of it lives in. */

export { shallowEqual } from './shallowEqual.js'
export { storeKey } from './types.js'
export type {
    AnyStore, ApiOf, DataOf, EventsOf, KeyOf, RefsOf, Selector, SelectorName, SelectorValue,
    SelectorsOf, StoreEvents, StoreKey, StoreRefs, StoreShape, StoreTask, ValidShape, ValueUpdate,
    ValuesOf, ValuesUpdate,
} from './types.js'

export { StoreApiBridge } from './StoreApiBridge.js'
export { DataApi } from './DataApi.js'
export { StoreSelectors } from './StoreSelectors.js'
export { Store } from './Store.js'
export { createStore, extenralStorage, getStore, storeHolders, subscribeStorage, unregisterStore } from './storage.js'

export { browserKey, keepInBrowser, load, loadFromBrowser, saveToBrowser } from './persistence.js'

export { RModel } from './RModel.js'
export type { RModelProp } from './RModel.js'

export { storeApi } from './storeApi.js'
export type { StoreApi } from './storeApi.js'
export {
    useRCustomSelector,
    useRDataApi,
    useREmit,
    useRKey,
    useROn,
    useRRef,
    useRSelector,
    useRSetter,
    useRSetterByTask,
    useRStore,
    useRValue,
    useRValueAsRef,
    useRValues,
    useRValuesAsRef,
    useRValuesSetter,
    useRValuesSetterByTask,
} from './hooks.js'
