// The MSME Support Centre mark, as on the website. `onDark` is the footer
// version (white rays, lighter amber accent).
export default function BrandMark({ size = 30, onDark = false }: { size?: number; onDark?: boolean }) {
  const main = onDark ? '#FFFFFF' : '#0468B1'
  const accent = onDark ? '#D8923C' : '#B8690F'
  return (
    <svg width={size} height={size} viewBox="0 0 30 30" fill="none" aria-hidden="true">
      <circle cx="15" cy="15" r="3.1" fill={main} />
      <path d="M15 9.4 L15 2.6 M15 20.6 L15 27.4 M9.4 15 L2.6 15 M20.6 15 L27.4 15" stroke={main} strokeWidth="2" strokeLinecap="round" />
      <path d="M19.4 10.6 L24.2 5.8 M10.6 19.4 L5.8 24.2" stroke={accent} strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}
