import { useEffect, useState, type JSX } from "react"
import type React from "react"
import { createIncident, fetchCurrentWeather, fetchIncidentNodeGuidance, fetchIncidents, fetchNearestEvacCenters } from "../../lib/api"
import type { EvacCenter, FacilityType, IncidentNodeGuidanceResponse, IncidentRow, PendingConnection, WeatherCurrent } from "../../lib/types"
import { broadcastIncidentUpdate, useIncidentStream } from "../../hooks/useIncidentStream"
import { StatusBadge } from "./StatusBadge"
import { NodePanel } from "../chat/NodePanel"

type RoutePoint = { lat: number; lng: number }

type Props = {
  token: string
  userId: string
  onLogout: () => void
  onSelectFacility: (from: RoutePoint, to: RoutePoint, name: string) => void
  onFocusPing: (lat: number, lng: number) => void
  onUserLocationChange: (lat: number, lng: number) => void
  showFloodContext: boolean
  onToggleFloodContext: () => void
  showWeatherContext: boolean
  onToggleWeatherContext: () => void
  onConnectionsChange?: (connections: PendingConnection[]) => void
}

type LocationAccessState = "idle" | "granted" | "denied" | "unavailable"

const GEMINI_STORAGE_KEY = "roberto-gemini-key"

const NODE_GUIDANCE_CONFIDENCE_STYLES: Record<IncidentNodeGuidanceResponse["confidence_level"], string> = {
  high: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-200",
  low: "border-orange-500/30 bg-orange-500/10 text-orange-200",
  fallback: "border-slate-500/30 bg-slate-500/10 text-slate-300",
}

function confidenceLabelForGuidance(level: IncidentNodeGuidanceResponse["confidence_level"]): string {
  if (level === "high") return "high"
  if (level === "medium") return "medium"
  if (level === "low") return "low"
  return "fallback"
}

