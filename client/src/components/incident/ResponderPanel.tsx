import { useEffect, useState, type JSX } from "react"
import { fetchIncidents, fetchNearestEvacCenters, resolveIncident } from "../../lib/api"
import type { EvacCenter, IncidentRow } from "../../lib/types"
import { useIncidentStream } from "../../hooks/useIncidentStream"
import { StatusBadge } from "./StatusBadge"

type Props = {
  token: string
  onLogout: () => void
}

export function ResponderPanel({ token, onLogout }: Props): JSX.Element {
  const [incidents, setIncidents] = useState<IncidentRow[]>([])
  const [evacCache, setEvacCache] = useState<Record<string, EvacCenter[]>>({})
  const [toast, setToast] = useState<string | null>(null)

  const { incidents: streamIncidents } = useIncidentStream()

  useEffect(() => {
    fetchIncidents(token)
      .then((res) => {
        setIncidents(res.incidents.filter((i) => i.status === "ASSIGNED" || i.status === "RESOLVED"))
      })
      .catch(() => {})
  }, [token])

  useEffect(() => {
    for (const inc of streamIncidents) {
      if (inc.status === "ASSIGNED" || inc.status === "RESOLVED") {
        setIncidents((prev) => {
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
  }, [streamIncidents])

  useEffect(() => {
    for (const inc of incidents) {
      if (!evacCache[inc.id]) {
        fetchNearestEvacCenters(inc.latitude, inc.longitude)
          .then((res) => {
            setEvacCache((prev) => ({ ...prev, [inc.id]: res.centers }))
          })
          .catch(() => {})
      }
    }
  }, [incidents, evacCache])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const handleResolve = (inc: IncidentRow, note: string) => {
    resolveIncident(token, inc.id, note, inc.version)
      .then((res) => {
        setIncidents((prev) => prev.map((i) => (i.id === res.incident.id ? res.incident : i)))
      })
      .catch((err: unknown) => {
        const e = err as Error & { status?: number }
        if (e.status === 409) {
          showToast("Version conflict — please refresh")
        } else {
          showToast(e.message ?? "Resolve failed")
        }
      })
  }

  const assigned = incidents.filter((i) => i.status === "ASSIGNED")
  const resolved = incidents.filter((i) => i.status === "RESOLVED")

  return (
    <div className="flex h-full flex-col bg-[#1e293b] text-slate-50">
      <div className="flex items-center justify-between border-b border-[#334155] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Responder
          </h2>
          <p className="text-[10px] text-slate-600">Resolve assigned incidents</p>
        </div>
        <button
          onClick={onLogout}
          className="rounded px-2 py-1 text-[10px] text-slate-500 transition-colors hover:bg-[#334155] hover:text-slate-300"
        >
          Sign out
        </button>
      </div>

      {toast && (
        <div className="mx-4 mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400">
          {toast}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        <div className="p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
            Assigned ({assigned.length})
          </h3>
          {assigned.length === 0 && (
            <p className="text-xs text-slate-600">No incidents assigned to you.</p>
          )}
          <div className="space-y-2">
            {assigned.map((inc) => (
              <AssignedCard
                key={inc.id}
                incident={inc}
                evacCenters={evacCache[inc.id]}
                onResolve={handleResolve}
              />
            ))}
          </div>
        </div>

        {resolved.length > 0 && (
          <div className="border-t border-[#334155] p-4">
            <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Resolved ({resolved.length})
            </h3>
            <div className="space-y-2">
              {resolved.map((inc) => (
                <div
                  key={inc.id}
                  className="rounded-lg border border-[#334155]/50 bg-[#0f172a] p-3"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="truncate text-sm text-slate-400">{inc.title}</p>
                    <StatusBadge
                      status={inc.status}
                      data-testid={`incident-status-${inc.id}`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function AssignedCard({
  incident,
  evacCenters,
  onResolve,
}: {
  incident: IncidentRow
  evacCenters: EvacCenter[] | undefined
  onResolve: (inc: IncidentRow, note: string) => void
}): JSX.Element {
  const [note, setNote] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = () => {
    if (!note.trim()) return
    setSubmitting(true)
    onResolve(incident, note.trim())
    setTimeout(() => setSubmitting(false), 1000)
  }

  return (
    <div className="rounded-lg border border-[#334155]/50 bg-[#0f172a] p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-slate-200">{incident.title}</p>
          <p className="mt-0.5 text-[10px] font-mono text-slate-600">
            {incident.latitude.toFixed(4)}, {incident.longitude.toFixed(4)}
          </p>
        </div>
        <StatusBadge
          status={incident.status}
          data-testid={`incident-status-${incident.id}`}
        />
      </div>

      <p className="mt-2 text-xs text-slate-400">{incident.description}</p>

      {incident.priority !== null && (
        <span className="mt-2 inline-block rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-orange-400">
          Priority {incident.priority}
        </span>
      )}

      {evacCenters && evacCenters.length > 0 && (
        <div className="mt-2 border-t border-[#334155]/50 pt-2">
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

      <div className="mt-3 border-t border-[#334155]/50 pt-3">
        <textarea
          data-testid={`resolve-note-${incident.id}`}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="w-full resize-none rounded-lg border border-[#334155] bg-[#1e293b] px-3 py-2 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-emerald-500/50"
          placeholder="Resolution note..."
          rows={2}
        />
        <button
          data-testid={`resolve-submit-${incident.id}`}
          disabled={submitting || !note.trim()}
          onClick={handleSubmit}
          className="mt-2 w-full rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-medium text-emerald-400 transition-colors hover:bg-emerald-500/25 disabled:opacity-50"
        >
          {submitting ? "Resolving..." : "Resolve Incident"}
        </button>
      </div>
    </div>
  )
}
