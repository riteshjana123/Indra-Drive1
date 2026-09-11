import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { getSimulationState, restartSimulation, updateSimulationControl } from './services/simulationApi'
import logo from './assets/Logo.png'

const initialTelemetry = { speed: 38, targetSpeed: 38, acceleration: 0, steering: 0, ttc: 8, collisionProbability: 0 }
const scenarios = ['Straight road']

function Pill({ children, tone = 'green' }) { return <span className={`pill pill-${tone}`}><i />{children}</span> }
function Title({ eyebrow, title, action }) { return <div className="panel-title"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action && <span className="panel-action">{action}</span>}</div> }

function Controls({ running, setRunning, scenario, setScenario, speed, setSpeed, restart, syncControl }) {
  return <aside className="panel controls-panel">
    <Title eyebrow="Mission control" title="Scenario" action="LIVE" />
    <div className="control-section"><label htmlFor="scenario">Scenario type</label><select id="scenario" value={scenario} onChange={(event) => { setScenario(event.target.value); syncControl({ scenario: event.target.value }) }}>{scenarios.map((item) => <option key={item}>{item}</option>)}</select></div>
    <div className="control-section"><div className="label-row"><label>Traffic density</label><strong>LOW</strong></div><div className="density-bars" aria-label="Low traffic density"><b /><b /><b /></div><p className="muted">Clear road · 0 dynamic road users</p></div>
    <div className="control-section compact-grid"><div><span>WEATHER</span><strong>CLEAR</strong></div><div><span>VISIBILITY</span><strong>120 m</strong></div></div>
    <div className="control-section"><div className="label-row"><label htmlFor="sim-speed">Simulation speed</label><strong>{speed}x</strong></div><input id="sim-speed" type="range" min="0.5" max="2" step="0.5" value={speed} onChange={(event) => { setSpeed(event.target.value); syncControl({ speedMultiplier: event.target.value }) }} /><div className="range-labels"><span>0.5x</span><span>1x</span><span>2x</span></div></div>
    <div className="control-actions"><button className="button button-primary" type="button" onClick={() => { const nextRunning = !running; setRunning(nextRunning); syncControl({ running: nextRunning }) }}>{running ? '||  Pause' : '>  Resume'}</button><button className="button button-quiet" type="button" onClick={restart}>↻  Restart</button></div>
    <div className="pipeline-mini"><span className="eyebrow">Pipeline status</span>{['DETECT', 'PREDICT', 'QUANTIFY RISK', 'GENERATE PATHS', 'ADAPT & ACT'].map((step, index) => <div className="pipeline-step" key={step}><span>{String(index + 1).padStart(2, '0')}</span><strong>{step}</strong><i className={index === 4 ? 'active' : ''} /></div>)}</div>
  </aside>
}

function RoadCanvas({ telemetry }) {
  return <div className="twin-stage">
    <div className="stage-toolbar"><span><i className="legend-dot green" /> DRIVABLE ROAD</span><span><i className="legend-dot amber" /> CENTER LANE</span><span><i className="legend-dot red" /> ROAD CLEAR</span></div>
    <svg className="road-scene" viewBox="0 0 760 560" role="img" aria-label="Top-down straight road with only the blue ego vehicle">
      <defs><linearGradient id="road" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#1c2529" /><stop offset=".52" stopColor="#293338" /><stop offset="1" stopColor="#1b2529" /></linearGradient></defs>
      <path className="road-surface" d="M150 0 H610 L570 560 H190 Z" fill="url(#road)" />
      <path className="road-edge" d="M175 0 L208 560 M585 0 L552 560" />
      <path className="road-centerline" d="M380 0 V70 M380 105 V175 M380 210 V280 M380 315 V385 M380 420 V490 M380 525 V560" />
      <path className="selected-path" d="M380 525 V65" />
      <g className="ego-vehicle-blue" transform="translate(380 455)"><rect x="-25" y="-42" width="50" height="84" rx="12" /><rect className="ego-window" x="-16" y="-26" width="32" height="25" rx="5" /><path className="ego-beam" d="M-14-39h28" /></g>
    </svg>
    <div className="twin-footer"><span><b className="live-dot" /> DIGITAL TWIN / STRAIGHT ROAD</span><span>INDRA PATH <b className="path-line" /> {telemetry.targetSpeed} km/h TARGET</span></div>
  </div>
}

function VehicleStatus({ telemetry }) {
  const items = [['CURRENT SPEED', `${Math.round(telemetry.speed)} km/h`, 'neutral'], ['TARGET SPEED', `${telemetry.targetSpeed} km/h`, 'teal'], ['ACCELERATION', `${telemetry.acceleration} m/s²`, 'amber'], ['STEERING ANGLE', `${telemetry.steering}°`, 'neutral']]
  return <aside className="panel status-panel"><Title eyebrow="Telemetry" title="Vehicle status" action="EGO-01" /><div className="telemetry-grid">{items.map(([label, value, tone]) => <div className="telemetry-card" key={label}><span>{label}</span><strong className={`value-${tone}`}>{value}</strong></div>)}</div><div className="status-row"><span>Brake status</span><strong className="brake-status clear-brake"><i /> RELEASED</strong></div><div className="risk-readout"><div><span>TIME TO COLLISION</span><strong>{telemetry.ttc.toFixed(1)}<small> sec</small></strong></div><div><span>COLLISION PROBABILITY</span><strong>{telemetry.collisionProbability}<small>%</small></strong></div></div><div className="risk-meter"><span style={{ width: `${telemetry.collisionProbability}%` }} /></div><div className="current-risk"><span>Current risk</span><strong className="clear-risk"><i /> CLEAR</strong></div><div className="selected-path"><span>Selected path</span><strong>Center lane <em>INDRA</em></strong></div></aside>
}

