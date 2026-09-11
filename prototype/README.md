# INDRA-DRIVE Prototype Hardware

This folder defines the hardware boundary for a low-speed autonomous research prototype. The existing digital-twin UI is intentionally preserved.

## Power and charging

The physical prototype needs a traction battery, a battery-management system (BMS), a fuse/protection path, a dedicated charger matched to the exact battery chemistry and series count, regulated DC-DC conversion for logic/sensors, and a hardware emergency-stop. The charger is an external power component; this repository models its state and safety interlock rather than pretending to control mains power.

**Safety rule:** the prototype must not enable propulsion while the charger is connected. Battery chemistry, pack voltage, charge current, connector, fuse rating, wire gauge, and charger specification must be selected from the actual battery manufacturer requirements before assembly.

## Compute

Use two control layers for a research prototype:

1. An autonomy computer for perception, object tracking, risk estimation and path planning.
2. A safety microcontroller for watchdog, emergency-stop, propulsion-enable and actuator safety.

The autonomy computer must never be the only safety layer.

## Minimum sensors

- Forward RGB camera
- LiDAR or depth sensor
- IMU
- Wheel encoders

Optional redundancy:

- GNSS for outdoor position reference
- Short-range radar or ultrasonic sensors

## Minimum actuators

- Drive motor and motor controller
- Steering actuator
- Brake actuator

The brake path should be fail-safe and independently capable of stopping propulsion.

## Communications

- CAN bus for vehicle-control messages
- UART/USB for sensor and debug integration
- Ethernet/Wi-Fi for development telemetry only

## Prototype software boundary

The backend exposes:

- `GET /api/prototype/state`
- `POST /api/prototype/control`
- `POST /api/prototype/heartbeat`

The runtime models charger state, battery state-of-charge, emergency stop, watchdog, sensor/compute/actuator health, propulsion interlock and safe-state reasons.

### Example control payloads

```json
{"chargerConnected": true}
```

```json
{"chargerConnected": false, "batterySoc": 86}
```

```json
{"estop": true}
```

```json
{"sensorHealth": false}
```

A prototype is considered propulsion-ready only when the safety reasons list is empty. Charging, emergency stop, critical/low battery, watchdog failure, sensor failure, compute failure or actuator failure force the runtime into `SAFE` mode.

## Next hardware-integration step

When the physical platform is selected, replace the simulated runtime signals with real drivers for the chosen MCU, motor controller, steering servo/actuator, brake actuator, camera/LiDAR, encoder and CAN interface. Do not connect the software directly to a high-power charger or traction pack without appropriate electrical protection and a hardware safety design.
