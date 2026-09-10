import { useEffect, useState } from 'react'
import { RModel } from 'rmodel'
import Header from './components/Header'
import ItemForm from './components/ItemForm'
import ItemList from './components/ItemList'
import RerenderButton from './components/RerenderButton'
import Stats from './components/Stats'
import Toolbar from './components/Toolbar'
import PageData from './PageData'
import { DEFAULT_VALUE, PAGE_KEY } from './pageModel'
import './template.css'

function Page() {
  // The only state left in the whole page: a tick to force a render.
  const [renderCount, setRenderCount] = useState(0)

  useEffect(() => {
    console.log('[render] Page')
  })

  return (
    <RModel storageKey={PAGE_KEY} defaultValue={DEFAULT_VALUE}>
      <main className="page">
        <PageData names={['listName', 'setListName']}>{Header}</PageData>
        <PageData names={['draft', 'setDraft', 'addItem']}>{ItemForm}</PageData>
        <PageData names={['filter', 'doneCount', 'setFilter', 'clearDone']}>{Toolbar}</PageData>
        <PageData names={['visibleItems', 'toggleItem', 'changeQty', 'removeItem']}>
          {ItemList}
        </PageData>
        <PageData names={['items', 'doneCount']}>{Stats}</PageData>
        <RerenderButton
          renderCount={renderCount}
          rerender={() => setRenderCount((count) => count + 1)}
        />
      </main>
    </RModel>
  )
}

export default Page
