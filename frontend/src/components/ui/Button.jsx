import { forwardRef } from 'react'

const variants = {
  primary: 'bg-primary text-white hover:bg-primary-dark shadow-sm active:scale-[0.98]',
  outline: 'bg-white text-primary border border-primary hover:bg-primary-light active:scale-[0.98]',
  ghost:   'bg-transparent text-brand-muted hover:bg-gray-100 active:scale-[0.98]',
  danger:  'bg-red-500 text-white hover:bg-red-600 shadow-sm active:scale-[0.98]',
}
const sizes = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
}

const Button = forwardRef(({
  children,
  variant = 'primary',
  size = 'md',
  loading = false,
  className = '',
  disabled,
  ...props
}, ref) => {
  return (
    <button
      ref={ref}
      disabled={disabled || loading}
      className={`
        inline-flex items-center justify-center gap-2
        font-medium rounded-lg transition-all duration-150
        disabled:opacity-50 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}
      `}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.4 0 0 5.4 0 12h4z" />
        </svg>
      )}
      {children}
    </button>
  )
})
Button.displayName = 'Button'
export default Button
