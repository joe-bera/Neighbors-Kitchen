import { useId } from 'react'

interface ToggleProps {
  label: string
  checked: boolean
  disabled?: boolean
  onChange: (checked: boolean) => void
}

/** An on/off switch. It is a real checkbox underneath, so it works with the keyboard and screen readers. */
export default function Toggle({ label, checked, disabled, onChange }: ToggleProps) {
  const id = useId()
  return (
    <label className="toggle" htmlFor={id}>
      <input
        id={id}
        type="checkbox"
        role="switch"
        className="toggle-input"
        checked={checked}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className="toggle-track" aria-hidden="true">
        <span className="toggle-thumb" />
      </span>
      <span className="toggle-label">{label}</span>
    </label>
  )
}
