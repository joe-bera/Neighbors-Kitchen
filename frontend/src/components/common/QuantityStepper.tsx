interface QuantityStepperProps {
  value: number
  onChange: (value: number) => void
  /** Names the thing being counted, for screen readers, e.g. "Tamales". */
  label: string
  min?: number
  max?: number
}

export default function QuantityStepper({ value, onChange, label, min = 1, max = 20 }: QuantityStepperProps) {
  return (
    <div className="quantity-stepper" role="group" aria-label={`Quantity of ${label}`}>
      <button type="button" onClick={() => onChange(value - 1)} disabled={value <= min} aria-label={`One fewer ${label}`}>
        −
      </button>
      <span className="quantity-stepper-value" aria-live="polite">{value}</span>
      <button type="button" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label={`One more ${label}`}>
        +
      </button>
    </div>
  )
}
