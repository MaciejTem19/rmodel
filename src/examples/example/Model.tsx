import { shallowEqual, storeKey, useRDataApi, useRKey, DataApi, StoreSelectors } from 'rmodel'

export interface ExData {
    clicked: number,
    name: string,
    header: string,
    products: string[]
    // actualButton: "danger" | "success" | "warning"
}

export interface ExApi {
    addClick: () => void,
    setName: (name: string) => void,
    setHeader: (header: string) => void,
    addProduct: (product: string) => void,
    removeLastProduct: () => void
}

export interface ExSelectors {

}

export const EX_KEY = storeKey<{ data: ExData, api: ExampleApi, selectors: ExampleSelectors }>('example')

export const EX_DEFAULT: ExData = {
    clicked: 0,
    name: 'Ada',
    header: 'Example model',
    products: ['Coffee beans', 'Rubber duck'],
}

/**
 * The write half. Arrow fields, so a method can be handed to onClick as it is;
 * setValue/setValues/updateValue come from DataApi and write through the store the
 * part was attached to.
 */
export class ExampleApi extends DataApi<ExData> implements ExApi {
    addClick = () => this.updateValue('clicked', (clicked) => clicked + 1)

    setName = (name: string) => this.setValue('name', name)

    setHeader = (header: string) => this.setValue('header', header)

    addProduct = (product: string) => this.updateValue('products', (products) => [...products, product])

    removeLastProduct = () => this.updateValue('products', (products) => products.slice(0, -1))

    /** Two fields in one write: one notification round, one render. */
    reset = () => this.setValues(['clicked', 'products'], [0, []])

}

/**
 * The read half. Every field is a selector built by select(), so it carries the
 * fields it reads and the comparison that decides whether its result moved.
 */
export class ExampleSelectors extends StoreSelectors<ExData> implements ExSelectors {
    productCount = this.select(({ products }) => products.length, ['products'])

    title = this.select(({ header, name }) => `${header} — ${name}`, ['header', 'name'])

    /** A fresh array every time, so it needs a comparison of its own. */
    sortedProducts = this.select(
        ({ products }) => [...products].sort(),
        ['products'],
        shallowEqual,
    )
}

/**
 * One instance per storage, built here rather than in JSX: <RModel /> reads the
 * props once, at creation, and a part belongs to the storage it was attached to.
 *
 *   <RModel
 *     storageKey={EX_KEY}
 *     defaultValue={EX_DEFAULT}
 *     dataApi={exampleApi}
 *     selectors={exampleSelectors}
 *   >
 *     <App />
 *   </RModel>
 *
 * Outside React the same store comes from
 * createStore(EX_KEY, EX_DEFAULT, exampleApi, exampleSelectors).
 */
export const exampleApi = new ExampleApi()
export const exampleSelectors = new ExampleSelectors()

/**
 * The key of the storage this subtree is mounted under, carrying the example's
 * types. Straight from <RModel />'s context, so a component never names the
 * storage it sits in — and EX_KEY stays an implementation detail of this file.
 */
export const useExampleKey = () => useRKey<{ data: ExData, api: ExampleApi, selectors: ExampleSelectors }>()

/** The write half, for a component that acts on the data without showing it. */
export const useExampleApi = () => useRDataApi(useExampleKey())
