import cors from 'cors'
import express from 'express'
import { createSimulationService } from './simulationService.js'
import { createPrototypeService } from './prototypeService.js'

const app = express()
const simulation = createSimulationService()
const prototype = createPrototypeService()
const port = Number(process.env.PORT || 3001)

app.use(cors())
app.use(express.json())

app.get('/api/health', (_request, response) => {
  response.json({ status: 'ok', service: 'indra-drive-simulation', timestamp: new Date().toISOString() })
})

app.get('/api/scenarios', (_request, response) => {
  response.json({ scenarios: simulation.getScenarios() })
})

app.get('/api/simulation/state', (_request, response) => {
  response.json(simulation.getState())
})

app.post('/api/simulation/control', (request, response) => {
  const { running, speedMultiplier, vehicleSpeed, scenario } = request.body || {}
  response.json(simulation.setControl({ running, speedMultiplier, vehicleSpeed, scenario }))
})

app.post('/api/simulation/restart', (_request, response) => {
  response.json(simulation.restart())
})

app.get('/api/prototype/state', (_request, response) => {
  response.json(prototype.getState())
})

app.post('/api/prototype/control', (request, response) => {
  response.json(prototype.control(request.body || {}))
})

app.post('/api/prototype/heartbeat', (_request, response) => {
  response.json(prototype.heartbeat())
})

const server = app.listen(port, () => {
  console.log(`INDRA-DRIVE simulation API listening on http://localhost:${port}`)
})

function shutdown() {
  simulation.stop()
  prototype.stop()
  server.close(() => process.exit(0))
}

process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)
