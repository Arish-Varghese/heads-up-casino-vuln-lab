# Vulnerability: Stored XSS via Profile Bio (Privilege Escalation to Admin Session)

## Severity
Critical

## Location
POST /profile/edit, views/profile.ejs — server.js

## Description
The profile bio field is rendered using EJS's unescaped output tag
(`<%- user.bio %>`) instead of the default escaped tag (`<%= %>`). Any
HTML or JavaScript entered into the bio field is stored as-is in the
database and executed as real markup whenever the profile page is
rendered, for any viewer.

```html
<!-- Vulnerable line in profile.ejs -->
<p>Bio: <%- user.bio %></p>
```

Combined with the admin exception built into the /profile/:id ownership
check (see vulnerability #1, IDOR), this allows a low-privilege user to
plant a payload that executes inside a higher-privilege admin's browser
session the moment the admin looks up their profile — a stored XSS
escalating into a cross-privilege compromise.

## Steps to Reproduce
*(These steps were valid against the vulnerable code shown above, before
the fix below was applied. The current main branch no longer exhibits
this behavior.)*

1. Log in as a regular user (Arish, balance 1000).
2. Go to Edit Profile, set the bio to:
```html
   <script>
   fetch('/admin/update-balance', {
     method: 'POST',
     headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
     body: 'userId=2&newBalance=999999'
   });
   </script>
```
3. Save. The payload is now stored and will execute for any viewer of
   this profile page.
4. Log out, log in as admin.
5. Visit /profile/2 (Arish's profile) — permitted by the legitimate
   admin exception in the IDOR fix.
6. The script fires silently using the admin's authenticated session.
   The browser automatically attaches the admin's session cookie to the
   fetch request (standard behavior — HttpOnly only blocks JavaScript
   from reading a cookie, not from the browser sending it). The server
   accepts the request since req.session.isAdmin is true for this
   session, and updates Arish's balance to 999999 with no visible
   indication to the admin that anything happened.
7. Checking Arish's account afterward confirms the balance change
   persisted, despite the admin never manually using the admin panel's
   update form for this user.

## Evidence
- xss-arish-baseline.png — Arish's dashboard before exploitation,
  balance at 1000.
- xss-payload-entry.png — the fetch()-based payload entered into
  Arish's bio field via Edit Profile.
- xss-admin-session-active.png — confirmation of being logged in as
  admin (balance 5000, Admin link visible in nav) before visiting
  Arish's profile.
- xss-admin-views-profile.png — admin viewing Arish's profile at
  /profile/2, the page where the payload silently executes.
- xss-burp-successful-request.png — Burp Suite HTTP History showing the
  actual POST /admin/update-balance request fired by the payload,
  carrying the admin's real session cookie and userId=2&newBalance=999999
  in the body, with a 302 response confirming the server accepted it.
- xss-balance-changed-confirmed.png — Arish's dashboard afterward,
  balance changed to 999999, confirming the unauthorized update
  persisted in the database.

## Root Cause
EJS's unescaped output tag (`<%- %>`) was used for user-controlled input
that should have used the default escaped tag (`<%= %>`). This is an easy
mistake in EJS specifically, since both tags exist and look visually
similar, and a developer might reach for the unescaped version believing
it is needed to support basic text formatting in a bio field.

## Mitigating Factor Observed
An earlier test attempted to read the session cookie directly via
`document.cookie` inside an XSS payload, which returned empty. This is
because express-session sets the HttpOnly flag on session cookies by
default, correctly blocking JavaScript from reading them even when XSS
is present. This is a legitimate, working defense-in-depth control — it
blocks direct cookie theft, but does not prevent the more dangerous
consequence demonstrated here: using the victim's browser to silently
perform actions with their privileges (a CSRF-style abuse enabled by
XSS), since the browser still attaches the cookie automatically to any
request the malicious script makes.

## Fix
Changed the unescaped output tag to the escaped default in profile.ejs:

```html
<p>Bio: <%= user.bio %></p>
```

This single change is sufficient to fully remediate this vulnerability.
With escaping restored, any HTML or script content in a bio is rendered
as inert, visible text (e.g. the literal characters
`<script>alert(1)</script>`) rather than being parsed and executed by
the browser. No other code changes were required, since the entire
vulnerability was contained in this one template line.

## Verification
Reloaded Arish's profile (containing the same malicious bio payload from
the exploit) after applying the fix. The script tag is now rendered as
literal, inert text within the Bio field, instead of being parsed and
executed as HTML/JavaScript. Balance remained unchanged at 1000, and no
POST /admin/update-balance request fired, confirming the fix fully
prevents the exploit without any functional change to the bio feature
itself for legitimate plain-text use. Checkout xss-fix-verification.png
for evidence.