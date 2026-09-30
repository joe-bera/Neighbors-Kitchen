import { useId, useState } from 'react'
import { uploadMealPhoto } from '../../services/kitchenService'
import { getApiError } from '../../utils/apiError'
import MealImage from '../meal/MealImage'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp']
const MAX_BYTES = 5 * 1024 * 1024

interface PhotoUploadProps {
  value: string | null
  onChange: (url: string | null) => void
}

/** Uploads a meal photo as soon as it is chosen and reports the saved address. */
export default function PhotoUpload({ value, onChange }: PhotoUploadProps) {
  const inputId = useId()
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFile = async (file: File | undefined) => {
    if (!file) return
    setError(null)
    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError('Choose a JPG, PNG or WebP photo.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError('That photo is too large. Photos must be 5 MB or smaller.')
      return
    }
    setUploading(true)
    try {
      onChange(await uploadMealPhoto(file))
    } catch (uploadError) {
      setError(getApiError(uploadError).message)
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="photo-upload">
      <div className="photo-upload-preview">
        <MealImage src={value} alt="Meal photo" />
        {uploading && (
          <div className="photo-upload-overlay" role="status">
            <div className="spinner" aria-hidden="true" />
            <span className="visually-hidden">Uploading photo</span>
          </div>
        )}
      </div>
      <div className="photo-upload-actions">
        <label htmlFor={inputId} className="btn btn-outline btn-small" aria-disabled={uploading}>
          {value ? 'Change photo' : 'Upload a photo'}
        </label>
        <input
          id={inputId}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          className="visually-hidden"
          disabled={uploading}
          onChange={(event) => {
            void handleFile(event.target.files?.[0])
            event.target.value = ''
          }}
        />
        {value && !uploading && (
          <button type="button" className="text-button" onClick={() => onChange(null)}>
            Remove photo
          </button>
        )}
        <p className="field-hint">JPG, PNG or WebP, up to 5 MB. A bright, close-up photo sells best.</p>
        {error && <p className="field-error" role="alert">{error}</p>}
      </div>
    </div>
  )
}
