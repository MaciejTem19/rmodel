# RModel

A lightweight state management library for React — closest in spirit to Redux or
Zustand, but built around state management for a single page rather than for the
whole application. It gives a page something that works like a ViewModel.

Looking for one particular signature rather than the story? That is
[api.md](./api.md), next door.

**Contents**

1. [Let's start with an example](#lets-start-with-an-example)
2. [RModel to the rescue](#rmodel-to-the-rescue)
3. [The `<RModel />` component](#the-rmodel--component)
4. [Store keys](#store-keys)
5. [Reading values](#reading-values)
6. [Rerenders](#rerenders)
7. [Writing values](#writing-values)
8. [Updating from the current value](#updating-from-the-current-value)
9. [A model of your own: custom DataApi](#a-model-of-your-own-custom-dataapi)
10. [Computed values: selectors](#computed-values-selectors)
11. [Refs: what nothing renders from](#refs-what-nothing-renders-from)
12. [Events: what merely happened](#events-what-merely-happened)
13. [The rest of the `<RModel />` props](#the-rest-of-the-rmodel--props)
14. [Stacking models: the app above, the page below](#stacking-models-the-app-above-the-page-below)
15. [Setting values from a task](#setting-values-from-a-task)
16. [Updating by task: building on the value that is there](#updating-by-task-building-on-the-value-that-is-there)
17. [Doing it by hand, without the task hooks](#doing-it-by-hand-without-the-task-hooks)
18. [Keeping data in the browser](#keeping-data-in-the-browser)
19. [The storage outside React: `getStore`](#the-storage-outside-react-getstore)

---

## Let's start with an example

Say we have one main page and two subpages:

- main panel
- contact panel
- gallery panel

So the code would look something like this:

```tsx
export function App() {
    return (
        <React.Router>
            {/* main panel */}
            <Route path={''}>
                <Main />
            </Route>
            {/* contact panel */}
            <Route path={'contact'}>
                <Contact />
            </Route>
            {/* and gallery */}
            <Route path={'gallery'}>
                <Gallery />
            </Route>
        </React.Router>
    )
}
```

As we can see, we have three unrelated panels, each with its own data. Let's build
the contact page first. It probably has:

- an email field, the address we want to send the message from
- a message field
- an "accept policy" checkbox
- a send button, disabled until some conditions are met

And of course we want some validation somewhere. Say we keep all of it in the
parent component, so the values and their setters can be passed down the tree:

```tsx
export function Contact() {
    const [email, setEmail] = useState<string>('')
    const [message, setMessage] = useState<string>('')
    const [isPolicyAccepted, setIsPolicyAccepted] = useState<boolean>(false)

    /* ... */
}
```

Simplest practice: one piece of state per field.

### Where is the problem?

In a bigger application there is far more of it than this, and managing that many
pieces of state one by one becomes cumbersome fast. So we wrap everything in one
object:

```tsx

export type ContactData = {
    email: string
    message: string
    isPolicyAccepted: boolean
}

export function ContactPage() {

    const [data, setData] = useState<ContactData>({
        email: '',
        message: '',
        isPolicyAccepted: false,
    })

    //bla bla bla
}
```

…and now every update builds a whole new object, so **every component reading any
part of it rerenders** — even when the field it uses has not changed at all. It can
be patched over with `React.memo` and other tricks, but it can becomes problemsome.

There is a second problem too: passing all of it down the component tree. Every
component needs props of its own, and so does every component between it and the
data. It becomes tiresome the moment one value is wanted by one component deep
down, specially, when it comes to refactoring existing component tree to include this value.

React's Context API solves that one. But the performance problem arrives quickly:
a component reading a context rerenders every time the context value changes, so
with a whole object in there, every change costs a rerender in everyone reading
it.

We can of course stack one provider per piece of data:

```tsx
    <EmailProvider>
        <MessageProvider>
            <ApiProvider>
                {ourPage}
            </ApiProvider>
        <MessageProvider>
    </EmailProvider>
```

— which is a great deal of writing for nothing. So we end up with a dilemma:

- keep everything in one object, and keep the performance problem, or
- split the values across many providers, and end up with a strange-looking tower
  of context providers.

---

## RModel to the rescue

RModel aims to fix both. It lets you declare a data container high up in the tree,
where all the data of that page lives — like the context above, but without either
problem.

We start with a type describing what is stored, as we did above:

```ts
export type ContactData = {
    email: string
    message: string
    isPolicyAccepted: boolean
}
```

Once we have the shape of our stored data, we can hand it to `<RModel />`.

---

## The `<RModel />` component

`<RModel />` is a wrapper that creates the storage, talks to it, and deletes it on
the way out. You can mount as many of them as you like across the app, and one
`<RModel />` may sit below another. It also works as a context provider for a
couple of quality-of-life features, but we don't have to worry about them right now.

### Idea behind this

RModel aims to provide view model for a component. It should live as long, as component does and only in some situations should be remebered or live somewhere. Difference betwwen it and Redux or Zustand it is meant to be bound to components and the storage system, wich leaves outside react, is becouse of optimalization and more flexibility. Hovewer aim is to declare data you want to store in some component - you use data across children components and change it, while not worring about unnecessary rerenders.


Btw, library do not want to be better than already existing solutions - it is different aproach to similiar problem.

Soooo, after short yaping session from author, lets dive back into example:

Every storage has its own key which is represented as a string. Those keys are to identify storages, so *remember to make different keys of different storages, because unmanaged conflicts will delete older storage, which will cause Errors*. Also, it is a good idea to create const strings to represent keys of specific storages outside of React as a global variable.

```ts
const CONTACT_KEY = "contact"
```

When we decide what key to use, we still need the type of our data. RModel expects some `object`, so we need to form one, we can do it with `type` keyword, like we did with context provider example:

```tsx

export type ContactData = {
    email: string,
    message: string,
    isPolicyAccepted: boolean
}
```

then, we need to create a default value with the same type as our type. Those values will be present during first render of components. Also, declaring default values is required:

```tsx
export const CONTACT_DEFAULT: ContactData = {
    email: '',
    message: '',
    isPolicyAccepted: false,
}
```

and then, we pass key and default data:

```tsx
export function ContactPage() {
    return (
        <RModel storageKey={CONTACT_KEY} defaultValue={CONTACT_DEFAULT}>
            <Contact />
        </RModel>
    )
}
```

Two places can deliberately use the same key, and a storage can outlive the
component that mounted it or share you can create other `<RModel>` component referencing to the same storage, so naming it is what makes both possible. It is also crucial, while sharing or remembering store state for you to pass same types, that were used earlier in same storage. 

When two `<RModel />` are stacked, the key is what tells them apart:


```tsx

    export function PageSomething() {
        return (
            //Main store with different key...
            <RModel storageKey={MAIN_STORE} defaultValue={MAIN_DEF}>
                
                <div>
                    {/* ... with secondary, so we can manage data from both of them simultaneously */}
                    <RModel storageKey={PAGE_STORE} defaultValue={PAGE_DEF}>
                        <Page />
                    </RModel>
                <div/>
                <BlaBlaPage />
            <RModel/>)
    }

```


> The default value is read **once**, when the storage is created. Passing a fresh
> object on a later render does not overwrite live data — which is exactly what
> you want, and worth knowing before you go looking for a bug that is not there.
> If you want to set values from default object, you need to set them manually (we will learn how to
> do that soon)

---

## Store keys

Now let's use some of the values. First we need `storeKey()`, which hands back the
key of the storage. What it takes is a **shape**: the parts the storage is made
of, named. Only `data` is required — `ContactData` in our example:

```ts
export const CONTACT_KEY = storeKey<{ data: ContactData }>('contact')
```

The other parts — `api`, `selectors`, `refs`, `events` — are added to that object
as the model grows, and each section below adds one. They are named rather than
counted, so the order does not matter and a model with events and no selectors
says exactly that. We will explore what these are in future sections.

It seems strange to do it this way. Why can't we just write `'contact'` wherever a
key is needed? The answer is TypeScript: nothing can predict what kind of data is
behind a given key. Maybe you create the storage with a different type
depending on some condition — who knows? A typed key means every hook and every
function knows what it is handing you, so you are not casting types for eternity.

> Keep the key in an exported `const`: you are going to need it often.

At runtime `storeKey()` returns the very string you gave it. The types just ride
along with it.

Actually, all hooks require the key to be passed in, so they can evaluate types.

`<RModel />` takes it too, and that is the other half of what a key is for. Hand
the key to `storageKey` and the mounting is checked against what it names: the
`defaultValue` has to be the data the key describes, the `dataApi` has to be an
api over that data, those refs and those events, and the selectors the same.

```tsx
<RModel storageKey={CONTACT_KEY} defaultValue={CONTACT_DEFAULT} dataApi={contactApi}>
```

A part the key names is required rather than merely checked: a key promising
`api: ContactApi` cannot be mounted without one — the storage would carry the
empty stand-in while every `useRDataApi(CONTACT_KEY)` below is typed for the real
thing, and the first `api.clear()` is where that would turn up. The same goes for
`selectors` and `refs`. What the key says nothing about stays optional, so a
data-only key is mounted with a default value and nothing else. (A part is read
off its type, so an api that adds nothing of its own to `DataApi` is still
optional — there is no difference left between it and the empty one.)

`createStore()` is under the same rule, being the same mounting without a
component: hand it the key and it takes the parts that key names, in the order
`storeKey()` names them.

```ts
createStore(CONTACT_KEY, CONTACT_DEFAULT, contactApi, contactSelectors, CONTACT_REFS)
```

Mount it with a plain `'contact'` instead and it still works — a key is a string
at runtime — but there is nothing to check against and nothing is required, so
the parts are worked out from the props alone. The key is what makes a storage
mounted with someone else's api, or with a default value missing half its
fields, an error at the `<RModel />` rather than a surprise in whatever reads by
that key later.


---

## Reading values

Somewhere in the page there is a button that can only be pressed once the policy
is accepted. We read that field with `useRValue`:

```tsx
export function SendButton() {

    //First argument: the key of the storage
    //Second argument: the field we want to read
    const isAccepted = useRValue(CONTACT_KEY, 'isPolicyAccepted')


    const onClick = () => {
        /* … */
    }

    return (
        <button onClick={onClick} className={isAccepted ? 'button-enabled' : 'button-disabled'}>
            Send message
        </button>
    )
}
```


The result is typed straight from `ContactData` — `boolean` here — and asking for
a field that does not exist is a compile error.

Several fields at once is `useRValues`, with an "s" at the end. Same shape as the
one above: the key, and the names of the fields to read.

```tsx

    const data = useRValues(CONTACT_KEY, ["message", "email"])

    //data is an object with the properties "message" and "email"

    const email = data.email
    const message = data.message

```

<!-- ### The key, without importing it

Every hook takes the key — that is what carries the types, and what leaves no
doubt about which storage a component reads. When importing the key constant
everywhere gets tiresome, `useRKey()` hands you the key of the **nearest
`<RModel />` above**, with the types you name on it:

```tsx
export const useContactKey = () => useRKey<{ data: ContactData, api: ContactApi }>()

const email = useRValue(useContactKey(), 'email')
const api = useRDataApi(useContactKey())
```

One line in the model file, and the components below name neither the key string
nor the types again. It is also what makes a subtree portable: mount the same
components under a `<RModel />` on another key and they follow it.

> The word doing the work there is **nearest**. With a single `<RModel />` above
> a component there is nothing to get wrong — but models stack, an app-wide one
> above a page's own, and down inside the page `useRKey()` is the page's key, not
> the app's. A helper written for the model that is *not* the nearest hands out
> the wrong key, quietly and with the right types on it. Name that model's
> exported key instead; [Stacking models](#stacking-models-the-app-above-the-page-below)
> is where this bites and what it looks like. -->

## Rerenders

Data in the storage causes rerenders: when `isPolicyAccepted` changes, the button
above rerenders. But **only** the components reading that field do. Update
`email`, and the button sits still — unless, of course, a parent above it
rerenders for its own reasons and takes the button along. **Components which use values from the store rerender only when those specific values change.**

### A value with no rerender at all

Sometimes a component needs a value without showing it: what to submit when the
button is pressed, what to compare the next keystroke against, what a timer or a
listener should pick up when it fires. Rendering for those is pure waste.

`useRValueAsRef` reads the same field as `useRValue` and hands it over as a ref
instead. It follows every write to that field and rerenders nothing, the way a ref does:

```tsx
export function SendButton() {
    const message = useRValueAsRef(CONTACT_KEY, 'message')

    const onClick = () => send(message.current) // whatever it says at click time

    return <button onClick={onClick}>Send message</button>
}
```

`useRValuesAsRef` is the same for several fields, the way `useRValues` is:

```tsx
const draft = useRValuesAsRef(CONTACT_KEY, ['email', 'message'])

const onClick = () => send(draft.current)
```

`current` is read-only on both, and deliberately so: the ref is a window onto
the field, not a copy to write through. Writes still go through a setter or the
api, which is what keeps the rest of the app in step. The slice is replaced
rather than written into — the way the storage replaces its data — so reach
through the ref, `draft.current.email`, rather than holding on to what it
pointed at earlier.

> Do not read either of them while rendering. Nothing about them triggers a
> rerender, so what you drew would stay on screen after the field had moved on.
> Reading during a render is exactly what `useRValue` is for.

Both are filled in before their subscription starts, so they are right from the
first commit — and if the storage is dropped they hold on to the last value they
saw, rather than throwing at whoever happened to write.

---

## Writing values

Now consider the input we type our email into:

```tsx
export function EmailInput() {
    const email = useRValue(CONTACT_KEY, 'email')

    const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        /* … */
    }

    return (
        <input type={'email'} className={'example-email-input'} value={email} onChange={onInputChange} />
    )
}
```

To write, we need a setter. There are a few ways to get one.

### A setter for one field

`useRSetter` gives you a stable setter for a single field:

```tsx
export function EmailInput() {
    const email = useRValue(CONTACT_KEY, 'email')
    const setEmail = useRSetter(CONTACT_KEY, 'email') // same shape as reading

    const onInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
        setEmail(event.target.value)
    }

    return (
        <input type={'email'} className={'example-email-input'} value={email} onChange={onInputChange} />
    )
}
```

The setter keeps its identity for as long as the key and the field do, so it is
safe to pass to a memoised child or to list as a dependency.

### Writing a few fields at once

If we want to change a few fields at once we can use `useRValuesSetter`, which gives us a more generic approach to setting values. This hook is not bound to specific fields, but gives a method to pass whatever data we want to set:

```tsx

export function ClearButton() {
            //There is no fields specification
    const setter = useRValuesSetter(CONTACT_KEY) 

    const onClick = () => {
        //We are specific which data we want to change with values. Only components reading those values will eventually rerender
        setter({email: "", message: ""})
    }

    return <button onClick={onClick}>Clear form</button>
}

```

---

## Updating from the current value

Sometimes the new value is built from the old one, for example counters or lists. So rather than setting a new value, we want to update it. We can achieve this with `useRSetter`, by handing it a callback instead of a value — the same shape as `useState` in React:

```tsx
export function Counter() {
    const setCounter = useRSetter(COUNTER_KEY, 'counter')

    const onClick = () => {
        setCounter((old) => {
            return old + 1
        })

        /*
        or:
            setCounter((old) => old + 1)
        if you want it clean ... and cool
        */
    }

    return <button onClick={onClick}>add</button>
}
```

Either way the callback runs at click time against the value in the storage right
now — not against whatever the render that built the handler happened to see.

## Updating multiple values at once

There is also a way to update multiple values using `useRValuesSetter`. In this case we also need to pass down a callback, however this time, as the argument of the callback we get an object containing all the data, not only a specific field value. As a return type, the callback requires an object with fields taken from the data type with new values:

```tsx
export function Updater() {
    const setter = useRValuesSetter(EX_KEY)

    const onClick = () => {
            //data contains all values from Storage
        setter( (data) => {
            return {
                counterOne: data.counterOne + 1,
                counterTwo: data.counterTwo + 2,
            }
        })

    }
}
```

It is fairly similar to updating a value from state, which is represented by an object.

Updating multiple values will cause only one rerender of components.


## A model of your own: custom DataApi

All good so far. But it is common to want data-manipulating methods that live
with the model rather than in a component. Say we write a "clear" function in one place:

```tsx
export function ClearButton() {
    const api = useRDataApi(CONTACT_KEY)

    const clear = () => {
        api.setValue('email', '')
        api.setValue('message', '')
    }

    // …
}
```

…and then want to clear the same fields after a message is sent. Now we are
writing the same function again in the send button.

Instead, we can give the storage a **custom DataApi**.


Storage as an api expects a class extending `DataApi<T>` with our own methods.
`DataApi` holds methods and no data, so it is fairly different from our raw data. Splitting data from logic ensure, that using functions from `DataApi` will cause no rerenders. Also, functions given by `DataApi` are stable, so they can be passed down with props safely.

Same DataApi object holds primary functions to manipulate data.

```ts
/* Extending DataApi is what makes it a data api  */
export class ContactApi extends DataApi<ContactData> {
    
    //A method can take nothing…
    clear = () => {
        this.setValues({ message: '', email: '' })
    }

    //…or take arguments, like any other function.
    accept = (accepted: boolean) => this.setValue('isPolicyAccepted', accepted)
}
```

> Write the methods as **arrow fields**, not as `clear() {}` methods. That way
> `api.clear` can be handed straight to `onClick` and still knows its `this`.

And now the component is one line:

```tsx
export function ClearButton() {
    
    const api = useRDataApi(CONTACT_KEY)

    return <button onClick={api.clear}>Clear</button>
}
```

Two more things have to change. First the key, which now carries the api type as
well:

```ts
// old:
// export const CONTACT_KEY = storeKey<{ data: ContactData }>('contact')

export const CONTACT_KEY = storeKey<{ data: ContactData, api: ContactApi }>('contact')
```

The api is checked against the rest of the shape rather than taken on trust: an
api written over other data — or over other events, once there are any — does
not fit the key that claims it.

This way TypeScript knows our api type, and after `useRDataApi(CONTACT_KEY)`
our own methods are right there next to the built-in ones.


And second, an instance of the api has to be handed to `<RModel />`:

```tsx
/* One instance per storage, built here rather than in the JSX: <RModel /> reads
   it once, when it creates the storage, so it has to be a stable object. Writing
   dataApi={new ContactApi()} would build a new one on every render. */
export const contactApi = new ContactApi()

export function ContactPage() {
    return (
        <RModel storageKey={CONTACT_KEY} defaultValue={CONTACT_DEFAULT} dataApi={contactApi}>
            <Contact />
        </RModel>
    )
}
```

Now `useRDataApi` hands out the whole api, our own methods included, and still
costs no rerenders.


### The methods DataApi already brings

Extending `DataApi<T>` hands you the writes themselves. They are the only things
in the class that touch the store, and each one goes through the same
notification round, so whatever you build out of them reaches every component
reading the storage. Your own methods sit next to them, and so do these when a
component takes the api out of `useRDataApi`:

| method | what it does |
| --- | --- |
| `setValue(name, value)` | Writes one field. |
| `setValues(values)` | Writes several in one go — one notification and one render however many it names, and fields left out are left alone. Also takes the positional form, `setValues(['name', 'qty'], ['Tea', 5])`, for a caller that already holds the names as a list. |
| `updateValue(name, next)` | Writes one field from its own current value: `this.updateValue('qty', (qty) => qty + 1)`. |
| `updateValues(next)` | The same for several: the callback is handed the whole data and hands back the fields to write. |
| `setValueByTask(name, task)` | `setValue` with an async step in front of it — the task computes, and what it hands back is written when it settles. Returns the cancel. See [Setting values from a task](#setting-values-from-a-task). |
| `updateByTask(name, task)` | The same for a task that builds the new value out of the old one, at the write rather than when it started — see [Updating by task](#updating-by-task-building-on-the-value-that-is-there). |
| `setValuesByTask(task)` | Several fields from one task, in both shapes `setValues` takes. One write when it finishes, and none at all if it was called off first. |
| `emit(name, argument)` | Announces one of the storage's events, for an api that names them. Nothing is written and nothing is kept — see [Announcing one](#announcing-one). |
| `cancelTasks()` | Calls off every task this storage still has in flight. |

A few more are `protected`: yours inside the class, and not part of what a
component gets.

| member | what it is |
| --- | --- |
| `this.data` | The data as of right now. To read — a write goes through the methods above. |
| `this.refs` | The storage's own refs object, for an api that names them — see [Refs from inside the model](#refs-from-inside-the-model). |
| `this.subscribe(listener, keys?)` | Reacts to writes without a render. The subscription belongs to the storage and goes with it; the return value drops it sooner. |
| `this.runTask(task, onCancel?)` | Runs an async task and writes what it hands back with one `setValues()`. `onCancel` is the state to put back, written the moment the task is called off. Returns the cancel. |
| `this.trackTask(body, onDone?)` | The bare form underneath it: runs `body` as a task of this storage — so a cancel and a dropped storage reach it — and writes nothing by itself. |

`attach` and `detach` are public too, but they belong to `<RModel />`: it calls
them as it builds and drops the storage. There is nothing to call them for.

Every one of these throws once the storage behind it is gone — an api used after
its `<RModel />` unmounted has nowhere to write, and saying so beats writing into
a store nobody reads. `cancelTasks()` is the exception: with the storage went
everything it had running, so there is nothing left to call off and it stays
quiet.


### What can I put in my custom api?

Honestly, whatever you like. Just remember that the data manipulation itself
should go through the methods you have under `this` — `this.setValue`,
`this.setValues`, `this.updateValue`, `this.updateValues`. That is what
guarantees the update actually reaches every component in the app.

---

## Computed values: selectors

A page rarely shows only what is in the storage. It shows things worked out from
it: whether the form can be sent, how many words are in the message, the list of
recipients split out of one field. Doing that in the component works, but it
means the component has to read every field the answer is built from — and then
it rerenders on every keystroke, even when the answer did not move.

A **selector** is that computation, declared once, with the fields it reads
declared next to it:

```ts
export type Selector<T extends object, V, R extends object = StoreRefs> = {
    selector: (data: T, refs: R) => V
    dependencies: readonly (keyof T)[]
    /** Defaults to Object.is. */
    isEqual?: (previous: V, next: V) => boolean
}
```

- `selector` — how the value is worked out from the data. A second argument
  comes with it: the storage's [refs](#refs-what-nothing-renders-from), for the
  rarer view that has to read one. They are handed over, not depended on —
  nothing notifies when a ref moves, so what a selector sees there is whatever
  they held at the recompute its dependencies caused.
- `dependencies` — the fields it reads. Those, and only those, wake it.
- `isEqual` — what counts as "the result changed".

The whole idea is that you declare the computation together with the fields it
reads. It is worked out again when one of those fields changes, and the component
rerenders only when the **result** is different from the last one — which is not
the same question. Take a selector answering whether the message is longer than
eight characters:

```ts
const isLongEnough = (message: string) => message.length > 8
```

Typing the ninth letter flips the answer and rerenders whoever reads it. The
tenth changes `message` but not the answer, and rerenders nobody.



<!-- ### Reading one

To read a selector's value we use the `useRSelector` hook, and we name the
selector we want:

```tsx
export function SendButton() {
    const canSend = useRSelector(CONTACT_KEY, 'canSend')

    return (
        <button disabled={!canSend} className={canSend ? 'button-enabled' : 'button-disabled'}>
            Send message
        </button>
    )
}
```

`'canSend'` is a field of the `ContactSelectors` class declared a few sections
down, and the key is what tells the hook where to look — nothing has to be
imported next to it. The name is typed against that class, so only the fields
built with `this.select()` are offered, and the result is whatever the selector
hands back — a `boolean` here:

```ts
useRSelector(CONTACT_KEY, 'words')     // number
useRSelector(CONTACT_KEY, 'nope')      // ✗ no such selector on ContactSelectors
useRSelector(CONTACT_KEY, 'message')   // ✗ a data field, not a selector
useRSelector(CONTACT_KEY, 'read')      // ✗ a method, not a selector
```

Compare that with the same button written with `useRValues` earlier: that one
holds three fields and rerenders on every letter typed into the message. This one
holds a boolean and rerenders when the answer flips — twice in the life of the
form, not once per keystroke. -->

### Declaring them locally

There is two ways do declare selector:
- locally, existing only in one component
- globally for store, able to be reused across different components.

Selector is build from 3 parts:
- selector callback - function which declares what we will get. It is handed the
  data, and the storage's refs after it
- dependencies array - tells what values change can cause selector to change its value.
- isEqual function - declares, what counts as same value for selector. This function prevents unnecessary rerenders. default value is `Object.is` function.

Value of selector can only change, when:
- one of value from dependency array changed
- isEqual function between old and new computed value returns `false`.

When that happens, every component which is subscribed to selector rerenders with its new computed value. Seems complicated, however it is pretty similar to `useMemo` from React, only difference is that we get data object as an argument of the callback.


A selector written this way has no name on the model, so there is nothing to
look up — it is handed over directly, and that is what `useRCustomSelector` is
for:

```tsx
export function WordCount() {
    const words = useRCustomSelector(CONTACT_KEY, 
        {   
            //the key is what types the callback's argument as ContactData
            selector: (data) => data.message.trim().split(/\s+/).filter(Boolean).length,  
            dependencies: ['message']
        }   
    )

    return <span>{words} words</span>
}
```

`useRCustomSelector` is the whole of the machinery — `useRSelector` is this same
hook with the name looked up first, so the two behave identically once the
selector is in hand. Reach for it when the view belongs to one component, or
when it closes over something only that component knows. A view the app reads in
more than one place belongs on the selectors class instead, where it is named
once and read by that name everywhere.

### What is the point of dependencies?

The dependency list is what tells RModel when the answer might have moved. The
selector is worked out again after a write to one of those fields and after no
other write, so the value is never stale and nothing is computed for nothing.

> Declare it at module level (or memoise it), not inline in the component. The
> dependency list is read on every render, and a selector rebuilt each time is a
> subscription rebuilt each time.

### Declaring StoreSelectors

A selector declared inside a component is for that component alone. For the ones
the app reads in more than one place, extend `StoreSelectors<T>` — where `T` is
the data type, `ContactData` here — much as we extended `DataApi` above.

Each selector is a field of that class, built with `this.select()`, which takes
the computation, its dependencies and, optionally, an `isEqual`:

```ts
export class ContactSelectors extends StoreSelectors<ContactData> {
    canSend = this.select(
        ({ email, message, isPolicyAccepted }) =>
            isPolicyAccepted && email !== '' && message !== '',
        ['email', 'message', 'isPolicyAccepted'],
    )

    words = this.select(
        ({ message }) => message.trim().split(/\s+/).filter(Boolean).length,
        ['message'],
    )
}

```

Then we build one instance of it and hand it to `<RModel />`. And once again the
`storeKey()` call has to name the new type:

```tsx
 const contactSelectors = new ContactSelectors()

//`selectors` names the class, so the hooks know what can be read by name
export const CONTACT_KEY = storeKey<{
    data: ContactData
    api: ContactApi
    selectors: ContactSelectors
}>('contact')

export function ContactPage() {
    return (
        <RModel
            storageKey={CONTACT_KEY}
            defaultValue={CONTACT_DEFAULT}
            dataApi={contactApi}
            selectors={contactSelectors}
        >
            <Contact />
        </RModel>
    )
}
```

### Fresh arrays and objects

`isEqual` defaults to `Object.is`, which is right for a number, a string or a
boolean. A selector that builds a **new** array or object every time it runs needs
more than that, or the result is never equal to the last one and the component
rerenders for nothing:

```ts
recipients = this.select(
    ({ email }) => email.split(',').map((one) => one.trim()),
    ['email'],
    shallowEqual, // exported by the library — compares entry by entry
)
```

With it, a write that leaves the same entries in the same order costs one
recompute and no render at all.

<!-- ### Reading one outside React

The same names work outside a render. `read()` on the selectors runs one right
now, without a subscription and without a comparison — for a timer, a socket, a
router hook, anything that acts on the model without drawing it:

```ts
const store = getStore(CONTACT_KEY)
const canSend = store ? store.selectors.read('canSend') : false
```

This is what keeps a rule in one place. The button above and the code here work
out "can this be sent" by the very same name, so there is no second copy of the
rule to fall out of step with the first.

`read()` takes a selector object too, on the same terms as
`useRCustomSelector()`:

```ts
contactSelectors.read(WORD_COUNT)
```

### Attaching them to the storage

Selectors are handed to `<RModel />` the same way an api is, and the key carries
their type as the third parameter — both of which the section above already did.
Two rules are worth spelling out, and they are the api's rules exactly:

**One instance per storage, built at module level.** `<RModel />` reads
`selectors` once, when it creates the storage, so it has to be a stable object:

```tsx
export const contactSelectors = new ContactSelectors()

// ✓ the same instance on every render
<RModel
    storageKey={CONTACT_KEY}
    defaultValue={CONTACT_DEFAULT}
    dataApi={contactApi}
    selectors={contactSelectors}
>

// ✗ a new one every render — and every one after the first is ignored
<RModel
    storageKey={CONTACT_KEY}
    defaultValue={CONTACT_DEFAULT}
    dataApi={contactApi}
    selectors={new ContactSelectors()}
>
```

That the later ones are ignored is deliberate rather than a wart: a fresh
instance on the parent's next render must not swap the parts under a subtree
that is already reading through them.

**The instance holds no data.** `this.select()` only writes down the
computation; what it runs against is the storage the instance was attached to
when `<RModel />` built it. That is what makes `contactSelectors.read('canSend')`
work from anywhere — and also why reading through a set of selectors whose
storage has been dropped throws, instead of quietly answering from data nobody
can see any more.

Outside React the same instance goes to `createStore`, in the same position:

```ts
createStore(CONTACT_KEY, CONTACT_DEFAULT, contactApi, contactSelectors)
```

--- -->

## Refs: what nothing renders from

Some of what a page shares is not data at all. There were a few cases where we already used them (for example in selectors).
The `<input>` the send button
wants to focus, how far the list is scrolled, the id of a timer still running:
several components need the same one, none of them draws it, and putting it in
the storage's data would mean a rerender every time it moves.

That is the storage's other half. Beside the data it carries a **refs** object:
declared as a type, handed to `<RModel />`, written in place, listened to by
nobody. Declaration is pretty similar to normal data. First, we need the type of our ref container:

```ts
export type ContactRefs = {
    email: HTMLInputElement | null
    lastSentAt: number
}
```

then, we need to pass down our type to our key:

```tsx
//yes, the key grows again — one more part in the shape

export const CONTACT_KEY = storeKey<{
    data: ContactData
    api: ContactApi
    selectors: ContactSelectors
    refs: ContactRefs
}>('contact')
```
and pass it down to RModel as an object, which contains the default values of our container

```tsx
//We declare our default values. One object per storage, at module level: this is
//the very object the subtree writes into, and <RModel /> reads it once.
export const CONTACT_REFS: ContactRefs = { email: null, lastSentAt: 0 }

<RModel
    storageKey={CONTACT_KEY}
    defaultValue={CONTACT_DEFAULT}
    dataApi={contactApi}
    selectors={contactSelectors}
    refs={CONTACT_REFS}
>
```

If we want to use it, we need to use
`useRRef`, which hands out one field of it, as a ref. It is a real one — reading and
writing `current` reads and writes the storage's own refs object — so every
component asking for the same field gets the same slot:

```tsx
export function EmailInput() {
    const email = useRValue(CONTACT_KEY, 'email')
    const setEmail = useRSetter(CONTACT_KEY, 'email')
    const field = useRRef(CONTACT_KEY, 'email') //This field is not the same as email field form data object.

    return (
        <input
            ref={field}
            type={'email'}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
        />
    )
}

export function SendButton() {
    const canSend = useRSelector(CONTACT_KEY, 'canSend')
    const field = useRRef(CONTACT_KEY, 'email')

    // Reaches the input in the other component. No prop, no context of its own.
    const onClick = () => (canSend ? send() : field.current?.focus())

    return <button onClick={onClick}>Send message</button>
}
```

and if you want to write to them, simply modify `ref.current` like in normal ref from React:

```tsx
export function ClickComponent() {

    const clickedTimes = useRREf(EX_KEY, "clicked")
    
    const onClick = () => {
        //updating ref value
        clickedTimes.current += 1
    }

    const showRes = () => {
        //Reading ref value
        console.log(clickedTimes.current)
    }

    return (
    <>
        <button onClick={showRes}>log clicks</button>
        <div 
            className={"click-container"}
            onClick={onClick}
        >
        Click inside. Waaaa
        
        </div>
    </>
    )

}

```


Reach for `useRRef` here, and mind the neighbour: `useRValueAsRef` hands out a
**data** field as a ref, which is a different thing. The refs live in a space of
their own precisely so that nothing has to be checked, compared or rerendered
when one of them moves.

A few things worth knowing:

- The object you hand to `refs` is the **very one** the storage carries, not a
  copy. It is read once, when the storage is built, and pinned to the key — a
  fresh object literal on the parent's next render does not throw away what the
  subtree already wrote into it.
- A ref attached during the commit — which is when React attaches DOM refs, before
  the layout effect that builds the storage — lands in that same object, so
  nothing is lost on the first mount.
- A storage that is adopted rather than built keeps the refs it already has, the
  way it keeps its data and its parts. `remember` keeps them too.
- Nothing here notifies anything. Whatever the app should rerender for belongs in
  the data.
- A key that names no refs has no field to take: `useRRef` on it is a compile
  error, not an `undefined`.

### Refs from inside the model

The components are not the only ones that need them. An api usually has
something of exactly this shape to keep — when it last ran, the cancel of the
task it has in flight so the next call can call the last one off — and that is
not state either: nothing should rerender because a request started, or because
the input it wants to focus finally exists.

So both halves of a model take the refs as a **second, optional type argument**:
the same type the key names.

```ts
export class ContactApi extends DataApi<ContactData, ContactRefs> {

    // `this.refs` is the storage's own refs object — the very one the
    // components take their refs out of, not a copy of it. So this reaches the
    // <input> some component below attached, with no prop and no context.
    focusEmail = () => this.refs.email?.focus()

    // Written in place, and nothing rerenders for it. The message is data and
    // is cleared through setValues; the timestamp is not, and is just assigned.
    send = () => {
        this.refs.lastSentAt = Date.now()

        return this.setValuesByTask(async (signal) => {
            await postMessage(this.data, signal)

            return { message: '' }
        })
    }
}

```

And as we could saw previously, we can create selectors also with refs as a second argument to our callback.
We also need to pass down our refs type to our StoreSelector object

```ts

export class ContactSelectors extends StoreSelectors<ContactData, ContactRefs> {

    // Selectors take it on the same terms, and there are two ways in: every
    // selector is handed the refs after the data…
    isDraftStale = this.select(
        (data, refs) => data,message !== '' && Date.now() - refs.lastSentAt > 60_000,
        ['message'],
    )

}
```

A ref is read there, never depended on. Nothing notifies when one moves, so the
value a selector sees is whichever the refs held at the recompute its
dependencies caused: `isDraftStale` is worked out again when the message
changes, not a minute after the last send. What has to be current the moment it
changes is data, and belongs in the store.

Keep the result stable, mind. It is compared with `isEqual` on every render, and
a selector that builds a different answer out of a ref on every call — a fresh
measurement of a node, a new object — is the one React complains about with
*"the result of getSnapshot should be cached"*. Reading a ref is fine; handing
back something new each time is not.

Leave the argument out and there are no refs to reach: `this.refs` on a part
that names none is a compile error, the way `useRRef` is on a key that names
none. And it is only about what the part itself may touch — an api written
without it still goes on a key that has refs, and the components still take
theirs. Naming it is how the api says it writes into them too.

`this.refs` throws while the part has no storage, exactly as `this.data` does:
the refs belong to the storage, so there is nothing to write into until one has
been built.

---

## Events: what merely happened

The data is what the page draws. The refs are what it shares without drawing.
The third thing a storage carries is neither: the fact that something happened.

A field cannot say "it happened again". A write of the value already there
changes nothing and notifies nobody, so the usual workaround is a counter nobody
means, rerendering everyone who reads it. An event costs no render at all — only
the handlers run.

### The container

Events are declared as a type: the names, and what each of them carries.

```ts
export type ContactEvents = {
    sent: number
    sendFailed: { status: number, at: number }
    draftCleared: string
}
```

That type is a container of types and nothing else. No event is stored anywhere,
so there is no value in it to read back later — only a shape to check the
announcements against.

**One name, one argument**, and the type standing against the name is that
argument's type: `sent` is announced with a number, `sendFailed` with that
object, and nothing else compiles. An event with nothing to carry declares
`void` or `null` and is passed it — the argument is the payload, not an optional
extra.

The key names the container as one more part of its shape, the way it names the
refs:

```ts
export const CONTACT_KEY = storeKey<{
    data: ContactData
    api: ContactApi
    selectors: ContactSelectors
    refs: ContactRefs
    events: ContactEvents
}>('contact')
```

And the api is checked against it. An api that announces one set of events does
not fit a key claiming another — the parts of a shape are checked against each
other, not one at a time.

Nothing is handed to `<RModel />` for it, and nothing has to be: there is no
value to hand over, and the events are the fifth of the five things the key
carries, so mounting with the key is what names them.

```tsx
<RModel
    storageKey={CONTACT_KEY}
    defaultValue={CONTACT_DEFAULT}
    dataApi={contactApi}
    selectors={contactSelectors}
    refs={CONTACT_REFS}
>
```

The api is checked against them there the way it is checked against the key —
`contactApi` has to announce *these* events, over *these* refs, for this
mounting to compile. Mount with a bare string instead and there is nothing
saying which events the storage carries: they default to none, and an api that
announces some still fits.

### Announcing one

From the model, which is where most of them belong. An api names the container
as its third type argument, and then `this.emit()` knows the names:

```ts

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export class ContactApi extends DataApi<ContactData, ContactRefs, ContactEvents> {

    send = async () => {
        
        //Simple event, just an example
        await sleep(1000)
        this.emit('sent', Date.now())
    }
}
```

Announced by the method that did it rather than by the button that called it:
whoever else sends a message announces it too, for free, and nobody has to
remember to.


You can also use, `useREmit` and get event-sending function. It works same as `emit` function from `DataApi`.

```tsx
export function ClearButton() {
    const api = useRDataApi(CONTACT_KEY)
    const cleared = useREmit(CONTACT_KEY, 'draftCleared')

    const onClick = () => {
        api.clear()
        //As an argument draftCleared requires string, so the string is passed
        cleared('the clear button')
    }

    return <button onClick={onClick}>Clear</button>
}
```

The emitter keeps its identity for as long as the key and the name do, subscribes
to nothing, and rerenders nobody by itself — this component does not even hear
its own event.

### Hearing one

`useROn` keeps a handler on the storage for as long as the component is mounted:
which gets as arguments:
- key (who would have guessed?)
- the type of an event from the event container
- handler with one argument, which represents event data

```tsx
export function SendStatus() {
    const [sentAt, setSentAt] = useState<number | null>(null)
    const [failed, setFailed] = useState<number | null>(null)

    useROn(CONTACT_KEY, 'sent', (at) => {
        setSentAt(at)
        setFailed(null)
    })

    useROn(CONTACT_KEY, 'sendFailed', ({ status }) => setFailed(status))

    if (failed) return <p>could not send it — {failed}</p>
    if (sentAt) return <p>sent at {new Date(sentAt).toLocaleTimeString()}</p>

    return null
}
```

The handler's argument is whatever the container types for that name, so `at` is
a number and `{ status }` unpacks the object — no casting, and a handler asking
for the wrong shape does not compile.

Look at what that component reads: no field and no selector. There is nothing it
could rerender for, and it is still never behind on what the app did. That is
the point of an event over a field — a component can react to something without
reading, and so without rerendering for, anything at all.

The handler is read fresh at every emit, so it may close over whatever the latest
render has. It is not a dependency, and changing it resubscribes nothing.

### The rules worth knowing

- **Nothing is stored.** An event is announced, the handlers run, and it is over.
  Nobody can ask afterwards what it was.
- **Nothing is replayed.** A component mounted after the emit hears nothing about
  it, and there is nowhere to go and look it up. What a latecomer has to see is
  data, not an event.
- **The handlers belong to the storage.** Dropping the storage ends them, the way
  it ends the tasks in flight.
- **It runs in the emitter's stack.** The handlers run inside the `emit()` call,
  synchronously. A handler that sets React state renders inside the write that
  announced it — one render, not two.
- **An event nobody is listening for is not an error.** It goes nowhere.
- **A key that names no events has none.** `useROn` and `useREmit` on such a key
  are compile errors rather than subscriptions to nothing.

---

## The rest of the `<RModel />` props

Everything past `storageKey` and `defaultValue` is optional — except the parts
the key names, which are required at the mounting.

| prop | type | default | what it does |
| --- | --- | --- | --- |
| `storageKey` | `StoreKey<T, A, S, R, E>` | — | Names the storage, and says what it is made of: the key from `storeKey()`, which is what the four props below are checked against — and which of them are required at all. Spelled out because React keeps `key` for itself. A bare string is still accepted — it names nothing, so nothing is checked and nothing is required. |
| `defaultValue` | `T` | — | The value the storage is built with. Read once, at creation. |
| `dataApi` | `A extends DataApi<T, R, E>` | empty api | The write half, attached as the storage is built. Name the refs on it — `DataApi<T, R>` — and it can write into them as well. Required where the key names an api. |
| `selectors` | `S extends StoreSelectors<T, R>` | empty set | The read half, on the same terms, and required on the same terms. |
| `refs` | `R extends object` | empty object | The refs the storage carries — see [Refs](#refs-what-nothing-renders-from). Required where the key names them. |
| `remember` | `boolean` | `false` | Keeps the storage alive after the last `<RModel />` on the key unmounts. |
| `allowSharedStore` | `boolean` | `true` | Whether a second `<RModel />` may adopt a storage someone else is holding. |
| `loadFromBrowser` | `boolean` | `false` | Builds the storage from what was last saved to the browser under this key. |
| `saveToBrowser` | `boolean` | `false` | Writes the storage to the browser under this key after every write to it. |

### `remember`

By default, when the last `<RModel />` on a key unmounts, the storage is dropped:
its parts are detached and the work still in flight is cancelled, so a write that
arrives late says so instead of vanishing into a store nobody can read.

`remember` keeps it in the registry instead. Mount the same key again and the data
is still there — and a write that was already on its way still lands.

```tsx
{open && (
    <RModel storageKey={COMPOSER_KEY} defaultValue={COMPOSER_DEFAULT} dataApi={composerApi} remember>
        <Composer />
    </RModel>
)}
```

That is the "closing the window keeps the draft" behaviour, and it is also what
lets a send survive the panel being closed halfway through.

### `allowSharedStore`

One storage per key. Mount a second `<RModel />` on a key that already has one and
it **adopts** what the first built rather than building its own; the storage then
lives until the last of them unmounts. Its `defaultValue`, `dataApi` and
`selectors` are ignored — the storage keeps the ones it was built with. Handed
over they still have to be, mind: which of two mountings builds the storage and
which adopts it is a question about the running app, and the key cannot answer
it while the code is being checked.

Turn the prop off to claim the key exclusively:

```tsx
<RModel
    storageKey={CONTACT_KEY}
    defaultValue={CONTACT_DEFAULT}
    dataApi={contactApi}
    selectors={contactSelectors}
    refs={CONTACT_REFS}
    allowSharedStore={false}
>
```

Now a second `<RModel />` on that key throws instead of quietly handing its
subtree data, an api and selectors it did not build. A storage nobody is holding
— one left behind by `remember`, or made with `createStore()` — is adopted either
way, because adopting it clashes with no one.

### `loadFromBrowser`

Builds the storage from what was last saved to the browser under this key, instead
of from `defaultValue` alone:

```tsx
<RModel
    storageKey={CONTACT_KEY}
    defaultValue={CONTACT_DEFAULT}
    dataApi={contactApi}
    selectors={contactSelectors}
    refs={CONTACT_REFS}
    loadFromBrowser
>
```

Anything that is not there falls back to `defaultValue`, field by field: a key
nobody ever saved, a field the saved data does not name, a browser with site data
switched off. None of them is an error — they just leave the default standing.

It is read once, together with the default value, and early enough that the first
render already shows the saved values rather than flicking over to them a moment
later.

### `saveToBrowser`

The other half. With it on, the storage is written to the browser as soon as it
exists and again after every write to it, for as long as this `<RModel />` is
mounted:

```tsx
<RModel
    storageKey={CONTACT_KEY}
    defaultValue={CONTACT_DEFAULT}
    dataApi={contactApi}
    selectors={contactSelectors}
    refs={CONTACT_REFS}
    loadFromBrowser
    saveToBrowser
>
```

That pair — load on the way in, save on the way out of every change — is a draft
that survives a reload, and it is the whole of what most pages want.

The two are independent, though. Save without loading to start every visit fresh
while leaving the data behind for something else to read; load without saving to
restore what another part of the app wrote.

> Every write means every write, a keystroke into a field included. A write that
> changes nothing notifies nobody, so it costs nothing — but where the data is
> big enough that saving it on every letter is more than it is worth, leave the
> prop off and call `saveToBrowser(key)` at the moments that matter instead.

A storage dropped on unmount is not wiped from the browser: what was last saved
stays there, which is what makes `loadFromBrowser` find it next time.

---

## Stacking models: the app above, the page below

As we said before, we can declare as many RModels as we like. We can stack them, or create them as siblings etc. We will dive deeper to concept of stacking models.

Not everything belongs to a page. The signed-in user, the theme, the clock in the
corner — those live as long as the app does, and every page wants them. That is
a second `<RModel />`, mounted above the router, with the page models sitting
inside it.

```ts
export type AppData = {
    now: string
    user: string
    theme: 'light' | 'dark'
}

export const APP_KEY = storeKey<{ data: AppData }>('app')

export const APP_DEFAULT: AppData = {
    now: new Date().toLocaleTimeString(),
    user: 'ada',
    theme: 'light',
}

/** The clock: a plain interval, writing into the storage from outside React. */
export function startClock() {
    const app = storeApi(APP_KEY)
    const tick = setInterval(() => app.setValue('now', new Date().toLocaleTimeString()), 1000)

    return () => clearInterval(tick)
}
```

```tsx
export function App() {
    return (
        <RModel storageKey={APP_KEY} defaultValue={APP_DEFAULT}>
            <Shell />
        </RModel>
    )
}

function Shell() {
    // By the time an effect runs the storage above exists, so this is where the
    // clock starts — and its cleanup is what stops it.
    useEffect(() => startClock(), [])

    return (
        <>
            <StatusBar />

            <React.Router>
                <Route path={''}>
                    <Main />
                </Route>
                <Route path={'contact'}>
                    {/* mounts its own <RModel storageKey={CONTACT_KEY}> inside this one */}
                    <ContactPage />
                </Route>
                <Route path={'gallery'}>
                    <Gallery />
                </Route>
            </React.Router>
        </>
    )
}
```

Now there are two storages standing at once, and a component inside the contact
page can read either — it says which by naming the key:

```tsx
function SendButton() {
    const canSend = useRSelector(CONTACT_KEY, 'canSend') // the page
    const theme = useRValue(APP_KEY, 'theme')                           // the app above

    return (
        <button className={theme} disabled={!canSend}>
            Send message
        </button>
    )
}
```

This is what the key buys you. Nothing is resolved by "which provider is nearer",
so nothing changes meaning when a component is moved deeper, and reading from two
models in one component is unremarkable rather than clever.

**The clock is the thing to watch.** It writes `now` once a second. The status bar
rerenders, because it reads `now`. The contact form does not — not the fields, not
the send button, not the list next to it — because a write reaches the components
reading *that field* and nobody else. One tall store for the whole app would have
rerendered the world every second.

```tsx
function StatusBar() {
    const { user, now } = useRValues(APP_KEY, ['user', 'now'])

    return <div className="statusbar">{user} · {now}</div>
}
```

The two also have different lifetimes, and that falls out of where they are
mounted. The app storage is created once and dropped when the app goes; the
contact storage is created when the route mounts and dropped when you leave it,
taking its draft — and any request still in flight — with it. Keep the draft
across visits by giving that one `remember`, and the two decisions stay
independent of each other.

> One gotcha worth knowing: `useRKey()` hands back the key of the **nearest**
> `<RModel />`, so inside the contact page it is the contact key, not the app
> one. A helper written as `useAppKey = () => useRKey<{ data: AppData }>()` would
> quietly hand out the wrong key down there. For a model that is not the nearest,
> name its exported key — `APP_KEY` — which is what it is for.

Stacking two `<RModel />` on the **same** key is a different thing entirely:
that is sharing one storage, and
[`allowSharedStore`](#allowsharedstore) is what governs it.

---

## Setting values from a task

Not every value arrives synchronously. `fetch` is the obvious case: the data comes
later, so something has to wait for it. The usual way is `useEffect` with
`useState`:

```tsx


function Something() {

    const [data, setData] = useState<Data>(undefined)
    const [dataErr, setDataErr] = useState(false)

    useEffect( () => {
        const call = async () => {
            const res = await fetch(ENDPOINT_ADDRESS)

            if (res.ok) {
                setData(await res.json() as Data)
            }
            else {
                setDataErr(true)
            }
        }

        call()
    }, [])
}

```

There are a couple of things missing. A component that unmounts mid-request should
stop it, and we would like to be able to call the request off ourselves. That is
what `AbortController` is for:

```tsx


function Something() {

    const [data, setData] = useState<Data>(undefined)
    const [dataErr, setDataErr] = useState(false)
    const abortFunction = useRef(undefined);

    useEffect( () => {
        const call = async () => {
            
            const abortController = new AbortController()
            abortFunction.current = () => abortController.abort()

            const res = await fetch(ENDPOINT_ADDRESS, { signal: abortController.signal })

            if (res.ok) {
                setData(await res.json() as Data)
            }
            else {
                setDataErr(true)
            }

            abortFunction.current = undefined
        }

        call()

        return () => {
            abortFunction.current?.()
        }
    }, [])
}

```

That way the request is called off on unmount. It is, however, a lot of ceremony
to repeat for every value that arrives late — and a `fetch` is far from the only
thing that does.

The rest of this chapter is that ceremony, done for you: one field, several
fields in one write, and what to do when the task fails instead of answering.

### One field: `useRSetterByTask`

RModel does that part for you. The hook takes the key and the field, and hands
back a caller that takes the task — the write happens when the task finishes.

```tsx
function Something() {

    //The hook names the field; the task comes at the call.
    const call = useRSetterByTask(EXAMPLE_KEY, 'asyncString')

    //Somewhere to keep the cancel of the task that is still running.
    const abort = useRef<(() => void) | undefined>(undefined)

    const onClick = () => {
        //Call off the previous one…
        abort.current?.()

        //…and start another. Every call hands back its own cancel. The signal
        //is RModel's: it is aborted by that cancel and by the storage being
        //dropped, so pass it to whatever is doing the waiting.
        abort.current = call(async (signal) => {
            return await someStringTask(signal)
        })
    }

    return (
        <div>
            Click to run the task!
            <button onClick={onClick}>run</button>
        </div>
    )
}
```

### Several fields at once: `useRValuesSetterByTask`

`useRSetterByTask` writes one field when the task finishes. When a task brings
back several, `useRValuesSetterByTask` writes them **in one go**: one write, one
notification, one render — all of the fields or none of them.

It takes the key alone, the way `useRValuesSetter` does. One setter for the
whole storage, not one per field.

The task can hand back the fields themselves:

```tsx
export function DraftLoader() {
    const load = useRValuesSetterByTask(CONTACT_KEY)

    // The call hands back its cancel, so returning it from the effect is the
    // whole of the cleanup: unmounting mid-flight writes nothing.
    useEffect(() => load(async (signal) => {
        const draft = await fetchDraft(signal)

        return {
            email: draft.email,
            message: draft.message,
        }
    }), [])

    return <p className="label">loading your draft…</p>
}
```

Or the names are given up front, and the task hands back their values in that
same order:

```tsx
const load = useRValuesSetterByTask(CONTACT_KEY)

load(['email', 'message'], async (signal) => [
    await fetchEmail(signal),
    await fetchMessage(signal),
])
```

Both shapes write once. That is the point of computing first and writing at the
end: a cancel cannot leave half of it behind, so there is no such thing as a
page with the email loaded and the message still empty. Fields you do not name
are left exactly as they were.

### Putting something back when it is called off

A cancelled task writes nothing — which is right for the field it was going to
fill, and wrong for the flag that was raised before it started. The api's task
methods take an optional last argument for exactly that: what to write the
moment the task is called off.

```ts
export class ContactApi extends DataApi<ContactData> {

    loadDraft = () => {
        this.setValue('isDraftLoading', true)

        // Called off — by the cancel below, or by cancelTasks() — and the flag
        // goes back down without waiting for the request to notice.
        return this.setValuesByTask(
            async (signal) => ({ ...await fetchDraft(signal), isDraftLoading: false }),
            { isDraftLoading: false },
        )
    }
}
```

`setValueByTask()` and `updateByTask()` take it as the value for the field they
write; `setValuesByTask()` takes the fields to write, which need not be the ones
the task fills. It is written the moment the cancel happens rather than whenever
the task gets round to settling — so a second load that calls the first one off
and then raises its own flag does not have that flag wiped by the old task's
rollback landing late. A cancel that came from the storage being dropped writes
nothing at all: there is nobody left to write for.

The hooks take it too, at the call rather than at the hook:

```tsx
const load = useRValuesSetterByTask(CONTACT_KEY)
const suggest = useRSetterByTask(CONTACT_KEY, 'message')

load(async (signal) => ({ …, isDraftLoading: false }), { isDraftLoading: false })
suggest((signal) => fetchSuggestion(signal), '(nothing suggested)')
```

### When the task fails: the error goes in fields of its own

A task that throws writes nothing. The only throw the library swallows is that
of a task that was called off — anything else comes back out as a rejection and
the storage is left exactly as it was. So a page that has to *show* a failure
has to catch it and write it somewhere.

Not into the fields the answer was going to fill. Those hold the data; whether
loading it worked is a different question, and it gets fields of its own:

```ts
export type ContactData = {
    email: string
    message: string
    isPolicyAccepted: boolean

    // Not the draft — what happened while fetching it.
    isDraftLoading: boolean
    draftError: string | null
}
```

Now one task writes one of two sets of fields, and never a mix of them:

```tsx
export function DraftLoader() {
    const load = useRValuesSetterByTask(CONTACT_KEY)

    useEffect(() => load(async (signal) => {
        try {
            const draft = await fetchDraft(signal)

            return {
                email: draft.email,
                message: draft.message,
                isDraftLoading: false,
                draftError: null,
            }
        } catch (problem) {
            // A cancel is not a failure. An aborted fetch throws as well, and
            // that throw is the library's to swallow — rethrow it rather than
            // reporting a cancel as something that went wrong.
            if (signal.aborted) throw problem

            // `email` and `message` are not named here, so they are not
            // written: the draft that failed to load leaves whatever the user
            // has already typed alone, and there is no half-cleared form.
            return {
                isDraftLoading: false,
                draftError: problem instanceof Error ? problem.message : 'could not load the draft',
            }
        }
    }), [])

    return <DraftStatus />
}
```

Both ways out of the `try` are one write, so nothing renders between "the
request came back" and "the error is on screen". And because the failing branch
names only its own two fields, a component reading `email` does not render at
all when the load goes wrong — it has no reason to.

Whoever shows it reads those fields and nothing else:

```tsx
export function DraftStatus() {
    const { isDraftLoading, draftError } = useRValues(CONTACT_KEY, ['isDraftLoading', 'draftError'])

    if (isDraftLoading) return <p className="label">loading your draft…</p>
    if (draftError) return <p className="label">{draftError}</p>

    return null
}
```

The flag going up is a write of its own, before the task starts — one that also
clears the last failure, so a retry does not show the old message while it runs:

```tsx
const setValues = useRValuesSetter(CONTACT_KEY)
const load = useRValuesSetterByTask(CONTACT_KEY)

const retry = () => {
    setValues({ isDraftLoading: true, draftError: null })

    return load(async (signal) => { /* as above */ })
}
```

## Updating by task: building on the value that is there

Everything above writes what the task computed. Sometimes the new value has to
be built from the old one — and a value read before the request went out is old
news by the time the answer lands.

The task setters take the same callback form as `useRSetter`: hand back a
function instead of a value, and it runs **at the write**, against the field as
it stands then.

```tsx
export function SuggestButton() {
    const suggest = useRSetterByTask(CONTACT_KEY, 'message')

    const onClick = () => suggest(async (signal) => {
        const ending = await fetchSuggestion(signal)

        // Not `message + ending` with a message captured up front: this
        // callback is handed whatever the user typed while the request was
        // away, so nothing they wrote is clobbered.
        return (message) => `${message} ${ending}`
    })

    return <button onClick={onClick}>suggest an ending</button>
}
```

Inside a model it is a method rather than a hook, and reads the same —
`updateByTask`:

```ts
export class ContactApi extends DataApi<ContactData> {

    suggestEnding = () => this.updateByTask('message', async (signal) => {
        const ending = await fetchSuggestion(signal)

        return (message) => `${message} ${ending}`
    })
}
```

Every call hands back its own cancel. A task called off — by that cancel, by
`cancelTasks()`, or by the storage being dropped — writes nothing at all, so a
slow answer that arrives after the page has moved on is dropped rather than
applied to a store nobody is reading any more.

## Doing it by hand, without the task hooks

Nothing stops you from writing the async part yourself and using a plain setter
when the answer lands. `useRSetter` inside an `async` function in a `useEffect`
works exactly as you would expect:

```tsx

function Something() {

    const setData = useRSetter(EX_KEY, 'data')
    const setDataError = useRSetter(EX_KEY, 'dataError')

    useEffect(() => {
        const call = async () => {
            const res = await fetch(ENDPOINT_ADDRESS)

            if (res.ok) {
                setData(await res.json() as Data)
            }
            else {
                setDataError(true)
            }
        }

        call()
    }, [])
}
```

An `AbortSignal` can be added the same way, with a ref holding the cancel so the
cleanup can reach it:

```tsx

function Something() {

    const setData = useRSetter(EX_KEY, 'data')
    const setDataError = useRSetter(EX_KEY, 'dataError')

    const abortRef = useRef<(() => void) | undefined>(undefined)

    useEffect(() => {
        const controller = new AbortController()

        const call = async () => {
            const res = await fetch(ENDPOINT_ADDRESS, { signal: controller.signal })

            if (res.ok) {
                setData(await res.json() as Data)
            }
            else {
                setDataError(true)
            }

            //Nothing left to call off
            abortRef.current = undefined
        }

        abortRef.current = () => controller.abort()
        call()

        return () => {
            abortRef.current?.()
        }
    }, [])
}
```

Which is very nearly `useRValuesSetterByTask`, written out by hand. What the hook
adds is that the task is tied to the **storage** as well as to the component: it
is called off when the storage is dropped, and a write that arrives after that is
thrown away rather than landing in a store nobody can read. Doing it by hand, that
part is yours to remember.

## Keeping data in the browser

Nothing is written behind your back: saving happens because
`<RModel saveToBrowser />` is on, or because the app asked for it.

We can also to this manual way with build in functions:

```ts
saveToBrowser(CONTACT_KEY)                  // whatever the storage holds right now
saveToBrowser(CONTACT_KEY, CONTACT_DEFAULT) // or some data of your own
```

It returns whether the browser took it: `false` when there is nowhere to write
(a server render) or the browser refused (no space, site data switched off).
Neither is worth throwing over — a later load simply finds nothing saved.

A common place for it is the api itself, where the write and the save sit
together:


```ts
export class ContactApi extends DataApi<ContactData> {
    saveDraft = () => saveToBrowser(CONTACT_KEY)
}
```

`keepInBrowser(key)` is what the `saveToBrowser` prop does, out on its own: it
saves the storage as soon as there is one and after every write to it, until the
stop it hands back is called. Reach for it outside React — a storage built with
`createStore()` that should keep itself saved without a component in sight.

```ts
const stop = keepInBrowser(CART_KEY)
```

Reading back, when you want it outside `<RModel loadFromBrowser />`:

```ts
const draft = loadFromBrowser(CONTACT_KEY, CONTACT_DEFAULT) // ContactData
const maybe = loadFromBrowser(CONTACT_KEY)                  // ContactData | undefined
const sent = load<ContactData>(json, CONTACT_DEFAULT)       // the same, from any JSON
```

Given a default value, the result really is a `ContactData`: the default's fields
are what the result carries, so fields the saved data does not name come from it,
and fields it names that the type does not know are dropped. JSON written by an
older version of the app cannot hand you a half-filled object.

---

## The storage outside React: `getStore`

Not everything that writes to a page is a component. A timer, a socket, a router
hook — none of them render, and none of them can call a hook. `getStore(key)`
hands them the storage itself:

```ts
const store = getStore(CONTACT_KEY)

store?.getData().email          // ContactData['email']
store?.setValue('message', '')
```

The key types it, exactly as it types the hooks: `getStore(CONTACT_KEY)` is a
store over `ContactData`, carrying `ContactApi` and `ContactSelectors`, so
`store.dataApi.clear()` and `store.selectors.read('canSend')` are right there and
typed. No context and no component — the key is the only thing anything needs.

**The `undefined` is the point.** A hook can promise a value because it runs
under the `<RModel />` that built the storage; out here nobody promises anything,
and a key whose page is not mounted has no storage at all. So the result is
`Store | undefined`, and a caller that fires whenever it likes has to say what
happens when the page is not there:

```ts
/** Ticks whether or not the clock page is mounted. */
setInterval(() => getStore(APP_KEY)?.setValue('now', new Date().toLocaleTimeString()), 1000)
```

What the store offers is what the model offers, one level down: `getData()`,
`setValue`/`setValues`, the task writes (`setValueByTask` and the rest),
`subscribe(listener, keys?)` for reacting without a render, `emit`/`onEvent`,
`refs`, and `cancelTasks()`. Everything a write does through a hook it does
here — one notification, and every component reading that field rerenders.

Two neighbours are worth knowing:

- `storeApi(key)` is the same reach with the lookup done on every call, so it
  survives the storage being replaced under the key — and its writes throw
  rather than vanish when there is none. Hold it; hold a `Store` only as long as
  you would hold the page.
- `createStore(key, defaultValue, …)` builds one without a `<RModel />` at all,
  for a model that belongs to the app rather than to a page — see
  [Store keys](#store-keys) for the parts it takes.

---

The folders under `src/Example/` in this repo — `example/`, `mail/`,
`asyncExample/`, `pageExample/` — are working demos of both, and of everything
above.
