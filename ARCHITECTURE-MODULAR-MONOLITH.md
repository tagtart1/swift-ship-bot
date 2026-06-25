# Swift Ship Bot — Architecture (Modular Monolith)

**This supersedes the earlier `LOCKED-IN-BOT-ARCHITECTURE.md` for our current scale.**
It keeps that doc's *principles* but swaps its *mechanism* (separate networked services)
for a single modular monolith, because none of the forces that justify splitting into
separate repos/services apply to us yet.

---

## One-sentence summary

One NestJS codebase owns Postgres + Redis and the domain logic; Telegram (GrammY webhook),
the BullMQ worker, and the future admin/web frontends are all **thin doors** into the **same
`buy()`** — split at the **process** level for isolation, not at the **repo** level.

---

## The decision

> **Modular monolith now. One repo, one language (TypeScript/NestJS), clean internal boundaries.
> Split a piece into its own networked service only when a concrete force demands it.**

This was reached by separating two concerns that are easy to conflate:

1. **Fast ack** — a *transport* concern (Telegram needs HTTP 200 in seconds).
2. **Where `buy()` lives** — a *domain* concern (exactly one implementation of the rules).

A **queue exists precisely so these two never trade off against each other.** The webhook acks
fast *because* it enqueues; the worker does the slow work off the hot path and can take as long
as it needs.

---

## Core principles (kept from the original doc — non-negotiable)

| Rule | Meaning |
|------|---------|
| **One brain** | Exactly one `buy()` / `changeBalance()` etc. Every caller routes through it. No duplicate business logic. |
| **Only the domain layer writes** | Controllers, webhook, and workers never touch Prisma directly. They call domain services. |
| **Webhook acks fast** | Webhook handler: parse → enqueue → 200. Slow work runs in the BullMQ worker. |
| **Redis ≠ database** | Redis = queue, cache, sessions, rate limits, locks. Postgres = source of truth. |
| **Idempotency** | Every job carries `telegramUpdateId` / `requestId`; domain dedupes so Telegram + BullMQ retries can't double-buy. |
| **Migrations live with the brain** | Prisma schema + migrations owned by the one codebase. |

---

## What changed vs the original doc

| | Original doc (Pattern A) | This doc (Pattern B) |
|---|---|---|
| Topology | Separate Grammy repo + separate Nest brain, talk over HTTP | One NestJS repo |
| Worker → brain | **HTTP call** to brain service | **In-process function call** to domain service |
| "One brain" enforced by | Network boundary | Module boundary |
| Right when… | Different runtimes, multiple teams, security isolation, independent deploys | Solo/small team, one language, moderate traffic, admin/web later |
| For us today | Premature / over-engineered | Correct |

The original doc is **not wrong** — it's the correct *end state* once a real force appears
(see "When to split" below). We keep its principles and defer its mechanism.

---

## The mental model

The monolith has multiple **doors in**, all leading to the same room (`OrdersService.buy()`):

```text
                    ┌─────────────────────────────────────────────┐
  Telegram  ──────► │ door 1: webhook controller (GrammY parses)   │─┐
  Browser   ──────► │ door 2: admin HTTP controller (later)        │─┤
  Browser   ──────► │ door 3: web shop controller (later)          │─┤
  Redis job ──────► │ door 4: BullMQ worker (separate process)     │─┤
                    └─────────────────────────────────────────────┘ │
                                                                     ▼
                                                  OrdersService.buy()   ← the one brain
                                                                     │
                                                                  Prisma → Postgres
```

Each door does **transport translation only** (parse a Telegram update / an HTTP body / a job
payload) and then calls the same domain method. "Treat the bot as another client" becomes
"the bot is another **inbound adapter**" — logically the same caller, no longer a remote one.

---

## Request flow: "Buy AAPL"

```text
1. Telegram → POST /telegram/webhook        (web process, GrammY)
     - parse "Buy AAPL"
     - (optional) ctx.reply("Processing...")  ~100ms
     - queue.add("buy", { chatId, userId, symbol: "AAPL", requestId })
     - return 200                              ← fast ack (~5ms of real work)

2. BullMQ worker (separate process, SAME repo) pulls the job
     - OrdersService.buy({ userId, symbol, requestId })   ← in-process call, NO HTTP
         - auth, balance check, idempotency on requestId, Prisma write, audit
     - bot.api.sendMessage(chatId, "Bought AAPL ✅" | error)
```

Note: even inside one repo, the webhook **must not** `await OrdersService.buy()` inline — that
would block Telegram. It enqueues; the worker runs the slow path.

---

## Deployment: one codebase, separate processes

**Build one artifact, start it N times with a different command.** The command picks the role.

```text
one image / repo (NestJS)
   ├── node dist/main.js     → web process    (site + /telegram webhook route)  [HTTP]
   ├── node dist/worker.js   → worker process  (BullMQ consumer, NO HTTP)
   └── node dist/scheduler.js→ cron process    (optional)
```

- **`worker` is a genuinely different entrypoint** (`worker.ts` boots only the BullMQ `Worker`,
  no HTTP server). This split is the **essential** one — it moves the slow `buy()` work entirely
  off the web process.
