import { DataApi, storeKey, StoreSelectors } from "rvmodel"

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

export type SecExampleData = {

    nameInput: string,
    surnameInput: string,
    emailInput: string,

    counterSync: number,
    counterAsync: number
}


export type SecExampleDataRef = {

    scrolledTo: number
    counterTasksAbourts: ( () => void )[]
}

/**
 * The third thing this storage names, beside its data and its refs: what can
 * happen to it. A container of types — nothing here is stored, and there is no
 * value to read back afterwards.
 *
 * One name, one argument, and the type against the name is the argument's:
 * `formCleared` hands a handler a number, `tasksCancelled` hands it that
 * object. Announcing the wrong shape does not compile.
 */
export type SecExampleEvents = {

    /** The moment the form was emptied. */
    formCleared: number

    /** What the sync counter landed on. */
    counterHit: number

    /** How many tasks were called off, and where the counters were left. */
    tasksCancelled: { cancelled: number, at: number }

    /** The list was put back to the top, from this far down. Emitted by the
     *  component itself — nothing in the model did it, and no field records it. */
    scrolledToTop: number
}


export class SecExampleApi extends DataApi<SecExampleData, SecExampleDataRef, SecExampleEvents> {

    clearData = () => {
        this.setValues(["emailInput", "nameInput", "surnameInput"], ["","",""])

        // Announced by the method that did it, not by the button that called
        // it: whoever else clears the form announces it too, for free.
        this.emit("formCleared", Date.now())
    }

    addToCounter = () => {
        this.updateValue("counterSync", (old) => old + 1)

        // After the write, so a handler that goes and reads the store sees the
        // number the event is talking about.
        this.emit("counterHit", this.store.getData().counterSync)
    }

    addToCounterAsync = (delay: number) => {
        const cancel = this.updateByTask("counterAsync", async (_signal) => {
            
            // setTimeout returns a number, so awaiting it waits for nothing:
            // the wait has to be a promise of its own. Resolved on the abort as
            // well, so a cancelled task stops here instead of hanging on until
            // its timer fires — the write is dropped either way, by the
            // signal.aborted gate in Store.trackTask().
            await sleep(delay)

            this.refs.counterTasksAbourts = this.refs.counterTasksAbourts.filter(e => e !== cancel)
            return (old: number) => {
                return old + 1
            }
        })

        this.refs.counterTasksAbourts.push(cancel);
    }

    clearCounters = () => {

        const cancelled = this.refs.counterTasksAbourts.length

        this.refs.counterTasksAbourts.forEach(e => e())
        this.refs.counterTasksAbourts = []

        this.setValues(["counterSync", "counterAsync"], [0,0])

        // How many were in flight is in the refs and nowhere else — nothing
        // renders from them, so without the event this number has no way out.
        this.emit("tasksCancelled", { cancelled, at: Date.now() })
    }
}

export class SecExampleSelectr extends StoreSelectors<SecExampleData, SecExampleDataRef> {

    isEmailValid = this.select(
        ({emailInput}) => {
            return emailInput.length >= 8 && emailInput.length <= 20
        },
        ["emailInput"]
    )
} 

export const EX_KEY = storeKey<{
    data: SecExampleData
    api: SecExampleApi
    selectors: SecExampleSelectr
    refs: SecExampleDataRef
    events: SecExampleEvents
}>("secExample");
export const EX_DEF_REFS = {counterTasksAbourts: [], scrolledTo: 0} as SecExampleDataRef

export const SEC_DEFAULT_VALUES = {
    counterAsync: 0,
    counterSync: 0,
    emailInput: "",
    nameInput: "",
    surnameInput: ""
} as SecExampleData

export const EX_API = new SecExampleApi();
export const EX_SELECTORS = new SecExampleSelectr();