# HealthFlow

A production-oriented **NestJS microservices** backend for a fictional healthcare booking platform. Built as a portfolio and interview project, HealthFlow demonstrates senior backend patterns — API gateway, JWT/RBAC, schema-per-service Postgres, Redis locking, gRPC, RabbitMQ eventing, WebSockets, background workers, and the **transactional outbox** pattern.

> **Note:** This is not a real hospital system. Do not use real patient data.

[![CI](https://github.com/rezasalehidev/healthFlow/actions/workflows/ci.yml/badge.svg)](https://github.com/rezasalehidev/healthFlow/actions/workflows/ci.yml)

---

## What it does

HealthFlow lets patients book doctors, manage appointments, and access clinical records. Doctors manage schedules, confirm visits, and write medical notes and prescriptions. Side systems react asynchronously — simulated email notifications, live WebSocket updates, audit logging, and appointment reminders.

| Role | Capabilities |
|------|--------------|
| **Patient** | Register, profile, book/cancel/reschedule appointments, read own clinical data |
| **Doctor** | Profile & schedules, confirm appointments, medical records & prescriptions |
| **Admin** | Broad access via seeded permissions |

---

## Architecture

Clients talk only to the **API Gateway**. The gateway proxies to internal services over HTTP. Service-to-service calls use **gRPC** where low latency matters. Domain changes are written to an **outbox** table in the same DB transaction, then relayed to **RabbitMQ** for fan-out to notifications, WebSockets, and the background worker.

```
Browser / API client
        │
        ▼
   API Gateway  ──HTTP──► Auth / Patient / Doctor / Appointment
        │
        │  WebSocket (/appointments)
        ▼
  Live UI updates ◄── RabbitMQ ◄── Outbox relays (appointment + patient)
                         │
            ┌────────────┼────────────┐
            ▼            ▼            ▼
      Notifications   Worker      (consumers)
      (email sim)   (audit + reminders)
```

### Services

| Service | Port | Responsibility |
|---------|------|----------------|
| `api-gateway` | 3000 | Public HTTP, JWT validation, rate limiting, proxy, WebSocket |
| `auth-service` | 3001 | Users, login/refresh, roles, permissions |
| `patient-service` | 3002 | Patient profiles, medical records, prescriptions |
| `doctor-service` | 3003 (+ gRPC 50051) | Doctor profiles, schedules, availability RPC |
| `appointment-service` | 3004 | Booking lifecycle, Redis lock, outbox |
| `notification-service` | 3005 | Consume events, simulate email, retry/DLQ |
| `worker` | 3006 | Audit logs → MongoDB; appointment reminders |

### Shared libraries (`libs/`)

| Package | Purpose |
|---------|---------|
| `@healthflow/common` | Errors, filters, logging, correlation ID middleware |
| `@healthflow/redis` | Cache-aside + distributed lock |
| `@healthflow/messaging` | RabbitMQ topology, publisher, idempotency |

---

## Tech stack

- **Runtime:** Node.js 20+, TypeScript 5
- **Framework:** NestJS
- **Monorepo:** pnpm workspaces
- **Databases:** PostgreSQL (schema-per-service via Prisma), MongoDB, Redis
- **Messaging:** RabbitMQ (events, retry queues, DLQ)
- **RPC:** gRPC (appointment → doctor availability)
- **Realtime:** WebSockets (gateway)
- **CI:** GitHub Actions

---

## Quick start

### Prerequisites

- Node.js ≥ 20
- pnpm 9
- Docker & Docker Compose (for infrastructure)

### 1. Clone and configure

```bash
git clone https://github.com/rezasalehidev/healthFlow.git
cd healthFlow
cp .env.example .env
pnpm install
```

### 2. Start infrastructure

```bash
docker compose up -d postgres redis rabbitmq mongodb
```

### 3. Build shared libraries and run migrations

```bash
pnpm build:common && pnpm build:redis && pnpm build:messaging
# Run Prisma migrations per service (see docs/09-local-setup.md)
```

### 4. Start services (separate terminals)

```bash
pnpm start:auth
pnpm start:gateway
pnpm start:doctor
pnpm start:patient
pnpm start:appointment
pnpm start:notification
pnpm start:worker
```

Or run everything with Docker:

```bash
docker compose --profile full up --build
```

### 5. Explore the API

With the gateway running, open Swagger at:

**http://localhost:3000/api/docs**

RabbitMQ management UI: **http://localhost:15672** (default `healthflow` / `healthflow`)

---

## Development

```bash
pnpm test          # unit tests across all packages
pnpm lint          # ESLint
pnpm typecheck     # TypeScript strict check
pnpm build         # build all libs and apps
```

Push or open a PR to `main` to trigger CI (install → build libs → Prisma generate → lint → typecheck → test → build).

---

## Reliable events (transactional outbox)

Appointment and clinical mutations write an `outbox_events` row in the **same database transaction** as the domain change. Background relays poll the outbox and publish to RabbitMQ, so events survive brief broker outages.

See [docs/16-outbox.md](./docs/16-outbox.md) for the full walkthrough.

### RabbitMQ topology

| Queue / exchange | Purpose |
|------------------|---------|
| `healthflow.events` | Domain events (appointments, clinical) |
| `healthflow.notifications` | Email simulation (+ retry / DLQ) |
| `healthflow.audit` | Audit trail → worker |
| `healthflow.gateway.appointments.ws` | WebSocket fan-out |

---

## Learn the codebase

This repo includes a **step-by-step learning guide** in `docs/`. Read the files in order:

**[docs/README.md](./docs/README.md)** → start with **[docs/00-how-to-study.md](./docs/00-how-to-study.md)**

Topics covered: architecture, monorepo layout, shared libraries, security (JWT/RBAC), request flows, WebSockets, worker, clinical data, CI, and outbox.

---

## Project phases

| Phase | Topic | Status |
|-------|-------|--------|
| 0–1 | Monorepo + `@healthflow/common` | Done |
| 2 | Auth service | Done |
| 3 | API Gateway | Done |
| 4 | Doctor + Patient + Redis cache | Done |
| 5 | Appointments + gRPC + distributed locks | Done |
| 6 | RabbitMQ + notifications | Done |
| 7 | WebSocket fan-out | Done |
| 8 | Worker (Mongo audit + reminders) | Done |
| 9 | Medical records + prescriptions | Done |
| 10 | GitHub Actions CI | Done |
| 11 | Transactional outbox (appointments) | Done |
| 12 | Transactional outbox (clinical) + learning docs | Done |

---

## Repository layout

```
healthflow/
├── apps/
│   ├── api-gateway/          # Public edge
│   ├── auth-service/         # Identity & access
│   ├── doctor-service/       # Doctors + gRPC
│   ├── patient-service/      # Patients + clinical data
│   ├── appointment-service/  # Booking + outbox
│   ├── notification-service/ # Event consumer
│   └── worker/               # Audit + reminders
├── libs/
│   ├── common/               # Shared utilities
│   ├── redis/                # Cache & locks
│   └── messaging/            # RabbitMQ helpers
├── docs/                     # Step-by-step learning guide
├── docker/                   # Dockerfiles & Postgres init
└── docker-compose.yml
```

---

## License

This project is provided for educational and portfolio purposes.
