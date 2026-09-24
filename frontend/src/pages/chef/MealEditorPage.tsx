import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { z } from 'zod'
import PhotoUpload from '../../components/chef/PhotoUpload'
import PageLoader from '../../components/common/PageLoader'
import { EmptyState, ErrorState } from '../../components/common/StatusStates'
import { useAsyncData } from '../../hooks/useAsyncData'
import { usePageTitle } from '../../hooks/usePageTitle'
import { createMeal, fetchMyMeals, updateMeal } from '../../services/kitchenService'
import type { MealCategory } from '../../types/catalog.types'
import type { OwnMeal } from '../../types/kitchen.types'
import { getApiError } from '../../utils/apiError'
import { formatCategory, formatDietaryTag } from '../../utils/format'
import { useChefKitchen } from './chefContext'

const CATEGORIES: MealCategory[] = ['BREAKFAST', 'LUNCH', 'DINNER', 'DESSERT', 'SNACK']
const DIETARY_TAGS = ['vegetarian', 'vegan', 'gluten-free', 'dairy-free', 'nut-free', 'contains-nuts', 'halal', 'kosher', 'spicy']
const CUISINE_SUGGESTIONS = [
  'American', 'Asian Fusion', 'Caribbean', 'Chinese', 'Filipino', 'Greek', 'Healthy', 'Indian', 'Italian', 'Japanese',
  'Korean', 'Mediterranean', 'Mexican', 'Middle Eastern', 'Salvadoran', 'Soul Food', 'Southern', 'Thai', 'Vietnamese',
]

