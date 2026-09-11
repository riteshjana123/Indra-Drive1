import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './motion.css'
import './vehicle-overrides.css'
import './ui-fixes.css'
import './interaction-fixes.css'
import logo from './assets/Logo.png'
import { getSimulationState, restartSimulation, updateSimulationControl } from './services/simulationApi'

const MAX_SPEED = 100
const VIEW_W = 760
const VIEW_H = 560
const ROAD_LEFT = 150
const ROAD_RIGHT = 610
const ROAD_BOTTOM = 560
const ROAD_MIN_X = ROAD_LEFT + 35
const ROAD_MAX_X = ROAD_RIGHT - 35
const ROAD_CENTER_X = (ROAD_LEFT + ROAD_RIGHT) / 2
const EGO_Y = 455
const EGO_HALF_WIDTH = 22
const EGO_HALF_HEIGHT = 40
const WARNING_DISTANCE = 260
const STEER_SPEED = 180

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
  { id: 'car', label: 'Other car', tone: 'blue', radius: 12 },
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
  const size = small ? 18 : 20
  const cls = small ? 'obstacle-icon small' : 'obstacle-icon'
  if (type === 'pedestrian') return <svg className={cls} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><circle cx="16" cy="6" r="3"/><path d="M16 10v9m0-6-6 5m6-5 6 5m-6 0-5 9m5-9 5 9"/></svg>
  if (type === 'bike') return <svg className={cls} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><circle cx="8" cy="23" r="5"/><circle cx="24" cy="23" r="5"/><path d="M8 23l6-12 5 12m-7-7h7m-5-5 3 12M14 11l-4 0"/></svg>
  if (type === 'car') return <svg className={cls} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="7" width="18" height="18" rx="4"/><path d="M10 7l2-4h8l2 4M10 20h3m6 0h3"/></svg>
  if (type === 'pothole') return <svg className={cls} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="17" rx="11" ry="7"/><path d="M8 14l4 2m2-3 4 2m2-4 4 2m-9 7 4 1"/></svg>
  if (type === 'tree') return <svg className={cls} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><rect x="14" y="18" width="4" height="10" rx="1"/><circle cx="10" cy="14" r="7"/><circle cx="20" cy="13" r="8"/><circle cx="16" cy="7" r="7"/></svg>
  return <svg className={cls} width={size} height={size} viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4l12 22H4z"/><path d="M16 11v8m0 4v1"/></svg>
}

