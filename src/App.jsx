import { useEffect, useMemo, useState } from 'react'
import './App.css'
import { getSimulationState, restartSimulation, updateSimulationControl } from './services/simulationApi'
import logo from './assets/Logo.png'

const initialTelemetry = { speed: 38, targetSpeed: 22, acceleration: -1.8, steering: -6.4, ttc: 1.6, collisionProbability: 68 }
const scenarios = ['Pedestrian crossing', 'Auto suddenly merging', 'Pothole ahead', 'Dense market traffic']

function Pill({ children, tone = 'green' }) { return <span className={`pill pill-${tone}`}><i />{children}</span> }
function Title({ eyebrow, title, action }) { return <div className="panel-title"><div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2></div>{action && <span className="panel-action">{action}</span>}</div> }

function Controls({ running, setRunning, scenario, setScenario, speed, setSpeed, restart, syncControl }) {
  return <aside className="panel controls-panel">
    <Title eyebrow="Mission control" title="Scenario" action="LIVE" />
    <div className="control-section"><label htmlFor="scenario">Scenario type</label><select id="scenario" value={scenario} onChange={(event) => { setScenario(event.target.value); syncControl({ scenario: event.target.value }) }}>{scenarios.map((item) => <option key={item}>{item}</option>)}</select></div>
    <div className="control-section"><div className="label-row"><label>Traffic density</label><strong>HIGH</strong></div><div className="density-bars" aria-label="High traffic density"><b /><b /><b /><b /><b /><b /><b /></div><p className="muted">8 dynamic road users detected</p></div>
    <div className="control-section compact-grid"><div><span>WEATHER</span><strong>RAIN</strong></div><div><span>VISIBILITY</span><strong>74 m</strong></div></div>
    <div className="control-section"><div className="label-row"><label htmlFor="sim-speed">Simulation speed</label><strong>{speed}x</strong></div><input id="sim-speed" type="range" min="0.5" max="2" step="0.5" value={speed} onChange={(event) => { setSpeed(event.target.value); syncControl({ speedMultiplier: event.target.value }) }} /><div className="range-labels"><span>0.5x</span><span>1x</span><span>2x</span></div></div>
    <div className="control-actions"><button className="button button-primary" type="button" onClick={() => { const nextRunning = !running; setRunning(nextRunning); syncControl({ running: nextRunning }) }}>{running ? '||  Pause' : '>  Resume'}</button><button className="button button-quiet" type="button" onClick={restart}>↻  Restart</button></div>
    <div className="pipeline-mini"><span className="eyebrow">Pipeline status</span>{['DETECT', 'PREDICT', 'QUANTIFY RISK', 'GENERATE PATHS', 'ADAPT & ACT'].map((step, index) => <div className="pipeline-step" key={step}><span>{String(index + 1).padStart(2, '0')}</span><strong>{step}</strong><i className={index === 4 ? 'active' : ''} /></div>)}</div>
  </aside>
}

