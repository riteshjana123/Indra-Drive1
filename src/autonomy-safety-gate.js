const nativeRequestAnimationFrame = window.requestAnimationFrame.bind(window)
const nativeCancelAnimationFrame = window.cancelAnimationFrame.bind(window)

const gate = window.__INDRA_SAFETY_GATE__ || {
  allowed: true,
  reason: 'INITIALIZING SAFETY CORE',
}

window.__INDRA_SAFETY_GATE__ = gate

const guardedCallbacks = new Map()
let nextGateId = 1

function schedule(callback) {
  const id = nextGateId++
  const run = timestamp => {
    if (window.__INDRA_SAFETY_GATE__?.allowed !== false) {
      guardedCallbacks.delete(id)
      callback(timestamp)
      return
    }

    guardedCallbacks.set(id, { callback, frameId: nativeRequestAnimationFrame(run) })
  }

  guardedCallbacks.set(id, { callback, frameId: nativeRequestAnimationFrame(run) })
  return id
}

window.requestAnimationFrame = schedule

window.cancelAnimationFrame = id => {
  const entry = guardedCallbacks.get(id)
  if (entry) {
    nativeCancelAnimationFrame(entry.frameId)
    guardedCallbacks.delete(id)
    return
  }
  nativeCancelAnimationFrame(id)
}

export function setAutonomySafetyGate({ allowed, reason = '' } = {}) {
  window.__INDRA_SAFETY_GATE__.allowed = allowed !== false
  window.__INDRA_SAFETY_GATE__.reason = reason
  window.dispatchEvent(new CustomEvent('indra-safety-gate', {
    detail: { ...window.__INDRA_SAFETY_GATE__ },
  }))
}

export function getAutonomySafetyGate() {
  return { ...window.__INDRA_SAFETY_GATE__ }
}
