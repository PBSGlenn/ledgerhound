---
description: Import a bank CSV into Ledgerhound
allowed-tools: Read, Bash, Grep, Glob, Edit, Write, mcp__Claude_in_Chrome__javascript_tool, mcp__Claude_in_Chrome__navigate
argument-hint: [csv-file-path] [account-name]
---

Import a bank CSV file into Ledgerhound. Follow these steps:

1. Read the CSV file at `$1` (or ask the user which file). Examine first 10 rows to identify columns.

2. Identify target account (`$2` or ask). Query the database for the account ID:
   ```python
   import sqlite3, glob, os
   db_files = glob.glob('/sessions/*/mnt/Ledgerhound/prisma/books/*/ledger.db')
   db_path = max(db_files, key=os.path.getmtime)
   conn = sqlite3.connect(f'file://{db_path}?mode=ro&immutable=1', uri=True)
   cur = conn.cursor()
   cur.execute("SELECT id, name FROM accounts WHERE kind='TRANSFER' AND archived=0 ORDER BY name")
   ```

3. Parse all CSV rows. Handle common Australian bank formats (CBA, NAB, Westpac, ANZ). Normalize amounts, parse DD/MM/YYYY dates.

4. Check for duplicates against existing transactions in date range.

5. Apply memorized rules for auto-categorization.

6. Preview: show summary (count, date range, account, auto-categorized, duplicates). Ask for confirmation.

7. Execute import via Chrome javascript_tool POSTing to http://localhost:3001/api/transactions.

8. Report: how many imported, errors, skipped duplicates.
