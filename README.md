# rvmodel

A lightweight state management library for React — closest in spirit to Redux or
Zustand, but built around the state of a single page rather than of the whole
application. It gives a page something that works like a ViewModel: one store
per page, declared where the page starts and gone when it leaves.

## Installating library

```bash
npm install rvmodel
```

React 18 or newer is a peer dependency — the package uses the one your app
already has.

## Use

```tsx
import { RVModel, storeKey, useRValue, useRSetter } from 'rvmodel'

const COUNTER = storeKey<{ data: { count: number } }>('counter')

function Count() {
    const count = useRValue(COUNTER, 'count')
    const setCount = useRSetter(COUNTER, 'count')

    return <button onClick={() => setCount(count + 1)}>{count}</button>
}

export function Page() {
    return (
        <RVModel storageKey={COUNTER} defaultValue={{ count: 0 }}>
            <Count />
        </RVModel>
    )
}
```

`<RVModel />` holds the store, `storeKey` names and types it, and the hooks read
and write single values — a component rerenders only for the value it asked for.
From there the library adds computed selectors, refs, events, async tasks and
browser persistence.

## Docs

- [docs.md](./docs.md) — the story: what it is and how to use it.
- [api.md](./api.md) — the lookup: every exported name, signature by signature.

