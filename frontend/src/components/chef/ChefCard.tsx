import { Link } from 'react-router-dom'
import type { ChefCardData } from '../../types/catalog.types'
import { kitchenTitle } from '../../utils/format'
import { formatDistance } from '../../utils/location'
import Avatar from '../common/Avatar'
import Rating from '../common/Rating'
import MealImage from '../meal/MealImage'
import './ChefCard.css'

export default function ChefCard({ chef }: { chef: ChefCardData }) {
  return (
    <Link to={`/chefs/${chef.id}`} className="chef-card">
      <div className="chef-card-cover">
        <MealImage src={chef.coverImageUrl} alt="" />
      </div>
      <div className="chef-card-body">
        <div className="chef-card-avatar">
          <Avatar name={chef.chefName} photoUrl={chef.profilePhotoUrl} />
        </div>
        <div className="chef-card-heading">
          <h3>{kitchenTitle(chef)}</h3>
          <Rating average={chef.averageRating} count={chef.totalReviews} />
        </div>
        <p className="chef-card-by">
          by {chef.chefName} &middot; {chef.city}, {chef.state}
        </p>
        {typeof chef.distanceMiles === 'number' && (
          <p className="chef-card-distance">{formatDistance(chef.distanceMiles)}</p>
        )}
        {chef.specialties.length > 0 && (
          <div className="chip-row">
            {chef.specialties.slice(0, 3).map((specialty) => (
              <span key={specialty} className="chip">
                {specialty}
              </span>
            ))}
          </div>
        )}
        <p className="chef-card-meta">
          {chef.mealCount} {chef.mealCount === 1 ? 'meal' : 'meals'} on the menu
          {!chef.isAcceptingOrders && <> &middot; not taking orders right now</>}
        </p>
      </div>
    </Link>
  )
}
