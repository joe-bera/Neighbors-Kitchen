import type { Pagination } from '../../types/catalog.types'

interface PaginationNavProps {
  pagination: Pagination
  onPageChange: (page: number) => void
}

export default function PaginationNav({ pagination, onPageChange }: PaginationNavProps) {
  const { page, totalPages } = pagination
  if (totalPages <= 1) return null

  return (
    <nav className="pagination" aria-label="Pages">
      <button type="button" className="btn btn-outline btn-small" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
        Previous
      </button>
      <span className="pagination-status">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        className="btn btn-outline btn-small"
        disabled={page >= totalPages}
        onClick={() => onPageChange(page + 1)}
      >
        Next
      </button>
    </nav>
  )
}
