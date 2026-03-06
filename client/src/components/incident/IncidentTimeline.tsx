import { useEffect, useState, type JSX } from "react"
import { fetchIncidentEvents } from "../../lib/api"
import type { IncidentEventRow } from "../../lib/types"
import { StatusBadge } from "./StatusBadge"

type Props = {
  token: string
  incidentId: string
}

function formatTimeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const mins = Math.floor(diff / 60_000)
  if (mins < 1) return "just now"
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  return `${Math.floor(hrs / 24)}d ago`
}

function formatAbsolute(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleString("en-PH", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  })
}

function actionLabel(ev: IncidentEventRow): string {
  if (ev.action === "created") return "Incident created"
  if (ev.action === "transition" && ev.new_status) {
    return `Transitioned to ${ev.new_status}`
  }
  return ev.action
}

export function IncidentTimeline({ token, incidentId }: Props): JSX.Element {
  const [events, setEvents] = useState<IncidentEventRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    fetchIncidentEvents(token, incidentId)
      .then((res) => setEvents(res.events))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [token, incidentId])

  if (loading) {
    return <p className="px-4 py-2 text-[10px] text-slate-600">Loading timeline...</p>
  }

  if (events.length === 0) {
    return <p className="px-4 py-2 text-[10px] text-slate-600">No events recorded.</p>
  }

  return (
    <div className="relative ml-4 border-l border-[#334155]/60 pl-4">
      {events.map((ev) => (
        <div key={ev.id} className="relative pb-3 last:pb-0">
          <div className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full border-2 border-[#334155] bg-slate-500" />
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <p className="text-xs text-slate-300">{actionLabel(ev)}</p>
              {ev.old_status && ev.new_status && (
                <div className="mt-0.5 flex items-center gap-1">
                  <StatusBadge status={ev.old_status} />
                  <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-600">
                    <polyline points="9 18 15 12 9 6" />
                  </svg>
                  <StatusBadge status={ev.new_status} />
                </div>
              )}
              <p className="mt-0.5 text-[10px] text-slate-600">
                {formatTimeAgo(ev.created_at)} &middot; {formatAbsolute(ev.created_at)}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
