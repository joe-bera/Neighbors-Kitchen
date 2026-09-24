import { useSearchParams } from 'react-router-dom'
import PageLoader from '../components/common/PageLoader'
import PaginationNav from '../components/common/PaginationNav'
import SearchForm from '../components/common/SearchForm'
import { EmptyState, ErrorState } from '../components/common/StatusStates'
import MealCard from '../components/meal/MealCard'
import { useAsyncData } from '../hooks/useAsyncData'
import { usePageTitle } from '../hooks/usePageTitle'
import { fetchMealFilters, fetchMeals } from '../services/catalogService'
import type { MealSort } from '../types/catalog.types'
import { formatCategory, formatDietaryTag } from '../utils/format'
import { withUpdatedParams } from '../utils/searchParams'
import './BrowsePages.css'

const SORT_OPTIONS: { value: MealSort; label: string }[] = [
  { value: 'recommended', label: 'Recommended' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'newest', label: 'Newest' },
]

const PRICE_LIMITS = [10, 15, 20]

// Warnings such as "contains nuts" describe a dish; they are not something people filter for.
const NON_FILTER_TAGS = new Set(['contains-nuts'])

export default function MealsPage() {
  usePageTitle('Browse meals')
  const [searchParams, setSearchParams] = useSearchParams()
  const meals = useAsyncData(`meals?${searchParams.toString()}`, () => fetchMeals(searchParams))
  const filters = useAsyncData('meal-filters', fetchMealFilters)

  const search = searchParams.get('search') ?? ''
  const category = searchParams.get('category') ?? ''
  const cuisine = searchParams.get('cuisine') ?? ''
  const maxPrice = searchParams.get('maxPrice') ?? ''
  const sort = searchParams.get('sort') ?? 'recommended'
  const dietary = (searchParams.get('dietary') ?? '').split(',').filter(Boolean)
  const hasFilters = [...searchParams.keys()].some((key) => key !== 'page')

  const update = (changes: Record<string, string | null>) => setSearchParams(withUpdatedParams(searchParams, changes))
  const clearFilters = () => setSearchParams(new URLSearchParams())
  const toggleDietary = (tag: string) => {
    const next = dietary.includes(tag) ? dietary.filter((selected) => selected !== tag) : [...dietary, tag]
    update({ dietary: next.join(',') })
  }
  const goToPage = (page: number) => {
    update({ page: String(page) })
    window.scrollTo({ top: 0 })
  }

  const dietaryOptions = (filters.data?.dietaryTags ?? []).filter((tag) => !NON_FILTER_TAGS.has(tag))

  return (
    <div className="container browse">
      <header className="browse-header">
        <h1>Browse meals</h1>
        <p>Home-cooked dishes from chefs in your neighborhood, ready to pre-order.</p>
      </header>

      <section className="browse-filters" aria-label="Search and filters">
        <SearchForm
          key={search}
          initialValue={search}
          label="Search meals"
          placeholder="Search dishes, cuisines or kitchens"
          onSearch={(value) => update({ search: value })}
        />

        <div className="pill-group" role="group" aria-label="Meal type">
          <button type="button" className="pill" aria-pressed={!category} onClick={() => update({ category: null })}>
            All meals
          </button>
          {(filters.data?.categories ?? []).map((value) => (
            <button
              key={value}
              type="button"
              className="pill"
              aria-pressed={category === value}
              onClick={() => update({ category: value })}
            >
              {formatCategory(value)}
            </button>
          ))}
        </div>

        {dietaryOptions.length > 0 && (
          <div className="pill-group" role="group" aria-label="Dietary needs">
            {dietaryOptions.map((tag) => (
              <button
                key={tag}
                type="button"
                className="pill"
                aria-pressed={dietary.includes(tag)}
                onClick={() => toggleDietary(tag)}
              >
                {formatDietaryTag(tag)}
              </button>
            ))}
          </div>
        )}

        <div className="select-row">
          <label className="select-field">
            Cuisine
            <select value={cuisine} onChange={(event) => update({ cuisine: event.target.value })}>
              <option value="">All cuisines</option>
              {(filters.data?.cuisines ?? []).map((value) => (
                <option key={value} value={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="select-field">
            Price
            <select value={maxPrice} onChange={(event) => update({ maxPrice: event.target.value })}>
              <option value="">Any price</option>
              {PRICE_LIMITS.map((limit) => (
                <option key={limit} value={limit}>Up to ${limit}</option>
              ))}
            </select>
          </label>
          <label className="select-field">
            Sort by
            <select value={sort} onChange={(event) => update({ sort: event.target.value === 'recommended' ? null : event.target.value })}>
              {SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {!meals.data && meals.status === 'error' && <ErrorState message={meals.error ?? ''} onRetry={meals.retry} />}
      {!meals.data && meals.status === 'loading' && <PageLoader label="Loading meals" />}

      {meals.data && (
        <section
          aria-labelledby="meal-results-heading"
          aria-busy={meals.status === 'loading'}
          className={meals.status === 'loading' ? 'is-refreshing' : undefined}
        >
          <div className="results-bar">
            <h2 id="meal-results-heading" className="results-count">
              {meals.data.pagination.total} {meals.data.pagination.total === 1 ? 'meal' : 'meals'}
            </h2>
            {hasFilters && (
              <button type="button" className="text-button" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>

          {meals.status === 'error' && (
            <div className="alert alert-error results-alert" role="alert">
              {meals.error}
              <button type="button" className="text-button" onClick={meals.retry}>Try again</button>
            </div>
          )}

          {meals.data.items.length === 0 ? (
            <EmptyState title="No meals match your search" text="Try removing a filter or searching for something else.">
              {hasFilters && (
                <button type="button" className="btn btn-primary" onClick={clearFilters}>
                  Clear filters
                </button>
              )}
            </EmptyState>
          ) : (
            <div className="card-grid">
              {meals.data.items.map((meal) => (
                <MealCard key={meal.id} meal={meal} chef={meal.chef} />
              ))}
            </div>
          )}

          <PaginationNav pagination={meals.data.pagination} onPageChange={goToPage} />
        </section>
      )}
    </div>
  )
}
