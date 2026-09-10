import { useEffect, type ComponentProps } from 'react'

type CheckboxProps = Omit<ComponentProps<'input'>, 'type' | 'checked' | 'onChange'> & {
  checked: boolean
  onCheckedChange: (checked: boolean) => void
}

function Checkbox({ checked, onCheckedChange, className, ...rest }: CheckboxProps) {
  useEffect(() => {
    console.log('[render] Checkbox')
  })

  return (
    <input
      type="checkbox"
      className={`checkbox${className ? ` ${className}` : ''}`}
      checked={checked}
      onChange={(event) => onCheckedChange(event.target.checked)}
      {...rest}
    />
  )
}

export default Checkbox
