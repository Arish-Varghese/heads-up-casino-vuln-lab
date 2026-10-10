# Vulnerability: SQL Injection on /history Result Filter

## Severity
Critical

## Location
GET /history — server.js

## Description
The bet history filter feature built its SQL query using direct string
concatenation of the `result` query parameter, instead of a parameterized
query. This allowed an attacker to break out of the intended SQL string
and inject arbitrary SQL, including a UNION-based injection that returns
data from an entirely different table (`users`) instead of `bets`.

```javascript
// Original vulnerable code
const filter = req.query.result;
let query = `SELECT * FROM bets WHERE user_id = ${req.session.userId}`;
if (filter) {
  query += ` AND result = '${filter}'`;
}
const bets = db.prepare(query).all();
```

## Steps to Reproduce
*(These steps were valid against the vulnerable code shown above, before
the fix below was applied. The current main branch no longer exhibits
this behavior.)*
1. Log in as any user.
2. Visit `/history?result=win'` — a single quote alone breaks the query,
   causing a server error (`SqliteError: unrecognized token`) that
   confirms the input reaches the SQL parser unescaped.
3. Determine the `bets` table's column count by trial and error (6
   columns: id, user_id, amount, choice, result, timestamp).
4. Visit the following URL to extract data from the `users` table via a
   UNION-based injection:
   /history?result=nonexistent’ UNION SELECT id, id, username, password, is_admin, balance FROM users--
5. The page renders every user's username, bcrypt password hash, admin
   status, and balance — data that should never be reachable from this
   endpoint, and belongs to other users entirely.

## Evidence
- sqli-single-quote-error.png — single-quote probe causing a SQLite
  syntax error, confirming unescaped input reaches the query.
- sqli-union-exploit.png — browser showing the full UNION payload URL
  and the resulting page rendering leaked user data (usernames, bcrypt
  hashes, admin flags, balances) inside the bet history table.
- sqli-union-raw-html.png — the raw HTTP response source confirming the
  leaked data is present in the actual response, not just a rendering
  artifact.

## Root Cause
User input (`req.query.result`) was concatenated directly into a SQL
string instead of being passed as a bound parameter. better-sqlite3
supports parameterized queries via `?` placeholders throughout the rest
of this application; this route was deliberately written to bypass that
safety for demonstration purposes.

## Additional Observation: Verbose Error Disclosure
The single-quote probe (step 2) also revealed a full server stack trace
directly in the browser, including the application's absolute file paths
and confirmation of the database library in use (better-sqlite3). This
is a separate, minor information-disclosure issue: verbose error details
should never be shown to end users in a production deployment, since
they assist an attacker in fingerprinting the stack.

## Fix
Replaced the concatenated query with a parameterized query, and added a
whitelist check restricting the filter to only the two legitimate values
the feature was ever meant to support:

```javascript
app.get('/history', (req, res) => {
  if (!req.session.userId) return res.redirect('/login');
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);

  const filter = req.query.result;
  let bets;
  if (filter === 'win' || filter === 'loss') {
    bets = db.prepare('SELECT * FROM bets WHERE user_id = ? AND result = ?')
      .all(req.session.userId, filter);
  } else {
    bets = db.prepare('SELECT * FROM bets WHERE user_id = ?').all(req.session.userId);
  }

  res.render('history', { bets, user });
});
```

Two layers of defense: the `?` placeholders ensure the database always
treats `filter` as pure data, never as part of the SQL structure,
regardless of its contents — this alone closes the injection. The
whitelist check is additional defense-in-depth: only `'win'` or `'loss'`
are accepted as valid filter values, so any unexpected input (including
injection attempts) is simply ignored and falls back to showing all
bets, rather than ever reaching the database as part of a dynamic clause.

## Verification
Retested the exact UNION payload (/history?result=nonexistent' UNION
SELECT id, id, username, password, is_admin, balance FROM users--)
against the fixed route. The malicious filter value does not match
'win' or 'loss', so it is ignored by the whitelist check and the page
simply loads the user's normal bet history with no injection occurring
and no user data leaked. Confirmed that legitimate filtering
(/history?result=win and /history?result=loss) still functions
correctly, and that /history with no filter still shows all bets.