function RoadCanvas({ telemetry }) {
  return <div className="twin-stage">
    <div className="stage-toolbar"><span><i className="legend-dot green" /> DRIVABLE AREA</span><span><i className="legend-dot amber" /> RISK ZONE</span><span><i className="legend-dot red" /> HAZARD</span></div>
    <svg className="road-scene" viewBox="0 0 760 560" role="img" aria-label="Top-down unstructured Indian road digital twin placeholder">
      <defs><linearGradient id="road" x1="0" y1="0" x2="1" y2="0"><stop stopColor="#1c2529" /><stop offset=".52" stopColor="#293338" /><stop offset="1" stopColor="#1b2529" /></linearGradient><radialGradient id="risk"><stop stopColor="#ffb547" stopOpacity=".42" /><stop offset="1" stopColor="#ffb547" stopOpacity="0" /></radialGradient><filter id="soft"><feGaussianBlur stdDeviation="13" /></filter></defs>
      <path className="road-boundary" d="M170 0 C205 120 160 190 211 278 C254 354 202 438 244 560 M580 0 C548 102 604 191 556 274 C520 349 568 446 530 560" /><path className="road-surface" d="M178 0 C213 116 170 188 220 274 C260 349 214 439 252 560 L522 560 C561 443 516 350 558 274 C605 188 550 107 574 0 Z" fill="url(#road)" /><path className="road-edge" d="M223 0 C249 119 207 189 255 275 C290 350 252 438 282 560 M537 0 C514 116 558 189 520 275 C485 350 522 438 493 560" />
      <path className="candidate alt" d="M382 530 C370 430 395 360 369 278 C352 222 373 148 386 65" /><path className="candidate alt" d="M382 530 C420 440 421 361 437 278 C449 211 421 140 404 65" /><path className="selected-path" d="M382 530 C389 434 404 359 395 280 C388 218 395 144 394 66" /><ellipse cx="395" cy="180" rx="134" ry="106" fill="url(#risk)" filter="url(#soft)" />
      <g className="object auto" transform="translate(398 166) rotate(8)"><rect x="-18" y="-30" width="36" height="60" rx="7" /><path d="M-13 -20h26M-13 20h26" /></g><g className="object bike" transform="translate(480 254)"><circle cx="-11" cy="13" r="8" /><circle cx="11" cy="13" r="8" /><path d="M-11 13 0-10 11 13M0-10h12" /></g><g className="object car" transform="translate(298 320) rotate(-12)"><rect x="-19" y="-34" width="38" height="68" rx="8" /><rect className="window" x="-13" y="-19" width="26" height="19" rx="3" /></g><g className="pedestrian" transform="translate(492 115)"><circle cx="0" cy="-13" r="7" /><path d="M0-5v22M0 2l-10 10M0 2l10 8M0 17l-8 13M0 17l9 11" /></g><g className="pothole" transform="translate(340 230)"><ellipse rx="24" ry="13" /><path d="M-12-3 2 4 12-5M-7 8 7-8" /></g><g className="ego-vehicle" transform="translate(382 477)"><rect x="-25" y="-42" width="50" height="84" rx="12" /><rect className="ego-window" x="-16" y="-26" width="32" height="25" rx="5" /><path className="ego-beam" d="M-14-39h28" /></g>
      <text className="map-label" x="275" y="206">POTHOLE AHEAD</text><text className="map-label red-label" x="453" y="90">CROSSING</text>
    </svg>
    <div className="twin-footer"><span><b className="live-dot" /> DIGITAL TWIN / FRAME 00482</span><span>INDRA PATH <b className="path-line" /> {telemetry.targetSpeed} km/h TARGET</span></div>
  </div>
}

function VehicleStatus({ telemetry }) {
  const items = [['CURRENT SPEED', `${Math.round(telemetry.speed)} km/h`, 'neutral'], ['TARGET SPEED', `${telemetry.targetSpeed} km/h`, 'teal'], ['ACCELERATION', `${telemetry.acceleration} m/s²`, 'amber'], ['STEERING ANGLE', `${telemetry.steering}°`, 'neutral']]
  return <aside className="panel status-panel"><Title eyebrow="Telemetry" title="Vehicle status" action="EGO-01" /><div className="telemetry-grid">{items.map(([label, value, tone]) => <div className="telemetry-card" key={label}><span>{label}</span><strong className={`value-${tone}`}>{value}</strong></div>)}</div><div className="status-row"><span>Brake status</span><strong className="brake-status"><i /> ENGAGED</strong></div><div className="risk-readout"><div><span>TIME TO COLLISION</span><strong>{telemetry.ttc.toFixed(1)}<small> sec</small></strong></div><div><span>COLLISION PROBABILITY</span><strong>{telemetry.collisionProbability}<small>%</small></strong></div></div><div className="risk-meter"><span style={{ width: `${telemetry.collisionProbability}%` }} /></div><div className="current-risk"><span>Current risk</span><strong><i /> HIGH</strong></div><div className="selected-path"><span>Selected path</span><strong>Brake + Left <em>INDRA</em></strong></div></aside>
}

function Performance() {
  const rows = [['Collisions', '2', '1', '0'], ['Minimum TTC', '0.6 s', '1.1 s', '1.6 s'], ['Average speed', '36 km/h', '29 km/h', '31 km/h'], ['Path efficiency', '78%', '84%', '93%'], ['Comfort score', '61', '72', '88'], ['Emergency braking', '4', '2', '1']]
  return <section className="panel performance-panel"><Title eyebrow="Benchmark run / same scenario" title="Performance comparison" action="3 CONTROLLERS" /><div className="comparison-layout"><table><thead><tr><th>METRIC</th><th>BASELINE</th><th>REACTIVE</th><th className="indra-heading">INDRA</th></tr></thead><tbody>{rows.map(([metric, baseline, reactive, indra]) => <tr key={metric}><td>{metric}</td><td>{baseline}</td><td>{reactive}</td><td className="best">{indra}<span>BEST</span></td></tr>)}</tbody></table><div className="chart"><div className="chart-caption"><span>SAFETY SCORE</span><strong>INDRA <b>92</b></strong></div><div className="bars"><div style={{ height: '44%' }}><i>52</i><span>BASE</span></div><div style={{ height: '62%' }}><i>71</i><span>REACTIVE</span></div><div className="bar-indra" style={{ height: '88%' }}><i>92</i><span>INDRA</span></div></div></div></div></section>
}

