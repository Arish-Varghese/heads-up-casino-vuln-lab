# Vulnerability: Potential Race Condition on Bet Placement

## Severity
Low (unsafe code pattern present; not practically exploitable in the
original implementation — see Analysis). Fixed as defense-in-depth.

## Location
POST /bet — server.js

## Description
The bet-placement route originally read the user's balance, calculated a
new value in application code, then wrote it back as a separate
statement — a read-modify-write pattern that is unsafe in general. Two
concurrent requests could theoretically read the same starting balance
before either one writes back, causing one bet's effect to be silently
lost, or allowing more bets to be approved than the actual balance should
permit.

```javascript
// Original vulnerable code
const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.session.userId);
// balance read into JS memory here

const newBalance = won ? user.balance + betAmount : user.balance - betAmount;
db.prepare('UPDATE users SET balance = ? WHERE id = ?').run(newBalance, user.id);
// write happens as a separate, later statement
```

## Testing Performed (Pre-Fix)
Starting balance was reset to 1000. A manual bet of 100 was placed and
won, bringing the balance to 1100 — this also confirmed a live session
before capturing the request for attack. Using Burp Suite's Intruder, the
captured POST /bet request was resent as 35 concurrent identical requests
with the bet amount edited to 600 — deliberately large relative to the
balance, so that a successful race (multiple 600-value bets approved
despite insufficient funds) would be mathematically unambiguous. A custom
Burp resource pool was configured with 35 concurrent requests (up from
the default 10) to maximize the chance of requests genuinely overlapping
in-flight rather than being sent in smaller sequential batches.

## Result (Pre-Fix)
Of the 35 concurrent requests fired, only 7 were processed as valid bets
(3 wins, 4 losses) — the remaining were correctly rejected by the
existing balance-sufficiency check, since the balance was insufficient to
cover more than a handful of 600-value bets. Across the 7 bets that did
process, the balance change exactly matched the sum of their logged
results: 1100 → 500 (a net change of -600). No discrepancy between the
logged bet history and the actual stored balance was observed. The race
condition did not manifest in this test.

## Analysis
This application uses better-sqlite3, a synchronous database driver,
inside Node.js's single-threaded event loop. The SELECT and UPDATE calls
in the /bet handler contained no async/await boundary between them, so
the entire read-modify-write sequence executed as one uninterruptible
block — Node could not begin processing a second request's JavaScript in
the middle of another request's synchronous execution. This incidentally
prevented the race condition from being triggered via concurrent HTTP
requests in this specific setup, even though the underlying code pattern
remained unsafe in general. The same code would very likely be
exploitable with an asynchronous database driver, a multi-threaded or
multi-process deployment, or a database shared across more than one
application instance — none of which are unusual in production systems.

## Fix
Replaced the read-modify-write pattern with a single atomic SQL
statement, combining the balance check and the update into one
indivisible operation:

```javascript
const result = db.prepare(
  'UPDATE users SET balance = balance + ? WHERE id = ? AND balance >= ?'
).run(delta, req.session.userId, betAmount);

if (result.changes === 0) {
  return res.send('Insufficient balance for this bet.');
}
```

This removes the read-modify-write gap entirely — the balance comparison
and the write happen inside the same SQLite statement, so no other
request can observe or act on an intermediate state. This was applied
as defense-in-depth rather than a reaction to a confirmed exploit: the
original code's safety was an implementation accident (a specific
synchronous driver choice), not a deliberate guarantee, and would have
silently broken if the database layer were ever swapped for an async
driver or the application were scaled across multiple processes.

## Verification (Post-Fix)
After applying the fix, the same test methodology was repeated with a
larger starting balance (1200, after a manual 100-bet win) to allow more
concurrent bets to actually process and more thoroughly exercise the
atomic write under load. Burp Suite Intruder fired concurrent identical
600-value bet requests against the fixed code. 36 bets were logged in
total — 24 wins and 12 losses. The net expected change was:
(24 x 600) - (12 x 600) = +7,200, giving an expected final balance of
1200 + 7200 = 8400. The actual observed balance after the attack matched
this exactly, with no discrepancy, confirming the atomic update holds
correctly even under a substantially higher concurrent write volume than
the pre-fix test.

## Evidence
- race-manual-bet-baseline.png — manual bet won pre-fix, balance at
  1100, confirming a live session before the initial attack.
- race-intruder-config(1).png — Intruder Positions tab showing the
  request body edited to choice=tails&amount=600.
- race-intruder-config(2).png — Intruder Payloads tab showing payload
  count set to 35 (null payloads, repeating the identical request).
- race-intruder-config(3).png — Intruder Resource Pool tab showing a
  custom pool with 35 concurrent requests.
- race-post-attack-balance.png — dashboard after the pre-fix attack,
  showing balance correctly at 500 despite high concurrency (no race
  triggered, consistent with the synchronous-driver analysis).
- race-bets-table-full.png — complete pre-fix bets table showing the
  manual bet plus all 7 processed attack bets, whose logged results sum
  exactly to the observed balance change.
- race-fix-verification-table.png — post-fix bets table (rows 31-49)
  showing the start of the verification attack's logged bets.
- race-fix-verification-table(2).png — post-fix bets table continued
  (rows 50-66), completing the full set of 36 logged bets whose wins and
  losses sum exactly to the observed balance change (1200 to 8400).