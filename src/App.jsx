import { useEffect, useMemo, useRef, useState } from 'react'
import './App.css'
import './motion.css'
import { getSimulationState, restartSimulation, updateSimulationControl } from './services/simulationApi'
import logo from './assets/Logo.png'

const initialTelemetry = { speed: 38, targetSpeed: 38, acceleration: 0, steering: 0, ttc: 8, collisionProbability: 0 }
const scenarios = ['Straight road']

const obstacleTypes = [
  { id: 'pedestrian', label: 'Pedestrian', tone: 'red' },
  { id: 'bike', label: 'Bike', tone: 'amber' },
  { id: 'car', label: 'Other car', tone: 'blue' },
  { id: 'pothole', label: 'Pothole', tone: 'dark' },
  { id: 'hazard', label: 'Hazard object', tone: 'yellow' },
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
  if (type === 'car') return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><rect x="7" y="8" width="18" height="16" rx="4" /><path d="M10 8l2-4h8l2 4M10 20h3m6 0h3" /></svg>
  if (type === 'pothole') return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><ellipse cx="16" cy="17" rx="11" ry="7" /><path d="M8 14l4 2m2-3 4 2m2-4 4 2m-9 7 4 1" /></svg>
  return <svg className={className} viewBox="0 0 32 32" aria-hidden="true"><path d="M16 4l12 22H4z" /><path d="M16 11v8m0 4v1" /></svg>
}

function Controls({ running, setRunning, scenario, setScenario, speed, setSpeed, restart, syncControl }) {
  return <aside className="panel controls-panel">
    <Title eyebrow="Mission control" title="Scenario" action="LIVE" />
    <div className="control-section"><label htmlFor="scenario">Scenario type</label><select id="scenario" value={scenario} onChange={(event) => { setScenario(event.target.value); syncControl({ scenario: event.target.value }) }}>{scenarios.map((item) => <option key={item}>{item}</option>)}</select></div>
    <div className="control-section"><div className="label-row"><label>Traffic density</label><strong>LOW</strong></div><div className="density-bars" aria-label="Low traffic density"><b /><b /><b /></div><p className="muted">Road starts clear · add obstacles manually</p></div>
    <div className="control-section compact-grid"><div><span>WEATHER</span><strong>CLEAR</strong></div><div><span>VISIBILITY</span><strong>120 m</strong></div></div>
    <div className="control-section"><div className="label-row"><label htmlFor="sim-speed">Simulation speed</label><strong>{speed}x</strong></div><input id="sim-speed" type="range" min="0.5" max="2" step="0.5" value={speed} onChange={(event) => { setSpeed(event.target.value); syncControl({ speedMultiplier: event.target.value }) }} /><div className="range-labels"><span>0.5x</span><span>1x</span><span>2x</span></div></div>
    <div className="control-actions"><button className="button button-primary" type="button" onClick={() => { const nextRunning = !running; setRunning(nextRunning); syncControl({ running: nextRunning }) }}>{running ? '||  Pause' : '>  Resume'}</button><button className="button button-quiet" type="button" onClick={restart}>↻  Restart</button></div>

    <div className="obstacle-palette">
      <div className="obstacle-palette-head"><div><span className="eyebrow">Environment editor</span><h3>Obstacle</h3></div><span className="drag-hint">DRAG → ROAD</span></div>
      <p className="palette-copy">Select an object below, then drag it onto the road.</p>
      <div className="obstacle-list">
        {obstacleTypes.map((item) => <div key={item.id} className={`obstacle-item obstacle-${item.tone}`} draggable onDragStart={(event) => event.dataTransfer.setData('obstacleType', item.id)} title={`Drag ${item.label} onto the road`}><div className="obstacle-icon-wrap"><ObstacleIcon type={item.id} small /></div><div><strong>{item.label}</strong><span>Drag to place</span></div><b>⋮⋮</b></div>)}
      </div>
      <div className="palette-note">Double-click a placed object to remove it.</div>
    </div>

    <div className="pipeline-mini"><span className="eyebrow">Pipeline status</span>{['DETECT', 'PREDICT', 'QUANTIFY RISK', 'GENERATE PATHS', 'ADAPT & ACT'].map((step, index) => <div className="pipeline-step" key={step}><span>{String(index + 1).padStart(2, '0')}</span><strong>{step}</strong><i className={index === 4 ? 'active' : ''} /></div>)}</div>
  </aside>
}

