import { createPrototypeRuntime } from '../prototype/prototypeRuntime.js'

export function createPrototypeService() {
  const runtime = createPrototypeRuntime()

  return {
    getState() {
      return runtime.getState()
    },
    control(payload) {
      return runtime.control(payload)
    },
    heartbeat() {
      return runtime.heartbeat()
    },
    stop() {
      runtime.shutdown()
    },
  }
}