export function ReporterPanel({
  token,
  userId,
  onLogout,
  onSelectFacility,
  onFocusPing,
  onUserLocationChange,
  showFloodContext,
  onToggleFloodContext,
  showWeatherContext,
  onToggleWeatherContext,
  onConnectionsChange,
}: Props): JSX.Element {
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [submitting, setSubmitting] = useState(false)
  const [locating, setLocating] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [locationState, setLocationState] = useState<LocationAccessState>("idle")
  const [currentLocation, setCurrentLocation] = useState<RoutePoint | null>(null)
  const [locationAccuracy, setLocationAccuracy] = useState<number | null>(null)
  const [weatherLoading, setWeatherLoading] = useState(false)
  const [weatherError, setWeatherError] = useState<string | null>(null)
  const [weather, setWeather] = useState<WeatherCurrent | null>(null)
  const [myPings, setMyPings] = useState<IncidentRow[]>([])
  const [evacCache, setEvacCache] = useState<Record<string, EvacCenter[]>>({})
  const [showConnect, setShowConnect] = useState(false)

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

  useEffect(() => {
    if (!showWeatherContext || currentLocation === null) {
      setWeatherLoading(false)
      setWeatherError(null)
      return
    }

    let active = true
    setWeatherLoading(true)
    setWeatherError(null)

    fetchCurrentWeather(currentLocation.lat, currentLocation.lng)
      .then((res) => {
        if (!active) return
        setWeather(res)
      })
      .catch((err: unknown) => {
        if (!active) return
        setWeatherError(err instanceof Error ? err.message : "Unable to load weather")
      })
      .finally(() => {
        if (active) {
          setWeatherLoading(false)
        }
      })

    return () => {
      active = false
    }
  }, [showWeatherContext, currentLocation])

  const loadEvac = (incident: IncidentRow) => {
    if (evacCache[incident.id]) return
    fetchNearestEvacCenters(incident.latitude, incident.longitude)
      .then((res) => {
        setEvacCache((prev) => ({ ...prev, [incident.id]: res.centers }))
      })
      .catch(() => {})
  }

  const requestCurrentLocation = async (): Promise<RoutePoint | null> => {
    setFormError(null)

    if (typeof window === "undefined" || !window.navigator.geolocation) {
      setLocationState("unavailable")
      setFormError("Location services are not available on this device")
      return null
    }

    setLocating(true)

    return new Promise((resolve) => {
      window.navigator.geolocation.getCurrentPosition(
        (position) => {
          const next = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          }

          setLocationState("granted")
          setCurrentLocation(next)
          setLocationAccuracy(position.coords.accuracy)
          onUserLocationChange(next.lat, next.lng)
          onFocusPing(next.lat, next.lng)
          setLocating(false)
          resolve(next)
        },
        (error) => {
          setLocating(false)
          if (error.code === error.PERMISSION_DENIED) {
            setLocationState("denied")
            setFormError("Location permission denied. Please allow location access to request help from your current position.")
            resolve(null)
            return
          }

          setLocationState("unavailable")
          setFormError("Unable to get your current location. Please try again in a few seconds.")
          resolve(null)
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 30000,
        },
      )
    })
  }

  const handleWeatherToggle = () => {
    const nextVisible = !showWeatherContext
    onToggleWeatherContext()

    if (nextVisible && currentLocation === null) {
      void requestCurrentLocation()
    }
  }

  const handleSubmit = async (e: React.SyntheticEvent<HTMLFormElement>) => {
    e.preventDefault()
    setFormError(null)

    let targetLocation = currentLocation
    if (!targetLocation) {
      targetLocation = await requestCurrentLocation()
    }

    if (!targetLocation) {
      setFormError("Allow location access to send a ping from your current location")
      return
    }

    setSubmitting(true)
    createIncident(token, {
      title,
      description,
      latitude: targetLocation.lat,
      longitude: targetLocation.lng,
    })
      .then((res) => {
        setMyPings((prev) => [res.incident, ...prev])
        broadcastIncidentUpdate(res.incident, "incident_created")
        setTitle("")
        setDescription("")
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
          <div className="mb-3 rounded-lg border border-[#334155] bg-[#0f172a] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Flood Context
                </p>
                <p className="text-[11px] text-slate-500">
                  Keep this off by default for a cleaner map.
                </p>
              </div>
              <button
                type="button"
                onClick={onToggleFloodContext}
                className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  showFloodContext
                    ? "border-blue-500/40 bg-blue-500/10 text-blue-300"
                    : "border-[#334155] text-slate-400 hover:border-[#475569]"
                }`}
              >
                {showFloodContext ? "Visible" : "Hidden"}
              </button>
            </div>
          </div>
          <div className="mb-3 rounded-lg border border-[#334155] bg-[#0f172a] p-2.5">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Current Weather
                </p>
                <p className="text-[11px] text-slate-500">
                  Show rain and wind near your location.
                </p>
              </div>
              <button
                type="button"
                onClick={handleWeatherToggle}
                className={`rounded-md border px-2 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors ${
                  showWeatherContext
                    ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-300"
                    : "border-[#334155] text-slate-400 hover:border-[#475569]"
                }`}
              >
                {showWeatherContext ? "Visible" : "Hidden"}
              </button>
            </div>
            {showWeatherContext && (
              <div className="mt-2 rounded-md border border-[#334155] bg-[#020617] px-2.5 py-2">
                {currentLocation === null ? (
                  <p className="text-[11px] text-slate-500">Enable location to view current weather.</p>
                ) : weatherLoading ? (
                  <p className="text-[11px] text-slate-400">Loading weather...</p>
                ) : weatherError ? (
                  <p className="text-[11px] text-amber-300">{weatherError}</p>
                ) : weather ? (
                  <>
                    <p className="text-[11px] font-semibold text-slate-200">{weather.current.weather_label}</p>
                    <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-1 text-[10px] text-slate-400">
                      <span>Temp: {weather.current.temperature_c.toFixed(1)} C</span>
                      <span>Feels: {weather.current.feels_like_c.toFixed(1)} C</span>
                      <span>Rain: {weather.current.rain_mm.toFixed(1)} mm</span>
                      <span>Wind: {weather.current.wind_kph.toFixed(1)} kph</span>
                    </div>
                    <p className="mt-1 text-[10px] text-slate-500">
                      Updated {new Date(weather.current.observed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </>
                ) : (
                  <p className="text-[11px] text-slate-500">No weather data yet.</p>
                )}
              </div>
            )}
          </div>
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
            <div className="rounded-lg border border-[#334155] bg-[#0f172a] p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    Current Location
                  </p>
                  <p className="text-[11px] text-slate-500">
                    We only use this when you submit a ping.
                  </p>
                </div>
                <button
                  data-testid="report-use-location"
                  type="button"
                  onClick={() => { void requestCurrentLocation() }}
                  disabled={locating}
                  className="rounded-md border border-[#334155] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300 transition-colors hover:border-[#475569] hover:bg-[#1e293b] disabled:opacity-50"
                >
                  {locating ? "Locating..." : currentLocation ? "Refresh" : "Use My Location"}
                </button>
              </div>
              {currentLocation ? (
                <div className="mt-1.5">
                  <p className="font-mono text-[11px] text-slate-300">
                    {currentLocation.lat.toFixed(6)}, {currentLocation.lng.toFixed(6)}
                  </p>
                  {locationAccuracy != null && (
                    <p className="text-[10px] text-slate-500">Accuracy: {Math.round(locationAccuracy)} m</p>
                  )}
                </div>
              ) : (
                <p className="mt-1.5 text-[11px] text-slate-500">
                  Tap "Use My Location" and allow permission.
                </p>
              )}
              {locationState === "denied" && (
                <p className="mt-1.5 text-[10px] text-amber-300">
                  Location is blocked. Enable location permission in your browser settings.
                </p>
              )}
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
                onSelectFacility={onSelectFacility}
                onFocusPing={onFocusPing}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-[#334155] flex-shrink-0">
        <button
          onClick={() => setShowConnect(v => !v)}
          className="w-full flex items-center justify-between px-3 py-2 text-xs text-slate-400 hover:bg-[#1e293b] transition-colors"
        >
          <span className="font-medium">Connect</span>
          <span>{showConnect ? "\u25B2" : "\u25BC"}</span>
        </button>
        {showConnect && <NodePanel token={token} userId={userId} onConnectionsChange={onConnectionsChange} />}
      </div>
    </div>
  )
}

function PingCard({
  ping,
  evacCenters,
  onExpand,
  onSelectFacility,
  onFocusPing,
}: {
  ping: IncidentRow
  evacCenters: EvacCenter[] | undefined
  onExpand: () => void
  onSelectFacility: (from: RoutePoint, to: RoutePoint, name: string) => void
  onFocusPing: (lat: number, lng: number) => void
}): JSX.Element {
  const [expanded, setExpanded] = useState(false)
  const [selectedFacilityId, setSelectedFacilityId] = useState<string | null>(null)
  const [guidance, setGuidance] = useState<IncidentNodeGuidanceResponse | null>(null)
  const [loadingGuidance, setLoadingGuidance] = useState(false)
  const [guidanceError, setGuidanceError] = useState<string | null>(null)

  useEffect(() => {
    if (!expanded || guidance) return

    let cancelled = false
    const apiKey = localStorage.getItem(GEMINI_STORAGE_KEY) ?? ""
    setLoadingGuidance(true)
    setGuidanceError(null)

    fetchIncidentNodeGuidance(
      {
        latitude: ping.latitude,
        longitude: ping.longitude,
        incident: {
          title: ping.title,
          status: ping.status,
          priority: ping.priority,
          description: ping.description?.trim() ? ping.description : null,
        },
      },
      apiKey,
    )
      .then((result) => {
        if (cancelled) return
        setGuidance(result)
      })
      .catch(() => {
        if (cancelled) return
        setGuidanceError("Guidance unavailable right now. Showing conservative fallback.")
      })
      .finally(() => {
        if (cancelled) return
        setLoadingGuidance(false)
      })

    return () => {
      cancelled = true
    }
  }, [expanded, guidance, ping.latitude, ping.longitude, ping.title, ping.status, ping.priority, ping.description])

  const fallbackSections = {
    what_this_means: `${ping.title} (${ping.status}) was reported in this area. Keep a conservative flood safety posture while monitoring updates.`,
    what_you_can_do_now: [
      "Identify your nearest safe route and evacuation center now.",
      "Prepare essential items (documents, medicine, phone power) in one grab bag.",
      "Follow PAGASA and LGU advisories for official warnings and evacuation orders.",
    ],
  }

  const sections = guidance?.guidance ?? fallbackSections
  const confidenceLevel = guidance?.confidence_level ?? "fallback"
  const sourceLabel = guidance?.source === "ai" ? "AI-assisted" : "Preparedness fallback"
  const cityLabel = guidance?.context.city ?? "Unknown area"
  const hazardLabel = guidance?.context.hazard.label ?? "-"
  const weatherLabel = guidance?.context.weather
    ? `${guidance.context.weather.weather_label} ${guidance.context.weather.temperature_c.toFixed(1)}°C`
    : "Weather unavailable"

  const toggle = () => {
    if (!expanded) {
      onExpand()
      onFocusPing(ping.latitude, ping.longitude)
    }
    setExpanded((v) => !v)
  }

  return (
    <div className="w-full rounded-lg border border-[#334155]/50 bg-[#0f172a] p-3 text-left transition-colors hover:border-[#334155]">
      <button type="button" onClick={toggle} className="w-full text-left">
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
      </button>

      {expanded && (
        <div className="mt-2 border-t border-[#334155]/50 pt-2">
          <p className="text-xs text-slate-400">{ping.description}</p>
          {evacCenters && evacCenters.length > 0 && (
            <div className="mt-2">
              <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                Critical Facilities Near You
              </p>
              <div className="space-y-1.5">
                {evacCenters.map((c) => {
                  const isSelected = c.id === selectedFacilityId

                  return (
                    <div
                      key={c.id}
                      className={`w-full rounded-md border px-2.5 py-2 text-left transition-colors ${
                        isSelected
                          ? "border-blue-500/50 bg-blue-500/10"
                          : "border-[#334155] bg-[#1e293b]/30 hover:border-[#475569] hover:bg-[#1e293b]/60"
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          setSelectedFacilityId(c.id)
                          onSelectFacility(
                            { lat: ping.latitude, lng: ping.longitude },
                            { lat: c.latitude, lng: c.longitude },
                            c.name,
                          )
                        }}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="min-w-0 flex items-center gap-2">
                            <span className="text-sm leading-none">{getFacilityEmoji(c.type)}</span>
                            <span className="truncate text-[11px] text-slate-300">{c.name}</span>
                          </div>
                          <span className="ml-2 flex-shrink-0 text-[10px] font-mono text-slate-500">
                            {c.distance_km.toFixed(1)} km
                          </span>
                        </div>
                      </button>

                      <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-slate-400">
                        {c.phone && (
                          <a
                            href={toTelHref(c.phone)}
                            onClick={(e) => e.stopPropagation()}
                            className="underline decoration-slate-500/70 underline-offset-2 hover:text-slate-200"
                          >
                            📱 {c.phone}
                          </a>
                        )}
                        {c.landline && (
                          <a
                            href={toTelHref(c.landline)}
                            onClick={(e) => e.stopPropagation()}
                            className="underline decoration-slate-500/70 underline-offset-2 hover:text-slate-200"
                          >
                            ☎ {c.landline}
                          </a>
                        )}
                      </div>

                      {isSelected && (
                        <span className="mt-1 inline-flex rounded-full border border-blue-400/30 bg-blue-500/10 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wider text-blue-300">
                          🚶 Walking route
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          <div className="mt-2 rounded-md border border-[#334155] bg-[#020617] px-2.5 py-2">
            <p className="text-[10px] uppercase tracking-wider text-slate-500">
              {weatherLabel} · Flood {hazardLabel} · {cityLabel}
            </p>
          </div>

          <div className="mt-2 rounded-md border border-[#334155] bg-[#020617] px-2.5 py-2">
            {loadingGuidance && (
              <p className="text-[11px] text-slate-400">Analyzing local flood context...</p>
            )}
            {guidanceError && (
              <p className="mb-2 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-[11px] text-red-300">
                {guidanceError}
              </p>
            )}
            {!loadingGuidance && (
              <>
                <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[10px]">
                  <span className="rounded border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-blue-300">
                    {sourceLabel}
                  </span>
                  <span className={`rounded border px-1.5 py-0.5 ${NODE_GUIDANCE_CONFIDENCE_STYLES[confidenceLevel]}`}>
                    Confidence {confidenceLabelForGuidance(confidenceLevel)}
                  </span>
                </div>

                <div className="mb-2">
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">What this means</div>
                  <p className="mt-0.5 text-[11px] leading-relaxed text-slate-200">{sections.what_this_means}</p>
                </div>

                <div>
                  <div className="text-[10px] uppercase tracking-wider text-slate-500">What you can do now</div>
                  <ul className="mt-0.5 list-disc space-y-0.5 pl-4 text-[11px] leading-relaxed text-slate-200">
                    {sections.what_you_can_do_now.map((item) => (
                      <li key={item}>{item}</li>
                    ))}
                  </ul>
                </div>

                {guidance?.gated && (
                  <p className="mt-2 rounded border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] text-amber-200">
                    AI is unavailable or low-confidence for this node, so fallback guidance is shown.
                  </p>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function getFacilityEmoji(type: FacilityType): string {
  if (type === "hospital") return "🏥"
  if (type === "school") return "🏫"
  if (type === "fire_station") return "🚒"
  if (type === "police_station") return "🚔"
  return "🏛"
}

function toTelHref(value: string): string {
  const normalized = value.replace(/[^\d+]/g, "")
  return `tel:${normalized}`
}
