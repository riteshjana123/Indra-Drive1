const scenarios = ['Straight road']

const initialTelemetry = {
  speed: 38,
  targetSpeed: 38,
  acceleration: 0,
  steering: 0,
  ttc: 8,
  collisionProbability: 0,
}

function createSimulationState() {
  return {
    running: true,
    speedMultiplier: 1,
    scenario: scenarios[0],
    trafficDensity: 'LOW',
    weather: 'CLEAR',
    visibility: 120,
    telemetry: { ...initialTelemetry },
    frame: 1,
    updatedAt: new Date().toISOString(),
  }
}

export function createSimulationService() {
  let state = createSimulationState()
  let timer

  const tick = () => {
    if (!state.running) return
    state = {
      ...state,
      frame: state.frame + 1,
      telemetry: {
        ...state.telemetry,
        speed: state.telemetry.targetSpeed,
        acceleration: 0,
        steering: 0,
        ttc: 8,
        collisionProbability: 0,
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