function RoadObject({ object, onRemove }) {
  const label = obstacleTypes.find((item) => item.id === object.type)?.label || object.type
  return <g className={`road-obstacle obstacle-${object.type}`} transform={`translate(${object.x} ${object.y})`} onDoubleClick={(event) => { event.stopPropagation(); onRemove(object.id) }}>
    <circle className="obstacle-halo" r="24" />
    <g className="road-object-glyph"><ObstacleIcon type={object.type} /></g>
    <text y="36" textAnchor="middle">{label}</text>
  </g>
}

function Vegetation() {
  const leftTrees = [
    { x: 55, y: 70, s: 0.95 }, { x: 105, y: 155, s: 0.78 }, { x: 62, y: 260, s: 1.1 }, { x: 112, y: 365, s: 0.83 }, { x: 58, y: 470, s: 1.0 },
  ]
  const rightTrees = [
    { x: 705, y: 88, s: 0.85 }, { x: 660, y: 180, s: 1.06 }, { x: 706, y: 285, s: 0.82 }, { x: 657, y: 390, s: 1.08 }, { x: 708, y: 485, s: 0.92 },
  ]
  const grasses = [35, 86, 132, 626, 673, 724]
  const tree = (item, key) => <g key={key} className="road-tree" transform={`translate(${item.x} ${item.y}) scale(${item.s})`}><ellipse className="tree-shadow" cx="0" cy="20" rx="16" ry="6" /><rect className="tree-trunk" x="-3" y="5" width="6" height="18" rx="2" /><circle className="tree-crown crown-one" cx="-7" cy="3" r="10" /><circle className="tree-crown crown-two" cx="7" cy="2" r="11" /><circle className="tree-crown crown-three" cx="0" cy="-6" r="12" /></g>
  return <g aria-label="Trees and roadside vegetation">{leftTrees.map((item, index) => tree(item, `left-tree-${index}`))}{rightTrees.map((item, index) => tree(item, `right-tree-${index}`))}{grasses.map((x, index) => <path key={`grass-${index}`} className="grass-tuft" d={`M${x} ${120 + (index % 3) * 110} q-8-13 0-23 q8 10 0 23 m2 0 q7-11 13-10 q-3 9-13 10`} />)}</g>
}

function RoadCanvas({ running, telemetry, obstacles, setObstacles }) {
  const sceneRef = useRef(null)
  const [roadOffset, setRoadOffset] = useState(0)

  useEffect(() => {
    if (!running) return undefined
    let frame = 0
    let last = performance.now()
    const tick = (now) => {
      const delta = Math.min(80, now - last)
      last = now
      setRoadOffset((current) => (current + delta * (0.018 + Number(telemetry.speed) * 0.0015)) % 560)
      frame = window.requestAnimationFrame(tick)
    }
    frame = window.requestAnimationFrame(tick)
    return () => window.cancelAnimationFrame(frame)
  }, [running, telemetry.speed])

  const dropObstacle = (event) => {
    event.preventDefault()
    const type = event.dataTransfer.getData('obstacleType')
    if (!type || !sceneRef.current) return
    const rect = sceneRef.current.getBoundingClientRect()
    const x = ((event.clientX - rect.left) / rect.width) * 760
    const y = ((event.clientY - rect.top) / rect.height) * 560
    const clampedX = Math.max(215, Math.min(545, x))
    const clampedY = Math.max(32, Math.min(528, y))
    setObstacles((current) => [...current, { id: `${type}-${Date.now()}`, type, x: clampedX, y: clampedY }])
  }

  const stripeY = Array.from({ length: 9 }, (_, index) => ((index * 75 + roadOffset) % 675) - 65)
  const treeOffset = roadOffset * 0.82
  const obstacleOffset = roadOffset * 1.12

  return <div className="twin-stage">
    <div className="stage-toolbar"><span><i className="legend-dot green" /> DRIVABLE ROAD</span><span><i className="legend-dot amber" /> CENTER LANE</span><span><i className="legend-dot red" /> DROP ZONE READY</span></div>
    <div className="drop-area" onDragOver={(event) => event.preventDefault()} onDrop={dropObstacle}>
      <svg ref={sceneRef} className="road-scene" viewBox="0 0 760 560" role="img" aria-label="Top-down straight road with a stationary blue ego vehicle, moving road markings, trees and draggable obstacles">
        <defs>
          <linearGradient id="road" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#1c2529" /><stop offset=".52" stopColor="#293338" /><stop offset="1" stopColor="#1b2529" /></linearGradient>
          <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#173221" /><stop offset="1" stopColor="#10271a" /></linearGradient>
        </defs>
        <rect width="760" height="560" fill="url(#ground)" />
        <path className="road-shoulder" d="M150 0 H610 L570 560 H190 Z" />
        <path className="road-surface" d="M150 0 H610 L570 560 H190 Z" fill="url(#road)" />
        <path className="road-edge" d="M175 0 L208 560 M585 0 L552 560" />

        <g className="moving-environment" transform={`translate(0 ${treeOffset - 560})`}><Vegetation /></g>
        <g className="moving-environment" transform={`translate(0 ${treeOffset})`}><Vegetation /></g>
        <g className="moving-environment" transform={`translate(0 ${treeOffset + 560})`}><Vegetation /></g>

        {stripeY.map((y) => <path key={`center-${y}`} className="road-centerline moving-line" d={`M380 ${y} V${y + 42}`} />)}

        <g className="moving-obstacles">
          {obstacles.map((object) => {
            const movedY = ((object.y + obstacleOffset) % 650) - 45
            return movedY > -55 && movedY < 615
              ? <RoadObject key={object.id} object={{ ...object, y: movedY }} onRemove={(id) => setObstacles((current) => current.filter((item) => item.id !== id))} />
              : null
          })}
        </g>

        <g className="ego-vehicle-blue ego-fixed" transform="translate(380 455)">
          <rect x="-25" y="-42" width="50" height="84" rx="12" /><rect className="ego-window" x="-16" y="-26" width="32" height="25" rx="5" /><path className="ego-beam" d="M-14-39h28" />
        </g>
      </svg>
      <div className="drop-overlay"><span>DROP OBSTACLE ON ROAD</span></div>
    </div>
    <div className="twin-footer"><span><b className="live-dot" /> DIGITAL TWIN / ROAD MOTION</span><span>INDRA PATH <b className="path-line" /> {telemetry.targetSpeed} km/h TARGET</span></div>
  </div>
}

