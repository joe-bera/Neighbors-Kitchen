import { useState } from 'react'
import { Link } from 'react-router-dom'
import PageLoader from '../../components/common/PageLoader'
import { EmptyState, ErrorState } from '../../components/common/StatusStates'
import MealImage from '../../components/meal/MealImage'
import { useAsyncData } from '../../hooks/useAsyncData'
import { useFlashMessage } from '../../hooks/useFlashMessage'
import { usePageTitle } from '../../hooks/usePageTitle'
import { deleteMeal, fetchMyMeals, updateMeal } from '../../services/kitchenService'
import type { OwnMeal } from '../../types/kitchen.types'
import { getApiError } from '../../utils/apiError'
import { formatCategory, formatPrice } from '../../utils/format'
import { useChefKitchen } from './chefContext'

export default function ChefMealsPage() {
  usePageTitle('Your meals')
  const { reloadKitchen } = useChefKitchen()
  const flash = useFlashMessage()
  const meals = useAsyncData('my-meals', fetchMyMeals)
  const [busyMealId, setBusyMealId] = useState<string | null>(null)
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  const runAction = async (meal: OwnMeal, action: () => Promise<unknown>) => {
    setBusyMealId(meal.id)
    setActionError(null)
    try {
      await action()
      meals.retry()
      await reloadKitchen()
    } catch (error) {
      setActionError(getApiError(error).message)
    } finally {
      setBusyMealId(null)
      setConfirmingDeleteId(null)
    }
  }

  const header = (
    <div className="section-heading">
      <h2>Your meals</h2>
      <Link to="/chef/meals/new" className="btn btn-primary">Add a meal</Link>
    </div>
  )

  if (meals.status === 'error' && !meals.data) {
    return (
      <div className="dashboard-section">
        {header}
        <ErrorState message={meals.error ?? ''} onRetry={meals.retry} />
      </div>
    )
  }
  if (!meals.data) return <PageLoader label="Loading your meals" />

  return (
    <div className="dashboard-section">
      {flash && <div className="alert alert-success" role="status">{flash}</div>}
      {header}
      {actionError && <div className="alert alert-error" role="alert">{actionError}</div>}

      {meals.data.length === 0 ? (
        <EmptyState title="Your menu is empty" text="Add your first meal so neighbors can see what you cook.">
          <Link to="/chef/meals/new" className="btn btn-primary">Add your first meal</Link>
        </EmptyState>
      ) : (
        <ul className={`meal-rows ${meals.status === 'loading' ? 'is-refreshing' : ''}`}>
          {meals.data.map((meal) => {
            const busy = busyMealId === meal.id
            return (
              <li key={meal.id} className="meal-row">
                <div className="meal-row-photo">
                  <MealImage src={meal.imageUrl} alt="" />
                </div>
                <div className="meal-row-info">
                  <p className="meal-row-name">{meal.name}</p>
                  <p className="meal-row-meta">
                    {formatPrice(meal.price)} &middot; {formatCategory(meal.category)}
                    {meal.maxOrdersPerDay !== null && <> &middot; up to {meal.maxOrdersPerDay} a day</>}
                  </p>
                </div>
                <span className={`status-pill ${meal.isAvailable ? 'status-pill--on' : ''}`}>
                  {meal.isAvailable ? 'On the menu' : 'Hidden'}
                </span>
                <div className="meal-row-actions">
                  <button
                    type="button"
                    className="btn btn-outline btn-small"
                    disabled={busy}
                    onClick={() => runAction(meal, () => updateMeal(meal.id, { isAvailable: !meal.isAvailable }))}
                  >
                    {meal.isAvailable ? 'Hide' : 'Show'}
                    <span className="visually-hidden"> {meal.name}</span>
                  </button>
                  <Link to={`/chef/meals/${meal.id}/edit`} className="btn btn-outline btn-small">
                    Edit<span className="visually-hidden"> {meal.name}</span>
                  </Link>
                  {confirmingDeleteId === meal.id ? (
                    <span className="confirm-delete">
                      <button type="button" className="btn btn-danger btn-small" disabled={busy} onClick={() => runAction(meal, () => deleteMeal(meal.id))}>
                        Yes, delete
                      </button>
                      <button type="button" className="text-button" onClick={() => setConfirmingDeleteId(null)}>
                        Cancel
                      </button>
                    </span>
                  ) : (
                    <button type="button" className="text-button text-button--danger" disabled={busy} onClick={() => setConfirmingDeleteId(meal.id)}>
                      Delete<span className="visually-hidden"> {meal.name}</span>
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
