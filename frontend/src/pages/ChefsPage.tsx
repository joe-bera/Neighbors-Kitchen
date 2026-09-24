import { useSearchParams } from 'react-router-dom'
import ChefCard from '../components/chef/ChefCard'
import PageLoader from '../components/common/PageLoader'
import PaginationNav from '../components/common/PaginationNav'
import SearchForm from '../components/common/SearchForm'
import { EmptyState, ErrorState } from '../components/common/StatusStates'
import { useAsyncData } from '../hooks/useAsyncData'
import { usePageTitle } from '../hooks/usePageTitle'
import { fetchChefs, fetchMealFilters } from '../services/catalogService'
import { withUpdatedParams } from '../utils/searchParams'
import './BrowsePages.css'

export default function ChefsPage() {
  usePageTitle('Browse chefs')
  const [searchParams, setSearchParams] = useSearchParams()
  const chefs = useAsyncData(`chefs?${searchParams.toString()}`, () => fetchChefs(searchParams))
  const filters = useAsyncData('meal-filters', fetchMealFilters)

  const search = searchParams.get('search') ?? ''
  const city = searchParams.get('city') ?? ''
  const cuisine = searchParams.get('cuisine') ?? ''
  const hasFilters = [...searchParams.keys()].some((key) => key !== 'page')

  const update = (changes: Record<string, string | null>) => setSearchParams(withUpdatedParams(searchParams, changes))
  const clearFilters = () => setSearchParams(new URLSearchParams())
  const goToPage = (page: number) => {
    update({ page: String(page) })
    window.scrollTo({ top: 0 })
  }

  return (
    <div className="container browse">
      <header className="browse-header">
        <h1>Local chefs</h1>
        <p>Meet the home cooks in your community and see what they are making this week.</p>
      </header>

      <section className="browse-filters" aria-label="Search and filters">
        <SearchForm
          key={search}
          initialValue={search}
          label="Search chefs"
          placeholder="Search by cuisine, dish, kitchen or chef name"
          onSearch={(value) => update({ search: value })}
        />
        <div className="select-row">
          <label className="select-field">
            City
            <select value={city} onChange={(event) => update({ city: event.target.value })}>
              <option value="">All cities</option>
              {(filters.data?.cities ?? []).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="select-field">
            Cuisine
            <select value={cuisine} onChange={(event) => update({ cuisine: event.target.value })}>
              <option value="">All cuisines</option>
              {(filters.data?.cuisines ?? []).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {!chefs.data && chefs.status === 'error' && <ErrorState message={chefs.error ?? ''} onRetry={chefs.retry} />}
      {!chefs.data && chefs.status === 'loading' && <PageLoader label="Loading chefs" />}

      {chefs.data && (
        <section
          aria-labelledby="chef-results-heading"
          aria-busy={chefs.status === 'loading'}
          className={chefs.status === 'loading' ? 'is-refreshing' : undefined}
        >
          <div className="results-bar">
            <h2 id="chef-results-heading" className="results-count">
              {chefs.data.pagination.total} {chefs.data.pagination.total === 1 ? 'chef' : 'chefs'}
            </h2>
            {hasFilters && (
              <button type="button" className="text-button" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>

          {chefs.status === 'error' && (
            <div className="alert alert-error results-alert" role="alert">
              {chefs.error}
              <button type="button" className="text-button" onClick={chefs.retry}>Try again</button>
            </div>
          )}

          {chefs.data.items.length === 0 ? (
            <EmptyState title="No chefs match your search" text="Try another city or cuisine, or clear the filters.">
              {hasFilters && (
                <button type="button" className="btn btn-primary" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </EmptyState>
          ) : (
            <div className="card-grid">
              {chefs.data.items.map((chef) => (
                <ChefCard key={chef.id} chef={chef} />
              ))}
            </div>
          )}

          <PaginationNav pagination={chefs.data.pagination} onPageChange={goToPage} />
        </section>
      )}
    </div>
  )
}