function VehicleStatus({ telemetry, obstacles }) {
  const items = [['CURRENT SPEED', `${Math.round(telemetry.speed)} km/h`, 'neutral'], ['TARGET SPEED', `${telemetry.targetSpeed} km/h`, 'teal'], ['ACCELERATION', `${telemetry.acceleration} m/s²`, 'amber'], ['STEERING ANGLE', `${telemetry.steering}°`, 'neutral']]
  return <aside className="panel status-panel"><Title eyebrow="Telemetry" title="Vehicle status" action="EGO-01" /><div className="telemetry-grid">{items.map(([label, value, tone]) => <div className="telemetry-card" key={label}><span>{label}</span><strong className={`value-${tone}`}>{value}</strong></div>)}</div><div className="status-row"><span>Brake status</span><strong className="brake-status clear-brake"><i /> RELEASED</strong></div><div className="risk-readout"><div><span>TIME TO COLLISION</span><strong>{telemetry.ttc.toFixed(1)}<small> sec</small></strong></div><div><span>COLLISION PROBABILITY</span><strong>{Math.round(telemetry.collisionProbability)}<small>%</small></strong></div></div><div className="risk-meter"><span style={{ width: `${telemetry.collisionProbability}%` }} /></div><div className="current-risk"><span>Current risk</span><strong className={obstacles.length ? 'watch-risk' : 'clear-risk'}><i /> {obstacles.length ? 'MONITOR' : 'CLEAR'}</strong></div><div className="selected-path"><span>Selected path</span><strong>Center lane <em>INDRA</em></strong></div><div className="status-obstacles"><span>Placed obstacles</span><strong>{obstacles.length}</strong></div></aside>
}

function Performance() {
  const rows = [['Collisions', '0', '0', '0'], ['Minimum TTC', '8.0 s', '8.0 s', '8.0 s'], ['Average speed', '38 km/h', '38 km/h', '38 km/h'], ['Path efficiency', '100%', '100%', '100%'], ['Comfort score', '94', '94', '96'], ['Emergency braking', '0', '0', '0']]
  return <section className="panel performance-panel"><Title eyebrow="Benchmark run / interactive road" title="Performance comparison" action="3 CONTROLLERS" /><div className="comparison-layout"><table><thead><tr><th>METRIC</th><th>BASELINE</th><th>REACTIVE</th><th className="indra-heading">INDRA</th></tr></thead><tbody>{rows.map(([metric, baseline, reactive, indra]) => <tr key={metric}><td>{metric}</td><td>{baseline}</td><td>{reactive}</td><td className="best">{indra}<span>BEST</span></td></tr>)}</tbody></table><div className="chart"><div className="chart-caption"><span>SAFETY SCORE</span><strong>INDRA <b>96</b></strong></div><div className="bars"><div style={{ height: '78%' }}><i>94</i><span>BASE</span></div><div style={{ height: '78%' }}><i>94</i><span>REACTIVE</span></div><div className="bar-indra" style={{ height: '92%' }}><i>96</i><span>INDRA</span></div></div></div></div></section>
}

