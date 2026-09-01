import { getStoredToken } from './tokenStorage.js'

const configuredBaseUrl = import.meta.env?.VITE_API_BASE_URL

export const API_BASE_URL = (
  configuredBaseUrl || 'http://localhost:3000/api/v1'
).replace(/\/$/, '')

export class ApiError extends Error {
  constructor(message, { status = 0, code = 'API_ERROR' } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
  }
}

function getErrorMessage(body, status) {
  if (body?.error?.message && typeof body.error.message === 'string') {
    return body.error.message
  }

  if (status >= 500) {
    return 'The service is temporarily unavailable. Please try again.'
  }

  return 'The request could not be completed.'
}

async function parseResponse(response) {
  const contentType = response.headers.get('content-type') || ''

  if (!contentType.includes('application/json')) {
    return null
  }

  try {
    return await response.json()
  } catch {
    return null
  }
}

export async function apiRequest(
  path,
  { method = 'GET', body, authenticated = true, responseType = 'json', signal } = {},
) {
  const headers = new Headers({
    Accept: responseType === 'blob' ? 'image/*' : 'application/json',
  })
  const isFormData = typeof FormData !== 'undefined' && body instanceof FormData

  if (body !== undefined && !isFormData) {
    headers.set('Content-Type', 'application/json')
  }

  if (authenticated) {
    const token = getStoredToken()

    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
  }

  let response

  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined || isFormData ? body : JSON.stringify(body),
      signal,
    })
  } catch (error) {
    if (error.name === 'AbortError') {
      throw error
    }

    throw new ApiError('Unable to connect to the service. Check your connection and try again.', {
      code: 'NETWORK_ERROR',
    })
  }

  const responseBody = response.ok && responseType === 'blob'
    ? await response.blob()
    : await parseResponse(response)

  if (!response.ok) {
    if (authenticated && response.status === 401) {
      window.dispatchEvent(new Event('auth:unauthorized'))
    }

    throw new ApiError(getErrorMessage(responseBody, response.status), {
      status: response.status,
      code: response.status === 401 ? 'UNAUTHORIZED' : 'API_ERROR',
    })
  }

  return responseBody
}
