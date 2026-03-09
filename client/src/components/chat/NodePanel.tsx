import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { useChatStream } from "../../hooks/useChatStream"
import {
  cancelInvite,
  createInvite,
  fetchNearbyNodes,
  registerNode,
  respondToInvite,
  searchAddresses,
  sendMessage,
} from "../../lib/api"
import type { AddressSearchResult, ConversationRow, HelpNodeRow, PendingConnection } from "../../lib/types"

type Tab = "node" | "nearby" | "invites" | "chat"

type NodePanelProps = {
  token: string
  userId: string
  initialLocation?: { lat: number; lng: number } | null
  onConnectionsChange?: (connections: PendingConnection[]) => void
}

export function NodePanel({ token, userId, initialLocation, onConnectionsChange }: NodePanelProps) {
  const [tab, setTab] = useState<Tab>("node")
  const [myNode, setMyNode] = useState<HelpNodeRow | null>(null)
  const autoRegistered = useRef(false)
  const [nearbyNodes, setNearbyNodes] = useState<HelpNodeRow[]>([])
  const [selectedConv, setSelectedConv] = useState<ConversationRow | null>(null)
  const [msgInput, setMsgInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const [addressQuery, setAddressQuery] = useState("")
  const [addressResults, setAddressResults] = useState<AddressSearchResult[]>([])
  const [addressLoading, setAddressLoading] = useState(false)
  const [addressError, setAddressError] = useState<string | null>(null)
  const [addressSearchAttempted, setAddressSearchAttempted] = useState(false)
  const [selectedAddress, setSelectedAddress] = useState<AddressSearchResult | null>(null)
  const [locationSubmitting, setLocationSubmitting] = useState(false)
  const [locatingCurrent, setLocatingCurrent] = useState(false)
  const { invites, conversations, messages, addMessage } = useChatStream(token)

  // Auto-register node from reporter's existing ping location
  const autoRegister = useCallback(
    (lat: number, lng: number) => {
      setLocationSubmitting(true)
      registerNode(token, { latitude: lat, longitude: lng })
        .then((response) => {
          setMyNode(response.node)
          setTab("nearby")
        })
        .catch(() => {
          // Silently fall back to manual — user can still set location manually
        })
        .finally(() => {
          setLocationSubmitting(false)
        })
    },
    [token],
  )

  useEffect(() => {
    if (autoRegistered.current || myNode) return
    if (!initialLocation) return
    autoRegistered.current = true
    autoRegister(initialLocation.lat, initialLocation.lng)
  }, [initialLocation, myNode, autoRegister])

  useEffect(() => {
    const query = addressQuery.trim()

    if (query.length < 3) {
      setAddressResults([])
      setAddressError(null)
      setAddressLoading(false)
      setAddressSearchAttempted(false)
      return
    }

    const controller = new AbortController()
    const timeoutId = setTimeout(() => {
      setAddressLoading(true)
      setAddressError(null)

      searchAddresses(query, {
        limit: 5,
        proximity: myNode ? { lat: myNode.latitude, lng: myNode.longitude } : null,
        signal: controller.signal,
      })
        .then((res) => {
          if (controller.signal.aborted) return
          setAddressResults(res.features)
          setAddressSearchAttempted(true)
        })
        .catch((err: unknown) => {
          if (controller.signal.aborted) return
          setAddressResults([])
          setAddressSearchAttempted(true)
          setAddressError(err instanceof Error ? err.message : "Failed to search addresses")
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setAddressLoading(false)
          }
        })
    }, 350)

    return () => {
      clearTimeout(timeoutId)
      controller.abort()
    }
  }, [addressQuery, myNode])

  const pendingConnections = useMemo(() => {
    if (!myNode) return []
    const allNodes = [myNode, ...nearbyNodes]
    return invites
      .filter((inv) => inv.status === "pending")
      .map((inv) => {
        const sender = allNodes.find((n) => n.id === inv.sender_node_id)
        const recipient = allNodes.find((n) => n.id === inv.recipient_node_id)
        if (sender && recipient) {
          return {
            from: [sender.longitude, sender.latitude] as [number, number],
            to: [recipient.longitude, recipient.latitude] as [number, number],
          }
        }
        return null
      })
      .filter((c): c is PendingConnection => c !== null)
  }, [invites, myNode, nearbyNodes])

  useEffect(() => {
    onConnectionsChange?.(pendingConnections)
  }, [pendingConnections, onConnectionsChange])

  const updateNodeLocation = (latitude: number, longitude: number) => {
    const hadNode = myNode !== null
    setLocationSubmitting(true)
    setNotice(null)

    registerNode(token, { latitude, longitude })
      .then((response) => {
        setMyNode(response.node)
        setNotice(hadNode ? "Node location updated." : "Node location set.")
      })
      .catch((err: unknown) => {
        setNotice(err instanceof Error ? err.message : "Failed to set node location")
      })
      .finally(() => {
        setLocationSubmitting(false)
      })
  }

  const useCurrentLocationForNode = () => {
    if (typeof window === "undefined" || !window.navigator.geolocation) {
      setNotice("Location services are unavailable on this device")
      return
    }

    setLocatingCurrent(true)
    window.navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocatingCurrent(false)
        setSelectedAddress(null)
        updateNodeLocation(position.coords.latitude, position.coords.longitude)
      },
      () => {
        setLocatingCurrent(false)
        setNotice("Unable to get your location. Try address search instead.")
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 30000,
      },
    )
  }

  const findNearby = () => {
    if (!myNode) {
      setNotice("Set your node location first.")
      return
    }

    fetchNearbyNodes(token, myNode.latitude, myNode.longitude, 5)
      .then((response) => setNearbyNodes(response.nodes.filter((node) => node.id !== myNode.id)))
      .catch((err: unknown) => setNotice(err instanceof Error ? err.message : "Failed to load nearby nodes"))
  }

  const sendInvite = (nodeId: string) => {
    setBusy(true)
    createInvite(token, nodeId)
      .then(() => {
        setNotice("Invite sent!")
        setTimeout(() => setNotice(null), 2000)
      })
      .catch((err: unknown) => setNotice(err instanceof Error ? err.message : "Failed to send invite"))
      .finally(() => setBusy(false))
  }

  const respond = (id: string, action: "accepted" | "rejected", version: number) => {
    respondToInvite(token, id, action, version)
      .then((response) => {
        if (action === "accepted" && response.conversation) {
          setSelectedConv(response.conversation)
          setTab("chat")
        }
      })
      .catch((err: unknown) => setNotice(err instanceof Error ? err.message : "Failed to respond to invite"))
  }

  const cancel = (id: string, version: number) => {
    cancelInvite(token, id, version)
      .catch((err: unknown) => setNotice(err instanceof Error ? err.message : "Failed to cancel invite"))
  }

  const send = () => {
    if (!selectedConv || !msgInput.trim()) return
    const body = msgInput.trim()
    setMsgInput("")
    sendMessage(token, selectedConv.id, crypto.randomUUID(), body)
      .then((response) => addMessage(selectedConv.id, response.message))
      .catch(() => {})
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "node", label: "Node" },
    { key: "nearby", label: "Nearby" },
    { key: "invites", label: `Invites${invites.length ? ` (${invites.length})` : ""}` },
    { key: "chat", label: "Chat" },
  ]

  const statusBadge = (status: string) => {
    const classes: Record<string, string> = {
      pending: "bg-yellow-500/20 text-yellow-400",
      accepted: "bg-green-500/20 text-green-400",
      rejected: "bg-red-500/20 text-red-400",
      cancelled: "bg-slate-500/20 text-slate-400",
      expired: "bg-slate-500/20 text-slate-400",
    }

    return <span className={`rounded px-1.5 py-0.5 text-xs ${classes[status] ?? ""}`}>{status}</span>
  }

  return (
    <div className="flex flex-col text-xs text-slate-300">
      {notice && <div className="bg-blue-600/20 px-2 py-1 text-xs text-blue-300">{notice}</div>}

      <div className="flex border-b border-[#334155]">
        {tabs.map((entry) => (
          <button
            key={entry.key}
            onClick={() => setTab(entry.key)}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
              tab === entry.key
                ? "border-b-2 border-blue-500 text-blue-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {entry.label}
          </button>
        ))}
      </div>

      <div className="max-h-64 overflow-y-auto p-2">
        {tab === "node" && (
          <div className="space-y-2">
            {myNode ? (
              <div className="rounded bg-[#1e293b] p-2">
                <div className="mb-1 font-medium text-green-400">● Node Active</div>
                <div className="text-slate-500">Lat: {myNode.latitude.toFixed(4)}</div>
                <div className="text-slate-500">Lng: {myNode.longitude.toFixed(4)}</div>
                <div className="mt-1 text-slate-500">ID: {myNode.id.slice(0, 8)}...</div>
              </div>
            ) : (
              <div className="rounded border border-[#334155] bg-[#1e293b]/40 p-2 text-slate-500">
                Set your node location to enable nearby search and invites.
              </div>
            )}

            <div className="rounded border border-[#334155] bg-[#0f172a] p-2">
              <p className="text-[11px] font-semibold text-slate-300">Set Node Location</p>
              <p className="mt-0.5 text-[10px] text-slate-500">Search an address or use your current location.</p>

              <input
                data-testid="node-address-search"
                type="text"
                value={addressQuery}
                onChange={(event) => setAddressQuery(event.target.value)}
                placeholder="Search street, barangay, city"
                className="mt-1.5 w-full rounded border border-[#334155] bg-[#020617] px-2 py-1.5 text-xs text-slate-200 placeholder-slate-600 outline-none focus:border-blue-500/50"
              />

              {addressLoading && (
                <p className="mt-1 text-[10px] text-slate-400">Searching addresses...</p>
              )}

              {addressError && (
                <p className="mt-1 rounded bg-red-500/10 px-2 py-1 text-[10px] text-red-300">{addressError}</p>
              )}

              {!addressLoading && !addressError && addressQuery.trim().length >= 3 && addressSearchAttempted && addressResults.length === 0 && (
                <p className="mt-1 text-[10px] text-slate-500">No matching addresses found.</p>
              )}

              {addressResults.length > 0 && (
                <div className="mt-1.5 max-h-28 space-y-1 overflow-y-auto">
                  {addressResults.map((result) => {
                    const isSelected = selectedAddress?.id === result.id
                    return (
                      <button
                        key={result.id}
                        data-testid="node-address-option"
                        type="button"
                        onClick={() => setSelectedAddress(result)}
                        className={`w-full rounded border px-2 py-1.5 text-left text-[11px] transition-colors ${
                          isSelected
                            ? "border-blue-500/50 bg-blue-500/10 text-blue-200"
                            : "border-[#334155] bg-[#020617] text-slate-300 hover:border-[#475569] hover:bg-[#1e293b]"
                        }`}
                      >
                        <p className="truncate font-medium">{result.name}</p>
                        <p className="mt-0.5 truncate text-[10px] text-slate-500">{result.place_name}</p>
                      </button>
                    )
                  })}
                </div>
              )}

              {selectedAddress && (
                <p className="mt-1 text-[10px] text-blue-300">Selected: {selectedAddress.place_name}</p>
              )}

              <div className="mt-2 flex gap-1.5">
                <button
                  type="button"
                  onClick={useCurrentLocationForNode}
                  disabled={locatingCurrent || locationSubmitting}
                  className="flex-1 rounded border border-[#334155] px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-slate-300 transition-colors hover:border-[#475569] hover:bg-[#1e293b] disabled:opacity-50"
                >
                  {locatingCurrent ? "Locating..." : "Use My Location"}
                </button>

                <button
                  data-testid="node-set-address"
                  type="button"
                  disabled={!selectedAddress || locationSubmitting}
                  onClick={() => {
                    if (!selectedAddress) return
                    updateNodeLocation(selectedAddress.latitude, selectedAddress.longitude)
                  }}
                  className="flex-1 rounded bg-blue-600 px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
                >
                  {locationSubmitting
                    ? "Saving..."
                    : myNode
                      ? "Update Address"
                      : "Activate Address"}
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === "nearby" && (
          <div>
            <button
              onClick={findNearby}
              disabled={!myNode}
              className="mb-2 w-full rounded bg-blue-600 px-2 py-1.5 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
            >
              Find Nearby Nodes
            </button>
            {!myNode && <div className="text-slate-500">Set your node location in the Node tab first.</div>}
            {myNode && nearbyNodes.length === 0 && <div className="text-slate-500">No nearby nodes found.</div>}
            {nearbyNodes.map((node) => (
              <div key={node.id} className="mb-1 flex items-center justify-between rounded bg-[#1e293b] p-2">
                <span className="text-slate-400">{node.id.slice(0, 8)}...</span>
                <button
                  onClick={() => sendInvite(node.id)}
                  disabled={busy}
                  className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  Invite
                </button>
              </div>
            ))}
          </div>
        )}

        {tab === "invites" && (
          <div>
            {invites.length === 0 && <div className="text-slate-500">No invites yet.</div>}
            {invites.map((invite) => {
              const isSender = invite.sender_node_id === myNode?.id
              return (
                <div key={invite.id} className="mb-1 rounded bg-[#1e293b] p-2">
                  <div className="mb-1 flex items-center justify-between">
                    <span className="text-slate-500">{isSender ? "-> Sent" : "<- Received"}</span>
                    {statusBadge(invite.status)}
                  </div>
                  <div className="mt-1 flex gap-1">
                    {!isSender && invite.status === "pending" && (
                      <>
                        <button
                          onClick={() => respond(invite.id, "accepted", invite.version)}
                          className="rounded bg-green-600 px-2 py-0.5 text-xs text-white hover:bg-green-700"
                        >
                          Accept
                        </button>
                        <button
                          onClick={() => respond(invite.id, "rejected", invite.version)}
                          className="rounded bg-red-600 px-2 py-0.5 text-xs text-white hover:bg-red-700"
                        >
                          Reject
                        </button>
                      </>
                    )}
                    {isSender && invite.status === "pending" && (
                      <button
                        onClick={() => cancel(invite.id, invite.version)}
                        className="rounded border border-[#334155] px-2 py-0.5 text-xs text-slate-400 hover:bg-[#334155]"
                      >
                        Cancel
                      </button>
                    )}
                    {invite.status === "accepted" && (
                      <button
                        onClick={() => {
                          const conversation = conversations.find((entry) => entry.invite_id === invite.id)
                          if (conversation) {
                            setSelectedConv(conversation)
                            setTab("chat")
                          }
                        }}
                        className="rounded bg-blue-600 px-2 py-0.5 text-xs text-white hover:bg-blue-700"
                      >
                        Chat
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {tab === "chat" && (
          <div className="flex flex-col gap-1">
            {!selectedConv && <div className="text-slate-500">Accept an invite to start chatting.</div>}
            {selectedConv && (
              <>
                <div className="mb-1 text-slate-500">Conv: {selectedConv.id.slice(0, 8)}...</div>
                <div className="flex max-h-40 flex-col gap-0.5 overflow-y-auto">
                  {[...(messages[selectedConv.id] ?? [])].reverse().map((message) => (
                    <div
                      key={message.id}
                      className={`rounded px-2 py-1 text-xs ${
                        message.sender_id === userId
                          ? "self-end bg-blue-600/30 text-blue-200"
                          : "bg-[#1e293b] text-slate-300"
                      }`}
                    >
                      {message.body}
                    </div>
                  ))}
                </div>
                <div className="mt-1 flex gap-1">
                  <input
                    value={msgInput}
                    onChange={(event) => setMsgInput(event.target.value)}
                    onKeyDown={(event) => event.key === "Enter" && send()}
                    placeholder="Type a message..."
                    className="flex-1 rounded border border-[#334155] bg-[#1e293b] px-2 py-1 text-xs text-slate-200 placeholder-slate-600 outline-none"
                  />
                  <button onClick={send} className="rounded bg-blue-600 px-2 py-1 text-xs text-white hover:bg-blue-700">
                    Send
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
