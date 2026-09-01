import { apiRequest } from './apiClient.js'

export async function listInspections({ signal } = {}) {
  const response = await apiRequest('/inspections', { signal })
  return response.inspections
}

export async function getInspection(inspectionId, { signal } = {}) {
  const response = await apiRequest(`/inspections/${encodeURIComponent(inspectionId)}`, { signal })
  return response.inspection
}

export async function createInspection(propertyId) {
  const response = await apiRequest('/inspections', {
    method: 'POST',
    body: { propertyId },
  })
  return response.inspection
}

export async function completeInspection(inspectionId) {
  const response = await apiRequest(
    `/inspections/${encodeURIComponent(inspectionId)}/complete`,
    { method: 'POST' },
  )
  return response.inspection
}
