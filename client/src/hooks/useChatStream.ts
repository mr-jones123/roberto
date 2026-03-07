import { useEffect, useRef, useState } from "react"
import type { ConnectionInviteRow, ConversationRow, MessageRow, SSEEvent } from "../lib/types"
import {
  fetchConversations,
  fetchConversationsCatchup,
  fetchInvites,
  fetchInvitesCatchup,
  fetchMessages,
} from "../lib/api"

export type UseChatStreamResult = {
  invites: ConnectionInviteRow[]
  conversations: ConversationRow[]
  messages: Record<string, MessageRow[]>
  loading: boolean
  error: string | null
}

function upsertInvite(list: ConnectionInviteRow[], invite: ConnectionInviteRow): ConnectionInviteRow[] {
  const idx = list.findIndex((row) => row.id === invite.id)
  if (idx >= 0) {
    const next = [...list]
    next[idx] = invite
    return next
  }
  return [invite, ...list]
}

function upsertConversation(
  list: ConversationRow[],
  conversation: ConversationRow,
): ConversationRow[] {
  const idx = list.findIndex((row) => row.id === conversation.id)
  if (idx >= 0) {
    const next = [...list]
    next[idx] = conversation
    return next
  }
  return [conversation, ...list]
}

function appendMessage(
  messages: Record<string, MessageRow[]>,
  conversationId: string,
  message: MessageRow,
): Record<string, MessageRow[]> {
  const existing = messages[conversationId] ?? []
  return {
    ...messages,
    [conversationId]: [...existing, message],
  }
}

async function fetchInitialState(
  token: string,
  setInvites: React.Dispatch<React.SetStateAction<ConnectionInviteRow[]>>,
  setConversations: React.Dispatch<React.SetStateAction<ConversationRow[]>>,
  setMessages: React.Dispatch<React.SetStateAction<Record<string, MessageRow[]>>>,
): Promise<void> {
  try {
    const [invitesRes, conversationsRes] = await Promise.all([
      fetchInvites(token),
      fetchConversations(token),
    ])

    setInvites(invitesRes.invites)
    setConversations(conversationsRes.conversations)

    // Fetch messages for each conversation
    const messagesMap: Record<string, MessageRow[]> = {}
    for (const conv of conversationsRes.conversations) {
      try {
        const messagesRes = await fetchMessages(token, conv.id)
        messagesMap[conv.id] = messagesRes.messages
      } catch {
        // Silently skip if message fetch fails
      }
    }
    setMessages(messagesMap)
  } catch {
    // Silently fail on initial load
  }
}

async function catchUp(
  token: string,
  lastSyncAt: string,
  setInvites: React.Dispatch<React.SetStateAction<ConnectionInviteRow[]>>,
  setMessages: React.Dispatch<React.SetStateAction<Record<string, MessageRow[]>>>,
): Promise<void> {
  try {
    const [invitesRes, messagesRes] = await Promise.all([
      fetchInvitesCatchup(token, lastSyncAt),
      fetchConversationsCatchup(token, lastSyncAt),
    ])

    setInvites((prev) => {
      let next = prev
      for (const invite of invitesRes.invites) {
        next = upsertInvite(next, invite)
      }
      return next
    })

    setMessages((prev) => {
      let next = prev
      for (const msg of messagesRes.messages) {
        next = appendMessage(next, msg.conversation_id, msg)
      }
      return next
    })
  } catch {
    // Silently fail on catch-up
  }
}

export function useChatStream(token: string | null): UseChatStreamResult {
  const [invites, setInvites] = useState<ConnectionInviteRow[]>([])
  const [conversations, setConversations] = useState<ConversationRow[]>([])
  const [messages, setMessages] = useState<Record<string, MessageRow[]>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const sourceRef = useRef<EventSource | null>(null)
  const lastSyncAtRef = useRef<string>(new Date().toISOString())

  // Initial load
  useEffect(() => {
    if (!token) {
      setLoading(false)
      return
    }

    setLoading(true)
    fetchInitialState(token, setInvites, setConversations, setMessages)
      .then(() => {
        lastSyncAtRef.current = new Date().toISOString()
        setLoading(false)
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load chat")
        setLoading(false)
      })
  }, [token])

  // SSE listener
  useEffect(() => {
    if (!token) return

    const source = new EventSource(`/api/events?token=${encodeURIComponent(token)}`)
    sourceRef.current = source

    const onMessage = (e: MessageEvent) => {
      try {
        const event = JSON.parse(e.data as string) as SSEEvent

        if (event.type === "invite_created" || event.type === "invite_updated") {
          setInvites((prev) => upsertInvite(prev, event.invite))
          if (event.type === "invite_updated" && event.conversation) {
            setConversations((prev) => upsertConversation(prev, event.conversation!))
          }
        } else if (event.type === "message_created") {
          setMessages((prev) => appendMessage(prev, event.conversationId, event.message))
        }

        lastSyncAtRef.current = new Date().toISOString()
      } catch {
        // Silently skip malformed events
      }
    }

    const onError = () => {
      // On SSE error, trigger catch-up
      catchUp(token, lastSyncAtRef.current, setInvites, setMessages).catch(() => {})
    }

    source.addEventListener("incident_update", onMessage)
    source.addEventListener("error", onError)

    return () => {
      source.removeEventListener("incident_update", onMessage)
      source.removeEventListener("error", onError)
      source.close()
      sourceRef.current = null
    }
  }, [token])

  // Focus/visibility recovery
  useEffect(() => {
    if (!token) return

    const onFocus = () => {
      catchUp(token, lastSyncAtRef.current, setInvites, setMessages).catch(() => {})
    }

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        catchUp(token, lastSyncAtRef.current, setInvites, setMessages).catch(() => {})
      }
    }

    window.addEventListener("focus", onFocus)
    document.addEventListener("visibilitychange", onVisibilityChange)

    return () => {
      window.removeEventListener("focus", onFocus)
      document.removeEventListener("visibilitychange", onVisibilityChange)
    }
  }, [token])

  return { invites, conversations, messages, loading, error }
}
