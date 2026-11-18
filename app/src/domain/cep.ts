/**
 * Brazilian CEP → address lookup, called directly from the browser/WebView.
 * Verified 2026-11-17 from the deployed app (GitHub Pages origin): both providers send CORS headers.
 *  - BrasilAPI v2 (~80 ms): primary. NOTE: it can return a plausible-looking address for an invalid CEP
 *    (99999-999 gave a street in Sarandi/PR), so results are only PREFILLED and stay editable.
 *  - ViaCEP (~450 ms): fallback; "not found" is HTTP 200 with { erro: "true" }.
 * City-wide CEPs (e.g. 11600-000) may resolve with empty street/district, or not at all.
 */
export interface CepAddress { street: string; district: string; city: string; state: string }

/** Strip everything but digits; return 8 digits or null. Keep as string (leading zeros!). */
export function normalizeCep(input: string): string | null {
  const d = input.replace(/\D/g, '')
  return d.length === 8 && d !== '00000000' ? d : null
}

/** Input mask: "01310100" -> "01310-100" (works on partial input too). */
export function maskCep(input: string): string {
  const d = input.replace(/\D/g, '').slice(0, 8)
  return d.length > 5 ? `${d.slice(0, 5)}-${d.slice(5)}` : d
}

async function fetchJson(url: string, timeoutMs: number): Promise<{ status: number; body: any }> {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { signal: ctrl.signal, headers: { Accept: 'application/json' } })
    let body: any = null
    try { body = await res.json() } catch { /* non-JSON error page */ }
    return { status: res.status, body }
  } finally {
    clearTimeout(t)
  }
}

const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

// Each provider returns an address, 'notfound' (definitive for that provider), or throws (try the next one).
type Provider = (cep: string, timeoutMs: number) => Promise<CepAddress | 'notfound'>

const brasilApi: Provider = async (cep, ms) => {
  const { status, body } = await fetchJson(`https://brasilapi.com.br/api/cep/v2/${cep}`, ms)
  if (status === 404) return 'notfound'
  if (status !== 200 || !body) throw new Error(`brasilapi ${status}`)
  return { street: str(body.street), district: str(body.neighborhood), city: str(body.city), state: str(body.state) }
}

const viaCep: Provider = async (cep, ms) => {
  const { status, body } = await fetchJson(`https://viacep.com.br/ws/${cep}/json/`, ms)
  if (status === 400) return 'notfound'
  if (status !== 200 || !body) throw new Error(`viacep ${status}`)
  if (body.erro === true || body.erro === 'true') return 'notfound'
  return { street: str(body.logradouro), district: str(body.bairro), city: str(body.localidade), state: str(body.uf) }
}

const PROVIDERS: Provider[] = [brasilApi, viaCep]
const cache = new Map<string, CepAddress | null>()

/**
 * Returns the address, or null if the CEP is invalid/unknown. Throws only if every provider failed
 * technically (offline, timeout), so the UI can tell "not found" from "couldn't check".
 */
export async function lookupCep(input: string, timeoutMs = 5000): Promise<CepAddress | null> {
  const cep = normalizeCep(input)
  if (!cep) return null
  if (cache.has(cep)) return cache.get(cep)!
  let lastError: unknown
  for (const provider of PROVIDERS) {
    try {
      const r = await provider(cep, timeoutMs)
      if (r === 'notfound') { lastError = undefined; continue } // another source may know it
      if (!r.city || !r.state) throw new Error('incomplete response')
      cache.set(cep, r)
      return r
    } catch (e) {
      lastError = e
    }
  }
  if (lastError) throw lastError
  cache.set(cep, null)
  return null
}
