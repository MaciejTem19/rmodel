import { useEffect } from 'react'
import type { PageValues } from '../pageModel'
import Button from '../ui/Button'
import Checkbox from '../ui/Checkbox'
import NumberInput from '../ui/NumberInput'
import type { Item } from '../types'

type ItemRowProps = Pick<PageValues, 'toggleItem' | 'changeQty' | 'removeItem'> & {
  item: Item
}

function ItemRow({ item, toggleItem, changeQty, removeItem }: ItemRowProps) {
  useEffect(() => {
    console.log('[render] ItemRow', item.name)
  })

  return (
    <li className={`item${item.done ? ' item-done' : ''}`}>
      <Checkbox
        checked={item.done}
        onCheckedChange={() => toggleItem(item.id)}
        aria-label={`Packed: ${item.name}`}
      />
      <span className="item-name">{item.name}</span>
      <NumberInput
        value={item.qty}
        onValueChange={(qty) => changeQty(item.id, qty)}
        min={1}
        aria-label={`Quantity of ${item.name}`}
      />
      <Button onClick={() => removeItem(item.id)} aria-label={`Remove ${item.name}`}>
        ✕
      </Button>
    </li>
  )
}

export default ItemRow
