import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './motion.css'
import './vehicle-overrides.css'
import './ui-fixes.css'
import { getSimulationState, restartSimulation, updateSimulationControl } from './services/simulationApi'
import logo from './assets/Logo.png'

const scenarios = ['Straight road']
const ROAD_LEFT = 150
const ROAD_RIGHT = 610
const ROAD_TOP = 0
const ROAD_BOTTOM = 560
const EGO_X = 380
const EGO_Y = 455
const EGO_HALF_WIDTH = 22
const EGO_HALF_HEIGHT = 40
const MAX_SPEED = 100

const initialTelemetry = {
  speed: 38,
  targetSpeed: 38,
  acceleration: 0,
  steering: 0,
  ttc: 8,
  collisionProbability: 0,
}

const obstacleTypes = [
  { id: 'pedestrian', label: 'Pedestrian', tone: 'red', radius: 8 },
  { id: 'bike', label: 'Bike', tone: 'amber', radius: 9 },
  { id: 'car', label: 'Other car', tone: 'blue', radius: 13 },
  { id: 'pothole', label: 'Pothole', tone: 'dark', radius: 9 },
  { id: 'hazard', label: 'Hazard object', tone: 'yellow', radius: 10 },
  { id: 'tree', label: 'Tree', tone: 'green', radius: 12 },
]

function Pill({ children, tone = 'green' }) {
  return <span className={`pill pill-${tone}`}><i />{children}</span>
}

function Title({ eyebrow, title, action }) {
  return <div className="panel-title"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action && <span className="panel-action">{action}</span>}</div>
}

function ObstacleIcon({ type, small = false }) {
  const className = small ? 'obstacle-icon small' : 'obstacle-icon'
  if (type === 'pedestrian') return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="6" r="3" /><path d="M16 10v9m0-6-6 5m6-5 6 5m-6 0-5 9m5-9 5 9" /></svg>
  if (type === 'bike') return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><circle cx="8" cy="23" r="5" /><circle cx="24" cy="23" r="5" /><path d="M8 23l6-12 5 12m-7-7h7m-5-5 3 0m0 0 3 12M14 11l-4 0" /></svg>
  if (type === 'car') return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="7" width="18" height="18" rx="4" /><path d="M10 7l2-4h8l2 4M10 20h3m6 0h3" /></svg>
  if (type === 'pothole') return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="17" rx="11" ry="7" /><path d="M8 14l4 2m2-3 4 2m2-4 4 2m-9 7 4 1" /></svg>
  if (type === 'tree') return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><rect x="14" y="18" width="4" height="10" rx="1" /><circle cx="10" cy="14" r="7" /><circle cx="20" cy="13" r="8" /><circle cx="16" cy="7" r="7" /></svg>
  return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4l12 22H4z" /><path d="M16 11v8m0 4v1" /></svg>
}

