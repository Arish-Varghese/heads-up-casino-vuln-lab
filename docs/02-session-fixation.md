# Vulnerability: Session Fixation on Login

## Severity
Medium

## Location
POST /login — server.js

## Description
The login route sets req.session.userId and req.session.isAdmin on the
existing session object without regenerating the session ID first. If a
browser already holds a session cookie (e.g. from a previous login), logging
in as a different user reuses the same session ID — it is simply relabeled
with the new user's identity rather than issued a fresh one. This was discovered 
while verifying the 01-IDOR fix. If left unfixed, this is the same 
underlying flaw responsible for real account-takeover attacks predating 
session-regeneration becoming a framework default

## Steps to Reproduce
1. Log in as Arish. Note the session cookie value.
2. Without logging out, submit the login form again with admin credentials.
3. Inspect the request in Burp — the exact same connect.sid cookie value
   from step 1 is sent, and the server accepts it and reassigns it to the
   admin identity instead of issuing a new session.

## Evidence
- session-fixation-arish-login.png — POST /login as Arish, cookie issued.
- session-fixation-admin-login.png — POST /login as admin, same cookie
  value present in the request, reused rather than replaced.

## Root Cause
express-session does not regenerate the session ID automatically. Without
an explicit call to regenerate it, the same session object (and therefore
the same ID) persists across logins. In a real attack scenario, this
pattern (session fixation) allows an attacker who can plant a known session
ID in a victim's browser to hijack that session once the victim logs in.

## Fix
Call req.session.regenerate() before assigning new session data on login,
forcing a new session ID to be issued every time a login succeeds.

## Verification
Logged in as Arish, noted session cookie (ending ...vpYcE). Without logging
out, submitted login as admin. The request still carried the old cookie
(expected browser behavior), but the response's Set-Cookie now issued a
completely new value (ending ...oMbTicxg), confirming the server no longer
reuses an existing session across logins.