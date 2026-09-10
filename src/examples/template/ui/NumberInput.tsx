import { useEffect, type ComponentProps } from 'react'

type NumberInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  value: number
  onValueChange: (value: number) => void
}

function NumberInput({ value, onValueChange, className, ...rest }: NumberInputProps) {
  useEffect(() => {
    console.log('[render] NumberInput')
  })

  return (
    <input
      type="number"
      className={`input input-number${className ? ` ${className}` : ''}`}
      value={value}
      onChange={(event) => onValueChange(Number(event.target.value) || 0)}
      {...rest}
    />
  )
}

export default NumberInput