function Controls({ running, setRunning, scenario, setScenario, speed, setSpeed, restart, syncControl, selectedObstacleType, setSelectedObstacleType }) {
  const updateSpeed = (rawValue) => {
    const nextSpeed = Math.max(0, Math.min(MAX_SPEED, Number(rawValue) || 0))
    setSpeed(nextSpeed)
    syncControl({ vehicleSpeed: nextSpeed })
  }

  return <aside className="panel controls-panel">
    <Title eyebrow="Mission control" title="Scenario" action="LIVE" />
    <div className="control-section"><label htmlFor="scenario">Scenario type</label><select id="scenario" value={scenario} onChange={(event) => { setScenario(event.target.value); syncControl({ scenario: event.target.value }) }}>{scenarios.map((item) => <option key={item}>{item}</option>)}</select></div>
    <div className="control-section"><div className="label-row"><label>Traffic density</label><strong>LOW</strong></div><div className="density-bars" aria-label="Low traffic density"><b /><b /><b /></div><p className="muted">Road starts clear · add obstacles manually</p></div>
    <div className="control-section compact-grid"><div><span>WEATHER</span><strong>CLEAR</strong></div><div><span>VISIBILITY</span><strong>120 m</strong></div></div>

    <div className="control-section speed-control">
      <div className="label-row"><label htmlFor="sim-speed">Vehicle speed</label><strong>{speed} km/h</strong></div>
      <div className="speed-input-row"><input className="speed-number" type="number" min="0" max={MAX_SPEED} step="1" value={speed} onChange={(event) => updateSpeed(event.target.value)} aria-label="Vehicle speed in kilometres per hour" /><span>km/h</span></div>
      <input id="sim-speed" className="speed-slider" type="range" min="0" max={MAX_SPEED} step="1" value={speed} onChange={(event) => updateSpeed(event.target.value)} />
      <div className="range-labels"><span>0</span><span>50</span><span>100 km/h</span></div>
      <p className="speed-note">0 = stopped · 100 km/h = maximum</p>
    </div>

    <div className="control-actions"><button className="button button-primary" type="button" onClick={() => { const nextRunning = !running; setRunning(nextRunning); syncControl({ running: nextRunning }) }}>{running ? '||  Pause' : '>  Resume'}</button><button className="button button-quiet" type="button" onClick={restart}>↻  Restart</button></div>

    <div className="obstacle-palette">
      <div className="obstacle-palette-head"><div><span className="eyebrow">Environment editor</span><h3>Obstacle</h3></div><span className="drag-hint">DRAG → ROAD</span></div>
      <p className="palette-copy">Drag an object onto any point of the road, or click an object then click the road to place it.</p>
      <div className="obstacle-list">
        {obstacleTypes.map((item) => <div key={item.id} className={`obstacle-item obstacle-${item.tone} ${selectedObstacleType === item.id ? 'obstacle-selected' : ''}`} draggable onClick={() => setSelectedObstacleType(item.id)} onDragStart={(event) => { event.dataTransfer.setData('text/plain', item.id); event.dataTransfer.setData('obstacleType', item.id); event.dataTransfer.effectAllowed = 'copy' }} title={`Drag ${item.label} onto the road`}><div className="obstacle-icon-wrap"><ObstacleIcon type={item.id} small /></div><div><strong>{item.label}</strong><span>{selectedObstacleType === item.id ? 'Selected · click road' : 'Drag to place'}</span></div><b>⋮⋮</b></div>)}
      </div>
      <div className="palette-note">Double-click a placed obstacle to remove it. Objects do not respawn after leaving the scene.</div>
    </div>

    <div className="pipeline-mini"><span className="eyebrow">Pipeline status</span>{['DETECT', 'PREDICT', 'QUANTIFY RISK', 'GENERATE PATHS', 'ADAPT & ACT'].map((step, index) => <div className="pipeline-step" key={step}><span>{String(index + 1).padStart(2, '0')}</span><strong>{step}</strong><i className={index === 4 ? 'active' : ''} /></div>)}</div>
  </aside>
}

function RoadObject({ object, onRemove, crashed }) {
  const type = obstacleTypes.find((item) => item.id === object.type) || obstacleTypes[0]
  const iconScale = object.type === 'tree' ? 0.78 : object.type === 'car' ? 0.82 : 0.72
  return <g className={`road-obstacle obstacle-${object.type}${crashed ? ' collision-obstacle' : ''}`} transform={`translate(${object.x} ${object.y}) scale(${iconScale})`} onDoubleClick={(event) => { event.stopPropagation(); onRemove(object.id) }}>
    <circle className="obstacle-halo" r={type.radius + 5} />
    <g className="road-object-glyph" transform="translate(-16 -16)"><ObstacleIcon type={object.type} /></g>
    <text y={type.radius + 15} textAnchor="middle">{type.label}</text>
  </g>
}

