# Heads Up — A Deliberately Vulnerable Coin-Toss Betting App

A small full-stack web app built around a simple heads-or-tails betting
mechanic, created from scratch to demonstrate practical AppSec skills:
designing, exploiting, documenting, and fixing real web vulnerabilities in
an app I built myself.

This is not a full casino platform — it's a single coin-toss betting game
(place a bet, pick heads or tails, win or lose the amount) used as a
realistic, small-scale app to practice AppSec on.

Built as part of my transition from casino game development into
cybersecurity (currently studying at CDAC Hyderabad).

## Why this project

Most beginner AppSec portfolios use a pre-made vulnerable app (DVWA, Juice
Shop). I built my own instead — a small betting app, using my prior game
dev background — so I could demonstrate both sides of the problem: how a
developer accidentally introduces a vulnerability, and how an attacker
finds and exploits it.

## Tech stack

- Node.js + Express.js
- SQLite (better-sqlite3)
- EJS templating
- express-session for authentication
- Burp Suite Community Edition for vulnerability testing

## Methodology

Built in two phases:
1. **Phase 1** — the app was built the way an unhardened developer under
   time pressure would build it, so vulnerabilities formed naturally
   rather than being artificially inserted.
2. **Phase 2** — went back with an attacker's mindset: traced every user
   input to where it ends up (a database query, rendered HTML, a
   permission check, a calculation), cross-referenced against the
   OWASP Top 10, then exploited, documented, and fixed each finding.

## Vulnerabilities

Full writeups with reproduction steps, evidence, root cause, and fixes
are in [`/docs`](./docs).

| # | Vulnerability                                                 | Status      |
|---|----------------------------------------------------------------|--------------|
| 1 | Insecure Direct Object Reference (IDOR) on `/profile/:id`      | Fixed        |
| 2 | Session Fixation on login                                       | Fixed        |
| 3 | Missing input validation on bet amount (business logic flaw)   | Documented   |
| 4 | Race condition on bet placement                                 | Planned      |
| 5 | Plaintext password storage                                      | Planned      |
| 6 | SQL Injection (deliberately introduced)                         | Planned      |
| 7 | Stored XSS (deliberately introduced)                            | Planned      |

## Branches

- `main` — current app state, with fixes applied progressively.
- `vulnerable` — frozen snapshot of the app immediately after Phase 1,
  before any deliberate vulnerability work began.

## Running locally

npm install
node db.js
node server.js

App runs at `http://localhost:3000`. Default admin login: `admin` /
`admin123` (this is intentionally insecure — see vulnerability #5).