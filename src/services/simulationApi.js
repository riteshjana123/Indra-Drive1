const fallbackState = {
  running: true,
  speedMultiplier: 1,
  vehicleSpeed: 38,
  scenario: 'Straight road',
  telemetry: { speed: 38, targetSpeed: 38, acceleration: 0, steering: 0, ttc: 8, collisionProbability: 0 },
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
  try { return await request('/api/simulation/control', { method: 'POST', body: JSON.stringify(control) }) } catch { return { ...fallbackState, ...control, vehicleSpeed: Number.isFinite(Number(control.vehicleSpeed)) ? Math.max(0, Math.min(100, Number(control.vehicleSpeed))) : fallbackState.vehicleSpeed } }
}

export async function restartSimulation() {
  try { return await request('/api/simulation/restart', { method: 'POST' }) } catch { return fallbackState }
}