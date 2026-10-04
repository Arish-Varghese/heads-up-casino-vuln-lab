# Vulnerability: Missing Input Validation on Bet Amount (Business Logic Flaw)

## Severity
High

## Location
POST /bet — server.js

## Description
The bet-placement endpoint accepts any integer for `amount`, with no
minimum, maximum, or sign check, and no check against the user's current
balance. The payout formula is `won ? balance + amount : balance - amount`,
so a negative amount inverts the intended money flow — a coin-flip "loss"
with a negative bet amount increases the balance instead of decreasing it.
There is also no upper bound, allowing unbounded balance inflation.

## Steps to Reproduce
1. Log in with balance 1300.
2. Submit a bet with amount = -300.
3. If the coin flip resolves as a loss, balance increases by 300 instead
   of decreasing — despite being recorded as a "loss" in the bet history.
4. Repeating this with larger negative values compounds the balance with
   no upper limit, since nothing validates the amount's range.

## Evidence
- bet-baseline-balance.png — shows baseline balance before betting for user Arish
- bet-negative-request.png — POST /bet request body showing amount=-300.
- bet-negative-result.png — dashboard showing balance decreased after a
  recorded "win"
- bet-extreme-negative-request — /bet request body showing extreme bet amount=-100000000000
- bet-extreme-negative-result — dashboard showing balance decreased to -99999999000 after recorded "win"

## Root Cause
No server-side validation on the `amount` field before it's used in the
balance calculation — negative numbers, zero, and values exceeding the
user's current balance are all silently accepted.

## Fix
Added three server-side validation checks before the bet is processed:
1. Reject if the amount is not a valid positive integer (catches negative
   values, zero, and non-numeric input).
2. Reject if the amount exceeds the user's current balance.
Both checks happen before any balance calculation or database write,
ensuring no invalid bet can affect the stored balance.

Note: the browser's native number input has its own step-validation quirk
that allows certain near-integer decimals (e.g. 1.99999999) to bypass
client-side validation due to floating-point tolerance. This has no
security impact, since the server-side check (Number.isInteger) validates
the actual submitted value independently of any client-side behavior.

## Verification
- amount = -10 → rejected with "Invalid bet amount."
- amount = 0 → rejected with "Invalid bet amount."
- amount = 1400 (exceeding a balance of 1300) → rejected with
  "Insufficient balance for this bet."
- amount = 300 (valid, within balance) → processed normally, balance
  updated correctly as a loss.

## Additional Observation: URL Query Parameter Manipulation (Not Exploitable)

The dashboard route accepts `result` and `amount` as URL query parameters
purely for displaying the "you won/lost X" message after a bet. These
values can be freely edited in the URL (e.g. changing result=win to
result=loss, or changing the amount), but this has no security impact:
the actual balance is always read fresh from the database on every
dashboard load, independent of these query parameters. This confirms the
app correctly separates client-displayed state from server-side
source-of-truth state for anything involving money. No fix required.