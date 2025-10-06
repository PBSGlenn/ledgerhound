# Ledgerhound

## Project Overview

Ledgerhound is a personal and small-business ledger application for Australia with GST support. It is a desktop application built with Tauri, React, TypeScript, and Vite. The application uses a SQLite database with Prisma as the ORM.

The application features a double-entry accounting model, GST tracking, memorized rules for auto-categorization, and support for CSV imports and reconciliation.

## Building and Running

### Prerequisites

*   Node.js 18+ and npm
*   Rust toolchain (for Tauri)
*   Git

### Installation

```bash
# Clone the repository
git clone <repo-url>
cd ledgerhound

# Install dependencies
npm install

# Run database migrations
npm run db:migrate

# Seed the database with sample data
npm run db:seed
```

### Development

```bash
# Run the app in development mode
npm run tauri:dev

# Run Vite dev server only (for UI development)
npm run dev

# Open Prisma Studio to inspect the database
npm run db:studio
```

### Build

```bash
# Build for production
npm run tauri:build
```

### Testing

```bash
# Run unit tests
npm test

# Run E2E tests
npm run test:e2e
```

## Development Conventions

*   **Frontend**: React 19 + TypeScript
*   **Desktop**: Tauri 2.x (Rust wrapper)
*   **Database**: SQLite via Prisma
*   **UI Components**: Radix UI (headless, accessible)
*   **PDF**: PDF.js
*   **Date handling**: date-fns
*   **Testing**: Vitest + Playwright
