import { useEffect, type ComponentProps } from 'react'

type ButtonProps = ComponentProps<'button'> & {
  variant?: 'primary' | 'ghost'
}

function Button({ variant = 'ghost', className, ...rest }: ButtonProps) {
  useEffect(() => {
    console.log('[render] Button')
  })

  return (
    <button
      type="button"
      className={`btn btn-${variant}${className ? ` ${className}` : ''}`}
      {...rest}
    />
  )
}

export default Button
