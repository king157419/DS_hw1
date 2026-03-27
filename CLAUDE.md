# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Install dependencies
bun install

# Start dev server (port 3000)
bun run dev

# Build for production
bun run build

# Start production server
bun run start

# Lint
bun run lint
```

## Architecture

This is a Next.js 15 + TypeScript bank queue simulation app (数据结构课程项目).

### Core data flow

1. **`src/lib/bank-simulation.ts`** — all simulation logic. Contains the event-driven algorithm:
   - `Customer`, `Window`, `Event`, `TimelineEvent` interfaces
   - Priority: assign arriving customers to idle windows first; otherwise push to the shortest queue
   - Processes events chronologically; computes wait time, sojourn time, window utilization

2. **`src/app/api/simulation/route.ts`** — POST API endpoint dispatching on `action` field:
   - `simulate`: runs `BankSimulation` with manual customer input
   - `realistic`: runs `RealisticBankSimulation` with a `BankConfig` (auto-generates customers)
   - `validate`: validates input without running
   - `testData`: returns generated test data via `generateTestData(type)`

3. **`src/app/page.tsx`** — single-page client UI with three tabs:
   - 数据输入: window count slider, customer table (arrival/service time), test data loaders
   - 模拟结果: stats overview, per-window status, customer detail table
   - 时间线: chronological event log

4. **`src/app/layout.tsx`** — root layout; **`src/app/globals.css`** — Tailwind base styles

### Key algorithm invariants

- Events are sorted by time before processing
- Idle window check happens before shortest-queue assignment
- `waitTime = startTime - arrivalTime`; `sojournTime = endTime - arrivalTime`
- Input validation rejects negative arrival times and non-positive service times; out-of-order arrival times produce a warning but still run
