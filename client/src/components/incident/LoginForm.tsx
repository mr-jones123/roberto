import { useState, type FormEvent, type JSX } from "react"

type Props = {
  onLogin: (username: string, password: string) => Promise<void>
}

export function LoginForm({ onLogin }: Props): JSX.Element {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    onLogin(username, password)
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Login failed")
      })
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="flex h-full flex-col items-center justify-center bg-[#1e293b] px-6">
      <div className="w-full max-w-xs">
        <div className="mb-6 text-center">
          <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-amber-500/10">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#f59e0b" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <h2 className="text-sm font-semibold text-slate-200">Incident Command</h2>
          <p className="mt-1 text-xs text-slate-500">Sign in to access your role panel</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div>
            <label htmlFor="ic-username" className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
              Username
            </label>
            <input
              id="ic-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none transition-colors focus:border-amber-500/50"
              placeholder="e.g. reporter1"
              required
            />
          </div>
          <div>
            <label htmlFor="ic-password" className="mb-1 block text-[10px] uppercase tracking-wider text-slate-500">
              Password
            </label>
            <input
              id="ic-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none transition-colors focus:border-amber-500/50"
              placeholder="password"
              required
            />
          </div>

          {error && (
            <p className="rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-amber-400 disabled:opacity-50"
          >
            {submitting ? "Signing in..." : "Sign In"}
          </button>
        </form>

        <p className="mt-4 text-center text-[10px] text-slate-600">
          reporter1 &middot; coord1 &middot; resp1
        </p>
      </div>
    </div>
  )
}