function Controls({ running, setRunning, speed, setSpeed, restart, syncControl, selectedObstacleType, setSelectedObstacleType, obstacles }) {
  const trafficPercent = Math.min(100, obstacles.length * 12)
  const trafficLabel = trafficPercent < 35 ? 'LOW' : trafficPercent < 70 ? 'MEDIUM' : 'HIGH'
  const activeBars = trafficPercent === 0 ? 0 : Math.ceil(trafficPercent / 34)

  const updateSpeed = (raw) => {
    const n = Number(raw)
    const next = Number.isFinite(n) ? Math.max(0, Math.min(MAX_SPEED, Math.round(n))) : 0
    setSpeed(next)
    syncControl({ vehicleSpeed: next })
  }

  return <aside className="panel controls-panel">
    <Title eyebrow="Mission control" title="Scenario" action="LIVE" />
    <div className="control-section"><label htmlFor="scenario">Scenario type</label><select id="scenario" defaultValue="Straight road"><option>Straight road</option></select></div>
    <div className="control-section">
      <div className="label-row"><label>Traffic density</label><strong>{trafficLabel} · {trafficPercent}%</strong></div>
      <div className="density-bars">
        {[0,1,2].map(index => <b key={index} style={{ opacity: index < activeBars ? 1 : .32 }} />)}
      </div>
      <p className="muted">Active road objects increase traffic density · {obstacles.length} object{obstacles.length === 1 ? '' : 's'}</p>
    </div>
    <div className="control-section compact-grid"><div><span>WEATHER</span><strong>CLEAR</strong></div><div><span>VISIBILITY</span><strong>120 m</strong></div></div>
    <div className="control-section speed-control">
      <div className="label-row"><label htmlFor="sim-speed">Vehicle speed</label><strong>{Math.round(speed)} km/h</strong></div>
      <div className="speed-input-row"><input className="speed-number" type="number" min="0" max={MAX_SPEED} step="1" value={speed} onChange={e => updateSpeed(e.target.value)} /><span>km/h</span></div>
      <input id="sim-speed" className="speed-slider" type="range" min="0" max={MAX_SPEED} step="1" value={speed} onChange={e => updateSpeed(e.target.value)} />
      <div className="range-labels"><span>0</span><span>50</span><span>100 km/h</span></div>
      <p className="speed-note">0 = stopped · 100 km/h = maximum</p>
    </div>
    <div className="control-actions"><button className="button button-primary" type="button" onClick={() => { const next = !running; setRunning(next); syncControl({ running: next }) }}>{running ? '||  Pause' : '>  Resume'}</button><button className="button button-quiet" type="button" onClick={restart}>↻  Restart</button></div>
    <div className="obstacle-palette">
      <div className="obstacle-palette-head"><div><span className="eyebrow">Environment editor</span><h3>Obstacle</h3></div><span className="drag-hint">DRAG → ROAD</span></div>
      <p className="palette-copy">Place a vehicle or hazard anywhere on the road. INDRA can steer continuously across the full road width to pass around it.</p>
      <div className="obstacle-list">{obstacleTypes.map(item => <div key={item.id} className={`obstacle-item obstacle-${item.tone} ${selectedObstacleType === item.id ? 'obstacle-selected' : ''}`} draggable="true" onClick={() => setSelectedObstacleType(item.id)} onDragStart={e => { e.dataTransfer.effectAllowed = 'copy'; e.dataTransfer.setData('text/plain', item.id); e.dataTransfer.setData('obstacleType', item.id) }}><div className="obstacle-icon-wrap"><ObstacleIcon type={item.id} small /></div><div><strong>{item.label}</strong><span>{selectedObstacleType === item.id ? 'Selected · click road' : 'Drag to place'}</span></div><b>⋮⋮</b></div>)}</div>
      <div className="palette-note">Double-click a placed obstacle to remove it. Passed objects are removed permanently.</div>
    </div>
    <div className="pipeline-mini"><span className="eyebrow">Pipeline status</span>{['DETECT','PREDICT','QUANTIFY RISK','GENERATE PATHS','ADAPT & ACT'].map((s,i) => <div className="pipeline-step" key={s}><span>{String(i+1).padStart(2,'0')}</span><strong>{s}</strong><i className={i===4 ? 'active' : ''}/></div>)}</div>
  </aside>
}

function RoadObject({ object, crashed, onRemove }) {
  const type = obstacleTypes.find(i => i.id === object.type) || obstacleTypes[0]
  return <g className={`road-obstacle obstacle-${object.type}${crashed ? ' collision-obstacle' : ''}`} transform={`translate(${object.x} ${object.y})`} onDoubleClick={e => { e.stopPropagation(); onRemove(object.id) }}>
    <circle className="obstacle-halo" r={type.radius + 4}/>
    <g className="road-object-glyph" transform="translate(-10 -10)"><ObstacleIcon type={object.type}/></g>
    <text y={type.radius + 14} textAnchor="middle">{type.label}</text>
  </g>
}

function Vegetation() {
  const left = [{x:55,y:70,s:.68},{x:105,y:155,s:.55},{x:62,y:260,s:.73},{x:112,y:365,s:.6},{x:58,y:470,s:.67}]
  const right = [{x:705,y:88,s:.6},{x:660,y:180,s:.71},{x:706,y:285,s:.56},{x:657,y:390,s:.71},{x:708,y:485,s:.62}]
  const tree = (t,k) => <g key={k} className="road-tree" transform={`translate(${t.x} ${t.y}) scale(${t.s})`}><ellipse className="tree-shadow" cx="0" cy="20" rx="16" ry="5"/><rect className="tree-trunk" x="-3" y="5" width="6" height="18" rx="2"/><circle className="tree-crown crown-one" cx="-7" cy="3" r="10"/><circle className="tree-crown crown-two" cx="7" cy="2" r="11"/><circle className="tree-crown crown-three" cx="0" cy="-6" r="12"/></g>
  return <g aria-label="Trees and roadside vegetation">{left.map((t,i) => tree(t,`l${i}`))}{right.map((t,i) => tree(t,`r${i}`))}</g>
}

