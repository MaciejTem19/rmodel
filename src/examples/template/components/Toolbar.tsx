import { useEffect } from 'react'
import type { PageValues } from '../pageModel'
import Button from '../ui/Button'
import type { Filter } from '../types'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'todo', label: 'To pack' },
  { value: 'done', label: 'Packed' },
]

type ToolbarProps = Pick<PageValues, 'filter' | 'doneCount' | 'setFilter' | 'clearDone'>

function Toolbar({ filter, doneCount, setFilter, clearDone }: ToolbarProps) {
  useEffect(() => {
    console.log('[render] Toolbar')
  })

  return (
    <div className="row toolbar">
      {FILTERS.map(({ value, label }) => (
        <Button
          key={value}
          aria-pressed={filter === value}
          onClick={() => setFilter(value)}
        >
          {label}
        </Button>
      ))}
      <Button className="push-right" disabled={doneCount === 0} onClick={clearDone}>
        Clear packed ({doneCount})
      </Button>
    </div>
  )
}

export default Toolbar
