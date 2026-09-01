import { apiRequest } from './apiClient.js'

export async function analyzeFinding(photo, observation) {
  const form = new FormData()

  if (observation?.trim()) {
    form.append('observation', observation.trim())
  }

  form.append('photo', photo)
  const response = await apiRequest('/ai/analyze-finding', {
    method: 'POST',
    body: form,
  })
  return response.suggestion
}