function Performance() {
  const rows = [['Collisions', '0', '0', '0'], ['Minimum TTC', '8.0 s', '8.0 s', '8.0 s'], ['Average speed', '38 km/h', '38 km/h', '38 km/h'], ['Path efficiency', '100%', '100%', '100%'], ['Comfort score', '94', '94', '96'], ['Emergency braking', '0', '0', '0']]
  return <section className="panel performance-panel"><Title eyebrow="Benchmark run / clear road" title="Performance comparison" action="3 CONTROLLERS" /><div className="comparison-layout"><table><thead><tr><th>METRIC</th><th>BASELINE</th><th>REACTIVE</th><th className="indra-heading">INDRA</th></tr></thead><tbody>{rows.map(([metric, baseline, reactive, indra]) => <tr key={metric}><td>{metric}</td><td>{baseline}</td><td>{reactive}</td><td className="best">{indra}<span>BEST</span></td></tr>)}</tbody></table><div className="chart"><div className="chart-caption"><span>SAFETY SCORE</span><strong>INDRA <b>96</b></strong></div><div className="bars"><div style={{ height: '78%' }}><i>94</i><span>BASE</span></div><div style={{ height: '78%' }}><i>94</i><span>REACTIVE</span></div><div className="bar-indra" style={{ height: '92%' }}><i>96</i><span>INDRA</span></div></div></div></div></section>
}

function App() {
  const [running, setRunning] = useState(true)
  const [scenario, setScenario] = useState(scenarios[0])
  const [speed, setSpeed] = useState('1')
  const [telemetry, setTelemetry] = useState(initialTelemetry)
  useEffect(() => { getSimulationState().then((state) => { setRunning(state.running); setScenario(state.scenario); setSpeed(String(state.speedMultiplier)); if (state.telemetry) setTelemetry(state.telemetry) }) }, [])
  useEffect(() => { if (!running) return undefined; const timer = window.setInterval(() => setTelemetry((current) => ({ ...current, speed: current.speed, ttc: current.ttc })), 850 / Number(speed)); return () => window.clearInterval(timer) }, [running, speed])
  const decision = useMemo(() => 'Clear straight road detected. INDRA is maintaining a centered path with smooth, stable control.', [])
  const syncControl = (control) => { updateSimulationControl(control).then((state) => { if (state.telemetry) setTelemetry(state.telemetry) }) }
  const restart = () => { setTelemetry(initialTelemetry); setRunning(true); setScenario(scenarios[0]); setSpeed('1'); restartSimulation().then((state) => { if (state.telemetry) setTelemetry(state.telemetry) }) }
  return <main className="app-shell"><header className="app-header"><div className="brand-lockup"><img className="brand-mark" src={logo} alt="INDRA-DRIVE logo" /><div><h1>INDRA-<b>DRIVE</b></h1><p>Predictive Risk-Adaptive Path Planning <span>/</span> Unstructured Indian Roads</p></div></div><div className="header-status"><Pill>SYSTEM STATUS: ACTIVE</Pill><Pill>SIMULATION: {running ? 'RUNNING' : 'PAUSED'}</Pill><Pill tone="blue">MODE: INDRA ADAPTIVE</Pill></div></header>
    <div className="dashboard-grid"><Controls running={running} setRunning={setRunning} scenario={scenario} setScenario={setScenario} speed={speed} setSpeed={setSpeed} restart={restart} syncControl={syncControl} /><section className="panel twin-panel"><Title eyebrow="Live environment / top-down view" title="Digital twin" action="30 FPS" /><RoadCanvas telemetry={telemetry} /><div className="twin-insight"><span className="alert-icon clear-icon">✓</span><div><strong className="clear-text">ROAD CLEAR</strong><p>No obstacles detected. Ego vehicle is centered and cruising smoothly.</p></div><span className="insight-time">SAFE</span></div></section><VehicleStatus telemetry={telemetry} /></div>
    <div className="lower-grid"><Performance /><section className="panel decision-panel"><Title eyebrow="Why did INDRA act?" title="Explainable decision" action="AUTO-LOGGED" /><div className="decision-copy"><div className="decision-tag"><span>01</span> DECISION TRACE</div><p>{decision}</p><div className="decision-facts"><div><span>PATHS EVALUATED</span><strong>1</strong></div><div><span>RISK REDUCTION</span><strong>100%</strong></div><div><span>WEIGHT PROFILE</span><strong>SAFETY <em>70%</em></strong></div></div><div className="action-callout"><span>↳</span><div><small>ACTION</small><strong>Maintain center lane + constant speed</strong></div></div></div></section></div>
    <footer className="app-footer"><span><b className="live-dot" /> SIMULATION ENGINE READY</span><span>SCENARIO: STRAIGHT ROAD &nbsp;·&nbsp; WEATHER: CLEAR &nbsp;·&nbsp; SEED: IDR-2048</span><strong>SAFETY FIRST <i>◆</i></strong></footer></main>
}

export default App