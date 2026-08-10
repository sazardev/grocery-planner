interface BrandMarkProps {
  size?: number
  className?: string
}

/** El logo de la marca (coincide con public/favicon.svg): tarjeta verde con
 *  la lista blanca y el check. */
export default function BrandMark({ size = 30, className }: BrandMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      role="img"
      aria-label="Grocery Planner"
      className={className}
    >
      <title>Grocery Planner</title>
      <rect width="512" height="512" rx="120" fill="#16A34A" />
      <rect x="128" y="120" width="256" height="272" rx="48" fill="#FFFFFF" />
      <rect x="176" y="196" width="132" height="28" rx="14" fill="#BBF7D0" />
      <rect x="176" y="264" width="160" height="24" rx="12" fill="#DCFCE7" />
      <rect x="176" y="320" width="112" height="24" rx="12" fill="#DCFCE7" />
      <circle cx="340" cy="210" r="34" fill="#16A34A" />
      <path
        d="M326 210l10 10 20-22"
        fill="none"
        stroke="#FFFFFF"
        strokeWidth={12}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
