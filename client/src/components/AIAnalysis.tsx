import { useState, type JSX } from "react"
import { fetchAnalysis } from "../lib/api"
import type { AnalysisResponse } from "../lib/types"
import { useLocale } from "../lib/locale"

const STORAGE_KEY = "roberto-gemini-key"

type Props = {
  cityId: string
}

const CONFIDENCE_STYLES: Record<NonNullable<AnalysisResponse["confidence_level"]>, string> = {
  high: "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30",
  medium: "bg-amber-500/15 text-amber-300 border border-amber-500/30",
  low: "bg-orange-500/15 text-orange-300 border border-orange-500/30",
  fallback: "bg-slate-500/15 text-slate-300 border border-slate-500/30",
}

function confidenceLabel(
  t: (key: string) => string,
  level: NonNullable<AnalysisResponse["confidence_level"]>,
): string {
  if (level === "high") return t("ai.confidenceHigh")
  if (level === "medium") return t("ai.confidenceMedium")
  if (level === "low") return t("ai.confidenceLow")
  return t("ai.confidenceFallback")
}

export function AIAnalysis({ cityId }: Props): JSX.Element {
  const { t } = useLocale()
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
      .catch(() => setResult({ analysis: null, error: t("ai.requestFailed") }))
      .finally(() => setLoading(false))
  }

  if (result?.analysis) {
    const confidenceLevel = result.confidence_level ?? "fallback"
    const sourceLabel = result.source === "fallback" ? t("ai.sourceFallback") : t("ai.sourceAi")

    return (
      <div className="rounded-lg border border-[#334155] bg-[#0f172a] p-4">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="rounded border border-blue-500/30 bg-blue-500/20 px-2 py-0.5 text-xs text-blue-300">
            {sourceLabel}
          </span>
          <span className={`rounded px-2 py-0.5 text-xs ${CONFIDENCE_STYLES[confidenceLevel]}`}>
            {t("ai.confidence")} {confidenceLabel(t, confidenceLevel)}
          </span>
        </div>
        <p className="text-sm leading-relaxed text-slate-300">{result.analysis}</p>
        {result.gated && (
          <div className="mt-3 rounded-md border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {t("ai.lowConfidenceFallback")}
          </div>
        )}
        <p className="mt-3 text-[11px] text-slate-500">
          {result.disclaimer ?? t("ai.disclaimer")}
        </p>
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
          {t("ai.tryAgain")}
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
          placeholder={t("ai.placeholder")}
          className="flex-1 rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-blue-500/50"
        />
        <button
          onClick={handleAnalyze}
          disabled={loading || apiKey.trim() === ""}
          className="rounded-lg border border-blue-500/30 bg-blue-500/10 px-4 py-2 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/20 disabled:opacity-40"
        >
          {loading ? "..." : t("ai.analyze")}
        </button>
      </div>
      <p className="text-[10px] text-slate-600">
        {t("ai.keyHelp")} {" "}
        <a
          href="https://aistudio.google.com/apikey"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-500/70 hover:underline"
        >
          aistudio.google.com
        </a>
        {" "}&middot; {t("ai.storedLocally")}
      </p>
    </div>
  )
}
