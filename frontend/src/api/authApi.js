import { apiRequest } from './apiClient.js'

export function loginRequest(credentials) {
  return apiRequest('/auth/login', {
    method: 'POST',
    body: credentials,
    authenticated: false,
  })
}

export function getCurrentUser({ signal } = {}) {
  return apiRequest('/auth/me', { signal })
}
