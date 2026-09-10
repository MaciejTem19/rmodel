import { useEffect } from 'react'
import { withData } from '../withData'

type ListTitleProps = {
  value: string
  fallback?: string
}

function ListTitle({ value, fallback = 'Untitled list' }: ListTitleProps) {
  useEffect(() => {
    console.log('[render] ListTitle')
  })

  return <h1 className="title">{value || fallback}</h1>
}

const ListTitleWithData = withData(ListTitle, 'listName')

export default ListTitleWithData
