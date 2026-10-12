// Line icons for the market profile cards, from the design mockup.

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" stroke="#0468B1" strokeWidth="1.6" strokeLinecap="square" strokeLinejoin="miter" aria-hidden="true">
      {children}
    </svg>
  )
}

export const GlobeIcon = () => (
  <Icon>
    <circle cx="20" cy="20" r="14" />
    <path d="M6 20h28M20 6c4.5 4.2 6.5 9 6.5 14S24.5 29.8 20 34M20 6c-4.5 4.2-6.5 9-6.5 14s2 9.8 6.5 14M9 12.5h22M9 27.5h22" />
  </Icon>
)

export const TrendIcon = () => (
  <Icon>
    <path d="M6 32h28" /><path d="M8 27l8-8 5 5 11-11" /><path d="M25 13h7v7" />
  </Icon>
)

export const BarsIcon = () => (
  <Icon>
    <path d="M6 33h28" /><path d="M10 33V22h5v11M18 33V16h5v17M26 33V10h5v23" />
  </Icon>
)

export const ExportIcon = () => (
  <Icon>
    <path d="M6 16l14-8 14 8v16H6z" /><path d="M13 32V21h14v11" /><path d="M20 25v-9m-3.5 3.5L20 16l3.5 3.5" />
  </Icon>
)

export const PodiumIcon = () => (
  <Icon>
    <path d="M6 33h28" />
    <path d="M15 33V19h10v14M6 33v-8h9M25 33v-11h9v11" />
    <path d="M20 9l1.4 2.8 3.1.4-2.2 2.2.5 3-2.8-1.4-2.8 1.4.5-3-2.2-2.2 3.1-.4z" />
  </Icon>
)

export const PriceTagIcon = () => (
  <Icon>
    <path d="M7 20.5V8h12.5L33 21.5 21.5 33z" /><circle cx="13.5" cy="14" r="2.2" />
  </Icon>
)

export const BarrierIcon = () => (
  <Icon>
    <path d="M6 33V13M34 33V13" /><path d="M6 17h28v5H6z" /><path d="M12 17l-3 5M19 17l-3 5M26 17l-3 5M33 17l-3 5" />
  </Icon>
)

export const TruckIcon = () => (
  <Icon>
    <path d="M5 12h19v16H5zM24 17h6l5 5v6H24" /><circle cx="11" cy="30" r="3" /><circle cx="29" cy="30" r="3" />
  </Icon>
)

export const DocumentIcon = () => (
  <Icon>
    <path d="M10 6h14l6 6v22H10z" /><path d="M24 6v6h6" /><path d="M15 23l4 4 7-8" />
  </Icon>
)

export const ShieldIcon = () => (
  <Icon>
    <path d="M20 6l12 4v9c0 7-5 12-12 15-7-3-12-8-12-15v-9z" /><path d="M15 20l4 4 7-7" />
  </Icon>
)

export const WalletIcon = () => (
  <Icon>
    <path d="M6 12h24v20H6z" /><path d="M6 12l18-6v6" /><path d="M22 19h12v7H22z" /><circle cx="26.5" cy="22.5" r="1" />
  </Icon>
)

/** Ring showing a share (0–100%), as in the Market share card. */
export function ShareRing({ pct }: { pct: number | null }) {
  const circumference = 2 * Math.PI * 15
  const filled = pct != null ? (Math.max(0, Math.min(100, pct)) / 100) * circumference : 0
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true">
      <circle cx="20" cy="20" r="15" fill="none" stroke="#EDEFF0" strokeWidth="6" />
      <circle
        cx="20" cy="20" r="15" fill="none" stroke="#0468B1" strokeWidth="6"
        strokeDasharray={`${filled.toFixed(2)} ${circumference.toFixed(2)}`}
        transform="rotate(-90 20 20)"
      />
    </svg>
  )
}