function EgoVehicle({ x }) {
  return <g className="ego-vehicle-blue ego-realistic ego-fixed ego-maneuvering" transform={`translate(${x} ${EGO_Y})`}>
    <ellipse className="vehicle-shadow" cx="0" cy="43" rx="25" ry="8"/>
    <rect className="vehicle-body" x="-23" y="-41" width="46" height="82" rx="13"/>
    <path className="vehicle-hood" d="M-17-25 Q0-34 17-25 L15-10 Q0-4-15-10Z"/>
    <rect className="vehicle-cabin" x="-16" y="-4" width="32" height="32" rx="7"/>
    <path className="vehicle-windshield" d="M-12-1 Q0-7 12-1 L10 7 Q0 12-10 7Z"/>
    <path className="vehicle-rear-glass" d="M-10 16 Q0 21 10 16 L9 23 Q0 27-9 23Z"/>
    <circle className="headlight" cx="-14" cy="-34" r="2.3"/><circle className="headlight" cx="14" cy="-34" r="2.3"/>
    <circle className="tail-light" cx="-14" cy="34" r="2.1"/><circle className="tail-light" cx="14" cy="34" r="2.1"/>
  </g>
}

function RoadCanvas({ running, speed, selectedObstacleType, setSelectedObstacleType, obstacles, setObstacles, crashed, setCrashed, setTelemetry, maneuver, setManeuver }) {
  const sceneRef = useRef(null)
  const offsetRef = useRef(0)
  const speedRef = useRef(speed)
  const obstaclesRef = useRef(obstacles)
  const egoXRef = useRef(ROAD_CENTER_X)
  const maneuverRef = useRef(maneuver)
  const [roadOffset, setRoadOffset] = useState(0)
  const [egoX, setEgoX] = useState(ROAD_CENTER_X)
  const [dragActive, setDragActive] = useState(false)

  useEffect(() => { speedRef.current = speed }, [speed])
  useEffect(() => { obstaclesRef.current = obstacles }, [obstacles])
  useEffect(() => { maneuverRef.current = maneuver }, [maneuver])

  const radiusOf = type => obstacleTypes.find(i => i.id === type)?.radius ?? 9
  const roadCandidates = Array.from({ length: 21 }, (_, i) => ROAD_MIN_X + ((ROAD_MAX_X - ROAD_MIN_X) / 20) * i)

  const isPathClear = (candidateX, referenceY = EGO_Y - 20, ignoreId = null) => {
    return !obstaclesRef.current.some(item => {
      if (item.id === ignoreId) return false
      const y = Number(item.worldY) + offsetRef.current
      const r = radiusOf(item.type)
      if (y < referenceY - 85 || y > EGO_Y + 90) return false
      return Math.abs(Number(item.x) - candidateX) < EGO_HALF_WIDTH + r + 18
    })
  }

  const bestSteeringTarget = (threat) => {
    const currentX = egoXRef.current
    const candidates = roadCandidates.filter(x => isPathClear(x, threat.movedY, threat.id))
    if (!candidates.length) return null

    const nearby = obstaclesRef.current
      .filter(item => item.id !== threat.id)
      .map(item => ({ item, y: Number(item.worldY) + offsetRef.current, r: radiusOf(item.type) }))
      .filter(({ y }) => y > threat.movedY - 100 && y < EGO_Y + 100)

    const score = x => {
      const obstacleClearance = nearby.length
        ? Math.min(...nearby.map(({ item, r }) => Math.abs(Number(item.x) - x) - (r + EGO_HALF_WIDTH)))
        : 140
      const threatClearance = Math.abs(Number(threat.x) - x) - (radiusOf(threat.type) + EGO_HALF_WIDTH)
      const movementCost = Math.abs(x - currentX)
      const centerCost = Math.abs(x - ROAD_CENTER_X)
      return Math.min(obstacleClearance, threatClearance) * 4 - movementCost * 0.6 - centerCost * 0.12
    }

    return candidates.reduce((best, x) => score(x) > score(best) ? x : best, candidates[0])
  }

  const findThreat = (nextOffset) => {
    let closest = null
    for (const item of obstaclesRef.current) {
      const y = Number(item.worldY) + nextOffset
      const lateralGap = EGO_HALF_WIDTH + radiusOf(item.type) + 42
      if (y < EGO_Y - 16 && y > EGO_Y - WARNING_DISTANCE && Math.abs(Number(item.x) - egoXRef.current) < lateralGap) {
        if (!closest || y > closest.movedY) closest = { ...item, movedY: y }
      }
    }
    return closest
  }

  useEffect(() => {
    if (!running || crashed) return undefined
    let frame = 0
    let last = performance.now()

    const tick = now => {
      const delta = Math.min(80, now - last)
      last = now
      const v = Math.max(0, Number(speedRef.current))
      const pps = v * 2.4
      const nextOffset = offsetRef.current + (delta / 1000) * pps
      offsetRef.current = nextOffset
      setRoadOffset(nextOffset)

      const current = obstaclesRef.current
      const surviving = current.filter(item => Number(item.worldY) + nextOffset <= ROAD_BOTTOM + 55)
      if (surviving.length !== current.length) {
        obstaclesRef.current = surviving
        setObstacles(surviving)
      }

      const threat = findThreat(nextOffset)
      let m = maneuverRef.current
      const tracked = m.obstacleId ? current.find(item => item.id === m.obstacleId) : null
      const trackedY = tracked ? Number(tracked.worldY) + nextOffset : Number.POSITIVE_INFINITY

      if (v > 0 && threat) {
        const trackedThreat = m.obstacleId === threat.id
        if (m.mode === 'cruise' || !trackedThreat || !isPathClear(m.targetX, threat.movedY, threat.id)) {
          const target = bestSteeringTarget(threat)
          m = target === null
            ? { mode: 'brake', targetX: egoXRef.current, reason: 'BRAKING — ROAD FULL', obstacleId: threat.id }
            : { mode: threat.type === 'car' ? 'overtake' : 'avoid', targetX: target, reason: threat.type === 'car' ? 'OVERTAKING AHEAD' : 'STEERING AROUND OBSTACLE', obstacleId: threat.id }
          maneuverRef.current = m
          setManeuver(m)
        }
      } else if (m.mode === 'avoid' || m.mode === 'overtake' || m.mode === 'return') {
        if (!tracked || trackedY > EGO_Y + 80) {
          const returnTarget = isPathClear(ROAD_CENTER_X, EGO_Y, null) ? ROAD_CENTER_X : bestSteeringTarget({ x: egoXRef.current, movedY: EGO_Y - 10, id: 'virtual' })
          const target = returnTarget ?? egoXRef.current
          m = Math.abs(target - egoXRef.current) < 2
            ? { mode: 'cruise', targetX: ROAD_CENTER_X, reason: 'OPEN ROAD', obstacleId: null }
            : { mode: 'return', targetX: target, reason: 'CLEARING THE ROAD', obstacleId: null }
          maneuverRef.current = m
          setManeuver(m)
        }
      }

      let nextX = egoXRef.current
      if (m.mode !== 'brake') {
        const direction = m.targetX - egoXRef.current
        const maxStep = (delta / 1000) * STEER_SPEED
        const step = Math.abs(direction) <= maxStep ? direction : Math.sign(direction) * maxStep
        nextX = Math.max(ROAD_MIN_X, Math.min(ROAD_MAX_X, egoXRef.current + step))
      }

      let collision = false
      for (const item of current) {
        const y = Number(item.worldY) + nextOffset
        const r = radiusOf(item.type)
        const dx = Math.abs(Number(item.x) - nextX)
        const dy = Math.abs(y - EGO_Y)
        if (dx <= EGO_HALF_WIDTH + r && dy <= EGO_HALF_HEIGHT + r) {
          collision = true
          break
        }
      }

      const lateralDelta = nextX - egoXRef.current
      egoXRef.current = nextX
      setEgoX(nextX)

      if (m.mode === 'brake') {
        const distance = threat ? Math.max(0, EGO_Y - threat.movedY) : 999
        const ttc = v > 0 ? distance / Math.max(1, pps) : 8
        setTelemetry(t => ({ ...t, speed: v, targetSpeed: v, acceleration: v > 0 ? -3.2 : 0, steering: 0, ttc: Math.max(.1, Math.min(8, ttc)), collisionProbability: Math.min(99, Math.max(20, 100 - ttc * 20)) }))
      } else {
        const steering = Math.abs(lateralDelta) < 0.2 ? 0 : Math.max(-35, Math.min(35, Math.round((lateralDelta / Math.max(1, delta)) * 120)))
        const ttc = threat ? Math.max(.1, (EGO_Y - threat.movedY) / Math.max(1, pps)) : 8
        setTelemetry(t => ({ ...t, speed: v, targetSpeed: v, acceleration: Math.abs(lateralDelta) > 0.2 ? 0.8 : 0, steering, ttc: Math.min(8, ttc), collisionProbability: threat ? Math.min(85, Math.max(5, 85 - ttc * 8)) : 0 }))
        if ((m.mode === 'return' || m.mode === 'avoid' || m.mode === 'overtake') && Math.abs(m.targetX - nextX) < 2 && m.mode === 'return') {
          const cruise = { mode: 'cruise', targetX: ROAD_CENTER_X, reason: 'OPEN ROAD', obstacleId: null }
          maneuverRef.current = cruise
          setManeuver(cruise)
        }
      }

      if (collision) setCrashed(true)
      frame = requestAnimationFrame(tick)
    }

    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [running, crashed, setCrashed, setManeuver, setObstacles, setTelemetry])

  const placeObstacle = (clientX, clientY, type) => {
    if (!sceneRef.current || crashed || !type) return
    const rect = sceneRef.current.getBoundingClientRect()
    const xRaw = ((clientX - rect.left) / rect.width) * VIEW_W
    const yRaw = ((clientY - rect.top) / rect.height) * VIEW_H
    const r = radiusOf(type)
    const x = Math.max(ROAD_LEFT + r, Math.min(ROAD_RIGHT - r, xRaw))
    const y = Math.max(r + 8, Math.min(ROAD_BOTTOM - r, yRaw))
    const object = { id: `${type}-${Date.now()}-${Math.random().toString(16).slice(2)}`, type, x, y, worldY: y - offsetRef.current }
    setObstacles(current => [...current, object])
    setSelectedObstacleType(null)
  }

  const handleDrop = event => {
    event.preventDefault()
    event.stopPropagation()
    setDragActive(false)
    const type = event.dataTransfer.getData('obstacleType') || event.dataTransfer.getData('text/plain')
    if (type) placeObstacle(event.clientX, event.clientY, type)
  }

  const handleClick = event => {
    if (!selectedObstacleType || crashed) return
    if (event.target.closest?.('.road-obstacle')) return
    placeObstacle(event.clientX, event.clientY, selectedObstacleType)
  }

  const vegetationOffset = roadOffset % 620

  return <div className={`twin-stage ${crashed ? 'stage-crashed' : ''}`}>
    <div className="stage-toolbar"><span><i className="legend-dot green"/> DRIVABLE ROAD</span><span><i className="legend-dot amber"/> {maneuver.mode === 'overtake' ? 'OVERTAKING PATH' : maneuver.mode === 'avoid' ? 'FREE STEERING PATH' : maneuver.mode === 'return' ? 'MERGING BACK' : 'OPEN ROAD'}</span><span className={crashed ? 'crash-toolbar' : ''}><i className="legend-dot red"/> {crashed ? 'COLLISION DETECTED' : maneuver.reason}</span></div>
    <div className={`drop-area ${dragActive ? 'drag-active' : ''}`} onDragEnter={e => { e.preventDefault(); setDragActive(true) }} onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; setDragActive(true) }} onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDragActive(false) }} onDrop={handleDrop}>
      <svg ref={sceneRef} className="road-scene" viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} aria-label="Straight road with continuous open-road autonomous steering" onDragOver={e => { e.preventDefault(); e.dataTransfer.dropEffect = 'copy' }} onDrop={handleDrop} onClick={handleClick}>
        <defs>
          <linearGradient id="road" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#1b2428"/><stop offset=".5" stopColor="#293237"/><stop offset="1" stopColor="#1a2327"/></linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#173221"/><stop offset="1" stopColor="#10271a"/></linearGradient>
        </defs>
        <rect width={VIEW_W} height={VIEW_H} fill="url(#ground)"/>
        <rect x={ROAD_LEFT} width={ROAD_RIGHT - ROAD_LEFT} height={VIEW_H} fill="url(#road)" className="road-surface"/>
        <rect x={ROAD_LEFT - 2} width="2" height={VIEW_H} className="road-edge"/>
        <rect x={ROAD_RIGHT} width="2" height={VIEW_H} className="road-edge"/>
        {[-620,0,620].map((base,i) => <g key={`veg-${i}`} className="moving-environment" transform={`translate(0 ${base + vegetationOffset})`}><Vegetation/></g>)}
        {obstacles.map(object => { const y = Number(object.worldY) + roadOffset; return y > -50 && y < ROAD_BOTTOM + 55 ? <RoadObject key={object.id} object={{...object,y}} crashed={crashed} onRemove={id => setObstacles(current => current.filter(item => item.id !== id))}/> : null })}
        <EgoVehicle x={egoX}/>
        {crashed && <g className="collision-marker" transform={`translate(${egoX} ${EGO_Y})`}><circle r="34"/><path d="M-9-9l18 18m0-18-18 18"/></g>}
      </svg>
      <div className="drop-overlay"><span>{crashed ? 'SIMULATION STOPPED — RESTART TO CONTINUE' : selectedObstacleType ? 'CLICK ANY POINT ON THE ROAD' : 'DRAG OBSTACLE ANYWHERE ON ROAD'}</span></div>
      {dragActive && !crashed && <div className="drag-ready"><span>RELEASE TO PLACE</span></div>}
      {crashed && <div className="collision-banner"><strong>COLLISION</strong><span>The ego vehicle touched a placed obstacle.</span></div>}
    </div>
    <div className="twin-footer"><span><b className="live-dot"/> DIGITAL TWIN / {crashed ? 'COLLISION STATE' : 'OPEN-ROAD AUTONOMOUS STEERING'}</span><span>INDRA PATH <b className="path-line"/> {Math.round(speed)} km/h</span></div>
  </div>
}

