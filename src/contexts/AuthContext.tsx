import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { api } from '../lib/api'

export interface AuthUser {
  id: number
  email: string
  role: 'buyer' | 'fabricator'
  active?: boolean
}

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<AuthUser>
  register: (email: string, password: string, role?: 'buyer' | 'fabricator') => Promise<AuthUser>
  logout: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

const TOKEN_KEY = 'vrfq_token'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY)
    if (!token) {
      setLoading(false)
      return
    }
    api
      .get<{ user: AuthUser }>('/auth/me')
      .then(({ user }) => setUser(user))
      .catch(() => localStorage.removeItem(TOKEN_KEY))
      .finally(() => setLoading(false))
  }, [])

  async function login(email: string, password: string): Promise<AuthUser> {
    const { token, user } = await api.post<{ token: string; user: AuthUser }>('/auth/login', {
      email,
      password,
    })
    localStorage.setItem(TOKEN_KEY, token)
    setUser(user)
    return user
  }

  async function register(email: string, password: string, role: 'buyer' | 'fabricator' = 'buyer'): Promise<AuthUser> {
    const { token, user } = await api.post<{ token: string; user: AuthUser }>('/auth/register', {
      email,
      password,
      role,
    })
    localStorage.setItem(TOKEN_KEY, token)
    setUser(user)
    return user
  }

  function logout() {
    localStorage.removeItem(TOKEN_KEY)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
