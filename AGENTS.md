# Project Context

Asteria Bank is a local-only banking workflow demonstration. It uses Node.js built-ins and SQLite and has no reverse proxy or external authorization layer.

## Security Review Guidelines

### Authentication and ownership

- `x-demo-user` identifies the authenticated demo user only. It never grants access to an object by itself and must not be treated as an authorization decision.
- `users.id` is the subject identifier. `accounts.user_id` is the account owner. A transfer is visible only when its `from_account` resolves to an account owned by the current subject. Statements inherit that same ownership relationship.
- Customer routes must include the current subject's ID in the database predicate, such as `WHERE accounts.id = ? AND accounts.user_id = ?`. Fetching by an object ID and checking only that a user is signed in is insufficient.
- A customer must receive the same not-found response for a missing object and an object owned by someone else. Never return another customer's account, balance, profile, transfer, or statement.

### Operator boundary

- Operator-only routes must require an authenticated database user whose `role` is exactly `operator`. Route names, URL prefixes, headers supplied by the client, and UI visibility do not confer operator access.
- Endpoints that list multiple customers or accounts are operator-only even when they are read-only. A customer must never receive an organization-wide list.
- Only operators may modify `role` or `status`. Customer profile input is restricted to the explicit allow-list `displayName` and `email`; ignore or reject every other property.

### Monetary invariants and promotions

- Every requested yen amount must be parsed without coercive fallbacks and validated as a safe integer greater than zero before any balance calculation.
- The authenticated subject must own the source account. The source and destination must differ, the source balance must cover the amount, and the balance check plus both balance updates must occur in one database transaction.
- Database constraints are defense in depth and do not replace request validation. Transforming a rejected amount with `Math.abs`, a default, or sign reversal is not acceptable.
- A promotion code may be redeemed at most once per user, regardless of browser session or request order. The redemption record and balance credit must be committed atomically, with a database uniqueness constraint enforcing `(user_id, code)`.

### Output and destination handling

- User-controlled values must not become executable SQL or HTML. SQL values use bound parameters; browser rendering uses text-only DOM APIs unless content has been sanitized by an approved sanitizer.
- Every exported CSV cell must be quoted and escaped. If its first non-whitespace character is `=`, `+`, `-`, `@`, tab, or carriage return, prefix it with a single quote before export so spreadsheet software treats it as text.
- A user-supplied filename must be resolved beneath an allow-listed directory and rejected if the canonical path escapes that directory.
- Outbound HTTP is disabled for customer-supplied destinations. Redirect targets must be local application paths beginning with one `/` and never `//`.
- User input must not control response-header structure, log structure, or process arguments.

### Configuration and errors

- Demo credentials and signing material must be loaded from environment variables. Example values must be unmistakable non-working placeholders and must never use production-looking prefixes.
- Client error bodies use stable public error codes only. They must not contain exception messages, stack traces, SQL text, filesystem paths, database locations, configuration values, or another customer's data.