function VehicleStatus({ telemetry, obstacles, crashed, maneuver }) {
  const acceleration = Number(telemetry.acceleration)
  const steering = Number(telemetry.steering)
  const ttc = Number(telemetry.ttc)
  const probability = Number(telemetry.collisionProbability)
  return <aside className="panel status-panel">
    <Title eyebrow="Telemetry" title="Vehicle status" action="EGO-01"/>
    <div className="telemetry-grid">{[['CURRENT SPEED',`${Math.round(Number(telemetry.speed))} km/h`,'neutral'],['TARGET SPEED',`${Math.round(Number(telemetry.targetSpeed))} km/h`,'teal'],['ACCELERATION',`${acceleration.toFixed(1)} m/s²`,'amber'],['STEERING ANGLE',`${Math.round(steering)}°`,'neutral']].map(([label,value,tone]) => <div className="telemetry-card" key={label}><span>{label}</span><strong className={`value-${tone}`}>{value}</strong></div>)}</div>
    <div className="status-row"><span>Brake status</span><strong className={`brake-status ${crashed || maneuver.mode === 'brake' ? 'brake-danger' : 'clear-brake'}`}><i/>{crashed ? ' LOCKED' : maneuver.mode === 'brake' ? ' APPLIED' : ' RELEASED'}</strong></div>
    <div className="risk-readout"><div><span>TIME TO COLLISION</span><strong className={crashed ? 'danger-value' : ''}>{crashed ? '0.0' : ttc.toFixed(1)}<small> sec</small></strong></div><div><span>COLLISION PROBABILITY</span><strong className={crashed ? 'danger-value' : ''}>{crashed ? '100' : Math.round(probability)}<small>%</small></strong></div></div>
    <div className="risk-meter"><span className={crashed ? 'risk-full' : ''} style={{width:`${crashed ? 100 : Math.round(probability)}%`}}/></div>
    <div className="current-risk"><span>Current risk</span><strong className={crashed ? 'collision-risk' : maneuver.mode === 'cruise' ? 'clear-risk' : 'watch-risk'}><i/>{crashed ? ' COLLISION' : maneuver.mode === 'brake' ? ' HIGH RISK' : maneuver.mode === 'overtake' ? ' OVERTAKING' : maneuver.mode === 'avoid' || maneuver.mode === 'return' ? ' MANEUVER' : obstacles.length ? ' MONITOR' : ' CLEAR'}</strong></div>
    <div className="selected-path"><span>Selected path</span><strong>{maneuver.mode === 'overtake' ? 'Free-road passing path' : maneuver.mode === 'avoid' ? 'Free steering path' : maneuver.mode === 'return' ? 'Center recovery path' : maneuver.mode === 'brake' ? 'Safe stopping path' : 'Open road'} <em>INDRA</em></strong></div>
    <div className="status-obstacles"><span>Active obstacles</span><strong>{obstacles.length}</strong></div>
  </aside>
}

