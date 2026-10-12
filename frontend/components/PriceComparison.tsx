// Afghanistan's unit price and the market average on one price scale, as in
// the design: Afghanistan's marker above the line, the market average below,
// the stretch between them coloured by which side Afghanistan is on.

const NICE_STEPS = [1, 2, 2.5, 5]

/** A round tick step giving roughly 1.5 steps across `span`. */
function niceStep(span: number): number {
  const raw = span / 1.5
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  for (const s of NICE_STEPS) if (s * magnitude >= raw) return s * magnitude
  return 10 * magnitude
}

function money(value: number, step: number): string {
  // Cents only when the scale is fine enough to need them
  const decimals = step < 1 || value < 10 ? 2 : 0
  return `$${value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`
}

export default function PriceComparison({
  afghan,
  market,
  unit,
}: {
  afghan: number
  market: number
  unit: string | null
}) {
  const lo = Math.min(afghan, market)
  const hi = Math.max(afghan, market)
  // Equal prices still need a scale: base it on 10% of the price
  const step = niceStep(hi - lo || hi * 0.1 || 1)
  const axisMin = Math.max(0, Math.floor(lo / step) * step - step)
  const axisMax = Math.ceil(hi / step) * step + step
  const at = (v: number) => `${(((v - axisMin) / (axisMax - axisMin)) * 100).toFixed(2)}%`

  const ticks: number[] = []
  for (let v = axisMin; v <= axisMax + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6)

  const cheaper = afghan < market
  const tone = cheaper ? 'text-green' : afghan > market ? 'text-danger' : 'text-ink'
  const segment = cheaper ? 'bg-score-high' : 'bg-score-low'
  const per = unit ? <span className="text-[13px] font-normal"> /{unit}</span> : null

  return (
    <figure className="relative h-[184px] mx-3 mt-2 mb-0" aria-label={`Afghanistan ${money(afghan, step)}${unit ? ` per ${unit}` : ''}; market average ${money(market, step)}`}>
      <div className="absolute inset-x-0 top-[70px] h-1 bg-line" />
      <div className={`absolute top-[70px] h-1 ${segment}`} style={{ left: at(lo), width: `calc(${at(hi)} - ${at(lo)})` }} />

      {/* Afghanistan, above the line */}
      <div className={`absolute top-0 -translate-x-1/2 text-center whitespace-nowrap ${tone}`} style={{ left: at(afghan) }}>
        <div className="text-xs font-semibold tracking-[0.06em] uppercase">Afghanistan</div>
        <div className="text-[22px] font-semibold">{money(afghan, step)}{per}</div>
      </div>
      <div
        className={`absolute top-[62px] w-5 h-5 -ml-2.5 rounded-full border-[3px] border-white ${cheaper ? 'bg-green shadow-[0_0_0_1px_#2C6A49]' : 'bg-danger shadow-[0_0_0_1px_#B3261E]'}`}
        style={{ left: at(afghan) }}
      />

      {/* Market average, below the line */}
      <div className="absolute top-[58px] w-[3px] h-7 -ml-[1.5px] bg-ink" style={{ left: at(market) }} />
      <div className="absolute top-[94px] -translate-x-1/2 text-center whitespace-nowrap" style={{ left: at(market) }}>
        <div className="text-[22px] font-semibold text-ink">{money(market, step)}{per}</div>
        <div className="text-xs font-semibold tracking-[0.06em] uppercase text-muted">Market average</div>
      </div>

      {/* Scale */}
      <div className="absolute inset-x-0 top-[148px] border-t border-soft" aria-hidden="true">
        {ticks.map((v) => (
          <span key={v} className="absolute top-2 -translate-x-1/2 text-xs text-muted" style={{ left: at(v) }}>
            {money(v, step)}
          </span>
        ))}
      </div>
    </figure>
  )
}
