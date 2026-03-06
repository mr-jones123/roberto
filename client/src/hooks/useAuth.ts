import { useCallback, useState } from "react"
import { loginUser } from "../lib/api"
import type { AuthUser } from "../lib/types"

type UseAuthResult = {
  token: string | null
  user: AuthUser | null
  login: (username: string, password: string) => Promise<void>
  logout: () => void
  isAuthenticated: boolean
}

const TOKEN_KEY = "roberto_incident_token"
const USER_KEY = "roberto_incident_user"

function loadStored(): { token: string | null; user: AuthUser | null } {
  try {
    const token = localStorage.getItem(TOKEN_KEY)
    const raw = localStorage.getItem(USER_KEY)
    const user = raw ? (JSON.parse(raw) as AuthUser) : null
    return { token, user }
  } catch {
    return { token: null, user: null }
  }
}

export function useAuth(): UseAuthResult {
  const [state, setState] = useState(loadStored)

  const login = useCallback(async (username: string, password: string) => {
    const res = await loginUser(username, password)
    localStorage.setItem(TOKEN_KEY, res.token)
    localStorage.setItem(USER_KEY, JSON.stringify(res.user))
    setState({ token: res.token, user: res.user })
  }, [])

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY)
    localStorage.removeItem(USER_KEY)
    setState({ token: null, user: null })
  }, [])

  return {
    token: state.token,
    user: state.user,
    login,
    logout,
    isAuthenticated: state.token !== null && state.user !== null,
  }
}