const wholeNumber = (label: string, min: number, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Enter ${label}`)
    .transform(Number)
    .pipe(z.number(`Enter ${label} as a number`).int('Use a whole number').min(min, `Use at least ${min}`).max(max, `Use ${max} or less`))

const mealFormSchema = z.object({
  name: z.string().trim().min(2, 'Enter a meal name').max(80, 'Use 80 characters or less'),
  description: z.string().trim().min(10, 'Describe the meal in at least 10 characters').max(1000, 'Use 1,000 characters or less'),
  price: z
    .string()
    .trim()
    .min(1, 'Enter a price')
    .transform(Number)
    .pipe(z.number('Enter a price, like 12.50').min(1, 'Price must be at least $1').max(500, 'Price must be $500 or less')),
  category: z.enum(CATEGORIES, 'Choose a meal type'),
  cuisineType: z.string().trim().max(40, 'Use 40 characters or less').transform((value) => value || null),
  dietaryTags: z.array(z.string()),
  servings: wholeNumber('how many people it serves', 1, 20),
  prepTimeMinutes: wholeNumber('the prep time in minutes', 5, 600),
  maxOrdersPerDay: z
    .string()
    .trim()
    .transform((value) => (value === '' ? null : Number(value)))
    .pipe(z.number('Use a number').int('Use a whole number').min(1, 'Use at least 1').max(500).nullable()),
  isAvailable: z.boolean(),
  imageUrl: z.string().nullable(),
})

type MealFormInput = z.input<typeof mealFormSchema>
type MealFormOutput = z.output<typeof mealFormSchema>
type MealField = keyof MealFormInput
const FIELDS = Object.keys(mealFormSchema.shape) as MealField[]

function toFormValues(meal?: OwnMeal): MealFormInput {
  return {
    name: meal?.name ?? '',
    description: meal?.description ?? '',
    price: meal ? meal.price.toFixed(2) : '',
    category: meal?.category ?? 'DINNER',
    cuisineType: meal?.cuisineType ?? '',
    dietaryTags: meal?.dietaryTags ?? [],
    servings: String(meal?.servings ?? 1),
    prepTimeMinutes: String(meal?.prepTimeMinutes ?? 30),
    maxOrdersPerDay: meal?.maxOrdersPerDay?.toString() ?? '',
    isAvailable: meal?.isAvailable ?? true,
    imageUrl: meal?.imageUrl ?? null,
  }
}

export default function MealEditorPage() {
  const { id } = useParams()
  usePageTitle(id ? 'Edit meal' : 'Add a meal')
  return id ? <EditMeal id={id} /> : <MealForm />
}

function EditMeal({ id }: { id: string }) {
  const meals = useAsyncData('my-meals', fetchMyMeals)
  if (meals.status === 'error') return <ErrorState message={meals.error ?? ''} onRetry={meals.retry} />
  if (!meals.data) return <PageLoader label="Loading meal" />

  const meal = meals.data.find((candidate) => candidate.id === id)
  if (!meal) {
    return (
      <EmptyState title="We could not find that meal">
        <Link to="/chef/meals" className="btn btn-outline">Back to your meals</Link>
      </EmptyState>
    )
  }
  return <MealForm meal={meal} />
}

function MealForm({ meal }: { meal?: OwnMeal }) {
  const navigate = useNavigate()
  const { reloadKitchen } = useChefKitchen()
  const [formError, setFormError] = useState<string | null>(null)
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<MealFormInput, unknown, MealFormOutput>({
    resolver: zodResolver(mealFormSchema),
    defaultValues: toFormValues(meal),
  })

  const submit = async (values: MealFormOutput) => {
    setFormError(null)
    try {
      if (meal) {
        await updateMeal(meal.id, values)
      } else {
        await createMeal(values)
      }
      await reloadKitchen()
      navigate('/chef/meals', {
        state: { message: meal ? `Saved your changes to ${values.name}.` : `${values.name} is on your menu.` },
      })
    } catch (error) {
      const apiError = getApiError(error)
      const fieldErrors = Object.entries(apiError.details ?? {}).map(([field, message]) => [field.split('.')[0], message])
      const known = fieldErrors.filter(([field]) => FIELDS.includes(field as MealField))
      if (known.length > 0) {
        known.forEach(([field, message]) => setError(field as MealField, { message }))
      } else {
        setFormError(apiError.message)
      }
    }
  }

  const fieldProps = (name: MealField) => ({
    id: name,
    className: 'field-input',
    'aria-invalid': errors[name] ? true : undefined,
    'aria-describedby': errors[name] ? `${name}-error` : undefined,
    ...register(name),
  })
  const fieldError = (name: MealField) =>
    errors[name] && <p id={`${name}-error`} className="field-error">{errors[name]?.message}</p>

  return (
    <div className="dashboard-section">
      <Link to="/chef/meals" className="back-link">&larr; Your meals</Link>
      <section className="card" aria-labelledby="meal-form-heading">
        <h2 id="meal-form-heading">{meal ? `Edit ${meal.name}` : 'Add a meal'}</h2>
        <form className="form meal-form" onSubmit={handleSubmit(submit)} noValidate>
          {formError && <div className="alert alert-error" role="alert">{formError}</div>}

          <div className="field">
            <span className="field-label">Photo</span>
            <Controller
              name="imageUrl"
              control={control}
              render={({ field }) => <PhotoUpload value={field.value} onChange={field.onChange} />}
            />
            {fieldError('imageUrl')}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="name">Meal name</label>
            <input type="text" placeholder="e.g. Chicken Enchiladas" {...fieldProps('name')} />
            {fieldError('name')}
          </div>

          <div className="field">
            <label className="field-label" htmlFor="description">Description</label>
            <textarea rows={3} placeholder="What is in it and what makes it special" {...fieldProps('description')} />
            {fieldError('description')}
          </div>

          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="price">Price ($)</label>
              <input type="number" inputMode="decimal" step="0.01" min={1} placeholder="12.50" {...fieldProps('price')} />
              {fieldError('price')}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="category">Meal type</label>
              <select {...fieldProps('category')}>
                {CATEGORIES.map((category) => (
                  <option key={category} value={category}>{formatCategory(category)}</option>
                ))}
              </select>
              {fieldError('category')}
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="cuisineType">Cuisine</label>
              <input type="text" list="cuisine-suggestions" placeholder="e.g. Mexican" {...fieldProps('cuisineType')} />
              <datalist id="cuisine-suggestions">
                {CUISINE_SUGGESTIONS.map((cuisine) => <option key={cuisine} value={cuisine} />)}
              </datalist>
              {fieldError('cuisineType')}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="servings">Serves</label>
              <input type="number" inputMode="numeric" min={1} max={20} {...fieldProps('servings')} />
              {fieldError('servings')}
            </div>
          </div>

          <div className="form-row">
            <div className="field">
              <label className="field-label" htmlFor="prepTimeMinutes">Prep time (minutes)</label>
              <input type="number" inputMode="numeric" min={5} max={600} {...fieldProps('prepTimeMinutes')} />
              {fieldError('prepTimeMinutes')}
            </div>
            <div className="field">
              <label className="field-label" htmlFor="maxOrdersPerDay">Most orders per day (optional)</label>
              <input type="number" inputMode="numeric" min={1} max={500} placeholder="No limit" {...fieldProps('maxOrdersPerDay')} />
              {fieldError('maxOrdersPerDay')}
            </div>
          </div>

          <fieldset className="checkbox-group">
            <legend className="field-label">Dietary information</legend>
            <div className="checkbox-grid">
              {DIETARY_TAGS.map((tag) => (
                <label key={tag} className="checkbox-option">
                  <input type="checkbox" value={tag} {...register('dietaryTags')} />
                  {formatDietaryTag(tag)}
                </label>
              ))}
            </div>
            {fieldError('dietaryTags')}
          </fieldset>

          <label className="checkbox-option checkbox-option--emphasis">
            <input type="checkbox" {...register('isAvailable')} />
            Show this meal on my menu
          </label>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Saving...' : meal ? 'Save changes' : 'Add meal'}
            </button>
            <Link to="/chef/meals" className="btn btn-outline">Cancel</Link>
          </div>
        </form>
      </section>
    </div>
  )
}
