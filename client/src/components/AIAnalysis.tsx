import { useState, type JSX } from "react"
import { fetchAnalysis } from "../lib/api"
import type { AnalysisResponse } from "../lib/types"

const STORAGE_KEY = "roberto-gemini-key"

type Props = {
  cityId: string
}

export function AIAnalysis({ cityId }: Props): JSX.Element {
  const [apiKey, setApiKey] = useState(() => localStorage.getItem(STORAGE_KEY) ?? "")
  const [result, setResult] = useState<AnalysisResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const saveKey = (key: string): void => {
    setApiKey(key)
    if (key.trim() === "") {
      localStorage.removeItem(STORAGE_KEY)
    } else {
      localStorage.setItem(STORAGE_KEY, key.trim())
    }
  }

  const handleAnalyze = (): void => {
    if (apiKey.trim() === "") return
    setLoading(true)
    fetchAnalysis(cityId, apiKey.trim())
      .then(setResult)
      .catch(() => setResult({ analysis: null, error: "Request failed" }))
      .finally(() => setLoading(false))
  }

  if (result?.analysis) {
    return (
      <div className="rounded-lg border border-[#334155] bg-[#0f172a] p-4">
        <div className="mb-2 flex items-center gap-2">
          <span className="rounded bg-blue-500/20 px-2 py-0.5 text-xs text-blue-400">
            Gemini Flash
          </span>
        </div>
        <p className="text-sm leading-relaxed text-slate-300">{result.analysis}</p>
      </div>
    )
  }

  if (result?.error) {
    return (
      <div className="space-y-3">
        <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-3">
          <p className="text-sm text-red-400">{result.error}</p>
        </div>
        <button
          onClick={() => setResult(null)}
          className="text-xs text-slate-500 hover:text-slate-300"
        >
          Try again
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="password"
          value={apiKey}
          onChange={(e) => saveKey(e.target.value)}
          placeholder="Gemini API key"
          className="flex-1 rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-blue-500/50"
        />
        <button
          onClick={handleAnalyze}
          disabled={loading || apiKey.trim() === ""}
          className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20 disabled:opacity-40"
        >
          {loading ? "..." : "Analyze"}
        </button>
      </div>
      <p className="text-[10px] text-slate-600">
        Get a key at{" "}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500/70 hover:underline"
        >
          aistudio.google.com
        </a>
        {" "}&middot; stored locally only
      </p>
    </div>
  )
}
