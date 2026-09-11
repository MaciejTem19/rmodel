import { memo, useLayoutEffect, useRef, useState } from "react"
import { RVModel, useRDataApi, useREmit, useROn, useRRef, useRSelector, useRSetter, useRValue, useRValuesSetter } from "rvmodel"
import Button from "../template/ui/Button"
import TextInput from "../template/ui/TextInput"
import "../template/template.css"
import { useRenderLog } from "../example/useRenderLog"
import { EX_API, EX_DEF_REFS, EX_KEY, EX_SELECTORS, SEC_DEFAULT_VALUES } from "./dataModel"

/**
 * The whole of the second model on one page — data, selectors, refs — with the
 * console open. Four things are worth watching while clicking around.
 *
 *   1. Type in Name. Only NameField renders: every field reads its own entry,
 *      so a write to one never reaches the other two.
 *   2. Type in Email. NameField sits still, and EmailField renders only while
 *      the answer of isEmailValid actually moves — 8 to 20 characters. Typing
 *      the ninth flips it, the tenth does not.
 *   3. Click "+1 in 1.5s" a few times and then "Cancel and zero". Every cancel
 *      is in the refs, so the api can call them all off — the counter never
 *      catches up afterwards, because a cancelled task writes nothing.
 *   4. Scroll the list, hide it, bring it back. It opens where you left it:
 *      the position lives in the storage's refs, which nothing rerenders for
 *      and which outlive the component that wrote them.
 *   5. Watch EventLog while you do any of it. It reads no field and no
 *      selector — there is nothing it could rerender for — and still says what
 *      happened: four useROn subscriptions are all it is. "Cancel and zero" is
 *      the one to try, since how many tasks were in flight is in the refs, and
 *      an event is the only way that number gets out. "Back to the top" is the
 *      other half, useREmit: the model did not do it and no field records it,
 *      so the component announces it itself.
 *
 *   SecondExamplePage      ← mounts the storage; reads nothing
 *   └─ SecPage             ← pure layout
 *      ├─ PersonForm       ← reads nothing itself
 *      │  ├─ NameField     ← data.nameInput
 *      │  ├─ SurnameField  ← data.surnameInput
 *      │  └─ EmailField    ← data.emailInput + selectors.isEmailValid
 *      ├─ Counters
 *      │  ├─ SyncCounter   ← data.counterSync + api.addToCounter
 *      │  ├─ AsyncCounter  ← data.counterAsync + api.addToCounterAsync
 *      │  └─ PendingLine   ← refs.counterTasksAbourts, on demand
 *      ├─ ScrollPanel      ← refs.scrolledTo, emits scrolledToTop
 *      └─ EventLog         ← events only: reads nothing at all
 */
export function SecondExamplePage() {

    useRenderLog("SecondExamplePage")

    return (<RVModel
        defaultValue={SEC_DEFAULT_VALUES}
        storageKey={EX_KEY}
        dataApi={EX_API}
        selectors={EX_SELECTORS}
        refs={EX_DEF_REFS}
        loadFromBrowser={true}
        saveToBrowser={true}
    >
        {<SecPage />}
    </RVModel>)
}

/** Holds the page together and reads nothing: it renders once and stays put. */
function SecPage() {

    useRenderLog("SecPage")

    return (
        <main className="page">
            <header className="header">
                <h1 className="title">Second example</h1>
                <ClearButton />
            </header>

            <PersonForm />
            <Counters />
            <ScrollPanel />
            <EventLog />
        </main>
    )
}

function ClearButton() {

    // The api instance itself, so this costs no rerender: it holds methods and
    // no data, and nothing about it changes when the data does.
    const api = useRDataApi(EX_KEY)

    useRenderLog("ClearButton")

    return <Button className="push-right" onClick={api.clearData}>Clear the form</Button>
}

/** Layout only — the three fields below are what actually read the store. */
function PersonForm() {

    useRenderLog("PersonForm")

    return (
        <section>
            <NameField />
            <SurnameField />
            <EmailField />
        </section>
    )
}

