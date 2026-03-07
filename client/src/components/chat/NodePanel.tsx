import { useState, useEffect, useMemo } from "react"
import { useChatStream } from "../../hooks/useChatStream"
import {
  registerNode, fetchNearbyNodes, createInvite,
  respondToInvite, cancelInvite, sendMessage
} from "../../lib/api"
import type { HelpNodeRow, ConversationRow, PendingConnection } from "../../lib/types"

type Tab = "node" | "nearby" | "invites" | "chat"

type NodePanelProps = {
  token: string
  userId: string
  onConnectionsChange?: (connections: PendingConnection[]) => void
}

export function NodePanel({ token, userId, onConnectionsChange }: NodePanelProps) {
  const [tab, setTab] = useState<Tab>("node")
  const [myNode, setMyNode] = useState<HelpNodeRow | null>(null)
  const [nearbyNodes, setNearbyNodes] = useState<HelpNodeRow[]>([])
  const [selectedConv, setSelectedConv] = useState<ConversationRow | null>(null)
  const [msgInput, setMsgInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)
  const { invites, conversations, messages, addMessage } = useChatStream(token)

  useEffect(() => {
    registerNode(token, { latitude: 14.5995, longitude: 120.9842 })
      .then(r => setMyNode(r.node))
      .catch(() => {})
  }, [token])

  const pendingConnections = useMemo(() => {
    if (!myNode) return []
    const allNodes = [myNode, ...nearbyNodes]
    return invites
      .filter(inv => inv.status === "pending")
      .map(inv => {
        const sender = allNodes.find(n => n.id === inv.sender_node_id)
        const recipient = allNodes.find(n => n.id === inv.recipient_node_id)
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

  const findNearby = () => {
    if (!myNode) return
    fetchNearbyNodes(token, myNode.latitude, myNode.longitude, 5)
      .then(r => setNearbyNodes(r.nodes.filter(n => n.id !== myNode.id)))
      .catch(() => {})
  }

  const sendInvite = (nodeId: string) => {
    setBusy(true)
    createInvite(token, nodeId)
      .then(() => { setNotice("Invite sent!"); setTimeout(() => setNotice(null), 2000) })
      .catch(e => setNotice(e.message))
      .finally(() => setBusy(false))
  }

  const respond = (id: string, action: "accepted" | "rejected", version: number) => {
    respondToInvite(token, id, action, version)
      .then(r => {
        if (action === "accepted" && r.conversation) {
          setSelectedConv(r.conversation)
          setTab("chat")
        }
      })
      .catch(e => setNotice(e.message))
  }

  const cancel = (id: string, version: number) => {
    cancelInvite(token, id, version).catch(e => setNotice(e.message))
  }

  const send = () => {
    if (!selectedConv || !msgInput.trim()) return
    const body = msgInput.trim()
    setMsgInput("")
    sendMessage(token, selectedConv.id, crypto.randomUUID(), body)
      .then((r) => addMessage(selectedConv.id, r.message))
      .catch(() => {})
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: "node", label: "Node" },
    { key: "nearby", label: "Nearby" },
    { key: "invites", label: `Invites${invites.length ? ` (${invites.length})` : ""}` },
    { key: "chat", label: "Chat" },
  ]

  const statusBadge = (status: string) => {
    const cls: Record<string, string> = {
      pending: "bg-yellow-500/20 text-yellow-400",
      accepted: "bg-green-500/20 text-green-400",
      rejected: "bg-red-500/20 text-red-400",
      cancelled: "bg-slate-500/20 text-slate-400",
      expired: "bg-slate-500/20 text-slate-400",
    }
    return <span className={`text-xs px-1.5 py-0.5 rounded ${cls[status] ?? ""}`}>{status}</span>
  }

  return (
    <div className="flex flex-col text-xs text-slate-300">
      {notice && <div className="bg-blue-600/20 text-blue-300 px-2 py-1 text-xs">{notice}</div>}

      {/* Tabs */}
      <div className="flex border-b border-[#334155]">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-1.5 text-xs font-medium transition-colors ${
              tab === t.key
                ? "border-b-2 border-blue-500 text-blue-400"
                : "text-slate-500 hover:text-slate-300"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-2 overflow-y-auto max-h-64">
        {/* Node Tab */}
        {tab === "node" && (
          <div>
            {myNode ? (
              <div className="bg-[#1e293b] rounded p-2">
                <div className="text-green-400 font-medium mb-1">● Node Active</div>
                <div className="text-slate-500">Lat: {myNode.latitude.toFixed(4)}</div>
                <div className="text-slate-500">Lng: {myNode.longitude.toFixed(4)}</div>
                <div className="text-slate-500 mt-1">ID: {myNode.id.slice(0, 8)}...</div>
              </div>
            ) : (
              <div className="text-slate-500">Registering node...</div>
            )}
          </div>
        )}

        {/* Nearby Tab */}
        {tab === "nearby" && (
          <div>
            <button
              onClick={findNearby}
              disabled={!myNode}
              className="w-full bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs px-2 py-1.5 rounded mb-2"
            >
              Find Nearby Nodes
            </button>
            {nearbyNodes.length === 0 && <div className="text-slate-500">No nearby nodes found.</div>}
            {nearbyNodes.map(n => (
              <div key={n.id} className="bg-[#1e293b] rounded p-2 mb-1 flex items-center justify-between">
                <span className="text-slate-400">{n.id.slice(0, 8)}...</span>
                <button
                  onClick={() => sendInvite(n.id)}
                  disabled={busy}
                  className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs px-2 py-1 rounded"
                >
                  Invite
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Invites Tab */}
        {tab === "invites" && (
          <div>
            {invites.length === 0 && <div className="text-slate-500">No invites yet.</div>}
            {invites.map(inv => {
              const isSender = inv.sender_node_id === myNode?.id
              return (
                <div key={inv.id} className="bg-[#1e293b] rounded p-2 mb-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-slate-500">{isSender ? "-> Sent" : "<- Received"}</span>
                    {statusBadge(inv.status)}
                  </div>
                  <div className="flex gap-1 mt-1">
                    {!isSender && inv.status === "pending" && (
                      <>
                        <button onClick={() => respond(inv.id, "accepted", inv.version)} className="bg-green-600 hover:bg-green-700 text-white text-xs px-2 py-0.5 rounded">Accept</button>
                        <button onClick={() => respond(inv.id, "rejected", inv.version)} className="bg-red-600 hover:bg-red-700 text-white text-xs px-2 py-0.5 rounded">Reject</button>
                      </>
                    )}
                    {isSender && inv.status === "pending" && (
                      <button onClick={() => cancel(inv.id, inv.version)} className="border border-[#334155] text-slate-400 hover:bg-[#334155] text-xs px-2 py-0.5 rounded">Cancel</button>
                    )}
                    {inv.status === "accepted" && (
                      <button
                        onClick={() => {
                          const conv = conversations.find(c => c.invite_id === inv.id)
                          if (conv) { setSelectedConv(conv); setTab("chat") }
                        }}
                        className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-0.5 rounded"
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

        {/* Chat Tab */}
        {tab === "chat" && (
          <div className="flex flex-col gap-1">
            {!selectedConv && <div className="text-slate-500">Accept an invite to start chatting.</div>}
            {selectedConv && (
              <>
                <div className="text-slate-500 mb-1">Conv: {selectedConv.id.slice(0, 8)}...</div>
                <div className="flex flex-col gap-0.5 max-h-40 overflow-y-auto">
                  {[...(messages[selectedConv.id] ?? [])].reverse().map(m => (
                    <div key={m.id} className={`rounded px-2 py-1 text-xs ${m.sender_id === userId ? "bg-blue-600/30 text-blue-200 self-end" : "bg-[#1e293b] text-slate-300"}`}>
                      {m.body}
                    </div>
                  ))}
                </div>
                <div className="flex gap-1 mt-1">
                  <input
                    value={msgInput}
                    onChange={e => setMsgInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && send()}
                    placeholder="Type a message..."
                    className="flex-1 bg-[#1e293b] border border-[#334155] rounded px-2 py-1 text-xs text-slate-200 placeholder-slate-600 outline-none"
                  />
                  <button onClick={send} className="bg-blue-600 hover:bg-blue-700 text-white text-xs px-2 py-1 rounded">Send</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
