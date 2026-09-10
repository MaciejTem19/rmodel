# rmodel — API reference

Every name `lib/main.ts` exports: what it is in a sentence or two, and a
table of what it takes and what it carries. The story is in
[docs.md](./docs.md); this is the lookup.

**Contents**

1. [How to read this](#how-to-read-this)
2. [Keys and shapes](#keys-and-shapes)
3. [Component](#component)
4. [Hooks — reading](#hooks--reading)
5. [Hooks — selectors](#hooks--selectors)
6. [Hooks — writing](#hooks--writing)
7. [Hooks — writing from a task](#hooks--writing-from-a-task)
8. [Hooks — refs and events](#hooks--refs-and-events)
9. [Classes](#classes)
10. [Registry and store access](#registry-and-store-access)
11. [Browser persistence](#browser-persistence)
12. [Types](#types)
13. [Utilities](#utilities)
14. [Not exported from the index](#not-exported-from-the-index)

---

## How to read this

Each entry is followed by a line in this shape: *subscribes to* — what a write
must touch for the holder to re-render · *stable* — how long the result stays
the same object · *throws* — when it refuses rather than hand back nothing.

`key: StoreKey<T>` accepts a plain `string` too: a key **is** a string at
runtime, it only carries the types. A component under an `<RModel />` that has
not built its storage yet reads the value it is about to be built with, so the
first render is never a special case.

---

## Keys and shapes

### `storeKey<Sh>(key)`

Names a storage and what it is made of; returns the string it was given, with
the shape riding along in the types. The parts are checked against each other,
so an api over other data or other events does not fit the key that claims it.

| takes | type | what it is |
| --- | --- | --- |
| `Sh` (type arg) | `ValidShape<Sh>` | The shape: `data` required, `api` / `selectors` / `refs` / `events` optional. |
| `key` | `string` | The name the storage lives under. |
| **returns** | `KeyOf<Sh>` | That string, typed. |

### `StoreKey<T, A, S, R, E>`

The key type: `string & { [STORE_KEY]?: [T, A, S, R, E] }`. Positional where
`storeKey()` is named, and what every hook infers its types from.

| parameter | type | responsible for |
| --- | --- | --- |
| `T` | `object` | The data the storage holds. |
| `A` | `DataApi<T, R, E>` | Its write half. Defaults to the empty api. |
| `S` | `StoreSelectors<T, R>` | Its read half. Defaults to the empty set. |
| `R` | `object` | Its refs. Defaults to `StoreRefs` (none). |
| `E` | `object` | Its events. Defaults to `StoreEvents` (none). |

### Shape helpers

| name | type | what it is |
| --- | --- | --- |
| `StoreShape` | `{ data, api?, selectors?, refs?, events? }` | What a shape may name. |
| `ValidShape<Sh>` | shape with the parts cross-checked | The constraint `storeKey()` and `useRKey()` take; an unknown field is an error. |
| `KeyOf<Sh>` | `StoreKey<…>` | The positional key a shape works out to. |
| `DataOf<Sh>` · `ApiOf<Sh>` · `SelectorsOf<Sh>` · `RefsOf<Sh>` · `EventsOf<Sh>` | one part of `Sh` | That part, or the empty stand-in where the shape names none. |
| `StoreRefs` · `StoreEvents` | `Record<never, never>` | The empty refs and empty events — the defaults. |

---

## Component

### `<RModel />`

Mounts a storage and provides it to the subtree; it holds no data and reads
nothing, so it never re-renders for a write. The storage is created in a layout
effect, so it exists before the browser paints.

| prop | type | default | responsible for |
| --- | --- | --- | --- |
| `storageKey` | `StoreKey<T, A, S, R, E>` | — | Names the storage, and decides which props below are required and what they are checked against. |
| `defaultValue` | `T` | — | What the storage is built with. Read once, at creation. |
| `dataApi` | `A extends DataApi<T, R, E>` | empty api | The write half, attached as the storage is built. Required when the key names an api. |
| `selectors` | `S extends StoreSelectors<T, R>` | empty set | The read half, on the same terms. |
| `refs` | `R extends object` | `{}` | The refs object the storage carries — the very one, not a copy. Required when the key names refs. |
| `remember` | `boolean` | `false` | Leaves the storage in the registry when the last `<RModel />` on the key unmounts. |
| `allowSharedStore` | `boolean` | `true` | Whether a second `<RModel />` may adopt a storage someone else holds. `false` makes that a throw. |
| `loadFromBrowser` | `boolean` | `false` | Builds from what was last saved under this key, falling back to `defaultValue` field by field. |
| `saveToBrowser` | `boolean` | `false` | Saves after every write, while this `<RModel />` is mounted. |
| `children` | `ReactNode` | — | The subtree that reads by this key. |

A part is optional while the empty stand-in still fits what the key named, and
required once the key narrows it. `RModelProp<T, A, S, R, E>` is this props type.

---

## Hooks — reading

### `useRValue(key, name)`

One field, subscribed.

| takes | type | what it is |
| --- | --- | --- |
| `key` | `StoreKey<T>` | The storage. |
| `name` | `K extends keyof T` | The field. |
| **returns** | `T[K]` | Its value now. |

*subscribes to* that field · *throws* with no storage under the key.

### `useRValues(key, names)`

A slice of several fields, compared entry by entry, so a write that leaves them
all alone costs no render.

| takes | type | what it is |
| --- | --- | --- |
| `key` | `StoreKey<T>` | The storage. |
| `names` | `readonly (keyof T)[]` | The fields to read. |
| **returns** | `Pick<T, K[number]>` | An object of just those fields. |

*subscribes to* the named fields · *throws* with no storage.

### `useRValueAsRef(key, name)`

The same field as a ref that follows every write and renders nobody. For values
a component acts on, never for values it draws.

| takes | type | what it is |
| --- | --- | --- |
| `key` | `StoreKey<T>` | The storage. |
| `name` | `K extends keyof T` | The field. |
| **returns** | `Readonly<RefObject<T[K]>>` | `current` is the value now; read-only, and stale on screen if drawn. |

*subscribes to* nothing that renders · *keeps* its last value if the storage is
dropped.

### `useRValuesAsRef(key, names)`

Several fields the same way. `current` is replaced rather than written into, so
reach through the ref each time.

| takes | type | what it is |
| --- | --- | --- |
| `key` | `StoreKey<T>` | The storage. |
| `names` | `readonly (keyof T)[]` | The fields to follow. |
| **returns** | `Readonly<RefObject<Pick<T, K[number]>>>` | The slice as of now. |

### `useRKey<Sh>()`

The key of the **nearest** `<RModel />` above, with the types you name on it.
Inside a page mounted under an app-wide model this is the page's key, not the
app's.

| takes | type | what it is |
| --- | --- | --- |
| `Sh` (type arg) | `ValidShape<Sh>` | What that storage holds. |
| **returns** | `KeyOf<Sh>` | The key, typed. |

*throws* outside `<RModel />`.

### `useRStore<Sh>(key)`

The store object itself, for reaching `refs`, `onEvent()` and the rest with
their types on.

| takes | type | what it is |
| --- | --- | --- |
| `key` | `string` | The storage. |
| **returns** | `Store<…> \| undefined` | The store, or nothing while there is none. |

*subscribes to* the registry: re-renders when a storage is created or dropped
under the key, not when the data moves.

---

## Hooks — selectors

### `useRSelector(key, name)`

Runs one of the storage's own selectors by name; only fields built with
`select()` are offered.

| takes | type | what it is |
| --- | --- | --- |
| `key` | `StoreKey<T, any, S, any>` | The storage, whose key names the selectors. |
| `name` | `SelectorName<T, S>` | Which selector. |
| **returns** | `SelectorValue<S, K>` | Whatever it hands back. |

*subscribes to* that selector's dependencies, and re-renders only when the
result itself changed · *throws* with no storage, and with no selectors to look
the name up in.

### `useRCustomSelector(key, selector)`

The same machinery for a view built by the caller. Declare it outside the
component or memoise it — the dependency list is read on every render.

| takes | type | what it is |
| --- | --- | --- |
| `key` | `StoreKey<T, any, any, R>` | The storage. |
| `selector.selector` | `(data: T, refs: R) => V` | The computation. Refs are readable but wake nothing. |
| `selector.dependencies` | `readonly (keyof T)[]` | The fields that wake it. |
| `selector.isEqual` | `(previous: V, next: V) => boolean` | What counts as unchanged. Defaults to `Object.is`. |
| **returns** | `V` | The result, the same object while `isEqual` says it did not move. |

---

## Hooks — writing

### `useRSetter(key, name)`

A setter for one field, for a component that writes it without displaying it.

| takes | type | what it is |
| --- | --- | --- |
| `key` | `StoreKey<T>` | The storage. |
| `name` | `K extends keyof T` | The field. |
| **returns** | `(value: ValueUpdate<T[K]>) => void` | Takes the value, or a callback handed the current one — read at call time. |

*subscribes to* nothing · *stable* for as long as the key and the field ·
*throws* on a write with no storage.

### `useRValuesSetter(key)`

One setter for the whole storage. One write per call however many fields it
names; fields left out are left alone.

| takes | type | what it is |
| --- | --- | --- |
| `key` | `StoreKey<T>` | The storage. |
| **returns** | `(values: ValuesUpdate<T>) => void` | Takes the fields, or a callback handed the whole data. |

*subscribes to* nothing · *stable* for as long as the key · *throws* on a write
with no storage.

### `useRDataApi(key)`

The api instance the storage was built with — your own methods included.

| takes | type | what it is |
| --- | --- | --- |
| `key` | `StoreKey<T, A>` | The storage, whose key names the api. |
| **returns** | `A` | That instance. |

*subscribes to* the registry only: no write re-renders the holder, and the
identity moves only when the storage is replaced · *throws* where neither a
storage nor a pending `<RModel />` has an api under the key.

---

## Hooks — writing from a task

Both return a **cancel** per call. A task called off — by that cancel, by
`cancelTasks()`, or by the storage being dropped — writes nothing at all, so
unmounting mid-flight leaves nothing behind. Where a cancel should leave
something behind after all, both take an optional rollback at the call — written
the moment the cancel happens, and not at all when it came with the storage.

### `useRSetterByTask(key, name)`

One field, written when the task settles.

| takes | type | what it is |
| --- | --- | --- |
| `key` | `StoreKey<T>` | The storage. |
| `name` | `K extends keyof T` | The field. |
| **returns** | `(task, onCancel?) => () => void` | Call it with the task; keep the cancel it hands back. |
| `task` | `(signal: AbortSignal) => Promise<ValueUpdate<T[K]>>` | Computes the value, or a callback run **at the write** against the field as it stands then. |
| `onCancel` | `T[K]` | Value set under `name` if the task is called off. Left out, a cancel writes nothing. |

### `useRValuesSetterByTask(key)`

Several fields from one task: one write when it finishes, all of them or none.

| takes | type | what it is |
| --- | --- | --- |
| `key` | `StoreKey<T>` | The storage. |
| **returns** | `StoreApi<T>['setValuesByTask']` | Two shapes: `(task, onCancel?)` where the task hands back the fields, or `(names, task, onCancel?)` where it hands back their values in that order. |
| `onCancel` | `Partial<T>` | Fields set if the task is called off — a loading flag put back, say. They need not be the fields the task fills. |

---

## Hooks — refs and events

### `useRRef(key, name)`

One field of the storage's refs, as a real ref: reading and writing `current`
reads and writes the storage's own object, so every component asking for the
same field gets the same slot.

| takes | type | what it is |
| --- | --- | --- |
| `key` | `StoreKey<any, any, any, R>` | The storage, whose key names the refs. |
| `name` | `K extends keyof R` | The field of the refs. |
| **returns** | `RefObject<R[K]>` | Writable; nothing is notified and nothing re-renders. |

*subscribes to* nothing · *stable* for as long as the key and the field (React
detaches a DOM ref when that identity moves) · works before the storage exists ·
*throws* where the key has neither a storage nor an `<RModel />` holding refs.

### `useREmit(key, name)`

An emitter for one event name.

| takes | type | what it is |
| --- | --- | --- |
| `key` | `StoreKey<any, any, any, any, E>` | The storage, whose key names the events. |
| `name` | `K extends keyof E` | Which event. |
| **returns** | `(argument: E[K]) => void` | Announces it. One argument, typed by the container. |

*subscribes to* nothing, and the holder does not hear its own event · *stable*
for as long as the key and the name · *throws* with no storage.

### `useROn(key, name, handler)`

Keeps a handler on the storage while the component is mounted. Nothing is
replayed, and the subscription survives the storage being rebuilt under the key.

| takes | type | what it is |
| --- | --- | --- |
| `key` | `StoreKey<any, any, any, any, E>` | The storage. |
| `name` | `K extends keyof E` | Which event. |
| `handler` | `(argument: E[K]) => void` | Runs inside the emit, in the emitter's stack. Read fresh every time, so it is not a dependency. |
| **returns** | `void` | |

*renders* the holder only if the handler makes it.

---

## Classes

### `abstract class DataApi<T, R = StoreRefs, E = StoreEvents>`

The write half of a model: the imperative api the rest of the app calls. Write
your methods as arrow fields, so one can be handed to `onClick` as it is.

| type arg | type | responsible for |
| --- | --- | --- |
| `T` | `object` | The data it writes. |
| `R` | `object` | The refs it may reach, when it names them. |
| `E` | `object` | The events it may announce. |

| method | signature | what it does |
| --- | --- | --- |
| `setValue` | `(name: K, value: T[K]) => void` | Writes one field. |
| `setValues` | `(values: Partial<T>) => void` · `(names: K[], values: ValuesOf<T, K>) => void` | Several in one write — one notification, one render. |
| `updateValue` | `(name: K, next: (value: T[K]) => T[K]) => void` | One field, from its own current value. |
| `updateValues` | `(next: (data: T) => Partial<T>) => void` | Several, from a callback handed the whole data. |
| `setValueByTask` | `(name: K, task: (signal) => Promise<T[K]>, onCancel?: T[K]) => () => void` | Writes one field when the task settles. `onCancel` is the value put under `name` the moment it is called off; left out, a cancel writes nothing. Returns the cancel. |
| `updateByTask` | `(name: K, task: (signal) => Promise<ValueUpdate<T[K]>>, onCancel?: T[K]) => () => void` | The same, for a task that may hand back a callback run at the write. |
| `setValuesByTask` | `(task, onCancel?) => () => void` · `(names, task, onCancel?) => () => void` | Several fields from one task, in both shapes `setValues()` takes. `onCancel: Partial<T>` are the fields put back on a cancel, and need not be the ones the task writes. |
| `emit` | `(name: K, argument: E[K]) => void` | Announces one of the storage's events. Nothing written, nothing kept. |
| `cancelTasks` | `() => void` | Calls off every task in flight. Silent when there is none. |
| `attach` / `detach` | `(store) => void` | Called by the store as it is built and dropped. Not for callers. |

| protected member | type | what it is |
| --- | --- | --- |
| `this.data` | `T` | The data right now. To read — writes go through the methods above. |
| `this.refs` | `R` | The storage's refs object, the very one. |
| `this.store` | `AnyStore<T>` | The store this part is attached to. |
| `this.attached` | `boolean` | Whether it still has one — a check that does not throw. |
| `this.subscribe` | `(listener, keys?) => () => void` | React to writes without a render. |
| `this.trackTask` | `(body, onDone?) => () => void` | Run a task the storage can call off. |
| `this.runTask` | `(task: StoreTask<T>, onCancel?: Partial<T>) => () => void` | Run a task and write what it returns with one `setValues()`; `onCancel` is the state put back the moment it is called off. |

Every member throws once the storage is gone; `cancelTasks()` is the exception —
whatever was running went with it.

### `abstract class StoreSelectors<T, R = StoreRefs>`

The read half: computed views, each carrying its dependencies and its
comparison. The instance holds no data — what a selector runs against is the
storage it was attached to.

| member | signature | what it does |
| --- | --- | --- |
| `protected select` | `(selector: (data: T, refs: R) => V, dependencies: readonly (keyof T)[], isEqual?) => Selector<T, V, R>` | Builds a selector. Safe in a field initialiser: it touches no data. |
| `read` | `(name: SelectorName<T, this>) => SelectorValue<this, K>` · `(selector: Selector<T, V, R>) => V` | Runs one selector once, outside React. No subscription, no comparison. |

Plus the protected members of the bridge below.

### `abstract class StoreApiBridge<T, R = StoreRefs>`

What both halves are built on: it holds the attachment to a store and nothing
else. Extend it directly only to build a third kind of part.

| member | type | what it is |
| --- | --- | --- |
| `attach` / `detach` | `(store: AnyStore<T>) => void` | Public, but the store's to call. |
| `cancelTasks` | `() => void` | Calls off this storage's tasks. |
| protected `store`, `attached`, `data`, `refs`, `subscribe`, `trackTask` | — | As listed under `DataApi`. |

### `class Store<T, A, S, R, E>`

One data object, synchronous writes, per-field listeners, and the tasks running
against them. Once a write returns, `getData()` already gives the new data and
every subscriber has run; the data object is replaced, never mutated.

| constructor argument | type | what it is |
| --- | --- | --- |
| `key` | `string` | The name it lives under. |
| `defaultValue` | `T` | The data it starts with. |
| `dataApi` | `A?` | The write half. An empty one when left out. |
| `selectors` | `S?` | The read half, on the same terms. |
| `refs` | `R?` | The refs object. `{}` when left out. |

| member | type | what it does |
| --- | --- | --- |
| `key` · `dataApi` · `selectors` · `refs` | `string` · `A` · `S` · `R` | What it was built with. |
| `data` · `getData()` | `T` | The data right now. |
| `setValue` · `setValues` | as on `DataApi` | The synchronous writes; `DataApi` passes straight through to these. |
| `setValueByTask` · `updateByTask` · `setValuesByTask` | `(…, onCancel?) => () => void` | The task writes, each returning its cancel. The optional last argument is what to put back if the task is called off — nothing at all when the cancel came with the storage. |
| `subscribe` | `(listener: () => void, keys?: readonly (keyof T)[]) => () => void` | Runs after a write that changed one of `keys` — or after any write, with none. |
| `emit` | `(name: K, argument: E[K]) => void` | Runs the handlers for that name, in the caller's stack. |
| `onEvent` | `(name: K, handler: (argument: E[K]) => void) => () => void` | Listens. Nothing is replayed. |
| `trackTask` | `(body, onDone?) => () => void` | Runs a task the store can call off; `onDone` runs only if it was still live. |
| `cancelTasks` | `() => void` | Calls off everything in flight. |
| `dispose` | `() => void` | Detaches the parts, cancels the tasks, drops every listener. |

---

## Registry and store access

### `createStore(key, defaultValue, ...parts)`

Builds a storage and puts it in the registry without an `<RModel />`. Called on
a key that already has one, it takes the slot over and **disposes the old**.

| takes | type | what it is |
| --- | --- | --- |
| `key` | `StoreKey<T, A, S, R, E>` | Names it, and decides which parts are required. |
| `defaultValue` | `T` | The data it starts with. |
| `...parts` | `[dataApi?, selectors?, refs?]` | In that order; a key that names refs and no api asks for `undefined` where the api would go. |
| **returns** | `Store<T, A, S, R, E>` | The storage. |

### `getStore(key)`

The storage under the key, typed by it. The plain way in from outside React.

| takes | type | what it is |
| --- | --- | --- |
| `key` | `StoreKey<T, A, S, R, E>` | The storage. |
| **returns** | `Store<…> \| undefined` | Nothing where the page is not mounted. |

### `storeApi(key)`

The same reach with the lookup done on every call, so it survives the storage
being replaced under the key. Its writes throw rather than vanish.

| member | type | what it does |
| --- | --- | --- |
| `key` | `string` | The key it was made for. |
| `getData` | `() => T \| undefined` | The data, or nothing while there is no storage. |
| `setValue` · `setValues` | as on `DataApi` | The writes. Throw with no storage. |
| `setValueByTask` · `updateByTask` · `setValuesByTask` | `(…, onCancel?) => () => void` | The task writes, with the same optional rollback as on `DataApi`. |
| `subscribe` | `(listener, keys?) => () => void` | Follows the key across a storage being built, dropped or replaced. |

### The rest

| name | signature | what it does |
| --- | --- | --- |
| `subscribeStorage` | `(key: string, listener: () => void) => () => void` | Fires when a storage is created, replaced or dropped under the key. |
| `storeHolders` | `(key: string) => number` | How many `<RModel />` hold that storage right now. |
| `unregisterStore` | `(key: string, store: AnyStore<T>) => void` | Drops it from the registry and disposes it; a no-op once a newer store took the slot. |
| `extenralStorage` | `Map<string, Store<any>>` | The registry itself — an escape hatch; prefer `getStore()`. |

---

## Browser persistence

`localStorage`, under the prefix `rmodel:`, and the key is saved with the data —
so a leftover from a renamed key reads as nothing saved. Nothing saves itself.

| name | signature | what it does |
| --- | --- | --- |
| `saveToBrowser` | `(key: StoreKey<T>, data?: T) => boolean` | Saves what the storage holds, or the data handed in. `false` where the browser would not take it (server render, no quota, site data off). Throws for a key with no storage and no data, and for data JSON cannot carry. |
| `keepInBrowser` | `(key: StoreKey<T>) => () => void` | Saves at once and after every write, until the returned stop is called. A key with nothing behind it saves nothing. |
| `loadFromBrowser` | `(key: StoreKey<T>, defaultValue?: T) => T \| undefined` | What was last saved. Never saved, renamed key, older version, site data off — all read as the default. |
| `load` | `(json: string, defaultValue?: T) => T \| undefined` | The same shaping for JSON from anywhere else. |
| `browserKey` | `(key: string) => string` | Where it is saved: `` `rmodel:${key}` ``. |

With a default value the result really is a `T`: its fields are what the result
carries, so missing ones come from it and unknown ones are dropped.

---

## Types

| type | shape | responsible for |
| --- | --- | --- |
| `Selector<T, V, R>` | `{ selector: (data: T, refs: R) => V, dependencies: readonly (keyof T)[], isEqual?: (a: V, b: V) => boolean }` | A computed view. |
| `SelectorName<T, S>` | `keyof S` filtered | The names a set of selectors offers — its `select()` fields only. |
| `SelectorValue<S, K>` | the `V` of that selector | What one hands back. |
| `ValueUpdate<V>` | `V \| ((previous: V) => V)` | What a one-field setter takes. |
| `ValuesUpdate<T>` | `Partial<T> \| ((data: T) => Partial<T>)` | The same for several fields. |
| `ValuesOf<T, K>` | tuple | Values matched positionally to a tuple of keys. |
| `StoreTask<T>` | `(signal: AbortSignal) => Promise<Partial<T> \| void>` | The body `runTask()` takes. |
| `AnyStore<T>` | `Store<T, any, any, any, any>` | A store over `T` carrying any parts. |
| `StoreApi<T>` | see above | What `storeApi(key)` hands back. |
| `RModelProp<T, A, S, R, E>` | see above | The props of `<RModel />`. |

---

## Utilities

| name | signature | what it does |
| --- | --- | --- |
| `shallowEqual` | `(a: unknown, b: unknown) => boolean` | `Object.is`, then entry by entry one level deep: same key count, each value the same. An array and a plain object never match. The `isEqual` for a selector that builds a fresh array or object. |

---

## Not exported from the index

Importable from their own modules, used by the library itself, and outside what
`main.ts` promises.

| name | module | what it is |
| --- | --- | --- |
| `useRStoreApi` | `./hooks` | What the writing hooks are built on; `storeApi(key)` is the public equivalent. |
| `followValue` · `followValues` | `./hooks` | The ref-following behind `useRValueAsRef()`, usable without a component. |
| `selectorNamed` | `./StoreSelectors` | The lookup `read()` and `useRSelector()` share. |
| `claimStore` · `releaseStore` · `Claim` · `StorageListener` | `./storage` | How `<RModel />` takes and gives up a hold on a storage. |
| `StoreKeyContext` · `StoreScope` | `./scope` | What `<RModel />` provides to the subtree. |
| `Listener` | `./types` | `() => void`, the shape `subscribe()` takes. |
