import { apiRequest } from './apiClient.js'

export async function listProperties({ signal } = {}) {
  const response = await apiRequest('/properties', { signal })
  return response.properties
}

export async function getProperty(propertyId, { signal } = {}) {
  const response = await apiRequest(`/properties/${encodeURIComponent(propertyId)}`, { signal })
  return response.property
}

export async function createProperty(property) {
  const response = await apiRequest('/properties', {
    method: 'POST',
    body: property,
  })
  return response.property
}

export async function listPropertyInspectors(propertyId, { signal } = {}) {
  const response = await apiRequest(
    `/properties/${encodeURIComponent(propertyId)}/inspectors`,
    { signal },
  )
  return response.inspectors
}

export async function assignInspector(propertyId, inspectorId) {
  const response = await apiRequest(
    `/properties/${encodeURIComponent(propertyId)}/inspectors`,
    {
      method: 'POST',
      body: { inspectorId },
    },
  )
  return response.assignment
}
