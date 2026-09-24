import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useAsyncData } from '../../hooks/useAsyncData'
import { fetchChefSuggestions, removeSuggestionVote, voteForSuggestion } from '../../services/feedbackService'
import { useAuthStore } from '../../store/authStore'
import type { Suggestion } from '../../types/feedback.types'
import { getApiError } from '../../utils/apiError'
import { suggestionStatusLabel, votesLabel } from '../../utils/feedback'
import { ErrorState } from '../common/StatusStates'
import DietaryTags from '../meal/DietaryTags'
import ChefReply from './ChefReply'
import SuggestionForm from './SuggestionForm'
import './Feedback.css'

interface DishRequestsProps {
  chefId: string
  kitchenName: string
  /** The signed-in chef is looking at their own page: they answer requests in the dashboard instead. */
  isOwnKitchen: boolean
}

/** Dishes neighbors would like this chef to cook, most wanted first, with voting and a request form. */
export default function DishRequests({ chefId, kitchenName, isOwnKitchen }: DishRequestsProps) {
  const location = useLocation()
  const authStatus = useAuthStore((state) => state.status)
  const userId = useAuthStore((state) => state.user?.id ?? null)
  // Load again after logging in or out, so "I want this too" shows the viewer's own votes.
  const requests = useAsyncData(`suggestions:${chefId}:${userId ?? 'visitor'}`, () => fetchChefSuggestions(chefId))
  const [added, setAdded] = useState<Suggestion[]>([])
  const [changed, setChanged] = useState<Record<string, Suggestion>>({})
  const [formOpen, setFormOpen] = useState(false)
  const [sentMessage, setSentMessage] = useState<string | null>(null)
  const [voting, setVoting] = useState<string | null>(null)
  const [voteError, setVoteError] = useState<string | null>(null)

  const canTakePart = authStatus === 'authenticated' && !isOwnKitchen
  const loginLink = `/login?redirect=${encodeURIComponent(location.pathname + location.search)}`
  // New requests stay on top where their author can see them; votes do not reorder the list while reading.
  const loaded = (requests.data ?? []).filter((item) => !added.some((mine) => mine.id === item.id))
  const items = [...added, ...loaded].map((item) => changed[item.id] ?? item)

  const toggleVote = async (suggestion: Suggestion) => {
    setVoting(suggestion.id)
    setVoteError(null)
    try {
      const updated = suggestion.hasVoted ? await removeSuggestionVote(suggestion.id) : await voteForSuggestion(suggestion.id)
      setChanged((current) => ({ ...current, [updated.id]: updated }))
    } catch (error) {
      setVoteError(getApiError(error).message)
    } finally {
      setVoting(null)
    }
  }

  return (
    <section className="dish-requests" aria-labelledby="requests-heading">
      <div className="section-heading">
        <h2 id="requests-heading">Dish requests</h2>
        {canTakePart && !formOpen && (
          <button
            type="button"
            className="btn btn-primary btn-small"
            onClick={() => {
              setFormOpen(true)
              setSentMessage(null)
            }}
          >
            Request a dish
          </button>
        )}
      </div>
      <p className="section-intro">
        Craving something {kitchenName} does not make yet? Ask for it, and vote for the dishes neighbors want most.
      </p>

      {authStatus === 'anonymous' && (
        <p className="alert alert-info">
          <Link to={loginLink} className="text-link">Log in</Link> to request a dish or vote for one.
        </p>
      )}
      {isOwnKitchen && (
        <p className="alert alert-info">
          These are requests from your neighbors.{' '}
          <Link to="/chef/feedback?view=requests" className="text-link">Answer them in your dashboard</Link>.
        </p>
      )}
      {sentMessage && <div className="alert alert-success" role="status">{sentMessage}</div>}
      {formOpen && (
        <SuggestionForm
          chefId={chefId}
          onCancel={() => setFormOpen(false)}
          onSent={(suggestion) => {
            setAdded((current) => [suggestion, ...current])
            setFormOpen(false)
            setSentMessage(`Thanks! ${kitchenName} will see your request.`)
          }}
        />
      )}
      {voteError && <p className="field-error" role="alert">{voteError}</p>}

      {requests.status === 'error' && !requests.data ? (
        <ErrorState message={requests.error ?? ''} onRetry={requests.retry} />
      ) : !requests.data && added.length === 0 ? (
        <p className="card-text">Loading dish requests...</p>
      ) : items.length === 0 ? (
        <p className="card dish-requests-empty">No requests yet. Be the first to ask for a dish!</p>
      ) : (
        <ul className="dish-request-list">
          {items.map((suggestion) => (
            <li key={suggestion.id} className="card dish-request">
              <div className="dish-request-main">
                <h3 className="dish-request-name">{suggestion.mealName}</h3>
                <p className="dish-request-description">{suggestion.description}</p>
                <DietaryTags tags={suggestion.dietaryRequirements} />
                <p className="dish-request-meta">Requested by {suggestion.suggestedBy}</p>
                {suggestion.chefResponse && <ChefReply label={`${kitchenName} says`} text={suggestion.chefResponse} />}
              </div>
              <div className="dish-request-side">
                <span className={`status-pill dish-status dish-status--${suggestion.status.toLowerCase()}`}>
                  {suggestionStatusLabel(suggestion.status)}
                </span>
                <p className="dish-request-votes">{votesLabel(suggestion.votes)}</p>
                {canTakePart && (
                  <button
                    type="button"
                    className="btn btn-outline btn-small vote-button"
                    aria-pressed={suggestion.hasVoted}
                    disabled={voting === suggestion.id}
                    onClick={() => toggleVote(suggestion)}
                  >
                    <span aria-hidden="true">{suggestion.hasVoted ? '✓' : '+'}</span> I want this too
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