- **`web` vs a dedicated `webhook` pool is the SAME entrypoint/command.** You split it only at the
  **routing layer** (load balancer / ingress / nginx sends `/telegram/*` to its own pool). This
  is an **optional** second step, only worth it if inbound bot HTTP volume threatens the site —
  and since the webhook only does parse→enqueue→200, that takes a lot of traffic.

```text
Everyday setup:   web (site + webhook)  +  worker
Under real load:  web (site)  +  webhook pool (/telegram/*)  +  worker
```

Example process descriptors (concept is identical across platforms):

```text
# Procfile (Heroku / Railway / Render / Fly machines)
web: node dist/main.js
worker: node dist/worker.js
scheduler: node dist/scheduler.js
```

```toml
# fly.toml
[processes]
  web = "node dist/main.js"
  worker = "node dist/worker.js"
# only the web process is attached to the public HTTP service
```

- **Docker Compose / k8s:** same `image:` for `web` and `worker`, different `command:`, separate
  replica counts / HPAs. Only `web` gets a public Service/Ingress.
- **Single VPS early on:** PM2 (Node) with multiple apps, or Supervisor for the worker.

---

## Noisy-neighbor / shared-fate

**Same codebase ≠ same process pool.** Deploy the same image as separate, independently-scaled
pools so a bot flood can't take down the customer site:

```text
build once → image:1.0
   ├─ run as web     × N   (customer site)     ← own machines, never sees /telegram/*
   ├─ run as webhook × M   (telegram intake)   ← own machines (only if needed)
   └─ run as worker  × K   (buy() jobs)        ← own machines, autoscale on queue depth
```

A Telegram flood becomes **a longer Redis queue processed at worker pace**, not site downtime
(the queue is a shock absorber that decouples arrival rate from processing rate).

The **one thing genuinely shared** even with separate pools is **Postgres + Redis**. Mitigations:

- Per-pool **DB connection limits** (and separate DB users) so workers can't exhaust the site's pool.
- **Bounded worker concurrency**.
- **Statement timeouts**; a **read replica** for the site's reads if needed.
- **Rate-limit / dedupe at the webhook** by `update_id` so spam never even becomes jobs.
- **Priority / separate queues** for customer-triggered vs bulk bot work.

(Note: Pattern A shares the same DB too — this isn't unique to the monolith.)

---

## Future expansion

### Admin panel
- Vue or React SPA → calls the **same NestJS HTTP API** over HTTP (staff JWT / session, RBAC).
- Hits the **same `OrdersService`** the bot worker uses. No second business-logic implementation.

### Web storefront
- Another frontend client of the same API (customer JWT/session on public routes).
- Same `buy()`.

Frontends calling the backend over HTTP is normal — that's just "browser → API." The thing we
avoid is our **own backend services** calling each other over HTTP when an in-process call works.

---

## When to split into a networked service (Pattern A)

Stay a monolith until one of these **concrete forces** appears:

- **Different runtime** for admin/web (e.g. Laravel/PHP) that **can't import the TS domain module**
  → the network boundary becomes the only way to share one `buy()`. *(Most likely trigger for us.)*
- **Multiple teams** independently owning bot vs platform.
- **Security isolation** — lock DB credentials to a single writer service.
- **Independent scaling/deploy cadence** becomes painful in one repo.

Until then, building those boundaries is solving problems we don't have.

---

## The discipline that keeps the door open (cheap insurance)

```text
controllers / webhook / worker  →  call  →  OrdersService.buy()  →  Prisma
      (thin adapters)                         (the ONLY writer)

NEVER let an adapter touch Prisma directly.
```

Hold this line and the monolith → service migration is **mechanical**: wrap `OrdersService` in an
HTTP controller, swap the worker's function call for a `fetch()`. Same `buy()`, now behind a
network boundary. No rewrite. Choosing the monolith now is therefore **not** a trap.

---

## Suggested repo layout

```text
src/
  telegram/        # door 1: GrammY webhook controller (thin: parse → enqueue → 200)
  queue/           # BullMQ producer config + worker entry (worker.ts)
  orders/          # THE BRAIN: OrdersService.buy(), changeBalance(), etc.
  admin/           # door 2 (later): staff HTTP controllers → OrdersService
  shop/            # door 3 (later): public HTTP controllers → OrdersService
  prisma/          # schema + migrations (owned here)
  main.ts          # web entry  (HTTP: webhook + API)
  worker.ts        # worker entry (BullMQ consumer, no HTTP)
# Single Postgres + single Redis, shared by all processes.
```

---

## Checklist before shipping a feature

- [ ] Business rule lives in a domain service only (not in a controller/worker)?
- [ ] Webhook returns 200 without awaiting the slow domain call?
- [ ] Job carries an idempotency key (`telegramUpdateId` / `requestId`)?
- [ ] No adapter (webhook/worker/controller) touches Prisma directly?
- [ ] Final user message sent from the worker, not blocked on the webhook?
- [ ] Worker concurrency + DB connection limits set so a flood can't starve the site?

---

*Modular monolith now; clean internal boundaries; split to services only when a concrete force arrives.*
