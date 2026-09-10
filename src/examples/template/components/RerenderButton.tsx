import { useEffect } from 'react'
import Button from '../ui/Button'

/** Not part of the model: forcing a render is exactly the thing that must not
 *  touch the data. <Page /> owns the tick and hands it down. */
type RerenderButtonProps = {
  renderCount: number
  rerender: () => void
}

function RerenderButton({ renderCount, rerender }: RerenderButtonProps) {
  useEffect(() => {
    console.log('[render] RerenderButton')
  })

  return (
    <div className="row">
      <Button variant="primary" onClick={rerender}>
        Rerender Page
      </Button>
      <span className="label">forced renders: {renderCount}</span>
    </div>
  )
}

export default RerenderButton
