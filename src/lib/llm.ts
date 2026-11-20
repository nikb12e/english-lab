// Bring your own key: the language model features call the provider straight from the browser with the user's own API key.
// The key is stored only in this browser (localStorage) and is sent only to the provider the user picked.
// Supported: OpenRouter, Anthropic and OpenAI. Without a key every AI feature quietly falls back to offline behaviour.

export type Provider = 'openrouter' | 'anthropic' | 'openai'

export interface LlmConfig { provider: Provider; key: string; model: string }

export const PROVIDERS: Record<Provider, { name: string; model: string; keyHint: string; keysUrl: string }> = {
  openrouter: { name: 'OpenRouter', model: 'openai/gpt-6-luna', keyHint: 'sk-or-…', keysUrl: 'https://openrouter.ai/keys' },
  anthropic: { name: 'Anthropic', model: 'claude-haiku-5-5', keyHint: 'sk-ant-…', keysUrl: 'https://console.anthropic.com/settings/keys' },
  openai: { name: 'OpenAI', model: 'gpt-6-luna', keyHint: 'sk-…', keysUrl: 'https://platform.openai.com/api-keys' },
}

const STORE = 'el:llm'
type Listener = () => void
const listeners = new Set<Listener>()

export function getLlm(): LlmConfig | null {
  try {
    const c = JSON.parse(localStorage.getItem(STORE) || 'null') as LlmConfig | null
    if (!c || !c.key || !PROVIDERS[c.provider]) return null
    return { ...c, model: c.model?.trim() || PROVIDERS[c.provider].model }
  } catch { return null }
}

export function setLlm(c: LlmConfig | null) {
  try {
    if (c) localStorage.setItem(STORE, JSON.stringify({ provider: c.provider, key: c.key.trim(), model: c.model.trim() }))
    else localStorage.removeItem(STORE)
  } catch { /* private mode: the key lives only for this page */ }
  down = 0
  listeners.forEach((l) => l())
}

export const onLlmChange = (l: Listener) => { listeners.add(l); return () => { listeners.delete(l) } }

/** True when a key is configured and the provider has not just failed. */
export const llmReady = () => !!getLlm() && Date.now() >= down

let down = 0

function parseJson(text: string): unknown {
  const t = text.replace(/^```(?:json)?\s*|\s*```$/gm, '').trim()
  try { return JSON.parse(t) } catch { /* fall through */ }
  const a = t.indexOf('{'), b = t.lastIndexOf('}')
  if (a >= 0 && b > a) { try { return JSON.parse(t.slice(a, b + 1)) } catch { /* */ } }
  return null
}

export class LlmError extends Error {
  status: number
  constructor(message: string, status = 0) { super(message); this.status = status }
}

/** Sends one request and returns the raw text answer. Throws LlmError with a readable message. */
async function send(c: LlmConfig, system: string, user: string, maxTokens: number, temperature: number, json: boolean, signal: AbortSignal): Promise<string> {
  let res: Response
  if (c.provider === 'anthropic') {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      signal,
      headers: {
        'content-type': 'application/json',
        'x-api-key': c.key,
        'anthropic-version': '2023-06-01',
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: c.model,
        max_tokens: maxTokens,
        temperature,
        system: json ? system + '\nAnswer with one JSON object only, no other text.' : system,
        messages: [{ role: 'user', content: user }],
      }),
    })
  } else {
    const url = c.provider === 'openrouter' ? 'https://openrouter.ai/api/v1/chat/completions' : 'https://api.openai.com/v1/chat/completions'
    const headers: Record<string, string> = { 'content-type': 'application/json', authorization: `Bearer ${c.key}` }
    if (c.provider === 'openrouter') { headers['X-Title'] = 'English Lab'; headers['HTTP-Referer'] = location.origin }
    const body: Record<string, unknown> = {
      model: c.model,
      messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
    }
    // OpenAI reasoning models accept only max_completion_tokens and the default temperature; reasoning also uses tokens, so the budget is larger
    if (c.provider === 'openai') body.max_completion_tokens = Math.max(maxTokens, 4000)
    else { body.max_tokens = maxTokens; body.temperature = temperature }
    if (json) body.response_format = { type: 'json_object' }
    res = await fetch(url, { method: 'POST', signal, headers, body: JSON.stringify(body) })
  }
  if (!res.ok) {
    let msg = ''
    try { const e = await res.json(); msg = e?.error?.message || e?.message || '' } catch { /* */ }
    throw new LlmError(msg || `HTTP ${res.status}`, res.status)
  }
  const out = await res.json()
  const text = c.provider === 'anthropic'
    ? (out?.content || []).filter((b: { type: string }) => b.type === 'text').map((b: { text: string }) => b.text).join('')
    : String(out?.choices?.[0]?.message?.content ?? '')
  return text
}

/** Asks the model for a JSON object. Returns null when no key is set, on timeout or on any error. */
export async function llmJson<T>(system: string, user: string, opts: { maxTokens?: number; temperature?: number; timeoutMs?: number } = {}): Promise<T | null> {
  const c = getLlm()
  if (!c || Date.now() < down) return null
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), opts.timeoutMs ?? 30_000)
  try {
    const text = await send(c, system, user, opts.maxTokens ?? 1500, opts.temperature ?? 0.4, true, ctl.signal)
    return parseJson(text) as T | null
  } catch (e) {
    // wrong key or no credit: pause for a while so the app does not keep hammering the provider
    if (e instanceof LlmError && (e.status === 401 || e.status === 402 || e.status === 403 || e.status === 429)) down = Date.now() + 2 * 60_000
    return null
  } finally {
    clearTimeout(timer)
  }
}

/** Checks a config with a tiny request. Returns null when it works, otherwise an error message for the user. */
export async function testLlm(c: LlmConfig): Promise<string | null> {
  const ctl = new AbortController()
  const timer = setTimeout(() => ctl.abort(), 25_000)
  try {
    const text = await send({ ...c, model: c.model.trim() || PROVIDERS[c.provider].model }, 'You are a connection test.', 'Reply with the JSON {"ok":true}.', 300, 0, true, ctl.signal)
    const j = parseJson(text) as { ok?: boolean } | null
    return j?.ok ? null : 'The model answered, but not with the expected JSON. Try another model.'
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') return 'The provider did not answer in time.'
    if (e instanceof LlmError) {
      if (e.status === 401 || e.status === 403) return 'The key was rejected. Check that you copied it correctly.'
      if (e.status === 404) return `Model not found: ${e.message}`
      return e.message
    }
    return 'Could not reach the provider. Check your connection.'
  } finally {
    clearTimeout(timer)
  }
}
