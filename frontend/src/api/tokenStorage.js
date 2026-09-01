const TOKEN_STORAGE_KEY = 'property-findings.auth-token'

export function getStoredToken() {
  try {
    return window.localStorage.getItem(TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

export function storeToken(token) {
  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token)
  } catch {
    throw new Error('Authentication cannot be saved in this browser.')
  }
}

export function clearStoredToken() {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
  } catch {
    // In-memory authentication state is still cleared when storage is unavailable.
  }
}