function App() {
  const [running, setRunning] = useState(true); const [scenario, setScenario] = useState(scenarios[0]); const [speed, setSpeed] = useState('1'); const [telemetry, setTelemetry] = useState(initialTelemetry)
  useEffect(() => { getSimulationState().then((state) => { setRunning(state.running); setScenario(state.scenario); setSpeed(String(state.speedMultiplier)); if (state.telemetry) setTelemetry(state.telemetry) }) }, [])
  useEffect(() => { if (!running) return undefined; const timer = window.setInterval(() => setTelemetry((current) => ({ ...current, speed: Math.max(22, Math.min(39, current.speed + (current.targetSpeed - current.speed) * 0.08)), ttc: current.ttc > 2.2 ? 1.4 : current.ttc + 0.04 })), 850 / Number(speed)); return () => window.clearInterval(timer) }, [running, speed])
  const decision = useMemo(() => scenario === 'Pothole ahead' ? 'Pothole risk detected. INDRA is reducing speed and shifting left.' : 'Pedestrian trajectory intersects the ego path. Brake + Left selected for maximum safety.', [scenario])
  const syncControl = (control) => { updateSimulationControl(control).then((state) => { if (state.telemetry) setTelemetry(state.telemetry) }) }
  const restart = () => { setTelemetry(initialTelemetry); setRunning(true); setScenario(scenarios[0]); setSpeed('1'); restartSimulation().then((state) => { if (state.telemetry) setTelemetry(state.telemetry) }) }
  return <main className="app-shell"><header className="app-header"><div className="brand-lockup"><img className="brand-mark" src={logo} alt="INDRA-DRIVE logo" /><div><h1>INDRA-<b>DRIVE</b></h1><p>Predictive Risk-Adaptive Path Planning <span>/</span> Unstructured Indian Roads</p></div></div><div className="header-status"><Pill>SYSTEM STATUS: ACTIVE</Pill><Pill>SIMULATION: {running ? 'RUNNING' : 'PAUSED'}</Pill><Pill tone="blue">MODE: INDRA ADAPTIVE</Pill></div></header>
    <div className="dashboard-grid"><Controls running={running} setRunning={setRunning} scenario={scenario} setScenario={setScenario} speed={speed} setSpeed={setSpeed} restart={restart} syncControl={syncControl} /><section className="panel twin-panel"><Title eyebrow="Live environment / top-down view" title="Digital twin" action="30 FPS" /><RoadCanvas telemetry={telemetry} /><div className="twin-insight"><span className="alert-icon">!</span><div><strong>HIGH RISK ALERT</strong><p>Unpredictable crossing ahead. Prediction confidence <b>86%</b>.</p></div><span className="insight-time">00:01.6</span></div></section><VehicleStatus telemetry={telemetry} /></div>
    <div className="lower-grid"><Performance /><section className="panel decision-panel"><Title eyebrow="Why did INDRA act?" title="Explainable decision" action="AUTO-LOGGED" /><div className="decision-copy"><div className="decision-tag"><span>04</span> DECISION TRACE</div><p>{decision}</p><div className="decision-facts"><div><span>PATHS EVALUATED</span><strong>6</strong></div><div><span>RISK REDUCTION</span><strong>72%</strong></div><div><span>WEIGHT PROFILE</span><strong>SAFETY <em>70%</em></strong></div></div><div className="action-callout"><span>↳</span><div><small>ACTION</small><strong>Gentle braking + smooth left steering</strong></div></div></div></section></div>
    <footer className="app-footer"><span><b className="live-dot" /> SIMULATION ENGINE READY</span><span>SCENARIO: {scenario.toUpperCase()} &nbsp;·&nbsp; WEATHER: RAIN &nbsp;·&nbsp; SEED: IDR-2048</span><strong>SAFETY FIRST <i>◆</i></strong></footer></main>
}

export default App