function Vegetation() {
  const leftTrees = [
    { x: 55, y: 70, s: 0.68 }, { x: 105, y: 155, s: 0.55 }, { x: 62, y: 260, s: 0.73 }, { x: 112, y: 365, s: 0.6 }, { x: 58, y: 470, s: 0.67 },
  ]
  const rightTrees = [
    { x: 705, y: 88, s: 0.6 }, { x: 660, y: 180, s: 0.71 }, { x: 706, y: 285, s: 0.56 }, { x: 657, y: 390, s: 0.71 }, { x: 708, y: 485, s: 0.62 },
  ]
  const grasses = [35, 86, 132, 626, 673, 724]
  const tree = (item, key) => <g key={key} className="road-tree" transform={`translate(${item.x} ${item.y}) scale(${item.s})`}><ellipse className="tree-shadow" cx="0" cy="20" rx="16" ry="5" /><rect className="tree-trunk" x="-3" y="5" width="6" height="18" rx="2" /><circle className="tree-crown crown-one" cx="-7" cy="3" r="10" /><circle className="tree-crown crown-two" cx="7" cy="2" r="11" /><circle className="tree-crown crown-three" cx="0" cy="-6" r="12" /></g>
  return <g aria-label="Trees and roadside vegetation">{leftTrees.map((item, index) => tree(item, `left-tree-${index}`))}{rightTrees.map((item, index) => tree(item, `right-tree-${index}`))}{grasses.map((x, index) => <path key={`grass-${index}`} className="grass-tuft" d={`M${x} ${120 + (index % 3) * 110} q-8-13 0-23 q8 10 0 23 m2 0 q7-11 13-10 q-3 9-13 10`} />)}</g>
}

function EgoVehicle() {
  return <g className="ego-vehicle-blue ego-realistic ego-fixed" transform={`translate(${EGO_X} ${EGO_Y})`} aria-label="Fixed blue ego vehicle">
    <ellipse className="vehicle-shadow" cx="0" cy="43" rx="25" ry="8" />
    <rect className="vehicle-body" x="-23" y="-41" width="46" height="82" rx="13" />
    <path className="vehicle-hood" d="M-17-25 Q0-34 17-25 L15-10 Q0-4-15-10Z" />
    <rect className="vehicle-cabin" x="-16" y="-4" width="32" height="32" rx="7" />
    <path className="vehicle-windshield" d="M-12-1 Q0-7 12-1 L10 7 Q0 12-10 7Z" />
    <path className="vehicle-rear-glass" d="M-10 16 Q0 21 10 16 L9 23 Q0 27-9 23Z" />
    <circle className="headlight" cx="-14" cy="-34" r="2.3" /><circle className="headlight" cx="14" cy="-34" r="2.3" />
    <circle className="tail-light" cx="-14" cy="34" r="2.1" /><circle className="tail-light" cx="14" cy="34" r="2.1" />
  </g>
}

