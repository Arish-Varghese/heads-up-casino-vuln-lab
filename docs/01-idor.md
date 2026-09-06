# Vulnerability: Insecure Direct Object Reference (IDOR) on /profile/:id

## Severity
High

## Location
GET /profile/:id — server.js

## Description
The profile route checks that a user is logged in, but never checks whether
the requested profile ID belongs to that logged-in user. Any authenticated
user can view any other user's profile data by changing the ID in the URL —
including the admin account's data.

## Steps to Reproduce
1. Log in as Arish (user id 2).
2. Visit /profile/2 — own profile loads correctly (balance: 1200).
3. Change the URL to /profile/5 (Bruce's id) — Bruce's data loads instead,
   same session cookie throughout.
4. Change the URL to /profile/1 (the admin account's id) — admin's username
   and balance (9999) load, again with the identical session cookie.
5. This confirms the flaw is not limited to regular users viewing each
   other's data — a low-privilege session can pull data belonging to the
   admin account as well, with no privilege distinction anywhere in the
   route.

## Evidence
- login-arish-cookie.png — POST /login, showing username=Arish and the
  session cookie issued.
- profile-2-own-data.png — GET /profile/2, same cookie, Arish's own data.
- profile-5-idor.png — GET /profile/5, same cookie, Bruce's data returned.
- profile-1-admin-idor.png — GET /profile/1, same cookie, admin's data
  returned.

## Root Cause
No ownership check — the route trusts req.params.id directly instead of
verifying it matches req.session.userId.

## Fix
Added an ownership check: the route now compares the requested profile id
against the logged-in user's own session id. If they don't match, the
request is rejected with a 403 Forbidden — unless the requester is an
admin, in which case access is intentionally allowed (mirrors a real
support/admin use case rather than blocking all cross-user access).

## Verification
- Logged in as Arish, requested /profile/5 (Bruce) — returns 403 Forbidden,
  "Access denied. You can only view your own profile." (previously returned
  Bruce's full profile data)
- Logged in as Arish, requested /profile/2 (own profile) — returns 200 with
  correct own data, confirming the fix does not block legitimate access.
- Logged in as admin, requested /profile/5 and /profile/1 — both succeed
  with 200, confirming the admin exception works as intended.