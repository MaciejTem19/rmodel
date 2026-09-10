import { useEffect } from 'react'
import ItemRow from './ItemRow'
import type { PageValues } from '../pageModel'

type ItemListProps = Pick<
  PageValues,
  'visibleItems' | 'toggleItem' | 'changeQty' | 'removeItem'
>

function ItemList({ visibleItems, toggleItem, changeQty, removeItem }: ItemListProps) {
  useEffect(() => {
    console.log('[render] ItemList')
  })

  if (visibleItems.length === 0) {
    return <p className="empty">Nothing here.</p>
  }

  return (
    <ul className="list">
      {visibleItems.map((item) => (
        <ItemRow
          key={item.id}
          item={item}
          toggleItem={toggleItem}
          changeQty={changeQty}
          removeItem={removeItem}
        />
      ))}
    </ul>
  )
}

export default ItemList
