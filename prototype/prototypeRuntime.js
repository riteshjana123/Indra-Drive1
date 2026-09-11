const LIMITS = {
  maxSpeedKmh: 100,
  minOperatingSoc: 15,
  emergencySoc: 8,
  watchdogMs: 500,
}

const componentTemplate = (status = 'READY') => ({ status, lastHeartbeat: new Date().toISOString() })

export function createPrototypeRuntime() {
  let state = {
    mode: 'SAFE',
    propulsionEnabled: false,
    chargerConnected: false,
    charging: false,
    batterySoc: 82,
    batteryVoltage: null,
    estop: false,
    watchdogHealthy: true,
    sensorsHealthy: true,
    computeHealthy: true,
    actuatorHealthy: true,
    components: {
      battery: componentTemplate('READY'),
      bms: componentTemplate('READY'),
      charger: componentTemplate('DISCONNECTED'),
      camera: componentTemplate('READY'),
      lidar: componentTemplate('READY'),
      imu: componentTemplate('READY'),
      wheelEncoders: componentTemplate('READY'),
      canBus: componentTemplate('READY'),
      motorController: componentTemplate('READY'),
      steeringActuator: componentTemplate('READY'),
      brakeActuator: componentTemplate('READY'),
      emergencyStop: componentTemplate('READY'),
    },
    lastControlAt: Date.now(),
  }

  const safetyReasons = () => {
    const reasons = []
    if (state.estop) reasons.push('EMERGENCY STOP ACTIVE')
    if (state.chargerConnected) reasons.push('CHARGER CONNECTED')
    if (state.batterySoc <= LIMITS.emergencySoc) reasons.push('BATTERY CRITICAL')
    if (state.batterySoc < LIMITS.minOperatingSoc) reasons.push('LOW BATTERY')
    if (!state.watchdogHealthy) reasons.push('WATCHDOG FAULT')
    if (!state.sensorsHealthy) reasons.push('SENSOR FAULT')
    if (!state.computeHealthy) reasons.push('COMPUTE FAULT')
    if (!state.actuatorHealthy) reasons.push('ACTUATOR FAULT')
    return reasons
  }

  const refreshMode = () => {
    const reasons = safetyReasons()
    state.propulsionEnabled = reasons.length === 0
    state.mode = reasons.length === 0 ? 'READY' : 'SAFE'
    return reasons
  }

  const touch = () => {
    state.lastControlAt = Date.now()
    state.watchdogHealthy = true
  }

  const setCharger = connected => {
    state.chargerConnected = Boolean(connected)
    state.charging = state.chargerConnected
    state.components.charger = componentTemplate(state.chargerConnected ? 'CONNECTED' : 'DISCONNECTED')
    refreshMode()
    return state
  }

  const setEstop = active => {
    state.estop = Boolean(active)
    state.components.emergencyStop = componentTemplate(state.estop ? 'ACTIVE' : 'READY')
    refreshMode()
    return state
  }

  const setBatterySoc = value => {
    const soc = Number(value)
    if (Number.isFinite(soc)) state.batterySoc = Math.max(0, Math.min(100, soc))
    refreshMode()
    return state
  }

  const setComponentHealth = ({ component, healthy }) => {
    const ok = Boolean(healthy)
    if (component === 'sensors') state.sensorsHealthy = ok
    if (component === 'compute') state.computeHealthy = ok
    if (component === 'actuators') state.actuatorHealthy = ok
    if (state.components[component]) state.components[component] = componentTemplate(ok ? 'READY' : 'FAULT')
    refreshMode()
    return state
  }

  const tick = () => {
    if (Date.now() - state.lastControlAt > LIMITS.watchdogMs) state.watchdogHealthy = false
    if (state.charging) state.batterySoc = Math.min(100, state.batterySoc + 0.05)
    refreshMode()
  }

  const timer = setInterval(tick, 100)

  return {
    getState() {
      return { ...state, limits: { ...LIMITS }, safetyReasons: safetyReasons() }
    },
    heartbeat() {
      touch()
      return this.getState()
    },
    control(payload = {}) {
      touch()
      if ('chargerConnected' in payload) setCharger(payload.chargerConnected)
      if ('estop' in payload) setEstop(payload.estop)
      if ('batterySoc' in payload) setBatterySoc(payload.batterySoc)
      if (typeof payload.sensorHealth === 'boolean') setComponentHealth({ component: 'sensors', healthy: payload.sensorHealth })
      if (typeof payload.computeHealth === 'boolean') setComponentHealth({ component: 'compute', healthy: payload.computeHealth })
      if (typeof payload.actuatorHealth === 'boolean') setComponentHealth({ component: 'actuators', healthy: payload.actuatorHealth })
      return this.getState()
    },
    shutdown() {
      clearInterval(timer)
    },
  }
}
