# Project Context

Asteria Bank is a local-only banking workflow demonstration. It uses Node.js built-ins and SQLite and has no reverse proxy or external authorization layer.

## Security Review Guidelines

- Every account, transfer, customer, and statement belongs to one user. All read and write operations must enforce ownership on the server.
- Monetary values must be positive integer yen amounts. Balances and limits must be checked before a transaction is committed.
- A promotion code may be redeemed at most once per user, regardless of browser session or request order.
- Only the allow-listed customer profile fields `displayName` and `email` may be updated by customers. Roles and account status are operator-managed.
- User-controlled values must not become executable SQL, HTML, spreadsheet formulas, file paths, HTTP destinations, response headers, log structure, or process arguments.
- Outbound HTTP is disabled for customer-supplied destinations. Redirect targets must be local application paths.
- Demo credentials and signing material must be loaded from environment variables. Example values must be clearly non-working placeholders.
- Error responses must not expose stack traces, filesystem paths, database details, or other customers' data.
