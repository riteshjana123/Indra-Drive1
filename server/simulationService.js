const scenarios = [
  'Pedestrian crossing',
  'Auto suddenly merging',
  'Pothole ahead',
  'Dense market traffic',
]

const initialTelemetry = {
  speed: 38,
  targetSpeed: 22,
  acceleration: -1.8,
  steering: -6.4,
  ttc: 1.6,
  collisionProbability: 68,
}

function createSimulationState() {
  return {
    running: true,
    speedMultiplier: 1,
    scenario: scenarios[0],
    trafficDensity: 'HIGH',
    weather: 'RAIN',
    visibility: 74,
    telemetry: { ...initialTelemetry },
    frame: 482,
    updatedAt: new Date().toISOString(),
  }
}

export function createSimulationService() {
  let state = createSimulationState()
  let timer

  const tick = () => {
    if (!state.running) return
    const telemetry = state.telemetry
    const nextSpeed = Math.max(22, Math.min(39, telemetry.speed + (telemetry.targetSpeed - telemetry.speed) * 0.08))
    state = {
      ...state,
      frame: state.frame + 1,
      telemetry: {
        ...telemetry,
        speed: Number(nextSpeed.toFixed(2)),
        ttc: telemetry.ttc > 2.2 ? 1.4 : Number((telemetry.ttc + 0.04).toFixed(2)),
      },
      updatedAt: new Date().toISOString(),
    }
  }

  const setTimer = () => {
    clearInterval(timer)
    timer = setInterval(tick, 850 / state.speedMultiplier)
  }

  setTimer()

  return {
    getState() {
      return state
    },
    setControl({ running, speedMultiplier, scenario }) {
      if (typeof running === 'boolean') state = { ...state, running }
      if (Number.isFinite(Number(speedMultiplier))) {
        state = { ...state, speedMultiplier: Math.max(0.5, Math.min(2, Number(speedMultiplier))) }
        setTimer()
      }
      if (typeof scenario === 'string' && scenarios.includes(scenario)) state = { ...state, scenario }
      return state
    },
    restart() {
      state = createSimulationState()
      setTimer()
      return state
    },
    getScenarios() {
      return scenarios
    },
    stop() {
      clearInterval(timer)
    },
  }
}