function NameField() {

    const name = useRValue(EX_KEY, "nameInput")
    const setName = useRSetter(EX_KEY, "nameInput")

    useRenderLog("NameField", { name })

    return (
        <label className="field">
            <span className="label">Name</span>
            <TextInput value={name} onValueChange={setName} placeholder="Jan" />
        </label>
    )
}

function SurnameField() {

    const surname = useRValue(EX_KEY, "surnameInput")
    const setSurname = useRSetter(EX_KEY, "surnameInput")

    useRenderLog("SurnameField", { surname })

    return (
        <label className="field">
            <span className="label">Surname</span>
            <TextInput value={surname} onValueChange={setSurname} placeholder="Kowalski" />
        </label>
    )
}

function EmailField() {

    const email = useRValue(EX_KEY, "emailInput")
    const setEmail = useRSetter(EX_KEY, "emailInput")

    // By name, not by hand: isEmailValid is the model's own rule, so every
    // component asking the same question gets the same answer — and this one
    // only rerenders when that answer flips, not on every keystroke.
    // const isValid = useRSelector(EX_KEY, "isEmailValid")

    useRenderLog("EmailField", { email })
    // const memoised = memo(EmailValidMessage)

    return (
        <label className="field">
            <span className="label">Email</span>
            <TextInput value={email} onValueChange={setEmail} placeholder="jan@kowalski.pl" />
            <EmailValidMessage />
        </label>
    )
}

const EmailValidMessage = memo(() => {

    
    const isValid = useRSelector(EX_KEY, "isEmailValid")
    useRenderLog("emailIsValid", {isValid})

    return  <span className="label">
                {isValid ? "looks fine" : "8 to 20 characters, please"}
            </span>

})

function Counters() {

    useRenderLog("Counters")

    return (
        <section>
            <SyncCounter />
            <AsyncCounter />
            <PendingLine />
        </section>
    )
}

function SyncCounter() {

    const counter = useRValue(EX_KEY, "counterSync")
    const api = useRDataApi(EX_KEY)

    useRenderLog("SyncCounter", { counter })

    return (
        <div className="row">
            <Button variant="primary" onClick={api.addToCounter}>+1 now</Button>
            <span className="label">sync: {counter}</span>
        </div>
    )
}

function AsyncCounter() {

    const counter = useRValue(EX_KEY, "counterAsync")
    const api = useRDataApi(EX_KEY)

    useRenderLog("AsyncCounter", { counter })

    return (
        <div className="row">
            <Button variant="primary" onClick={() => api.addToCounterAsync(2000)}>
                +1 in 2s
            </Button>

            {/* Cancels whatever is still in flight — the cancels are in the
                refs, which is the only reason the api can reach them — and
                zeroes both counters in one write. */}
            <Button className="push-right" onClick={api.clearCounters}>Cancel and zero</Button>

            <span className="label">async: {counter}</span>
        </div>
    )
}

/**
 * How many tasks are in flight, straight out of the refs. On demand, because
 * that is the deal with refs: nothing notifies when one moves, so a number
 * rendered from it would be whatever it was at the last render of this
 * component. Asking for it is the honest version — this is the count at the
 * moment of the click.
 */
function PendingLine() {

    const pending = useRRef(EX_KEY, "counterTasksAbourts")
    const [seen, setSeen] = useState<number | null>(null)

    useRenderLog("PendingLine", { seen })

    return (
        <div className="row">
            <Button onClick={() => setSeen(pending.current.length)}>Count the ones in flight</Button>
            <span className="label">
                {seen === null ? "not counted yet" : `${seen} when you asked`}
            </span>
        </div>
    )
}

/** The list, and the switch that unmounts it — the point of the exercise. */
function ScrollPanel() {

    const [shown, setShown] = useState(true)

    useRenderLog("ScrollPanel", { shown })

    return (
        <section>
            <div className="row">
                <Button variant={shown ? "ghost" : "primary"} onClick={() => setShown(!shown)}>
                    {shown ? "Hide the list" : "Bring it back"}
                </Button>
                <span className="label">scroll it, hide it, bring it back</span>
            </div>

            {shown
                ? <ScrollBox />
                : <p className="empty">Gone. Its scroll position is not: that one is in the refs.</p>}
        </section>
    )
}

