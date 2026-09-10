import { useEffect } from 'react'
import type { PageValues } from '../pageModel'
import ListTitle from './ListTitle'
import TextInput from '../ui/TextInput'

type HeaderProps = Pick<PageValues, 'listName' | 'setListName'>

function Header({ listName, setListName }: HeaderProps) {
  useEffect(() => {
    console.log('[render] Header')
  })

  return (
    <header className="header">
      <ListTitle />
      <label className="field">
        <span className="label">Rename</span>
        <TextInput value={listName} onValueChange={setListName} placeholder="List name" />
      </label>
    </header>
  )
}

export default Header
