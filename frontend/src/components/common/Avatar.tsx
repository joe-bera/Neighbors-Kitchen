interface AvatarProps {
  name: string
  photoUrl?: string | null
  size?: 'md' | 'lg'
}

/** A round profile picture, or the person's initials when there is no photo. */
export default function Avatar({ name, photoUrl, size = 'md' }: AvatarProps) {
  if (photoUrl) {
    return <img className={`avatar avatar--${size}`} src={photoUrl} alt="" />
  }
  const initials = name
    .split(/\s+/)
    .map((part) => part.charAt(0))
    .join('')
    .replace(/[^\p{L}]/gu, '')
    .slice(0, 2)
    .toUpperCase()
  return (
    <span className={`avatar avatar--${size}`} aria-hidden="true">
      {initials}
    </span>
  )
}
