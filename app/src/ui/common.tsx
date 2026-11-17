/** Small shared UI pieces and formatters. */
import { useState, type ReactNode } from 'react'
import type { PricePoint } from '../domain/types'

export const brl = (n: number) => 'R$ ' + n.toFixed(2).replace('.', ',')
export const pct = (n: number) => (n > 0 ? '+' : '') + n.toFixed(0) + '%'

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={'card ' + className}>{children}</section>
}

export function Modal({ children, onClose }: { children: ReactNode; onClose?: () => void }) {
  return (
    <div className="modal-bg" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  )
}

/** Big −/+ stepper used for counting. Large hit areas: used one-handed while looking in cupboards. */
export function Stepper({ value, onChange, size = 'big' }: { value: number; onChange: (v: number) => void; size?: 'big' | 'mid' | 'small' }) {
  return (
    <div className={'stepper ' + size}>
      <button aria-label="minus" onClick={() => onChange(Math.max(0, value - 1))}>−</button>
      <span className="val">{value}</span>
      <button aria-label="plus" onClick={() => onChange(value + 1)}>+</button>
    </div>
  )
}

/**
 * Tiny price chart. The line is the LIST price (what alerts measure); green dots are what was
 * actually paid when on sale. Keeping alert and line on the same measure avoids "+18 % but the
 * line goes down" confusion. The last point is a bigger dot.
 */
export function Sparkline({ h, w = 96, hgt = 30 }: { h: PricePoint[]; w?: number; hgt?: number }) {
  if (h.length < 2) return null
  const all = h.flatMap((p) => (p.sale ? [p.list, p.sale] : [p.list]))
  const min = Math.min(...all), max = Math.max(...all)
  const x = (i: number) => 4 + (i * (w - 8)) / (h.length - 1)
  const y = (v: number) => (max === min ? hgt / 2 : hgt - 4 - ((v - min) * (hgt - 8)) / (max - min))
  const n = h.length - 1
  return (
    <svg width={w} height={hgt} className="spark" aria-hidden>
      <polyline points={h.map((p, i) => `${x(i)},${y(p.list)}`).join(' ')} />
      {h.map((p, i) => (p.sale ? <circle key={i} className="sale" cx={x(i)} cy={y(p.sale)} r={2.5} /> : null))}
      <circle className="last" cx={x(n)} cy={y(h[n].list)} r={3} />
    </svg>
  )
}

// Krill's image CDN: '<file>' is the 500×500 original, '250x250/<file>' a thumbnail.
const IMG_HOST = 'https://produto-assets-vipcommerce-com-br.br-se1.magaluobjects.com/'
const DEPT_EMOJI: [RegExp, string][] = [
  [/Carnes/, '🥩'], [/Frios|Laticinios/, '🧀'], [/Congelados/, '🧊'], [/Iogurtes|Leites/, '🥛'], [/Hortifruti/, '🥬'],
  [/Matinais/, '☕'], [/Mercearia/, '🌾'], [/Molhos/, '🥫'], [/Doces/, '🍫'], [/Biscoitos/, '🥨'], [/Padaria/, '🍞'],
  [/Bebidas Alco/, '🍺'], [/Bebidas/, '🧃'], [/Bazar/, '🧻'], [/Pet/, '🐶'], [/Higiene/, '🧼'], [/Limpeza/, '🧽'],
]

/**
 * Product photo from Krill's image CDN. Falls back to a department emoji if there's no image or it
 * can't load (the claude.ai artifact preview blocks remote images; the real app/phone build loads them).
 */
export function ProductImg({ image, dept, size }: { image?: string; dept: string; size: number }) {
  const [failed, setFailed] = useState(false)
  const emoji = DEPT_EMOJI.find(([re]) => re.test(dept))?.[1] ?? '📦'
  return (
    <div className="pimg" style={{ width: size, height: size, fontSize: size * 0.5 }}>
      {/* Emoji always underneath; the photo fades in on top only once it has actually loaded. */}
      <span>{emoji}</span>
      {image && !failed && <img src={IMG_HOST + (size > 100 ? '' : '250x250/') + image} alt="" loading="lazy" onLoad={(e) => e.currentTarget.classList.add('loaded')} onError={() => setFailed(true)} />}
    </div>
  )
}

/** Vertical bar chart, single series, hover/tap tooltip. Bars have rounded data-ends. */
export function BarChart({ data, height = 160, fmtV, refLine }: {
  data: { label: string; value: number; tip?: string }[]
  height?: number
  fmtV: (v: number) => string
  refLine?: { value: number; label: string }
}) {
  const [hover, setHover] = useState<number | null>(null)
  const W = 340, padB = 20, padT = 14
  const max = Math.max(...data.map((d) => d.value), refLine?.value ?? 0) * 1.08 || 1
  const bw = W / data.length
  const y = (v: number) => padT + (height - padT - padB) * (1 - v / max)
  return (
    <div className="chart">
      <svg viewBox={`0 0 ${W} ${height}`} role="img">
        {refLine && (
          <g className="ref">
            <line x1={0} x2={W} y1={y(refLine.value)} y2={y(refLine.value)} />
            <text x={W - 2} y={y(refLine.value) - 3} textAnchor="end">{refLine.label}</text>
          </g>
        )}
        {data.map((d, i) => {
          const top = y(d.value), base = height - padB
          const bx = i * bw + bw * 0.18, bwid = bw * 0.64
          const r = Math.min(4, bwid / 2, base - top)
          return (
            <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => setHover(i)}>
              <rect x={i * bw} y={0} width={bw} height={height} fill="transparent" />
              {d.value > 0 && (
                <path
                  className={'bar' + (hover === i ? ' on' : '')}
                  d={`M${bx},${base} V${top + r} Q${bx},${top} ${bx + r},${top} H${bx + bwid - r} Q${bx + bwid},${top} ${bx + bwid},${top + r} V${base} Z`}
                />
              )}
              {(i % Math.ceil(data.length / 8) === 0 || data.length <= 8) && (
                <text className="axis" x={i * bw + bw / 2} y={height - 5} textAnchor="middle">{d.label}</text>
              )}
            </g>
          )
        })}
        <line className="base" x1={0} x2={W} y1={height - padB} y2={height - padB} />
      </svg>
      {hover !== null && (
        <div className="tip">
          <b>{data[hover].tip ?? data[hover].label}</b> · {fmtV(data[hover].value)}
        </div>
      )}
    </div>
  )
}
