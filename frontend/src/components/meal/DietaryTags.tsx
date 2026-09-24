import { formatDietaryTag } from '../../utils/format'

const WARNING_TAGS = new Set(['contains-nuts', 'spicy'])

interface DietaryTagsProps {
  tags: string[]
  /** Show at most this many tags, followed by "+N". */
  max?: number
}

export default function DietaryTags({ tags, max }: DietaryTagsProps) {
  if (tags.length === 0) return null
  const shown = max === undefined ? tags : tags.slice(0, max)
  const hiddenCount = tags.length - shown.length

  return (
    <ul className="tag-list" aria-label="Dietary information">
      {shown.map((tag) => (
        <li key={tag} className={`tag ${WARNING_TAGS.has(tag) ? 'tag--warning' : ''}`}>
          {formatDietaryTag(tag)}
        </li>
      ))}
      {hiddenCount > 0 && <li className="tag tag--more">+{hiddenCount}</li>}
    </ul>
  )
}
