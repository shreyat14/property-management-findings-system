import { apiRequest } from './apiClient.js'

export async function listInspectionFindings(inspectionId, { signal } = {}) {
  const response = await apiRequest(
    `/inspections/${encodeURIComponent(inspectionId)}/findings`,
    { signal },
  )
  return response.findings
}

export async function createFinding(inspectionId, finding) {
  const response = await apiRequest(
    `/inspections/${encodeURIComponent(inspectionId)}/findings`,
    { method: 'POST', body: finding },
  )
  return response.finding
}

export async function updateFinding(findingId, finding) {
  const response = await apiRequest(
    `/findings/${encodeURIComponent(findingId)}`,
    { method: 'PATCH', body: finding },
  )
  return response.finding
}

export async function uploadFindingPhoto(findingId, photo) {
  const form = new FormData()
  form.append('photo', photo)
  const response = await apiRequest(
    `/findings/${encodeURIComponent(findingId)}/photo`,
    { method: 'POST', body: form },
  )
  return response.finding
}

export async function submitFinding(findingId) {
  const response = await apiRequest(
    `/findings/${encodeURIComponent(findingId)}/submit`,
    { method: 'POST' },
  )
  return response.finding
}

export async function listReviewFindings({ signal } = {}) {
  const response = await apiRequest('/findings', { signal })
  return response.findings
}

export async function getFinding(findingId, { signal } = {}) {
  const response = await apiRequest(`/findings/${encodeURIComponent(findingId)}`, { signal })
  return response.finding
}

export async function approveFinding(findingId) {
  const response = await apiRequest(
    `/findings/${encodeURIComponent(findingId)}/approve`,
    { method: 'POST' },
  )
  return response.finding
}

export async function rejectFinding(findingId) {
  const response = await apiRequest(
    `/findings/${encodeURIComponent(findingId)}/reject`,
    { method: 'POST' },
  )
  return response.finding
}

export function getFindingPhoto(findingId, { signal } = {}) {
  return apiRequest(`/findings/${encodeURIComponent(findingId)}/photo`, {
    responseType: 'blob',
    signal,
  })
}
