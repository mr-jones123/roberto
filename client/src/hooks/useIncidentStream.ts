import { useEffect, useRef, useState } from "react"
import type { IncidentRow, SSEEvent } from "../lib/types"

type UseIncidentStreamResult = {
  incidents: IncidentRow[]
  lastEvent: SSEEvent | null
}

type LocalIncidentUpdateDetail = {
  incident: IncidentRow
  type: "incident_created" | "incident_updated"
}

const LOCAL_INCIDENT_EVENT = "incident-local-update"

function upsertIncident(list: IncidentRow[], incident: IncidentRow): IncidentRow[] {
  const idx = list.findIndex((row) => row.id === incident.id)
  if (idx >= 0) {
    const next = [...list]
    next[idx] = incident
    return next
  }
  return [incident, ...list]
}

function mergeIncidentLists(list: IncidentRow[], incoming: IncidentRow[]): IncidentRow[] {
  let next = list
  for (const incident of incoming) {
    next = upsertIncident(next, incident)
  }
  return next
}

function fetchIncidentSnapshot(
  setIncidents: React.Dispatch<React.SetStateAction<IncidentRow[]>>,
): void {
  fetch("/api/incidents")
    .then((res) => (res.ok ? (res.json() as Promise<{ incidents: IncidentRow[] }>) : null))
    .then((data) => {
      if (!data?.incidents) return
      setIncidents((prev) => mergeIncidentLists(prev, data.incidents))
    })
    .catch(() => {})
}

export function broadcastIncidentUpdate(
  incident: IncidentRow,
  type: "incident_created" | "incident_updated" = "incident_updated",
): void {
  if (typeof window === "undefined") return
  window.dispatchEvent(
    new CustomEvent<LocalIncidentUpdateDetail>(LOCAL_INCIDENT_EVENT, {
      detail: { incident, type },
    }),
  )
}

export function useIncidentStream(): UseIncidentStreamResult {
  const [incidents, setIncidents] = useState<IncidentRow[]>([])
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null)
  const sourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    fetchIncidentSnapshot(setIncidents)

    const poll = setInterval(() => {
      fetchIncidentSnapshot(setIncidents)
    }, 10000)

    return () => {
      clearInterval(poll)
    }
  }, [])

  useEffect(() => {
    const source = new EventSource("/api/events")
    sourceRef.current = source

    const onIncidentUpdate = (e: MessageEvent) => {
      const event = JSON.parse(e.data as string) as SSEEvent
      if (event.type === "incident_created" || event.type === "incident_updated") {
        setLastEvent(event)
        setIncidents((prev) => upsertIncident(prev, event.incident))
      }
    }

    const onError = () => {
      fetchIncidentSnapshot(setIncidents)
    }

    source.addEventListener("incident_update", onIncidentUpdate)
    source.addEventListener("error", onError)

    return () => {
      source.removeEventListener("incident_update", onIncidentUpdate)
      source.removeEventListener("error", onError)
      source.close()
      sourceRef.current = null
    }
  }, [])

  useEffect(() => {
    const onLocalIncidentUpdate = (evt: Event) => {
      const event = evt as CustomEvent<LocalIncidentUpdateDetail>
      const detail = event.detail
      if (!detail) return

      const sseEvent: SSEEvent = { type: detail.type, incident: detail.incident }
      setLastEvent(sseEvent)
      setIncidents((prev) => upsertIncident(prev, detail.incident))
    }

    const onFocus = () => {
      fetchIncidentSnapshot(setIncidents)
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        fetchIncidentSnapshot(setIncidents)
      }
    }

    window.addEventListener(LOCAL_INCIDENT_EVENT, onLocalIncidentUpdate as EventListener)
    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      window.removeEventListener(LOCAL_INCIDENT_EVENT, onLocalIncidentUpdate as EventListener)
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [])

  return { incidents, lastEvent }
}
