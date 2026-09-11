import './prototype-dashboard.css'

const API = '/api'
let mounted = false

const postControl = async payload => {
  const response = await fetch(`${API}/prototype/control`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!response.ok) throw new Error(`Prototype control failed: ${response.status}`)
  return response.json()
}

const getState = async () => {
  const response = await fetch(`${API}/prototype/state`)
  if (!response.ok) throw new Error(`Prototype state failed: ${response.status}`)
  return response.json()
}

const heartbeat = async () => {
  try { await fetch(`${API}/prototype/heartbeat`, { method: 'POST' }) } catch { /* local UI keeps the last known state */ }
}

const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#039;' }[ch]))

const componentStatus = (components, key) => components?.[key]?.status || 'UNKNOWN'
const statusClass = value => String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '-')

function render(state, panel) {
  const reasons = Array.isArray(state?.safetyReasons) ? state.safetyReasons : []
  const mode = state?.mode || 'SAFE'
  const propulsion = Boolean(state?.propulsionEnabled)
  const batterySoc = Math.round(Number(state?.batterySoc ?? 0))
  const charging = Boolean(state?.charging)
  const chargerConnected = Boolean(state?.chargerConnected)
  const health = [
    ['BATTERY', componentStatus(state?.components, 'battery')],
    ['BMS', componentStatus(state?.components, 'bms')],
    ['CAMERA', componentStatus(state?.components, 'camera')],
    ['LiDAR', componentStatus(state?.components, 'lidar')],
    ['IMU', componentStatus(state?.components, 'imu')],
    ['ENCODERS', componentStatus(state?.components, 'wheelEncoders')],
    ['CAN BUS', componentStatus(state?.components, 'canBus')],
    ['STEERING', componentStatus(state?.components, 'steeringActuator')],
    ['BRAKE', componentStatus(state?.components, 'brakeActuator')],
  ]

  panel.innerHTML = `
    <div class="panel-title prototype-panel-title">
      <div><span class="eyebrow">Prototype readiness / live safety core</span><h2>Vehicle systems</h2></div>
      <span class="panel-action">LIVE</span>
    </div>
    <div class="prototype-overview">
      <div class="prototype-hero prototype-${statusClass(mode)}"><span>SYSTEM MODE</span><strong>${esc(mode)}</strong><small>${propulsion ? 'PROPULSION ENABLED' : 'PROPULSION INHIBITED'}</small></div>
      <div class="prototype-metric"><span>BATTERY SOC</span><strong>${batterySoc}%</strong><div class="soc-track"><i style="width:${batterySoc}%"></i></div><small>${state?.batteryVoltage ? `${esc(state.batteryVoltage)} V` : 'Voltage sensor not connected'}</small></div>
      <div class="prototype-metric"><span>CHARGER</span><strong class="prototype-state-${chargerConnected ? 'connected' : 'disconnected'}">${chargerConnected ? 'CONNECTED' : 'DISCONNECTED'}</strong><small>${charging ? 'Charging / propulsion interlocked' : 'No charging session'}</small></div>
      <div class="prototype-metric"><span>PROPULSION</span><strong class="prototype-state-${propulsion ? 'enabled' : 'disabled'}">${propulsion ? 'ENABLED' : 'DISABLED'}</strong><small>${reasons.length ? esc(reasons[0]) : 'All safety gates clear'}</small></div>
    </div>
    <div class="prototype-layout">
      <div class="prototype-components">
        <div class="prototype-section-heading"><span class="eyebrow">Component health</span><span>${health.filter(([,v]) => v === 'READY').length}/${health.length} READY</span></div>
        <div class="component-grid">${health.map(([name,value]) => `<div class="component-chip component-${statusClass(value)}"><span>${esc(name)}</span><strong>${esc(value)}</strong></div>`).join('')}</div>
      </div>
      <div class="prototype-safety">
        <div class="prototype-section-heading"><span class="eyebrow">Safety interlocks</span><span>${reasons.length ? `${reasons.length} ACTIVE` : 'CLEAR'}</span></div>
        <div class="safety-list">${(reasons.length ? reasons : ['EMERGENCY STOP READY','CHARGER INTERLOCK READY','WATCHDOG HEARTBEAT READY']).map(item => `<div><i></i><span>${esc(item)}</span></div>`).join('')}</div>
      </div>
      <div class="prototype-controls">
        <div class="prototype-section-heading"><span class="eyebrow">Prototype controls</span><span>TEST MODE</span></div>
        <div class="prototype-button-row">
          <button type="button" data-proto="charger" class="proto-control-button">${chargerConnected ? 'Disconnect charger' : 'Connect charger'}</button>
          <button type="button" data-proto="estop" class="proto-control-button proto-danger">${state?.estop ? 'Release E-stop' : 'Trigger E-stop'}</button>
        </div>
        <div class="prototype-button-row">
          <button type="button" data-proto="sensor" class="proto-control-button">${state?.sensorsHealthy === false ? 'Restore sensors' : 'Simulate sensor fault'}</button>
          <button type="button" data-proto="compute" class="proto-control-button">${state?.computeHealthy === false ? 'Restore compute' : 'Simulate compute fault'}</button>
          <button type="button" data-proto="actuator" class="proto-control-button">${state?.actuatorHealthy === false ? 'Restore actuators' : 'Simulate actuator fault'}</button>
        </div>
        <label class="prototype-battery-control"><span>TEST BATTERY SOC</span><input data-proto-battery type="range" min="0" max="100" step="1" value="${batterySoc}"/><strong>${batterySoc}%</strong></label>
      </div>
    </div>
    <div class="prototype-architecture"><span>BATTERY</span><b>→</b><span>BMS</span><b>→</b><span>POWER / CHARGER</span><b>→</b><span>SAFETY GATE</span><b>→</b><span>COMPUTE + SENSORS</span><b>→</b><span>ACTUATORS</span></div>
    <div class="prototype-footnote">Software simulation of the prototype power/safety layer. High-voltage charging hardware must remain physically protected and interlocked.</div>
  `

  panel.querySelector('[data-proto="charger"]')?.addEventListener('click', async () => { await postControl({ chargerConnected: !state.chargerConnected }).catch(() => {}) })
  panel.querySelector('[data-proto="estop"]')?.addEventListener('click', async () => { await postControl({ estop: !state.estop }).catch(() => {}) })
  panel.querySelector('[data-proto="sensor"]')?.addEventListener('click', async () => { await postControl({ sensorHealth: state.sensorsHealthy === false }).catch(() => {}) })
  panel.querySelector('[data-proto="compute"]')?.addEventListener('click', async () => { await postControl({ computeHealth: state.computeHealthy === false }).catch(() => {}) })
  panel.querySelector('[data-proto="actuator"]')?.addEventListener('click', async () => { await postControl({ actuatorHealth: state.actuatorHealthy === false }).catch(() => {}) })
  panel.querySelector('[data-proto-battery]')?.addEventListener('input', async event => {
    const value = Number(event.target.value)
    event.target.nextElementSibling.textContent = `${value}%`
    await postControl({ batterySoc: value }).catch(() => {})
  })
}

async function refresh(panel) {
  try {
    const state = await getState()
    panel.dataset.connection = 'online'
    render(state, panel)
  } catch {
    panel.dataset.connection = 'offline'
    if (!panel.innerHTML) panel.innerHTML = '<div class="prototype-offline">Prototype service offline — start the Express server to enable live hardware/safety state.</div>'
  }
}

function mount() {
  if (mounted) return
  const anchor = document.querySelector('.lower-grid') || document.querySelector('.app-footer')
  if (!anchor) return
  const panel = document.createElement('section')
  panel.className = 'panel prototype-dashboard-panel'
  panel.setAttribute('aria-label', 'Autonomous vehicle prototype system status')
  if (anchor.parentElement) anchor.parentElement.insertBefore(panel, anchor)
  mounted = true
  refresh(panel)
  setInterval(() => refresh(panel), 1200)
  setInterval(heartbeat, 250)
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount)
else mount()
