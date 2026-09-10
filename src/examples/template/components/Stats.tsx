import { useEffect } from 'react'
import type { PageValues } from '../pageModel'

type StatsProps = Pick<PageValues, 'items' | 'doneCount'>

function Stats({ items, doneCount }: StatsProps) {
  useEffect(() => {
    console.log('[render] Stats')
  })

  const pieces = items.reduce((sum, item) => sum + item.qty, 0)

  return (
    <footer className="stats">
      {doneCount} / {items.length} packed · {pieces} pieces total
    </footer>
  )
}

export default Stats
