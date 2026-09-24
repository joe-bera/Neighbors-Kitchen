import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import ChefCard from '../components/chef/ChefCard'
import PageLoader from '../components/common/PageLoader'
import PaginationNav from '../components/common/PaginationNav'
import SearchForm from '../components/common/SearchForm'
import { EmptyState, ErrorState } from '../components/common/StatusStates'
import NearMeForm from '../components/location/NearMeForm'
import { useAsyncData } from '../hooks/useAsyncData'
import { usePageTitle } from '../hooks/usePageTitle'
import { fetchChefMap, fetchChefs, fetchMealFilters } from '../services/catalogService'
import {
  DEFAULT_MAX_DISTANCE,
  describePlace,
  DISTANCE_OPTIONS,
  readSearchPlace,
  searchPlaceParams,
  type SearchPlace,
} from '../utils/location'
import { withoutParams, withUpdatedParams } from '../utils/searchParams'
import './BrowsePages.css'

// Leaflet only loads when someone opens the map.
const ChefsMap = lazy(() => import('../components/location/ChefsMap'))

export default function ChefsPage() {
  usePageTitle('Browse chefs')
  const [searchParams, setSearchParams] = useSearchParams()
  const filters = useAsyncData('meal-filters', fetchMealFilters)

  const search = searchParams.get('search') ?? ''
  const city = searchParams.get('city') ?? ''
  const cuisine = searchParams.get('cuisine') ?? ''
  const maxDistance = searchParams.get('maxDistance') ?? ''
  const place = readSearchPlace(searchParams)
  const showMap = searchParams.get('view') === 'map'
  const hasFilters = [...searchParams.keys()].some((key) => key !== 'page' && key !== 'view')

  const update = (changes: Record<string, string | null>) => setSearchParams(withUpdatedParams(searchParams, changes))
  const clearFilters = () => setSearchParams(showMap ? new URLSearchParams({ view: 'map' }) : new URLSearchParams())
  const choosePlace = (next: SearchPlace) =>
    update({ ...searchPlaceParams(next), maxDistance: maxDistance || String(DEFAULT_MAX_DISTANCE) })
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
        <NearMeForm
          key={place?.kind === 'zip' ? place.zip : 'no-zip'}
          initialZip={place?.kind === 'zip' ? place.zip : undefined}
          onChoose={choosePlace}
        />
        {place && (
          <p className="near-me-current">
            Showing chefs {describePlace(place)}.{' '}
            <button type="button" className="text-button" onClick={() => update(searchPlaceParams(null))}>
              Clear location
            </button>
          </p>
        )}
        <SearchForm
          key={search}
          initialValue={search}
          label="Search chefs"
          placeholder="Search by cuisine, dish, kitchen or chef name"
          onSearch={(value) => update({ search: value })}
        />
        <div className="select-row">
          {place && (
            <label className="select-field">
              Distance
              <select value={maxDistance} onChange={(event) => update({ maxDistance: event.target.value })}>
                {DISTANCE_OPTIONS.map((miles) => (
                  <option key={miles} value={miles}>Within {miles} miles</option>
                ))}
                <option value="">Any distance</option>
              </select>
            </label>
          )}
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

      <div className="view-toggle" role="group" aria-label="Show chefs as">
        <button type="button" className="pill" aria-pressed={!showMap} onClick={() => update({ view: null })}>
          List
        </button>
        <button type="button" className="pill" aria-pressed={showMap} onClick={() => update({ view: 'map' })}>
          Map
        </button>
      </div>

      {showMap ? (
        <ChefMapView params={withoutParams(searchParams, 'view', 'page')} />
      ) : (
        <ChefListView
          params={withoutParams(searchParams, 'view')}
          place={place}
          hasFilters={hasFilters}
          onClearFilters={clearFilters}
          onPageChange={goToPage}
        />
      )}
    </div>
  )
}

interface ChefListViewProps {
  params: URLSearchParams
  place: SearchPlace | null
  hasFilters: boolean
  onClearFilters: () => void
  onPageChange: (page: number) => void
}

function ChefListView({ params, place, hasFilters, onClearFilters, onPageChange }: ChefListViewProps) {
  const chefs = useAsyncData(`chefs?${params.toString()}`, () => fetchChefs(params))

  if (!chefs.data && chefs.status === 'error') return <ErrorState message={chefs.error ?? ''} onRetry={chefs.retry} />
  if (!chefs.data) return <PageLoader label="Loading chefs" />

  const { total } = chefs.data.pagination
  return (
    <section
      aria-labelledby="chef-results-heading"
      aria-busy={chefs.status === 'loading'}
      className={chefs.status === 'loading' ? 'is-refreshing' : undefined}
    >
      <div className="results-bar">
        <h2 id="chef-results-heading" className="results-count">
          {total} {total === 1 ? 'chef' : 'chefs'}
          {place && ` ${describePlace(place)}`}
        </h2>
        {hasFilters && (
          <button type="button" className="text-button" onClick={onClearFilters}>
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
        <EmptyState
          title="No chefs match your search"
          text={place ? 'Try a larger distance, or clear the filters.' : 'Try another city or cuisine, or clear the filters.'}
        >
          {hasFilters && (
            <button type="button" className="btn btn-primary" onClick={onClearFilters}>
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

      <PaginationNav pagination={chefs.data.pagination} onPageChange={onPageChange} />
    </section>
  )
}

function ChefMapView({ params }: { params: URLSearchParams }) {
  const map = useAsyncData(`chef-map?${params.toString()}`, () => fetchChefMap(params))

  if (!map.data && map.status === 'error') return <ErrorState message={map.error ?? ''} onRetry={map.retry} />
  if (!map.data) return <PageLoader label="Loading map" />
  if (map.data.chefs.length === 0) {
    return <EmptyState title="No chefs on the map here" text="Try a larger distance, or clear the filters." />
  }
  return (
    <section aria-label="Map of chefs">
      <p className="results-count">
        {map.data.chefs.length} {map.data.chefs.length === 1 ? 'chef' : 'chefs'} on the map
      </p>
      <Suspense fallback={<PageLoader label="Loading map" />}>
        <ChefsMap data={map.data} />
      </Suspense>
    </section>
  )
}
