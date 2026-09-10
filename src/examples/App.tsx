import { useState } from "react"
import ExamplePage from "./example/ExamplePage"
import AsyncExamplePage from "./asyncExample/AsyncExamplePage"
import MailApp from "./mail/MailApp"
import { PageApp } from "./pageExample/PageApp"
import { SecondExamplePage } from "./secondExample/SecondExample"

// The template page — the same idea on the same model — is one swap away:
// import Page from "./template/Page"
function App() {

  const [page, setPage] = useState<'secondPage' | 'sync' | 'async' | 'second' | 'mail'>('mail')

  return (
  <>
    <div className="row">
      <button onClick={() => setPage('sync')}>example</button>
      <button onClick={() => setPage('async')}>async example</button>
      <button onClick={() => setPage('second')}>second example</button>
      <button onClick={() => setPage('mail')}>mail app</button>
      <button onClick={() => setPage('secondPage')}>secondPage</button>
    </div>

    {page === 'secondPage' && <PageApp />}
    {page === 'sync' && <ExamplePage />}
    {page === 'async' && <AsyncExamplePage />}
    {page === 'second' && <SecondExamplePage />}
    {page === 'mail' && <MailApp />}
  </>)
}

export default App