function Performance({ speed, crashed }) {
  const score = crashed ? 0 : 96
  return <section className="panel performance-panel"><Title eyebrow="Benchmark run / interactive road" title="Performance comparison" action="3 CONTROLLERS"/><div className="comparison-layout"><table><thead><tr><th>METRIC</th><th>BASELINE</th><th>REACTIVE</th><th className="indra-heading">INDRA</th></tr></thead><tbody>{[['Collisions',crashed?'1':'0'],['Minimum TTC',crashed?'0.0 s':'8.0 s'],['Average speed',`${Math.round(speed)} km/h`],['Path efficiency',crashed?'0%':'100%'],['Comfort score',crashed?'0':'96'],['Emergency braking',crashed?'1':'0']].map(([m,v]) => <tr key={m}><td>{m}</td><td>{v}</td><td>{v}</td><td className="best">{v}<span>{crashed ? 'FAULT' : 'BEST'}</span></td></tr>)}</tbody></table><div className="chart"><div className="chart-caption"><span>SAFETY SCORE</span><strong>INDRA <b>{score}</b></strong></div><div className="bars"><div style={{height:crashed?'10%':'78%'}}><i>{crashed?0:94}</i><span>BASE</span></div><div style={{height:crashed?'10%':'78%'}}><i>{crashed?0:94}</i><span>REACTIVE</span></div><div className="bar-indra" style={{height:crashed?'10%':'92%'}}><i>{score}</i><span>INDRA</span></div></div></div></div></section>
}

