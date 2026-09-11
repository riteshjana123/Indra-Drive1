const API_BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/api'

async function request(path, options = {}) {
  const response = await fetch(`${API_BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    ...options,
  })

  if (!response.ok) {
    throw new Error(`Prototype API request failed: ${response.status}`)
  }

  return response.json()
}

export function getPrototypeState() {
  return request('/prototype/state')
}

export function updatePrototypeControl(control) {
  return request('/prototype/control', {
    method: 'POST',
    body: JSON.stringify(control),
  })
}

export function sendPrototypeHeartbeat() {
  return request('/prototype/heartbeat', {
    method: 'POST',
    body: JSON.stringify({}),
  })
}
