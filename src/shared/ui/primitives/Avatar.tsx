import styles from './Avatar.module.css'

export type AvatarSize = 'xs' | 'sm' | 'md' | 'lg' | 'xl'

interface AvatarProps {
  name: string
  src?: string
  size?: AvatarSize
}

export default function Avatar({ name, src, size = 'md' }: AvatarProps) {
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join('')
    .toUpperCase()

  if (src) {
    return <img className={`${styles.avatar} ${styles[size]}`} src={src} alt={name} />
  }

  return (
    <span className={`${styles.avatar} ${styles[size]} ${styles.initial}`} role="img" aria-label={name}>
      {initials}
    </span>
  )
}
