import type { JSX } from "react"
import { useLocale } from "../lib/locale"

type Props = {
  onClose: () => void
}

export function Methodology({ onClose }: Props): JSX.Element {
  const { t } = useLocale()

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-[#1e293b] text-slate-50 shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-[#334155] bg-[#1e293b] px-6 py-4">
          <h2 className="text-xl font-semibold">{t("method.title")}</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-[#334155] hover:text-slate-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="space-y-6 px-6 py-5 text-sm leading-relaxed text-slate-300">
          <section>
            <h3 className="mb-2 text-base font-semibold text-slate-100">{t("method.dataSources")}</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-slate-200">{t("method.dataSources.dpwh.title")}</strong> &mdash; {t("method.dataSources.dpwh.body")} {" "}
                <a href="https://data.bettergov.ph/datasets/19" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">BetterGov.ph</a>{" "}
              </li>
              <li>
                <strong className="text-slate-200">{t("method.dataSources.noah.title")}</strong> &mdash; {t("method.dataSources.noah.body")}
              </li>
              <li>
                <strong className="text-slate-200">{t("method.dataSources.boundaries.title")}</strong> &mdash; {t("method.dataSources.boundaries.body")}{" "}
                <a href="https://github.com/faeldon/philippines-json-maps" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">faeldon/philippines-json-maps</a>.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-slate-100">{t("method.scoringFormula")}</h3>
            <div className="rounded-lg bg-[#0f172a] px-4 py-3 font-mono text-xs">
              EffectiveCoverage(city) = (raw_covered_area / total_high_hazard_area) &times; (avg_progress / 100)
            </div>
            <p className="mt-2">
              <strong className="text-slate-200">raw_covered_area</strong>: {t("method.scoring.rawCoveredArea")}
            </p>
            <p className="mt-1">
              <strong className="text-slate-200">total_high_hazard_area</strong>: {t("method.scoring.totalHazardArea")}
            </p>
            <p className="mt-1">
              <strong className="text-slate-200">avg_progress</strong>: {t("method.scoring.avgProgress")}
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-slate-100">{t("method.bufferRadius")}</h3>
            <p>
              {t("method.buffer.body")}
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-slate-100">{t("method.whatScoreMeans")}</h3>
            <p>
              {t("method.scoreMeaning.body")}
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-slate-100">{t("method.limitations")}</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t("method.limitations.item1")}</li>
              <li>{t("method.limitations.item2")}</li>
              <li>{t("method.limitations.item3")}</li>
              <li>{t("method.limitations.item4")}</li>
              <li>{t("method.limitations.item5")}</li>
              <li>{t("method.limitations.item6")}</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
