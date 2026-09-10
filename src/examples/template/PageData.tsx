import { useMemo, type ComponentType, type ReactElement } from 'react'
import { usePageValues, type PageValues } from './pageModel'
import { withData } from './withData'

type PageDataProps<K extends keyof PageValues> =
  | {
      /** One model entry, handed to the child element as `value`. */
      name: K
      names?: never
      children: ReactElement<{ value: PageValues[K] }>
    }
  | {
      /** Several model entries, handed to the child component by their own names. */
      names: readonly K[]
      name?: never
      children: ComponentType<Pick<PageValues, K>>
    }

/**
 * Element form of withData() / withPageData(): the wrapper reads the model,
 * the child only ever sees props.
 *
 *   <PageData name="listName"><ListTitle /></PageData>
 *   <PageData names={['listName', 'setListName']}>{Header}</PageData>
 */
export function PageData<K extends keyof PageValues>(props: PageDataProps<K>) {
  if (props.names) {
    return <NamedData names={props.names} component={props.children} />
  }

  return <ValueData name={props.name} element={props.children} />
}

type ValueDataProps<K extends keyof PageValues> = {
  name: K
  element: ReactElement<{ value: PageValues[K] }>
}

function ValueData<K extends keyof PageValues>({ name, element }: ValueDataProps<K>) {
  const Component = element.type as ComponentType<{ value: PageValues[K] }>
  const WithData = useMemo(() => withData(Component, name), [Component, name])

  return <WithData {...element.props} />
}

type NamedDataProps<K extends keyof PageValues> = {
  names: readonly K[]
  component: ComponentType<Pick<PageValues, K>>
}

function NamedData<K extends keyof PageValues>({ names, component: Component }: NamedDataProps<K>) {
  // Read here instead of building a withPageData() wrapper on the fly: `names`
  // is a fresh array on every render, so a wrapper would be a new component
  // type each time and would remount the child.
  const data = usePageValues(names)

  return <Component {...data} />
}

export default PageData
