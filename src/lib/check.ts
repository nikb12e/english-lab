/** Normalises text for comparison: lower case, uniform minus signs, spaces, powers, no trailing punctuation. */
export function norm(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFC')
    .replace(/[’`´]/g, "'")
    .replace(/[−–—]/g, '-')
    .replace(/[×*]/g, '·')
    .replace(/⁰/g, '^0').replace(/¹/g, '^1').replace(/²/g, '^2').replace(/³/g, '^3').replace(/⁴/g, '^4')
    .replace(/⁵/g, '^5').replace(/⁶/g, '^6').replace(/⁷/g, '^7').replace(/⁸/g, '^8').replace(/⁹/g, '^9').replace(/⁻/g, '^-')
    .replace(/\^(-?\d)\^(\d)/g, '^$1$2')
    .replace(/^\s*to\s+/, '')
    .replace(/[.!?;]+\s*$/, '')
    .replace(/\s*([,()·=+\-/{}^|:<>])\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Verb forms: allows “was/were”, “was or were”, “was, were”. Every part must be accepted. */
export function checkForm(input: string, accepted: Set<string>): { ok: boolean; empty: boolean; parts: string[] } {
  const parts = norm(input)
    .split(/\s*(?:\/|,|\bor\b|\bali\b)\s*/)
    .map((x) => x.trim())
    .filter(Boolean)
  if (!parts.length) return { ok: false, empty: true, parts }
  return { ok: parts.every((p) => accepted.has(p)), empty: false, parts }
}

export function checkText(input: string, accepted: string[]): boolean {
  const n = norm(input)
  if (!n) return false
  return accepted.some((a) => norm(a) === n || norm(a).replace(/ /g, '') === n.replace(/ /g, ''))
}

export function lev(a: string, b: string): number {
  const m = a.length, n = b.length
  if (!m) return n
  if (!n) return m
  let p = Array.from({ length: n + 1 }, (_, i) => i)
  for (let i = 1; i <= m; i++) {
    const c = [i]
    for (let j = 1; j <= n; j++) c[j] = Math.min(p[j] + 1, c[j - 1] + 1, p[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
    p = c
  }
  return p[n]
}

/** Splits the correct form into pieces; `miss: true` are letters missing from your answer. */
export function diff(user: string, correct: string): { t: string; miss: boolean }[] {
  const a = user, b = correct, m = a.length, n = b.length
  const L = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0))
  for (let i = m - 1; i >= 0; i--) for (let j = n - 1; j >= 0; j--) L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const out: { t: string; miss: boolean }[] = []
  const push = (t: string, miss: boolean) => {
    const last = out[out.length - 1]
    if (last && last.miss === miss) last.t += t
    else out.push({ t, miss })
  }
  let i = 0, j = 0
  while (j < n) {
    if (i < m && a[i] === b[j]) { push(b[j], false); i++; j++ }
    else if (i < m && L[i + 1][j] >= L[i][j + 1]) i++
    else { push(b[j], true); j++ }
  }
  return out
}
