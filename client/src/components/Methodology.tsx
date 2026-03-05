import type { JSX } from "react"

type Props = {
  onClose: () => void
}

export function Methodology({ onClose }: Props): JSX.Element {
  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-[#1e293b] text-slate-50 shadow-2xl">
        <div className="sticky top-0 flex items-center justify-between border-b border-[#334155] bg-[#1e293b] px-6 py-4">
          <h2 className="text-xl font-semibold">Methodology</h2>
          <button
            onClick={onClose}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-[#334155] hover:text-slate-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <div className="space-y-6 px-6 py-5 text-sm leading-relaxed text-slate-300">
          <section>
            <h3 className="mb-2 text-base font-semibold text-slate-100">Data Sources</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong className="text-slate-200">DPWH Transparency Data</strong> &mdash; 248,000+ infrastructure project records scraped from the DPWH Transparency Portal, published on{" "}
                <a href="https://data.bettergov.ph/datasets/19" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">BetterGov.ph</a>{" "}
                under CC0 license. Includes project locations, budgets, status, and progress percentages.
              </li>
              <li>
                <strong className="text-slate-200">NOAH Flood Hazard Maps</strong> &mdash; 25-year return period flood hazard polygons for Metro Manila from the UP NOAH Center, licensed under ODbL 1.0. Three severity levels (Var 1/2/3).
              </li>
              <li>
                <strong className="text-slate-200">City Boundaries</strong> &mdash; Administrative boundary geometries from OCHA Philippines combined with{" "}
                <a href="https://github.com/faeldon/philippines-json-maps" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:underline">faeldon/philippines-json-maps</a>.
              </li>
            </ul>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-slate-100">Scoring Formula</h3>
            <div className="rounded-lg bg-[#0f172a] px-4 py-3 font-mono text-xs">
              EffectiveCoverage(city) = (raw_covered_area / total_high_hazard_area) &times; (avg_progress / 100)
            </div>
            <p className="mt-2">
              <strong className="text-slate-200">raw_covered_area</strong>: The area (in km&sup2;) of the union of 500-meter buffers around each flood-control project point that overlaps with the city&apos;s high-hazard zone (Var = 3).
            </p>
            <p className="mt-1">
              <strong className="text-slate-200">total_high_hazard_area</strong>: The total area of Var = 3 (highest severity) flood hazard within the city boundary.
            </p>
            <p className="mt-1">
              <strong className="text-slate-200">avg_progress</strong>: The mean completion progress (0&ndash;100%) of all flood-control projects assigned to that city.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-slate-100">Buffer Radius</h3>
            <p>
              Each DPWH flood-control project is represented as a point (latitude/longitude). We draw a <strong className="text-slate-200">500-meter circular buffer</strong> around each point to approximate the project&apos;s area of influence. Buffers are unioned per city before intersecting with the hazard zone.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-slate-100">What the Score Means</h3>
            <p>
              A score of <strong className="text-slate-200">100%</strong> means every square meter of high-hazard area in the city is within 500m of a fully completed flood-control project. A score of <strong className="text-slate-200">50%</strong> could mean either half the hazard area is covered by completed projects, or all of it is covered by projects that are only 50% complete.
            </p>
          </section>

          <section>
            <h3 className="mb-2 text-base font-semibold text-slate-100">Limitations</h3>
            <ul className="list-disc space-y-1 pl-5">
              <li>~8.5% of DPWH projects have null coordinates and are silently dropped.</li>
              <li>Terminated projects are excluded entirely from scoring.</li>
              <li>The 500m buffer is a fixed assumption &mdash; actual project influence varies.</li>
              <li>Project points may not accurately represent the infrastructure&apos;s true footprint.</li>
              <li>Only Var = 3 (highest severity) hazard zones are used in scoring.</li>
              <li>All spatial computation uses EPSG:32651 (UTM Zone 51N) for area accuracy.</li>
            </ul>
          </section>
        </div>
      </div>
    </div>
  )
}
