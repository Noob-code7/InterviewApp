import { forwardRef } from 'react'

const Input = forwardRef(({
  label,
  error,
  hint,
  className = '',
  containerClassName = '',
  ...props
}, ref) => {
  return (
    <div className={`flex flex-col gap-1.5 ${containerClassName}`}>
      {label && (
        <label className="text-sm font-medium text-brand-text">
          {label}
        </label>
      )}
      <input
        ref={ref}
        className={`
          w-full px-3.5 py-2.5 text-sm
          bg-white border rounded-lg
          text-brand-text placeholder:text-brand-subtle
          transition-all duration-150
          focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary
          disabled:bg-gray-50 disabled:cursor-not-allowed
          ${error
            ? 'border-red-400 focus:ring-red-200 focus:border-red-400'
            : 'border-brand-border'}
          ${className}
        `}
        {...props}
      />
      {error && (
        <p className="text-xs text-red-500 flex items-center gap-1">
          <span>⚠</span> {error}
        </p>
      )}
      {hint && !error && (
        <p className="text-xs text-brand-subtle">{hint}</p>
      )}
    </div>
  )
})
Input.displayName = 'Input'
export default Input
