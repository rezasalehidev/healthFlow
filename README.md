# HealthFlow

Production-oriented NestJS microservices backend (portfolio / interview project).

## Status

Phases **0–12** complete: auth, gateway, doctor/patient, appointments (lock + gRPC), RabbitMQ notifications, WebSockets, worker (Mongo audit + reminders), medical records/prescriptions, CI, and **transactional outbox** for both appointments and clinical events — plus a **step-by-step learning guide**.

## Learn the project (start here)

Open the docs **in order**:

**[docs/README.md](./docs/README.md)** → begin with **[docs/00-how-to-study.md](./docs/00-how-to-study.md)**

That guide walks the whole codebase carefully: architecture → services → setup → request flows → worker → clinical data → outbox.

## CI

Push / PR to `main` runs [`.github/workflows/ci.yml`](./.github/workflows/ci.yml): install → build libs → Prisma generate → lint → typecheck → unit tests → build.

## Reliable events (outbox)

Appointment + patient mutations write `outbox_events` in the same DB transaction. Relays publish to RabbitMQ.

See [docs/16-outbox.md](./docs/16-outbox.md).

## Messaging (short)

| Piece | Name |
|-------|------|
| Events | `healthflow.events` |
| Notifications | `healthflow.notifications` (+ retry / DLQ) |
| Audit | `healthflow.audit` → worker |
| Gateway WS | `healthflow.gateway.appointments.ws` |

## Setup

```bash
cp .env.example .env
pnpm install
pnpm build:common && pnpm build:redis && pnpm build:messaging
pnpm test
pnpm lint
```

Full runbook: [docs/09-local-setup.md](./docs/09-local-setup.md).
