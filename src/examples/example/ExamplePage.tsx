import { useState } from 'react'
import { RVModel, useRSelector, useRValue } from 'rvmodel'
import Button from '../template/ui/Button'
import TextInput from '../template/ui/TextInput'
import '../template/template.css'
import {
  EX_DEFAULT,
  EX_KEY,
  exampleApi,
  exampleSelectors,
  useExampleApi,
  useExampleKey,
} from './Model'
import { useRenderLog } from './useRenderLog'

/**
 * A small tree on one model, to watch which nodes a write actually reaches.
 *
 *   ExamplePage          ← mounts the storage; reads nothing
 *   ├─ Header            ← selectors.title (header, name)
 *   │  └─ NameField      ← data.name + api.setName
 *   ├─ Clicker           ← data.clicked + api.addClick
 *   └─ Products          ← reads nothing: pure layout
 *      ├─ ProductForm    ← local draft state + api.addProduct
 *      ├─ ProductList    ← selectors.sortedProducts
 *      │  └─ ProductRow  ← props only
 *      └─ ProductCount   ← selectors.productCount
 *
 * The spine (ExamplePage, Products) subscribes to nothing, so it renders once
 * and stays put no matter what the data does; every log line after the first
 * batch belongs to a leaf that asked for the entry that moved.
 */
function ExamplePage() {
  useRenderLog('ExamplePage')

  return (
    <RVModel
      storageKey={EX_KEY}
      defaultValue={EX_DEFAULT}
      dataApi={exampleApi}
      selectors={exampleSelectors}
    >
      <main className="page">
        <Header />
        <Clicker />
        <Products />
      </main>
    </RVModel>
  )
}

function Header() {
  const title = useRSelector(useExampleKey(), 'title')

  useRenderLog('Header', { title })

  return (
    <header className="header">
      <h1 className="title">{title}</h1>
      <NameField />
    </header>
  )
}

function NameField() {
  const name = useRValue(useExampleKey(), 'name')
  const api = useExampleApi()

  useRenderLog('NameField', { name })

  return (
    <label className="field">
      <span className="label">Name</span>
      <TextInput value={name} onValueChange={(value) => api.setName(value)} />
    </label>
  )
}

function Clicker() {
  const clicked = useRValue(useExampleKey(), 'clicked')
  const api = useExampleApi()

  useRenderLog('Clicker', { clicked })

  return (
    <div className="row">
      <Button variant="primary" onClick={api.addClick}>
        Click me
      </Button>
      <span className="label">clicked: {clicked}</span>
    </div>
  )
}

/** Holds the product half together and reads nothing itself. */
function Products() {
  useRenderLog('Products')

  return (
    <section>
      <ProductForm />
      <ProductList />
      <ProductCount />
    </section>
  )
}

function ProductForm() {
  // Nothing from the store: this one renders on its own local state.
  useRenderLog('ProductForm')

  // Local state, not model data: the draft belongs to this input alone.
  const [draft, setDraft] = useState('')
  const api = useExampleApi()

  return (
    <form
      className="row"
      onSubmit={(event) => {
        event.preventDefault()
        if (!draft.trim()) return

        api.addProduct(draft.trim())
        setDraft('')
      }}
    >
      <TextInput value={draft} onValueChange={setDraft} placeholder="Add a product…" />
      <Button type="submit" variant="primary" disabled={!draft.trim()}>
        Add
      </Button>
      <Button className="push-right" onClick={api.removeLastProduct}>
        Remove last
      </Button>
    </form>
  )
}

function ProductList() {
  // sortedProducts builds a fresh array; its shallowEqual is what keeps this
  // component still when a write leaves the same names in the same order.
  const products = useRSelector(useExampleKey(), 'sortedProducts')

  useRenderLog('ProductList', products)

  if (!products.length) return <p className="empty">Nothing here.</p>

  return (
    <ul className="list">
      {products.map((product) => (
        <ProductRow key={product} product={product} />
      ))}
    </ul>
  )
}

function ProductRow({ product }: { product: string }) {
  // Props, not the store — the row is handed its product by the list.
  useRenderLog('ProductRow', product)

  return (
    <li className="item">
      <span className="item-name">{product}</span>
    </li>
  )
}

function ProductCount() {
  const count = useRSelector(useExampleKey(), 'productCount')

  useRenderLog('ProductCount', { count })

  return <footer className="stats">{count} products</footer>
}

export default ExamplePage
