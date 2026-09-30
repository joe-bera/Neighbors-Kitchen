export default function PageLoader({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="page-loader" role="status">
      <div className="spinner" aria-hidden="true" />
      <span className="visually-hidden">{label}</span>
    </div>
  )
}