function RoadCanvas({ running, speed, selectedObstacleType, setSelectedObstacleType, obstacles, setObstacles, crashed, setCrashed }) {
  const sceneRef = useRef(null)
  const roadOffsetRef = useRef(0)
  const [roadOffset, setRoadOffset] = useState(0)

  const getObstacleRadius = (type) => obstacleTypes.find((item) => item.id === type)?.radius ?? 9

  useEffect(() => {
    roadOffsetRef.current = roadOffset
  }, [roadOffset])

  useEffect(() => {
    if (!running || crashed || speed <= 0) return undefined
    let frame = 0
    let last = performance.now()
    const tick = (now) => {
      const delta = Math.min(80, now - last)
      last = now
      const pixelsPerSecond = Number(speed) * 2.0
      const nextOffset = roadOffsetRef.current + (delta / 1000) * pixelsPerSecond
      roadOffsetRef.current = nextOffset
      setRoadOffset(nextOffset)

      const surviving = []
      let didCrash = false
      for (const object of obstacles) {
        const movedY = Number(object.worldY) + nextOffset
        const radius = getObstacleRadius(object.type)
        if (movedY <= ROAD_BOTTOM + 50) surviving.push(object)
        const dx = Math.abs(Number(object.x) - EGO_X)
        const dy = Math.abs(movedY - EGO_Y)
        if (dx < EGO_HALF_WIDTH + radius && dy < EGO_HALF_HEIGHT + radius) didCrash = true
      }

      if (surviving.length !== obstacles.length) setObstacles(surviving)
      if (didCrash) setCrashed(true)
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [running, crashed, speed, obstacles, setObstacles, setCrashed])

  const placeObstacle = (clientX, clientY, type) => {
    if (!sceneRef.current || crashed || !type) return
    const rect = sceneRef.current.getBoundingClientRect()
    const xRaw = ((clientX - rect.left) / rect.width) * 760
    const yRaw = ((clientY - rect.top) / rect.height) * 560
    const radius = getObstacleRadius(type)
    const x = Math.max(ROAD_LEFT + radius, Math.min(ROAD_RIGHT - radius, xRaw))
    const y = Math.max(ROAD_TOP + radius, Math.min(ROAD_BOTTOM - radius, yRaw))
    const currentOffset = roadOffsetRef.current
    const obstacle = { id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`, type, x, y, worldY: y - currentOffset }
    setObstacles((current) => [...current, obstacle])
    setSelectedObstacleType(null)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('obstacleType') || event.dataTransfer.getData('text/plain')
    if (type) placeObstacle(event.clientX, event.clientY, type)
  }

  const handleRoadClick = (event) => {
    if (!selectedObstacleType || crashed) return
    const target = event.target
    if (target && typeof target.closest === 'function' && target.closest('.road-obstacle')) return
    placeObstacle(event.clientX, event.clientY, selectedObstacleType)
  }

  const markerOffset = roadOffset % 78
  const stripeY = Array.from({ length: 9 }, (_, index) => index * 78 + markerOffset - 70)
  const treeOffset = roadOffset % 620
  const environmentCopies = [-560, 0, 560]

  return <div className={`twin-stage ${crashed ? 'stage-crashed' : ''}`}>
    <div className="stage-toolbar"><span><i className="legend-dot green" /> DRIVABLE ROAD</span><span><i className="legend-dot amber" /> CENTER LANE</span><span className={crashed ? 'crash-toolbar' : ''}><i className="legend-dot red" /> {crashed ? 'COLLISION DETECTED' : selectedObstacleType ? 'CLICK ROAD TO PLACE' : 'DRAG ANYWHERE ON ROAD'}</span></div>
    <div className="drop-area" onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }} onDrop={handleDrop}>
      <svg ref={sceneRef} className="road-scene" viewBox="0 0 760 560" role="img" aria-label="Top-down perfectly straight road with fixed blue ego vehicle, moving environment and draggable obstacles" onClick={handleRoadClick}>
        <defs>
          <linearGradient id="road" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#1b2428" /><stop offset=".5" stopColor="#293237" /><stop offset="1" stopColor="#1a2327" /></linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#173221" /><stop offset="1" stopColor="#10271a" /></linearGradient>
        </defs>
        <rect width="760" height="560" fill="url(#ground)" />
        <rect x={ROAD_LEFT} y="0" width={ROAD_RIGHT - ROAD_LEFT} height="560" fill="url(#road)" className="road-surface" />
        <rect x={ROAD_LEFT - 2} y="0" width="2" height="560" className="road-edge" />
        <rect x={ROAD_RIGHT} y="0" width="2" height="560" className="road-edge" />

        {environmentCopies.map((base, index) => <g key={`veg-${index}`} className="moving-environment" transform={`translate(0 ${base + treeOffset})`}><Vegetation /></g>)}
        {stripeY.map((y, index) => <rect key={`center-${index}`} x="378" y={y} width="4" height="42" rx="2" className="road-centerline moving-line" />)}

        {obstacles.map((object) => {
          const movedY = Number(object.worldY) + roadOffset
          if (movedY < -55 || movedY > ROAD_BOTTOM + 50) return null
          return <RoadObject key={object.id} object={{ ...object, y: movedY }} crashed={crashed} onRemove={(id) => setObstacles((current) => current.filter((item) => item.id !== id))} />
        })}

        <EgoVehicle />

        {crashed && <g className="collision-marker" transform={`translate(${EGO_X} ${EGO_Y})`}><circle r="36" /><path d="M-10-10l20 20m0-20-20 20" /></g>}
      </svg>
      <div className="drop-overlay"><span>{crashed ? 'SIMULATION STOPPED — RESTART TO CONTINUE' : selectedObstacleType ? 'CLICK ANY POINT ON THE ROAD' : 'DROP OBSTACLE ANYWHERE ON ROAD'}</span></div>
      {crashed && <div className="collision-banner"><strong>COLLISION</strong><span>The ego vehicle reached a placed obstacle.</span></div>}
    </div>
    <div className="twin-footer"><span><b className="live-dot" /> DIGITAL TWIN / {crashed ? 'COLLISION STATE' : 'ROAD MOTION'}</span><span>INDRA PATH <b className="path-line" /> {Math.round(speed)} km/h</span></div>
  </div>
}

function VehicleStatus({ telemetry, obstacles, crashed }) {
  const items = [['CURRENT SPEED', `${Math.round(telemetry.speed)} km/h`, 'neutral'], ['TARGET SPEED', `${Math.round(telemetry.targetSpeed)} km/h`, 'teal'], ['ACCELERATION', `${telemetry.acceleration} m/s²`, 'amber'], ['STEERING ANGLE', `${telemetry.steering}°`, 'neutral']]
  return <aside className="panel status-panel"><Title eyebrow="Telemetry" title="Vehicle status" action="EGO-01" /><div className="telemetry-grid">{items.map(([label, value, tone]) => <div className="telemetry-card" key={label}><span>{label}</span><strong className={`value-${tone}`}>{value}</strong></div>)}</div><div className="status-row"><span>Brake status</span><strong className={`brake-status ${crashed ? 'brake-danger' : 'clear-brake'}`}><i /> {crashed ? 'LOCKED' : 'RELEASED'}</strong></div><div className="risk-readout"><div><span>TIME TO COLLISION</span><strong className={crashed ? 'danger-value' : ''}>{crashed ? '0.0' : telemetry.ttc.toFixed(1)}<small> sec</small></strong></div><div><span>COLLISION PROBABILITY</span><strong className={crashed ? 'danger-value' : ''}>{crashed ? '100' : Math.round(telemetry.collisionProbability)}<small>%</small></strong></div></div><div className="risk-meter"><span className={crashed ? 'risk-full' : ''} style={{ width: `${crashed ? 100 : telemetry.collisionProbability}%` }} /></div><div className="current-risk"><span>Current risk</span><strong className={crashed ? 'collision-risk' : obstacles.length ? 'watch-risk' : 'clear-risk'}><i /> {crashed ? 'COLLISION' : obstacles.length ? 'MONITOR' : 'CLEAR'}</strong></div><div className="selected-path"><span>Selected path</span><strong>Center lane <em>INDRA</em></strong></div><div className="status-obstacles"><span>Active obstacles</span><strong>{obstacles.length}</strong></div></aside>
}

function Performance({ speed, crashed }) {
  const rows = [['Collisions', crashed ? '1' : '0', crashed ? '1' : '0', crashed ? '1' : '0'], ['Minimum TTC', crashed ? '0.0 s' : '8.0 s', crashed ? '0.0 s' : '8.0 s', crashed ? '0.0 s' : '8.0 s'], ['Average speed', `${Math.round(speed)} km/h`, `${Math.round(speed)} km/h`, `${Math.round(speed)} km/h`], ['Path efficiency', crashed ? '0%' : '100%', crashed ? '0%' : '100%', crashed ? '0%' : '100%'], ['Comfort score', crashed ? '0' : '94', crashed ? '0' : '94', crashed ? '0' : '96'], ['Emergency braking', crashed ? '1' : '0', crashed ? '1' : '0', crashed ? '1' : '0']]
  return <section className="panel performance-panel"><Title eyebrow="Benchmark run / interactive road" title="Performance comparison" action="3 CONTROLLERS" /><div className="comparison-layout"><table><thead><tr><th>METRIC</th><th>BASELINE</th><th>REACTIVE</th><th className="indra-heading">INDRA</th></tr></thead><tbody>{rows.map(([metric, baseline, reactive, indra]) => <tr key={metric}><td>{metric}</td><td>{baseline}</td><td>{reactive}</td><td className="best">{indra}<span>{crashed ? 'FAULT' : 'BEST'}</span></td></tr>)}</tbody></table><div className="chart"><div className="chart-caption"><span>SAFETY SCORE</span><strong>INDRA <b>{crashed ? 0 : 96}</b></strong></div><div className="bars"><div style={{ height: crashed ? '10%' : '78%' }}><i>{crashed ? 0 : 94}</i><span>BASE</span></div><div style={{ height: crashed ? '10%' : '78%' }}><i>{crashed ? 0 : 94}</i><span>REACTIVE</span></div><div className="bar-indra" style={{ height: crashed ? '10%' : '92%' }}><i>{crashed ? 0 : 96}</i><span>INDRA</span></div></div></div></div></section>
}

function App() {
  const [running, setRunning] = useState(true)
  const [scenario, setScenario] = useState(scenarios[0])
  const [speed, setSpeed] = useState(38)
  const [telemetry, setTelemetry] = useState({ ...initialTelemetry })
  const [obstacles, setObstacles] = useState([])
  const [crashed, setCrashed] = useState(false)
  const [selectedObstacleType, setSelectedObstacleType] = useState(null)

  useEffect(() => {
    getSimulationState().then((state) => {
      setRunning(state.running)
      setScenario(state.scenario)
      const serverSpeed = Number(state.vehicleSpeed ?? state.telemetry?.targetSpeed ?? initialTelemetry.targetSpeed)
      setSpeed(Math.max(0, Math.min(MAX_SPEED, Number.isFinite(serverSpeed) ? serverSpeed : initialTelemetry.targetSpeed)))
      if (state.telemetry) setTelemetry(state.telemetry)
    }).catch(() => undefined)
  }, [])

  useEffect(() => {
    setTelemetry((current) => ({ ...current, speed, targetSpeed: speed, acceleration: 0, steering: 0 }))
  }, [speed])

  const decision = useMemo(() => crashed
    ? 'Collision detected. INDRA stopped the simulation because a placed road object entered the ego vehicle collision envelope.'
    : obstacles.length
      ? `INDRA is tracking ${obstacles.length} active road object${obstacles.length > 1 ? 's' : ''} while keeping EGO-01 fixed and advancing the environment toward it.`
      : 'Clear straight road detected. EGO-01 is fixed in the camera while the straight road environment moves toward it.', [crashed, obstacles.length])

  const syncControl = (control) => {
    updateSimulationControl(control).then((state) => {
      if (state.telemetry) setTelemetry(state.telemetry)
      if (typeof state.vehicleSpeed === 'number') setSpeed(Math.max(0, Math.min(MAX_SPEED, state.vehicleSpeed)))
    }).catch(() => undefined)
  }

  const restart = () => {
    setTelemetry({ ...initialTelemetry })
    setRunning(true)
    setScenario(scenarios[0])
    setSpeed(38)
    setObstacles([])
    setSelectedObstacleType(null)
    setCrashed(false)
    restartSimulation().then((state) => {
      if (state.telemetry) setTelemetry(state.telemetry)
      if (typeof state.vehicleSpeed === 'number') setSpeed(Math.max(0, Math.min(MAX_SPEED, state.vehicleSpeed)))
    }).catch(() => undefined)
  }

  return <main className="app-shell">
    <header className="app-header"><div className="brand-lockup"><img className="brand-mark" src={logo} alt="INDRA-DRIVE logo" /><div><h1>INDRA-<b>DRIVE</b></h1><p>Predictive Risk-Adaptive Path Planning <span>/</span> Realistic Road Digital Twin</p></div></div><div className="header-status"><Pill>SYSTEM STATUS: ACTIVE</Pill><Pill>SIMULATION: {crashed ? 'STOPPED' : running ? 'RUNNING' : 'PAUSED'}</Pill><Pill tone="blue">MODE: INDRA ADAPTIVE</Pill></div></header>

    <div className="dashboard-grid">
      <Controls running={running && !crashed} setRunning={(value) => { if (!crashed) setRunning(value) }} scenario={scenario} setScenario={setScenario} speed={speed} setSpeed={setSpeed} restart={restart} syncControl={syncControl} selectedObstacleType={selectedObstacleType} setSelectedObstacleType={setSelectedObstacleType} />
      <section className="panel twin-panel"><Title eyebrow="Live environment / top-down view" title="Digital twin" action="30 FPS" /><RoadCanvas running={running} speed={speed} selectedObstacleType={selectedObstacleType} setSelectedObstacleType={setSelectedObstacleType} obstacles={obstacles} setObstacles={setObstacles} crashed={crashed} setCrashed={setCrashed} /><div className="twin-insight"><span className={`alert-icon ${crashed ? 'collision-icon' : obstacles.length ? 'watch-icon' : 'clear-icon'}`}>{crashed ? '!' : obstacles.length ? '!' : '✓'}</span><div><strong className={crashed ? 'collision-text' : obstacles.length ? 'watch-text' : 'clear-text'}>{crashed ? 'COLLISION DETECTED' : obstacles.length ? 'OBSTACLE MONITORING' : 'ROAD CLEAR'}</strong><p>{crashed ? 'Simulation stopped at impact. Restart to run the scenario again.' : obstacles.length ? `${obstacles.length} placed object${obstacles.length > 1 ? 's are' : ' is'} moving with the road environment.` : 'EGO-01 remains fixed while road markings, trees and vegetation move toward it.'}</p></div><span className="insight-time">{crashed ? 'STOP' : obstacles.length ? 'ACTIVE' : 'SAFE'}</span></div></section>
      <VehicleStatus telemetry={telemetry} obstacles={obstacles} crashed={crashed} />
    </div>

    <div className="lower-grid"><Performance speed={speed} crashed={crashed} /><section className="panel decision-panel"><Title eyebrow="Why did INDRA act?" title="Explainable decision" action="AUTO-LOGGED" /><div className="decision-copy"><div className="decision-tag"><span>01</span> DECISION TRACE</div><p>{decision}</p><div className="decision-facts"><div><span>PATHS EVALUATED</span><strong>{crashed ? '0' : '1'}</strong></div><div><span>RISK REDUCTION</span><strong>{crashed ? '0%' : '100%'}</strong></div><div><span>WEIGHT PROFILE</span><strong>SAFETY <em>70%</em></strong></div></div><div className="action-callout"><span>↳</span><div><small>ACTION</small><strong>{crashed ? 'Stop vehicle + log collision' : `Drive at ${speed} km/h + keep EGO-01 fixed in camera`}</strong></div></div></div></section></div>

    <footer className="app-footer"><span><b className="live-dot" /> SIMULATION ENGINE READY</span><span>SCENARIO: STRAIGHT ROAD &nbsp;·&nbsp; WEATHER: CLEAR &nbsp;·&nbsp; SPEED LIMIT: 100 km/h</span><strong>SAFETY FIRST <i>◆</i></strong></footer>
  </main>
}

export default App
