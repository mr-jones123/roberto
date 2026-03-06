import { useEffect, useState, type JSX } from "react"
import {
  assignIncident,
  fetchIncidents,
  prioritizeIncident,
  rejectIncident,
  verifyIncident,
} from "../../lib/api"
import type { IncidentRow } from "../../lib/types"
import { useIncidentStream } from "../../hooks/useIncidentStream"
import { StatusBadge } from "./StatusBadge"

type Props = {
  token: string
  onLogout: () => void
}

type StatusFilter = "ALL" | "PING" | "VERIFIED" | "PRIORITIZED" | "ASSIGNED" | "RESOLVED" | "REJECTED"

const FILTER_OPTIONS: StatusFilter[] = ["ALL", "PING", "VERIFIED", "PRIORITIZED", "ASSIGNED", "RESOLVED", "REJECTED"]

export function CoordinatorPanel({ token, onLogout }: Props): JSX.Element {
  const [incidents, setIncidents] = useState<IncidentRow[]>([])
  const [filter, setFilter] = useState<StatusFilter>("ALL")
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [toast, setToast] = useState<string | null>(null)

  const { incidents: streamIncidents } = useIncidentStream()

  useEffect(() => {
    fetchIncidents(token)
      .then((res) => setIncidents(res.incidents))
      .catch(() => {})
  }, [token])

  useEffect(() => {
    for (const inc of streamIncidents) {
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
  }, [streamIncidents])

  const showToast = (msg: string) => {
    setToast(msg)
    setTimeout(() => setToast(null), 4000)
  }

  const handleError = (err: unknown) => {
    const e = err as Error & { status?: number }
    if (e.status === 409) {
      showToast("Version conflict — please refresh")
    } else {
      showToast(e.message ?? "Action failed")
    }
  }

  const updateIncident = (updated: IncidentRow) => {
    setIncidents((prev) => prev.map((i) => (i.id === updated.id ? updated : i)))
  }

  const filtered = incidents
    .filter((i) => filter === "ALL" || i.status === filter)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  return (
    <div className="flex h-full flex-col bg-[#1e293b] text-slate-50">
      <div className="flex items-center justify-between border-b border-[#334155] px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
            Coordinator
          </h2>
          <p className="text-[10px] text-slate-600">Verify, prioritize, assign</p>
        </div>
        <button
          onClick={onLogout}
          className="rounded px-2 py-1 text-[10px] text-slate-500 transition-colors hover:bg-[#334155] hover:text-slate-300"
        >
          Sign out
        </button>
      </div>

      <div className="flex flex-wrap gap-1 border-b border-[#334155] px-4 py-2">
        {FILTER_OPTIONS.map((opt) => (
          <button
            key={opt}
            onClick={() => setFilter(opt)}
            className={`rounded-full px-2 py-0.5 text-[10px] font-medium transition-colors ${
              filter === opt
                ? "bg-slate-600/50 text-slate-200"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {opt}
          </button>
        ))}
      </div>

      {toast && (
        <div
          data-testid="toast-error"
          className="mx-4 mt-2 rounded-lg bg-red-500/10 px-3 py-2 text-xs text-red-400"
        >
          {toast}
        </div>
      )}

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 && (
          <p className="p-4 text-xs text-slate-600">No incidents matching filter.</p>
        )}
        {filtered.map((inc) => (
          <IncidentQueueRow
            key={inc.id}
            incident={inc}
            expanded={expandedId === inc.id}
            onToggle={() => setExpandedId(expandedId === inc.id ? null : inc.id)}
            token={token}
            onUpdate={updateIncident}
            onError={handleError}
          />
        ))}
      </div>
    </div>
  )
}

function IncidentQueueRow({
  incident,
  expanded,
  onToggle,
  token,
  onUpdate,
  onError,
}: {
  incident: IncidentRow
  expanded: boolean
  onToggle: () => void
  token: string
  onUpdate: (i: IncidentRow) => void
  onError: (e: unknown) => void
}): JSX.Element {
  const [priorityInput, setPriorityInput] = useState("")
  const [rejectReason, setRejectReason] = useState("")
  const [assignee, setAssignee] = useState("user-resp-01")
  const [busy, setBusy] = useState(false)

  const wrap = (fn: () => Promise<{ incident: IncidentRow }>) => {
    setBusy(true)
    fn()
      .then((res) => onUpdate(res.incident))
      .catch(onError)
      .finally(() => setBusy(false))
  }

  const ago = formatTimeAgo(incident.created_at)

  return (
    <div
      data-testid={`incident-row-${incident.id}`}
      className="border-b border-[#334155]/50"
    >
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2 px-4 py-3 text-left transition-colors hover:bg-[#334155]/30"
      >
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-slate-200">{incident.title}</p>
          <p className="mt-0.5 text-[10px] text-slate-600">
            {ago} &middot; {incident.latitude.toFixed(3)}, {incident.longitude.toFixed(3)}
          </p>
        </div>
        <StatusBadge status={incident.status} />
        {incident.priority !== null && (
          <span className="rounded bg-orange-500/15 px-1.5 py-0.5 text-[10px] font-mono font-semibold text-orange-400">
            P{incident.priority}
          </span>
        )}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className={`flex-shrink-0 text-slate-600 transition-transform ${expanded ? "rotate-180" : ""}`}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-[#334155]/30 bg-[#0f172a]/50 px-4 py-3">
          <p className="mb-3 text-xs text-slate-400">{incident.description}</p>

          {incident.status === "PING" && (
            <div className="flex gap-2">
              <button
                data-testid="verify-btn"
                disabled={busy}
                onClick={() => wrap(() => verifyIncident(token, incident.id, incident.version))}
                className="rounded-lg bg-blue-500/15 px-3 py-1.5 text-xs font-medium text-blue-400 transition-colors hover:bg-blue-500/25 disabled:opacity-50"
              >
                Verify
              </button>
              <div className="flex flex-1 gap-1">
                <input
                  type="text"
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  className="flex-1 rounded-lg border border-[#334155] bg-[#0f172a] px-2 py-1 text-xs text-slate-300 placeholder-slate-600 outline-none focus:border-red-500/50"
                  placeholder="Reason..."
                />
                <button
                  disabled={busy || !rejectReason.trim()}
                  onClick={() => wrap(() => rejectIncident(token, incident.id, rejectReason.trim(), incident.version))}
                  className="rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/25 disabled:opacity-50"
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {incident.status === "VERIFIED" && (
            <div className="flex items-center gap-2">
              <input
                data-testid="priority-input"
                type="number"
                min={1}
                max={5}
                value={priorityInput}
                onChange={(e) => setPriorityInput(e.target.value)}
                className="w-16 rounded-lg border border-[#334155] bg-[#0f172a] px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-orange-500/50"
                placeholder="1-5"
              />
              <button
                disabled={busy || !priorityInput}
                onClick={() => wrap(() => prioritizeIncident(token, incident.id, parseInt(priorityInput, 10), incident.version))}
                className="rounded-lg bg-orange-500/15 px-3 py-1.5 text-xs font-medium text-orange-400 transition-colors hover:bg-orange-500/25 disabled:opacity-50"
              >
                Prioritize
              </button>
            </div>
          )}

          {incident.status === "PRIORITIZED" && (
            <div className="flex items-center gap-2">
              <select
                data-testid="assign-select"
                value={assignee}
                onChange={(e) => setAssignee(e.target.value)}
                className="flex-1 rounded-lg border border-[#334155] bg-[#0f172a] px-2 py-1.5 text-xs text-slate-300 outline-none focus:border-purple-500/50"
              >
                <option value="user-resp-01">resp1</option>
              </select>
              <button
                data-testid="assign-btn"
                disabled={busy}
                onClick={() => wrap(() => assignIncident(token, incident.id, assignee, incident.version))}
                className="rounded-lg bg-purple-500/15 px-3 py-1.5 text-xs font-medium text-purple-400 transition-colors hover:bg-purple-500/25 disabled:opacity-50"
              >
                Assign
              </button>
            </div>
          )}

          <div className="mt-2 flex items-center gap-2 text-[10px] text-slate-600">
            <span className="font-mono">v{incident.version}</span>
            <span>&middot;</span>
            <span className="font-mono">{incident.id.slice(0, 8)}</span>
          </div>
        </div>
      )}
    </div>
  )
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}
