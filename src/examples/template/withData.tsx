import { memo, type ComponentType } from 'react'
import { usePageValue, usePageValues, type PageValues } from './pageModel'

/**
 * Feeds one entry of the page model into a component as its `value` prop.
 *
 *   const ListTitle = withData(Title, 'listName')
 *   <ListTitle />            // value: string, taken from the 'listName' field
 *
 * The wrapper keeps every other prop of the wrapped component.
 */
export function withData<
  K extends keyof PageValues,
  P extends { value: PageValues[K] }>(Component: ComponentType<P>, name: K) {
  const displayName = `withData(${Component.displayName || Component.name || 'Component'})`

  function WithData(props: Omit<P, 'value'>) {
    const value = usePageValue(name)

    return <Component {...({ ...props, value } as P)} />
  }

  WithData.displayName = displayName

  return WithData
}

/**
 * Same idea for several entries at once: each one lands on the component
 * under its own name, so the component never touches the model itself.
 *
 *   const Header = withPageData(HeaderView, ['listName', 'setListName'])
 *   <Header />               // listName: string, setListName: (name) => void
 */
export function withPageData<
  K extends keyof PageValues,
  P extends Pick<PageValues, K>>(Component: ComponentType<P>, names: readonly K[]) {
  const displayName = `withPageData(${Component.displayName || Component.name || 'Component'})`

  const Comp = memo(Component)

  function WithPageData(props: Omit<P, K>) {
    const data = usePageValues(names)

    return <Comp {...({ ...props, ...data } as P)} />
  }

  WithPageData.displayName = displayName

  return WithPageData
}

export default withData
