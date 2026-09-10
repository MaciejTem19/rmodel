import { useEffect } from 'react'
import type { PageValues } from '../pageModel'
import Button from '../ui/Button'
import TextInput from '../ui/TextInput'

type ItemFormProps = Pick<PageValues, 'draft' | 'setDraft' | 'addItem'>

function ItemForm({ draft, setDraft, addItem }: ItemFormProps) {
  useEffect(() => {
    console.log('[render] ItemForm')
  })

  return (
    <form
      className="row"
      onSubmit={(event) => {
        event.preventDefault()
        addItem()
      }}
    >
      <TextInput
        value={draft}
        onValueChange={setDraft}
        placeholder="Add something…"
        aria-label="New item"
      />
      <Button type="submit" variant="primary" disabled={!draft.trim()}>
        Add
      </Button>
    </form>
  )
}

export default ItemForm
