const Card = ({ children, className = '', padding = true, ...props }) => (
  <div
    className={`card ${padding ? 'p-6' : ''} ${className}`}
    {...props}
  >
    {children}
  </div>
)
export default Card
