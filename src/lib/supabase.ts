// Open source version: no server, no accounts and no built in API calls (AI features use only the key you add yourself).
// This module replaces the Supabase client with a local implementation that has the same interface, so the rest of the code works
// unchanged. Progress stays in the browser (localStorage), the Arena plays with bots.

export const SUPABASE_URL = ''
export const SUPABASE_KEY = ''
export const OFFLINE = true

export interface Session {
  user: { id: string; email?: string | null; user_metadata?: { avatar_url?: string; [k: string]: unknown } }
}

type Payload = { payload: unknown }
type Handler = (msg: Payload) => void

/** Local channel: sees only you, messages from other players never arrive. */
export class RealtimeChannel {
  private presence: Record<string, unknown[]> = {}
  private syncHandlers: (() => void)[] = []
  readonly topic: string
  private readonly key: string
  constructor(topic: string, key = 'me') {
    this.topic = topic
    this.key = key
  }
  on(type: string, filter: { event: string }, cb: (() => void) | Handler) {
    if (type === 'presence' && filter.event === 'sync') this.syncHandlers.push(cb as () => void)
    return this
  }
  presenceState<T>() {
    return this.presence as Record<string, T[]>
  }
  subscribe(cb?: (status: string) => void) {
    setTimeout(() => cb?.('SUBSCRIBED'), 0)
    return this
  }
  async track(state: unknown) {
    this.presence = { [this.key]: [state] }
    this.syncHandlers.forEach((h) => h())
    return 'ok'
  }
  async send(_msg?: unknown) {
    return 'ok'
  }
}

const offlineError = { message: 'The open source build works without a server.', status: 0 }

/** Database query: always returns an empty result without an error so the app does not stop. */
function query(): any {
  const result = { data: null, error: offlineError }
  const chain: any = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') return (res: (v: typeof result) => unknown) => Promise.resolve(result).then(res)
      return () => chain
    },
    apply() {
      return chain
    },
  })
  return chain
}

export const supabase = {
  auth: {
    getSession: async () => ({ data: { session: null as Session | null }, error: null }),
    onAuthStateChange: (_cb: (event: string, session: Session | null) => void) => ({ data: { subscription: { unsubscribe() {} } } }),
    signOut: async () => ({ error: null }),
    signInWithOAuth: async (_o: unknown) => ({ data: null, error: offlineError }),
    signInWithOtp: async (_o: unknown) => ({ data: null, error: offlineError }),
    verifyOtp: async (_o: unknown) => ({ data: null, error: offlineError }),
  },
  functions: {
    invoke: async (_name: string, _o?: unknown) => ({ data: null as any, error: offlineError as any }),
  },
  from: (_table: string) => query(),
  channel: (topic: string, opts?: { config?: { presence?: { key?: string }; broadcast?: { self?: boolean } } }) => new RealtimeChannel(topic, opts?.config?.presence?.key),
  removeChannel: async (_c: RealtimeChannel) => 'ok',
}
