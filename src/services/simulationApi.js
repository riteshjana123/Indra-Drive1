const fallbackState = {
  running: true,
  speedMultiplier: 1,
  scenario: 'Pedestrian crossing',
  telemetry: { speed: 38, targetSpeed: 22, acceleration: -1.8, steering: -6.4, ttc: 1.6, collisionProbability: 68 },
}

async function request(path, options) {
  const response = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...options })
  if (!response.ok) throw new Error(`Simulation API request failed: ${response.status}`)
  return response.json()
}

export async function getSimulationState() {
  try { return await request('/api/simulation/state') } catch { return fallbackState }
}

export async function updateSimulationControl(control) {
  try { return await request('/api/simulation/control', { method: 'POST', body: JSON.stringify(control) }) } catch { return { ...fallbackState, ...control } }
}

export async function restartSimulation() {
  try { return await request('/api/simulation/restart', { method: 'POST' }) } catch { return fallbackState }
}