function ScrollBox() {

    // A field of the storage's refs, as a real ref: writing `current` writes
    // the storage's own object, and no listener hears about it.
    const scrolledTo = useRRef(EX_KEY, "scrolledTo")
    const box = useRef<HTMLDivElement | null>(null)

    // Nothing in the model did this and no field records it, so this component
    // is the one with something to announce. Emitting subscribes to nothing:
    // it costs no rerender here, and none in whoever listens unless their
    // handler asks for one.
    const scrolledToTop = useREmit(EX_KEY, "scrolledToTop")


    useRenderLog("ScrollBox")

    // Where the storage was left, before the browser paints. Runs on mount
    // only — this component is not the one that keeps the position.
    useLayoutEffect(() => {
        if (box.current) box.current.scrollTop = scrolledTo.current
    }, [scrolledTo])

    return (<>
        <div className="row">
            <Button onClick={() => {
                if (box.current) box.current.scrollTop = 0
                
                
                scrolledToTop(scrolledTo.current)

                // oxlint-disable-next-line react/immutability -- writing the refs is the point of useRRef()
                scrolledTo.current = 0
            }}>
                Back to the top
            </Button>
            <span className="label">the jump is announced, not written anywhere</span>
        </div>

        <div
            ref={box}
            className="list"
            style={{ maxHeight: "10rem", overflowY: "auto" }}
            // Every pixel of it, and not one rerender: this is what the data
            // half is deliberately not for.
            // oxlint-disable-next-line react/immutability -- writing the refs is the point of useRRef()
            onScroll={(event) => { scrolledTo.current = event.currentTarget.scrollTop }}
        >
            {ROWS.map((row) => (
                <div key={row} className="item">
                    <span className="item-name">{row}</span>
                </div>
            ))}
        </div>
    </>)
}

/**
 * Everything on screen here arrived as an event. The component reads no field
 * and no selector — it has nothing to rerender for — and is still never behind
 * on what the app did, because it was there when each thing happened.
 *
 * That is what the data cannot say. A field cannot mean "it happened again": a
 * write of the value already there changes nothing and notifies nobody.
 */
function EventLog() {

    // const setter = useRValuesSetter(EX_KEY);

    const [lines, setLines] = useState<Noted[]>([])

    const setter = useRValuesSetter(EX_KEY);
    setter((data) => {
        return {
            counterSync: data.counterAsync + 1
        }
    })

    // Four subscriptions and nothing else: useROn puts the handler on the
    // storage under the key and takes it off when this unmounts. The argument
    // is what the container types for that name — a number for three of them,
    // that object for the fourth — and the handler is read fresh at every emit,
    // so closing over setLines costs no resubscribe and no dependency.
    useROn(EX_KEY, "formCleared", (at) =>
        setLines((old) => note(old, `form cleared at ${clock(at)}`)))

    useROn(EX_KEY, "counterHit", (value) =>
        setLines((old) => note(old, `sync counter hit ${value}`)))

    useROn(EX_KEY, "tasksCancelled", ({ cancelled, at }) =>
        setLines((old) => note(old, `${cancelled} task(s) called off at ${clock(at)}`)))

    useROn(EX_KEY, "scrolledToTop", (from) =>
        setLines((old) => note(old, `list put back to the top, from ${Math.round(from)}px down`)))

    useRenderLog("EventLog", lines.length)

    return (
        <section>
            {lines.length === 0
                ? <p className="empty">
                    Nothing heard yet. Clear the form, bump the sync counter, or cancel the tasks.
                  </p>
                : <ul className="list">
                    {lines.map((line) => (
                        <li key={line.id} className="item">
                            <span className="item-name">{line.text}</span>
                        </li>
                    ))}
                  </ul>}
        </section>
    )
}

type Noted = { id: number, text: string }

let noted = 0

/** The last six, newest first. Nothing else remembers them: an event is stored
 *  nowhere, so this list is this component's own memory of having heard it. */
function note(old: Noted[], text: string): Noted[] {
    noted += 1

    return [{ id: noted, text }, ...old].slice(0, 6)
}

const clock = (at: number) => new Date(at).toLocaleTimeString()

const ROWS = Array.from({ length: 40 }, (_, index) => `Row ${index + 1}`)

export default SecondExamplePage
