import { useState, type FormEvent } from 'react'

interface SearchFormProps {
  initialValue: string
  placeholder: string
  label: string
  onSearch: (value: string) => void
  variant?: 'default' | 'hero'
}

/** A search box that reports its value when submitted (Enter or the Search button). */
export default function SearchForm({ initialValue, placeholder, label, onSearch, variant = 'default' }: SearchFormProps) {
  const [value, setValue] = useState(initialValue)

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault()
    onSearch(value.trim())
  }

  return (
    <form className={`search-form search-form--${variant}`} role="search" onSubmit={handleSubmit}>
      <label className="visually-hidden" htmlFor={`search-${variant}`}>
        {label}
      </label>
      <input
        id={`search-${variant}`}
        type="search"
        className="field-input search-form-input"
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
      />
      <button type="submit" className={`btn ${variant === 'hero' ? 'btn-light' : 'btn-primary'}`}>
        Search
      </button>
    </form>
  )
}