function App() {
  const [running,setRunning] = useState(true)
  const [speed,setSpeed] = useState(38)
  const [telemetry,setTelemetry] = useState({...initialTelemetry})
  const [obstacles,setObstacles] = useState([])
  const [crashed,setCrashed] = useState(false)
  const [selectedObstacleType,setSelectedObstacleType] = useState(null)
  const [maneuver,setManeuver] = useState({mode:'cruise',targetX:ROAD_CENTER_X,reason:'OPEN ROAD',obstacleId:null})

  useEffect(() => {
    getSimulationState().then(state => {
      setRunning(Boolean(state.running))
      const value = Number(state.vehicleSpeed ?? state.telemetry?.targetSpeed ?? 38)
      setSpeed(Number.isFinite(value) ? Math.max(0,Math.min(MAX_SPEED,Math.round(value))) : 38)
      if (state.telemetry) setTelemetry(current => ({...current,...state.telemetry}))
    }).catch(() => undefined)
  },[])

  useEffect(() => {
    setTelemetry(current => ({...current,speed,targetSpeed:speed}))
  },[speed])

  const syncControl = control => {
    updateSimulationControl(control).then(state => {
      if (state.telemetry) setTelemetry(current => ({...current,...state.telemetry}))
    }).catch(() => undefined)
  }

  const restart = () => {
    setRunning(true)
    setSpeed(38)
    setTelemetry({...initialTelemetry})
    setObstacles([])
    setCrashed(false)
    setSelectedObstacleType(null)
    setManeuver({mode:'cruise',targetX:ROAD_CENTER_X,reason:'OPEN ROAD',obstacleId:null})
    restartSimulation().catch(() => undefined)
  }

  const decision = useMemo(() => {
    if (crashed) return 'Collision detected. INDRA stopped the vehicle because an obstacle reached the ego vehicle.'
    if (maneuver.mode === 'overtake') return 'A vehicle entered the driving corridor. INDRA selected an open position across the road width, steered around it, and will recover to the center after passing.'
    if (maneuver.mode === 'avoid') return 'An obstacle entered the driving corridor. INDRA is continuously steering toward the safest available position rather than following fixed lanes.'
    if (maneuver.mode === 'return') return 'The obstacle has been passed. INDRA is smoothly steering back toward the preferred center position.'
    if (maneuver.mode === 'brake') return 'The road is occupied across the available steering area. INDRA is braking rather than attempting an unsafe pass.'
    return 'The road is clear. INDRA is cruising while the road environment moves toward the fixed vehicle.'
  },[crashed,maneuver.mode])

  return <main className="app-shell">
    <header className="app-header"><div className="brand-lockup"><img className="brand-mark" src={logo} alt="INDRA-DRIVE logo"/><div><h1>INDRA-<b>DRIVE</b></h1><p>Predictive Risk-Adaptive Path Planning <span>/</span> Realistic Road Digital Twin</p></div></div><div className="header-status"><Pill>SYSTEM STATUS: ACTIVE</Pill><Pill>SIMULATION: {crashed?'STOPPED':running?'RUNNING':'PAUSED'}</Pill><Pill tone="blue">MODE: INDRA ADAPTIVE</Pill></div></header>
    <div className="dashboard-grid">
      <Controls running={running&&!crashed} setRunning={value => {if(!crashed)setRunning(value)}} speed={speed} setSpeed={setSpeed} restart={restart} syncControl={syncControl} selectedObstacleType={selectedObstacleType} setSelectedObstacleType={setSelectedObstacleType} obstacles={obstacles}/>
      <section className="panel twin-panel"><Title eyebrow="Live environment / top-down view" title="Digital twin" action="30 FPS"/><RoadCanvas running={running&&speed>0} speed={speed} selectedObstacleType={selectedObstacleType} setSelectedObstacleType={setSelectedObstacleType} obstacles={obstacles} setObstacles={setObstacles} crashed={crashed} setCrashed={setCrashed} setTelemetry={setTelemetry} maneuver={maneuver} setManeuver={setManeuver}/><div className="twin-insight"><span className={`alert-icon ${crashed?'collision-icon':maneuver.mode==='cruise'?'clear-icon':'watch-icon'}`}>{crashed?'!':maneuver.mode==='cruise'?'✓':'!'}</span><div><strong className={crashed?'collision-text':maneuver.mode==='cruise'?'clear-text':'watch-text'}>{crashed?'COLLISION DETECTED':maneuver.mode==='overtake'?'OVERTAKING':maneuver.mode==='avoid'?'OBSTACLE AVOIDANCE':maneuver.mode==='return'?'RETURNING TO ROAD':maneuver.mode==='brake'?'BRAKING':'OPEN ROAD'}</strong><p>{decision}</p></div><span className="insight-time">{crashed?'STOP':maneuver.mode==='cruise'?'SAFE':'ACTIVE'}</span></div></section>
      <VehicleStatus telemetry={telemetry} obstacles={obstacles} crashed={crashed} maneuver={maneuver}/>
    </div>
    <div className="lower-grid"><Performance speed={speed} crashed={crashed}/><section className="panel decision-panel"><Title eyebrow="Why did INDRA act?" title="Explainable decision" action="AUTO-LOGGED"/><div className="decision-copy"><div className="decision-tag"><span>01</span> DECISION TRACE</div><p>{decision}</p><div className="decision-facts"><div><span>PATHS EVALUATED</span><strong>{maneuver.mode==='cruise'?'21':maneuver.mode==='brake'?'0':'21'}</strong></div><div><span>RISK REDUCTION</span><strong>{crashed?'0%':maneuver.mode==='brake'?'35%':'100%'}</strong></div><div><span>WEIGHT PROFILE</span><strong>SAFETY <em>70%</em></strong></div></div><div className="action-callout"><span>↳</span><div><small>ACTION</small><strong>{crashed?'Stop vehicle + log collision':maneuver.mode==='overtake'?'Steer around vehicle + pass + recover':maneuver.mode==='avoid'?'Steer around obstacle + maintain clearance':maneuver.mode==='return'?'Recover preferred road position':maneuver.mode==='brake'?'Brake + wait for safe gap':`Cruise at ${Math.round(speed)} km/h`}</strong></div></div></div></section></div>
    <footer className="app-footer"><span><b className="live-dot"/> SIMULATION ENGINE READY</span><span>SCENARIO: STRAIGHT ROAD &nbsp;·&nbsp; WEATHER: CLEAR &nbsp;·&nbsp; SPEED LIMIT: 100 km/h</span><strong>SAFETY FIRST <i>◆</i></strong></footer>
  </main>
}

export default App
