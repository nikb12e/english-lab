// Open source različica: brez strežnika, brez računov in brez zunanjih API klicev.
// Ta modul nadomešča odjemalca Supabase z lokalno izvedbo, ki ima enak vmesnik, zato preostala koda deluje
// nespremenjeno. Napredek ostane v brskalniku (localStorage), AI funkcije se izklopijo, Arena igra z boti.

export const SUPABASE_URL = ''
export const SUPABASE_KEY = ''
export const OFFLINE = true

export interface Session {
  user: { id: string; email?: string | null; user_metadata?: { avatar_url?: string; [k: string]: unknown } }
}

type Payload = { payload: unknown }
type Handler = (msg: Payload) => void

/** Lokalni kanal: vidi samo tebe, sporočila drugih igralcev nikoli ne pridejo. */
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

const offlineError = { message: 'Open source različica deluje brez strežnika.', status: 0 }

/** Poizvedba na bazo: vedno vrne prazen rezultat brez napake, da se aplikacija ne ustavi. */
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
