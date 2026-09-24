import { Link } from 'react-router-dom'
import type { ChefSummary, MealCardData } from '../../types/catalog.types'
import { formatCategory, formatPrepTime, formatPrice } from '../../utils/format'
import DietaryTags from './DietaryTags'
import MealImage from './MealImage'
import './MealCard.css'

interface MealCardProps {
  meal: MealCardData
  /** Shown under the meal name; leave out on the chef's own page. */
  chef?: ChefSummary
}

export default function MealCard({ meal, chef }: MealCardProps) {
  return (
    <Link to={`/meals/${meal.id}`} className="meal-card">
      <div className="meal-card-media">
        <MealImage src={meal.imageUrl} alt={meal.name} />
        <span className="meal-card-category">{formatCategory(meal.category)}</span>
      </div>
      <div className="meal-card-body">
        <div className="meal-card-heading">
          <h3>{meal.name}</h3>
          <span className="meal-card-price">{formatPrice(meal.price)}</span>
        </div>
        {chef && (
          <p className="meal-card-chef">
            {chef.kitchenName ?? chef.chefName} &middot; {chef.city}
          </p>
        )}
        <p className="meal-card-description">{meal.description}</p>
        <div className="meal-card-footer">
          <DietaryTags tags={meal.dietaryTags} max={2} />
          <span className="meal-card-meta">
            {formatPrepTime(meal.prepTimeMinutes)} &middot; serves {meal.servings}
          </span>
        </div>
      </div>
    </Link>
  )
}
