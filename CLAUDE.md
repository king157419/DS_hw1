# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
bun install          # Install dependencies
bun run dev          # Start dev server (port 3000)

# Build & Production
bun run build        # Build for production
bun run start        # Start production server

# Code Quality
bun run lint         # Run ESLint
bun run lint:fix     # Run ESLint with auto-fix

# Testing (if/when added)
# bun test           # Run all tests
# bun test <path>    # Run specific test file
```

## Architecture

This is a Next.js 15 + TypeScript bank queue simulation app (数据结构课程项目).

### Core Simulation Engine (`src/lib/bank-simulation.ts`)

Event-driven simulation logic using a chronological timeline:
- **`BankSimulation`**: Core class for manual customer input. Uses Shortest Queue First (SQF) strategy.
- **`RoundRobinSimulation`**: Extends `BankSimulation` with round-robin window assignment.
- **`LeastExpectedWaitSimulation`**: Extends `BankSimulation` with Least Expected Wait (LEW) strategy, considering both current service time and queue wait time.
- **`RealisticBankSimulation`**: Extends logic for auto-generated distributions (Poisson arrival, Exponential service) with break management (lunch, window rotation, toilet breaks).
- **Priority Logic**: Idle windows are filled first; otherwise, customers join the queue based on the algorithm strategy.
- **Metrics**: Computes Wait Time (`startTime - arrivalTime`), Sojourn Time (`endTime - arrivalTime`), and Window Utilization.

### Data Flow & API

- **API (`src/app/api/simulation/route.ts`)**: POST endpoint handling `simulate`, `realistic`, `validate`, `testData`, and `compareAlgorithms` actions.
- **State Management**: React state in `src/app/page.tsx` manages simulation inputs and results across three tabs (Input, Results, Timeline).
- **Visualization (`src/components/`)**:
  - `P5QueueVisualization.tsx`: Real-time queue animation using p5.js with particle effects, flying dots, and pulse rings.
  - `AlgorithmicArt.tsx`: Particle/flow-field visualization driven by simulation data.

### Key Invariants

- Events must be sorted by time before processing.
- Idle window check happens *before* shortest-queue assignment.
- Input validation: Non-negative arrival times, positive service times.
- Algorithm comparison uses identical input data cloned for each simulation instance.
