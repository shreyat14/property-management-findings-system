import { useCallback, useEffect, useMemo, useState } from 'react'
import { getCurrentUser, loginRequest } from '../api/authApi.js'
import {
  clearStoredToken,
  getStoredToken,
  storeToken,
} from '../api/tokenStorage.js'
import { isSupportedRole } from '../routes/routePolicy.js'
import { AuthContext } from './authContext.js'

function isValidUser(user) {
  return (
    user &&
    typeof user.id === 'string' &&
    typeof user.email === 'string' &&
    isSupportedRole(user.role)
  )
}

export function AuthProvider({ children }) {
  const [auth, setAuth] = useState({
    token: getStoredToken(),
    user: null,
    initializing: true,
  })

  const logout = useCallback(() => {
    clearStoredToken()
    setAuth({ token: null, user: null, initializing: false })
  }, [])

  useEffect(() => {
    window.addEventListener('auth:unauthorized', logout)
    return () => window.removeEventListener('auth:unauthorized', logout)
  }, [logout])

  useEffect(() => {
    const controller = new AbortController()

    async function restoreSession() {
      if (!getStoredToken()) {
        setAuth({ token: null, user: null, initializing: false })
        return
      }

      try {
        const response = await getCurrentUser({ signal: controller.signal })

        if (!isValidUser(response?.user)) {
          throw new Error('The authenticated user response is invalid.')
        }

        setAuth((current) => ({
          token: current.token,
          user: response.user,
          initializing: false,
        }))
      } catch (error) {
        if (error.name !== 'AbortError') {
          clearStoredToken()
          setAuth({ token: null, user: null, initializing: false })
        }
      }
    }

    restoreSession()
    return () => controller.abort()
  }, [])

  const login = useCallback(async (email, password) => {
    const response = await loginRequest({ email, password })

    if (typeof response?.token !== 'string' || !isValidUser(response.user)) {
      throw new Error('The login response was not recognized. Please try again.')
    }

    storeToken(response.token)
    setAuth({ token: response.token, user: response.user, initializing: false })
    return response.user
  }, [])

  const value = useMemo(
    () => ({
      token: auth.token,
      user: auth.user,
      role: auth.user?.role ?? null,
      isAuthenticated: Boolean(auth.token && auth.user),
      initializing: auth.initializing,
      login,
      logout,
    }),
    [auth, login, logout],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
