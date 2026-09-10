# rmodel

A lightweight state management library for React — closest in spirit to Redux or
Zustand, but built around the state of a single page rather than of the whole
application. It gives a page something that works like a ViewModel: one store
per page, declared where the page starts and gone when it leaves.

```bash
npm install rmodel
```

React 18 or newer is a peer dependency — the package uses the one your app
already has.

## Use

```tsx
import { RModel, storeKey, useRValue, useRSetter } from 'rmodel'

const COUNTER = storeKey<{ data: { count: number } }>('counter')

function Count() {
    const count = useRValue(COUNTER, 'count')
    const setCount = useRSetter(COUNTER, 'count')

    return <button onClick={() => setCount(count + 1)}>{count}</button>
}

export function Page() {
    return (
        <RModel storageKey={COUNTER} defaultValue={{ count: 0 }}>
            <Count />
        </RModel>
    )
}
```

`<RModel />` holds the store, `storeKey` names and types it, and the hooks read
and write single values — a component rerenders only for the value it asked for.
From there the library adds computed selectors, refs, events, async tasks and
browser persistence.

## Docs

- [docs.md](./docs.md) — the story: what it is and how to use it.
- [api.md](./api.md) — the lookup: every exported name, signature by signature.

## Development

`lib/` is the published library, `src/` a demo app that imports `'rmodel'` by
name the same way a consumer does.

```bash
npm run dev         # dev server for the demo app
npm run build       # build the library into dist/ (ESM, CJS, .d.ts)
npm run typecheck   # typecheck the demo app and the library
npm run lint        # oxlint
```
