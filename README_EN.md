# 🍺 Baijiu Fermentation Digital Twin System

> IoT · Process Simulation · Real-time 3D Visualization — Digital Twin Platform for Luzhou-flavor Baijiu

[中文](./README.md) · [Architecture](./docs/ARCHITECTURE.md) · [Features](./docs/FEATURES.md) · [API Docs](./docs/API.md)

![tech](https://img.shields.io/badge/backend-Spring%20Boot%203.2-green) ![tech](https://img.shields.io/badge/frontend-React%2018%20%2B%20TS-blue) ![tech](https://img.shields.io/badge/3D-Three.js%20%2B%20R3F-orange) ![tech](https://img.shields.io/badge/realtime-WebSocket-purple) ![license](https://img.shields.io/badge/license-MIT-lightgrey)

## Overview

A full-stack digital twin system that models the complete production chain of **Luzhou-flavor Baijiu (浓香型白酒)**, from pit excavation through distillation to fermentation re-entry. The system features an animated 3D factory floor, real-time material-flow simulation, live sensor monitoring, and a comprehensive operations dashboard.

### Production Pipeline (5 Devices · 8 AGVs · 100 Fermentation Pits)

```
Zone-A pits ─ AGV-01 ─┐                                                   ┌─ AGV-05 → Zone-B pits
                        ├→ Mixer → Loading Robot → Distiller → Cooler ──→ ┤
Zone-C pits ─ AGV-06 ─┘  (AGV-02)   (AGV-03/07)              (AGV-04)     └─ AGV-08 → Zone-D pits
                          blending    loading · backup          unloading
                                                    ↑
                                         Water Pump PM-001 (boiler water loop)
```

| Step | Equipment | AGV | Material |
|---|---|---|---|
| ① Pit Excavation (A/C) | — | AGV-01 / AGV-06 | Fermented grain (zaopei) |
| ② Blending | Mixer MX-001 | AGV-02 | + 33% grain powder + 8% rice husk |
| ③ Loading | Loading Robot RB-001 | AGV-03 / AGV-07 | Blended grain |
| ④ Distillation | Distiller DL-001 | — | Head 5% / Mid 85% / Tail 10% |
| ⑤ Unloading | — | AGV-04 | Spent grain @ 85 °C |
| ⑥ Cooling & Inoculation | Cooler CL-001 | — | + 5% starter, 3-stage cooling |
| ⑦ Pit Entry (B/D) | — | AGV-05 / AGV-08 | Ready grain → 60-day fermentation |
| ⓘ Water Loop | Water Pump PM-001 | — | Supplies distiller boiler water |

## Tech Stack

**Backend** (`backend-java/`) — Spring Boot 3.2.1 · Java 17 · Spring Data JPA · H2 File DB · Spring WebSocket · Maven

**Frontend** (`frontend/`) — React 18 + TypeScript · Vite 5 · Three.js 0.182 + React Three Fiber 8 · Ant Design 5 · ECharts 5 · Zustand 4 · TailwindCSS 3

## Quick Start

### Prerequisites

| Tool | Min Version |
|---|---|
| JDK | 17 |
| Maven | 3.9 |
| Node.js | 18 LTS |

### Manual (Development)

```bash
# Terminal 1 — backend
cd backend-java
mvn package -DskipTests
java -jar target/digital-twin-1.0.0.jar
# → http://localhost:8000

# Terminal 2 — frontend
cd frontend
npm install
npm run dev
# → http://localhost:3000
```

> H2 console: http://localhost:8000/h2-console  
> JDBC URL: `jdbc:h2:file:./data/brewing` · username/password: empty

### Docker (Recommended for demos)

```bash
docker-compose up --build
```

## Key Features

- 🎮 **Real-time 3D Digital Twin** — Fully animated factory scene; drag to orbit, scroll to zoom
- 🔄 **1 s/tick Process Simulator** — Strict material conservation; 60 fermentation days ≈ 12 real minutes
- 📡 **WebSocket Push** — `sim_snapshot` broadcast every second; zero-latency frontend sync
- 🛢️ **Auto Liquor Grading** — Head / Mid / Tail storage tanks; auto-drain at 90% → 30% (bottling simulation)
- 🌾 **Auto Raw-Material Resupply** — Grain powder / rice husk / starter refill when < 30%
- 🚨 **Multi-level Alarm Center** — Temperature / pH / equipment fault alerts
- 📈 **OEE Performance Analysis** — Equipment efficiency, energy consumption, yield rate live charts
- 🎨 **Liquid Glass UI** — Dark theme + Gaussian blur + rounded corners, immersive SCADA aesthetics

## API Quick Reference

| Module | Method | Path | Description |
|---|---|---|---|
| Simulation | GET | `/api/v1/simulation/snapshot` | Full process snapshot |
| Simulation | POST | `/api/v1/simulation/pause` | Pause simulation |
| Simulation | POST | `/api/v1/simulation/resume` | Resume simulation |
| Simulation | POST | `/api/v1/simulation/reset` | Reset simulation |
| Dashboard | GET | `/api/v1/dashboard/stats` | Plant-wide KPIs |
| Pits | GET | `/api/v1/pits` | All 100 pit states |
| Devices | GET | `/api/v1/devices` | All 53 device states |
| Alarms | GET | `/api/v1/alarms/active` | Active alarms |
| Production | GET | `/api/v1/production/batches` | Batch list |

**WebSocket** `ws://localhost:8000/ws/realtime` pushes a `sim_snapshot` frame every second.

## Simulation Parameters

| Parameter | Value | Notes |
|---|---|---|
| Total pits | 100 (A/B/C/D × 25) | A/C = excavation, B/D = entry |
| AGVs | 8 | Each has a dedicated role |
| Devices | 5 core + 8 AGV + 40 aux | 53 total |
| Simulation rate | 1 real-sec ≈ 2 sim-hours | 60-day ferment ≈ 12 real-min |
| Distillation yield | 30% | Head 5% / Mid 85% / Tail 10% |
| Starter addition | 5% | 3-stage cooling: 85→60→35 °C |
| Tank drain threshold | 90% → 30% | Simulates bottling |
| Material resupply | 30% → 95% | Grain / husk / starter |

## License

MIT License — Free for academic research, competitions, and derivative works.
