import { apiRequest } from './apiClient.js'

export async function listInspectors({ signal } = {}) {
  const response = await apiRequest('/users/inspectors', { signal })
  return response.inspectors
}

export async function createInspector(credentials) {
  const response = await apiRequest('/users/inspectors', {
    method: 'POST',
    body: credentials,
  })
  return response.inspector
}