function App() {
  const [running, setRunning] = useState(true)
  const [scenario, setScenario] = useState(scenarios[0])
  const [speed, setSpeed] = useState('1')
  const [telemetry, setTelemetry] = useState(initialTelemetry)
  const [obstacles, setObstacles] = useState([])

  useEffect(() => {
    getSimulationState().then((state) => {
      setRunning(state.running)
      setScenario(state.scenario)
      setSpeed(String(state.speedMultiplier))
      if (state.telemetry) setTelemetry(state.telemetry)
    })
  }, [])

  const decision = useMemo(() => obstacles.length
    ? `INDRA is tracking ${obstacles.length} user-placed obstacle${obstacles.length > 1 ? 's' : ''} while keeping the ego vehicle fixed and advancing the road environment toward it.`
    : 'Clear straight road detected. INDRA is maintaining a centered path while the road environment moves toward the fixed ego vehicle.', [obstacles.length])

  const syncControl = (control) => {
    updateSimulationControl(control).then((state) => {
      if (state.telemetry) setTelemetry(state.telemetry)
    })
  }

  const restart = () => {
    setTelemetry(initialTelemetry)
    setRunning(true)
    setScenario(scenarios[0])
    setSpeed('1')
    setObstacles([])
    restartSimulation().then((state) => {
      if (state.telemetry) setTelemetry(state.telemetry)
    })
  }

  return <main className="app-shell">
    <header className="app-header">
      <div className="brand-lockup"><img className="brand-mark" src={logo} alt="INDRA-DRIVE logo" /><div><h1>INDRA-<b>DRIVE</b></h1><p>Predictive Risk-Adaptive Path Planning <span>/</span> Unstructured Indian Roads</p></div></div>
      <div className="header-status"><Pill>SYSTEM STATUS: ACTIVE</Pill><Pill>SIMULATION: {running ? 'RUNNING' : 'PAUSED'}</Pill><Pill tone="blue">MODE: INDRA ADAPTIVE</Pill></div>
    </header>

    <div className="dashboard-grid">
      <Controls running={running} setRunning={setRunning} scenario={scenario} setScenario={setScenario} speed={speed} setSpeed={setSpeed} restart={restart} syncControl={syncControl} />
      <section className="panel twin-panel"><Title eyebrow="Live environment / top-down view" title="Digital twin" action="30 FPS" /><RoadCanvas running={running} telemetry={telemetry} obstacles={obstacles} setObstacles={setObstacles} /><div className="twin-insight"><span className="alert-icon clear-icon">✓</span><div><strong className={obstacles.length ? 'watch-text' : 'clear-text'}>{obstacles.length ? 'OBSTACLE MONITORING' : 'ROAD CLEAR'}</strong><p>{obstacles.length ? `${obstacles.length} user-placed obstacle${obstacles.length > 1 ? 's are' : ' is'} moving with the road environment; the ego vehicle remains fixed in the camera.` : 'Ego vehicle remains fixed in the camera while road markings, trees and vegetation move toward it.'}</p></div><span className="insight-time">{obstacles.length ? 'ACTIVE' : 'SAFE'}</span></div></section>
      <VehicleStatus telemetry={telemetry} obstacles={obstacles} />
    </div>

    <div className="lower-grid">
      <Performance />
      <section className="panel decision-panel"><Title eyebrow="Why did INDRA act?" title="Explainable decision" action="AUTO-LOGGED" /><div className="decision-copy"><div className="decision-tag"><span>01</span> DECISION TRACE</div><p>{decision}</p><div className="decision-facts"><div><span>PATHS EVALUATED</span><strong>1</strong></div><div><span>RISK REDUCTION</span><strong>100%</strong></div><div><span>WEIGHT PROFILE</span><strong>SAFETY <em>70%</em></strong></div></div><div className="action-callout"><span>↳</span><div><small>ACTION</small><strong>Keep ego vehicle fixed + advance road environment</strong></div></div></div></section>
    </div>

    <footer className="app-footer"><span><b className="live-dot" /> SIMULATION ENGINE READY</span><span>SCENARIO: STRAIGHT ROAD &nbsp;·&nbsp; WEATHER: CLEAR &nbsp;·&nbsp; SEED: IDR-2048</span><strong>SAFETY FIRST <i>◆</i></strong></footer>
  </main>
}

export default App
