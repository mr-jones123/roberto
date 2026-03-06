import { useEffect, useState, type FormEvent, type JSX } from "react"
import { createIncident, fetchIncidents, fetchNearestEvacCenters } from "../../lib/api"
import type { EvacCenter, IncidentRow } from "../../lib/types"
import { useIncidentStream } from "../../hooks/useIncidentStream"
import { StatusBadge } from "./StatusBadge"

type Props = {
  token: string
  userId: string
  onLogout: () => void
}

export function ReporterPanel({ token, userId, onLogout }: Props): JSX.Element {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [lat, setLat] = useState("")
  const [lng, setLng] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [myPings, setMyPings] = useState<IncidentRow[]>([])
  const [evacCache, setEvacCache] = useState<Record<string, EvacCenter[]>>({})

  const { incidents: streamIncidents } = useIncidentStream()

  useEffect(() => {
    fetchIncidents(token)
      .then((res) => {
        setMyPings(res.incidents.filter((i) => i.reporter_id === userId))
      })
      .catch(() => {})
  }, [token, userId])

  useEffect(() => {
    for (const inc of streamIncidents) {
      if (inc.reporter_id === userId) {
        setMyPings((prev) => {
          const idx = prev.findIndex((p) => p.id === inc.id)
          if (idx >= 0) {
            const next = [...prev]
            next[idx] = inc
            return next
          }
          return [inc, ...prev]
        })
      }
    }
  }, [streamIncidents, userId])

  const loadEvac = (incident: IncidentRow) => {
    if (evacCache[incident.id]) return
    fetchNearestEvacCenters(incident.latitude, incident.longitude)
      .then((res) => {
        setEvacCache((prev) => ({ ...prev, [incident.id]: res.centers }))
      })
      .catch(() => {})
  }

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    setFormError(null)

    const latitude = parseFloat(lat)
    const longitude = parseFloat(lng)
    if (isNaN(latitude) || isNaN(longitude)) {
      setFormError("Latitude and longitude must be valid numbers")
      return
    }

    setSubmitting(true)
    createIncident(token, { title, description, latitude, longitude })
      .then((res) => {
        setMyPings((prev) => [res.incident, ...prev])
        setTitle("")
        setDescription("")
        setLat("")
        setLng("")
      })
      .catch((err: unknown) => {
        setFormError(err instanceof Error ? err.message : "Failed to create incident")
      })
      .finally(() => setSubmitting(false))
  }

  return (
    <div className="flex h-full flex-col bg-[#1e293b] text-slate-50">
      <div className="flex items-center justify-between border-b border-[#334155] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Reporter
          </h2>
          <p className="text-[10px] text-slate-600">Create & track pings</p>
        </div>
        <button
          onClick={onLogout}
          className="rounded px-2 py-1 text-[10px] text-slate-500 transition-colors hover:bg-[#334155] hover:text-slate-300"
        >
          Sign out
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <form onSubmit={handleSubmit} className="border-b border-[#334155] p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            New Ping
          </h3>
          <div className="space-y-2">
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-amber-500/50"
              placeholder="Title"
              required
            />
            <textarea
              data-testid="report-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full resize-none rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-amber-500/50"
              placeholder="Description"
              rows={2}
              required
            />
            <div className="grid grid-cols-2 gap-2">
              <input
                data-testid="report-location-lat"
                type="text"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-amber-500/50"
                placeholder="Latitude"
                required
              />
              <input
                data-testid="report-location-lng"
                type="text"
                value={lng}
                onChange={(e) => setLng(e.target.value)}
                className="rounded-lg border border-[#334155] bg-[#0f172a] px-3 py-2 text-sm text-slate-200 placeholder-slate-600 outline-none focus:border-amber-500/50"
                placeholder="Longitude"
                required
              />
            </div>
          </div>

          {formError && (
            <p className="mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {formError}
            </p>
          )}

          <button
            data-testid="report-submit"
            type="submit"
            disabled={submitting}
            className="mt-3 w-full rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-slate-900 transition-colors hover:bg-amber-400 disabled:opacity-50"
          >
            {submitting ? "Submitting..." : "Submit Ping"}
          </button>
        </form>

        <div className="p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            My Pings ({myPings.length})
          </h3>
          {myPings.length === 0 && (
            <p className="text-xs text-slate-600">No pings yet. Submit one above.</p>
          )}
          <div className="space-y-2">
            {myPings.map((ping) => (
              <PingCard
                key={ping.id}
                ping={ping}
                evacCenters={evacCache[ping.id]}
                onExpand={() => loadEvac(ping)}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function PingCard({
  ping,
  evacCenters,
  onExpand,
}: {
  ping: IncidentRow
  evacCenters: EvacCenter[] | undefined
  onExpand: () => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)

  const toggle = () => {
    if (!expanded) onExpand()
    setExpanded((v) => !v)
  }

  return (
    <button
      onClick={toggle}
      className="w-full rounded-lg border border-[#334155]/50 bg-[#0f172a] p-3 text-left transition-colors hover:border-[#334155]"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p data-testid="incident-id" className="truncate text-sm font-medium text-slate-200">
            {ping.title}
          </p>
          <p className="mt-0.5 text-[10px] font-mono text-slate-600">
            {ping.latitude.toFixed(4)}, {ping.longitude.toFixed(4)}
          </p>
        </div>
        <StatusBadge status={ping.status} data-testid="incident-status" />
      </div>

      {expanded && (
        <div className="mt-2 border-t border-[#334155]/50 pt-2">
          <p className="text-xs text-slate-400">{ping.description}</p>
          {evacCenters && evacCenters.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Nearest Evacuation Centers
              </p>
              {evacCenters.map((c) => (
                <div key={c.id} className="flex items-center justify-between py-0.5">
                  <span className="truncate text-[11px] text-slate-400">{c.name}</span>
                  <span className="ml-2 flex-shrink-0 text-[10px] font-mono text-slate-500">
                    {c.distance_km.toFixed(1)} km
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </button>
  )
}
