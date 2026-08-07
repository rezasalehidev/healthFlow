# HealthFlow

Production-oriented NestJS microservices backend (portfolio / interview project).

## Status

Phases 0–10 complete: auth, gateway, doctor/patient, appointments (lock + gRPC), RabbitMQ notifications, WebSocket live updates, worker (Mongo audit + reminders), **medical records / prescriptions**, and **GitHub Actions CI**.

## Learn the project (start here)

New to the codebase? Read the docs in order:

**[docs/README.md](./docs/README.md)** — learning path from architecture → setup → request flows → WebSockets → worker → clinical data.

## CI

Push / PR to `main` runs [`.github/workflows/ci.yml`](./.github/workflows/ci.yml): install → build libs → Prisma generate → lint → typecheck → unit tests → build.

## Messaging topology

| Piece | Name |
|-------|------|
| Events exchange | `healthflow.events` (topic) |
| Retry exchange | `healthflow.retry` (topic) |
| DLQ exchange | `healthflow.dlq` (fanout) |
| Requeue bridge | `healthflow.requeue` → `healthflow.notifications.requeue` |
| Main queue | `healthflow.notifications` |
| Retry TTL queues | `*.retry.5s` / `30s` / `120s` |
| DLQ | `healthflow.notifications.dlq` |
| Gateway WS queue | `healthflow.gateway.appointments.ws` (`appointment.*`) |
| Audit queue | `healthflow.audit` (`#` → worker → Mongo) |

## Clinical APIs (Phase 9)

Via gateway (JWT + roles):

- `POST/GET /api/v1/patients/:patientId/medical-records`
- `GET/PATCH /api/v1/medical-records/:id`
- `POST/GET /api/v1/patients/:patientId/prescriptions`
- `GET /api/v1/prescriptions/:id`
- `PATCH /api/v1/prescriptions/:id/status`

Events: `medical-record.created|updated`, `prescription.created`.

## Worker (Phase 8)

- Consumes `healthflow.audit` → writes `audit_logs` in MongoDB
- Plans / dispatches `appointment.reminder` (see `REMINDER_OFFSETS_HOURS`)

```bash
pnpm start:worker
```

## Realtime

- Socket.IO namespace: `/appointments`
- Auth: `auth.token` = access JWT
- Event: `appointment.updated`

## Setup

```bash
cp .env.example .env
pnpm install
pnpm build:common && pnpm build:redis && pnpm build:messaging
pnpm build:patient && pnpm build:appointment && pnpm build:notification && pnpm build:gateway && pnpm build:worker
pnpm test
pnpm lint
```

Full local stack: [docs/09-local-setup.md](./docs/09-local-setup.md).
