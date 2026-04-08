---
description: Show Ledgerhound account balances
allowed-tools: Bash
---

Query the Ledgerhound database and display all account balances. Use Python with sqlite3:

```python
import sqlite3, glob, os
db_files = glob.glob('/sessions/*/mnt/Ledgerhound/prisma/books/*/ledger.db')
db_path = max(db_files, key=os.path.getmtime)
conn = sqlite3.connect(f'file://{db_path}?mode=ro&immutable=1', uri=True)
conn.row_factory = sqlite3.Row
cur = conn.cursor()
```

Query all real accounts with their balances (opening_balance + sum of postings).
Group by Personal vs Business, then by account type (Savings, Credit Cards, Payment Processors).
Format as Australian dollars ($1,234.56). Show net worth at the bottom.

If `$ARGUMENTS` contains an account name, show the register (recent transactions) for that specific account instead.
