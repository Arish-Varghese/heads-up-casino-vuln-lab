# Vulnerability: Plaintext Password Storage

## Severity
Critical

## Location
db.js (schema), POST /signup, POST /login — server.js

## Description
User passwords are stored in the database exactly as entered, with no
hashing or encoding. The login route compares submitted passwords directly
against this stored plaintext value. Anyone who gains read access to the
database — via another vulnerability, a stolen backup, or insider access —
immediately has every user's real password in readable form.

## Steps to Reproduce
1. Open casino.db in any SQLite viewer.
2. View the users table.
3. All passwords are visible as plain, readable text.

## Evidence
- plaintext-pswd.png — users table showing readable passwords.

## Root Cause
No hashing function is applied to passwords at signup, and login performs
a direct string comparison against the stored value.

## Fix
Installed bcrypt and updated both the signup and login routes:
- Signup now hashes the password with bcrypt.hashSync(password, 10)
  before storing it, rather than storing the raw input.
- Login now fetches the user by username only, then verifies the
  submitted password using bcrypt.compareSync(password, user.password),
  which re-hashes the attempt and compares it against the stored hash
  rather than comparing plaintext values directly.
- The admin seed user in db.js was updated to hash its password the same
  way, and the database was reset so all existing test users were
  re-created through the new hashing flow.

## Verification
- Opened casino.db after the fix — all password fields now show bcrypt
  hashes (prefixed $2b$10$) instead of readable text.
- plaintext-pswd-verify.png — users table showing encrypted passwords.
- Logged in with correct credentials — succeeds normally, confirming the
  fix did not break legitimate login.
- Attempted login with an incorrect password — correctly rejected.