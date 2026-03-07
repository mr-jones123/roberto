import { useEffect, useRef, useState } from "react"
import type { IncidentRow, SSEEvent } from "../lib/types"

type UseIncidentStreamResult = {
  incidents: IncidentRow[]
  lastEvent: SSEEvent | null
}

export function useIncidentStream(): UseIncidentStreamResult {
  const [incidents, setIncidents] = useState<IncidentRow[]>([])
  const [lastEvent, setLastEvent] = useState<SSEEvent | null>(null)
  const sourceRef = useRef<EventSource | null>(null)
  const seededRef = useRef(false)

  useEffect(() => {
    if (seededRef.current) return
    seededRef.current = true

    fetch("/api/incidents")
      .then((res) => (res.ok ? (res.json() as Promise<{ incidents: IncidentRow[] }>) : null))
      .then((data) => {
        if (data?.incidents.length) {
          setIncidents((prev) => {
            const existingIds = new Set(prev.map((i) => i.id))
            const newOnes = data.incidents.filter((i) => !existingIds.has(i.id))
            return newOnes.length ? [...prev, ...newOnes] : prev
          })
        }
      })
      .catch(() => {})
  }, [])

  useEffect(() => {
    const source = new EventSource("/api/events")
    sourceRef.current = source

    source.addEventListener("incident_update", (e: MessageEvent) => {
      const event = JSON.parse(e.data as string) as SSEEvent
      setLastEvent(event)

      setIncidents((prev) => {
        const idx = prev.findIndex((inc) => inc.id === event.incident.id)
        if (idx >= 0) {
          const next = [...prev]
          next[idx] = event.incident
          return next
        }
        return [event.incident, ...prev]
      })
    })

    return () => {
      source.close()
      sourceRef.current = null
    }
  }, [])

  return { incidents, lastEvent }
}
