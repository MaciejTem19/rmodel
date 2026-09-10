import { useEffect, type ComponentProps } from 'react'

type TextInputProps = Omit<ComponentProps<'input'>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
}

function TextInput({ value, onValueChange, className, ...rest }: TextInputProps) {
  useEffect(() => {
    console.log('[render] TextInput')
  })

  return (
    <input
      type="text"
      className={`input${className ? ` ${className}` : ''}`}
      value={value}
      onChange={(event) => onValueChange(event.target.value)}
      {...rest}
    />
  )
}

export default TextInput
