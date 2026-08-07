# HealthFlow

Production-oriented NestJS microservices backend (portfolio / interview project).

## Status

Phases 0–7 complete: auth, gateway, doctor/patient, appointments (lock + gRPC), RabbitMQ notifications, **WebSocket live updates**, and a **beginner learning guide**.

## Learn the project (start here)

New to the codebase? Read the docs in order:

**[docs/README.md](./docs/README.md)** — learning path from architecture → setup → request flows → WebSockets.

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

Flow on notification failure: nack path → retry TTL queue → requeue bridge → events again (max 3) → DLQ.

## Realtime

- Socket.IO namespace: `/appointments`
- Auth: `auth.token` = access JWT (or `Authorization: Bearer …`)
- Event: `appointment.updated` (see [docs/11-websockets.md](./docs/11-websockets.md))

## Setup

```bash
cp .env.example .env
pnpm install
pnpm build:common && pnpm build:redis && pnpm build:messaging
pnpm build:appointment && pnpm build:notification && pnpm build:gateway
pnpm test
```

## Run (needs RabbitMQ for events + WS)

```bash
pnpm start:appointment
pnpm start:notification
pnpm start:gateway
```

Full local stack instructions: [docs/09-local-setup.md](./docs/09-local-setup.md).
