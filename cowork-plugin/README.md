# Ledgerhound Assistant

Connect to your Ledgerhound accounting system from Claude Cowork.

## What it does

- Query account balances, transactions, and financial reports directly from your Ledgerhound database
- Import bank CSV statements with auto-categorization via memorized rules
- Create and manage transactions, categories, and rules
- Generate P&L, GST, BAS, and spending analysis reports

## How it works

**Reads**: Direct SQLite queries against your Ledgerhound database (fast, no server needed — just mount the Ledgerhound project folder).

**Writes**: Uses Claude in Chrome to call the Ledgerhound Express API at localhost:3001.

## Setup

1. Mount the Ledgerhound project folder in your Cowork session
2. For read-only operations: no server needed
3. For write operations: run `start-ledgerhound.bat` first

## Components

### Skills
- **ledgerhound-data** — Financial queries (balances, spending, reports, GST)
- **ledgerhound-import** — Import/write (CSV import, create transactions)

### Commands
- `/import-csv [file] [account]` — Import a bank CSV
- `/balance [account]` — Show account balances or register
