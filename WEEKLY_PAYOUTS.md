# Roadily weekly manual bank payouts

Roadily accepts withdrawal requests **but never initiates bank transfers automatically**. Requests appear in the admin dashboard and Roadily staff make payments outside the platform in their bank portal.

## How it works

1. User chooses **Withdraw from wallet**, enters an amount, and sees the payout bank account already saved to their profile.
2. Backend checks **verified Peygo deposit credits** minus previously paid and pending withdrawals. It reserves the amount and creates a `requested` record.
3. Roadily admin dashboard (`/admin.html`) shows the pending queue, user, amount, bank, account number, and request time.
4. Staff reviews the request and approves it, or rejects it (which releases the reservation).
5. In the weekly payout batch, staff performs the actual transfer in the bank system, double-checking name, number and amount.
6. Only after the transfer is confirmed, staff selects **Record bank transfer**, entering the actual bank transaction reference. The backend marks the request `paid` and records the event in an audit table. A duplicate transfer reference is refused.
7. The user's available wallet balance remains reduced; the withdrawal history reflects the paid status.

Payout batches are grouped by the **week beginning Monday in Africa/Lagos**, with the next Monday at 09:00 as the *indicative* processing time. This is a scheduling convention, not a guarantee that staff will pay at exactly 09:00.

## Security boundaries

- Backend checks admin membership from `ROADILY_ADMIN_PHONES`, a server environment variable. The dashboard HTML being public on GitHub Pages **does not** grant admin permissions.
- Staff must register a normal Roadily account whose normalized phone is listed in `ROADILY_ADMIN_PHONES` (e.g. `+2348031234567`). Do not list an unverified stranger's phone.
- The staff dashboard authenticates using `/api/login` and receives a bearer session; all sensitive admin endpoints check this session AND the admin phone allowlist.
- **Do not publish real bank account numbers**, access tokens, environment variables, payout history, customer documents or the SQLite database in the GitHub repository.
- The standalone backend must run on a secure HTTPS host with persistent encrypted backups. SQLite is a development/reference backend. For multiple workers, use transactional Postgres, payment-provider reconciliation, staff 2FA, and separate approval/payment roles before production.
- The `mark-paid` action records a staff assertion and reference, not direct verification from the bank. For production, reconcile bank statements and require a second staff member to validate payouts.
- Payouts will not open until `ROADILY_PEYGO_CREATE_ACCOUNT_URL`, `ROADILY_PEYGO_API_TOKEN`, and `ROADILY_PEYGO_WEBHOOK_SECRET` are set for the backend. Those values must never be placed in `roadily.config.js`.

## Hosting & configuration

GitHub Pages is static. Publish `index.html`, `admin.html`, and `roadily.config.js` there, but host `server.py` on another server. Set **public only**:

```js
window.ROADILY_API_BASE = 'https://api.your-roadily-domain.com';
window.ROADILY_PUBLIC_ORIGIN = 'https://api.your-roadily-domain.com';
```

Server environment variables:

```env
ROADILY_HOST=0.0.0.0
ROADILY_PUBLIC_URL=https://api.your-roadily-domain.com
ROADILY_ALLOWED_ORIGINS=https://kingamada.github.io
ROADILY_ADMIN_PHONES=+2348031234567
ROADILY_PEYGO_CREATE_ACCOUNT_URL=https://peygo.net/_functions/apiRoadilyCreateAccount
ROADILY_PEYGO_API_TOKEN=<server-only secret>
ROADILY_PEYGO_WEBHOOK_SECRET=<server-only secret>
```

Endpoints:

- `POST /api/wallet/withdraw` `{ "amount": 500 }` — creates a request and reserves money
- `GET /api/wallet/withdrawals` — user's own withdrawal history
- `GET /api/admin/summary` — admin dashboard stats
- `GET /api/admin/withdrawals?status=requested` — admin queue with bank account snapshots
- `POST /api/admin/withdrawals/:id/approve` — approve request
- `POST /api/admin/withdrawals/:id/reject` — reject and release hold
- `POST /api/admin/withdrawals/:id/mark-paid` `{ "transfer_reference": "...", "note": "..." }` — record completed manual payment
- `GET /api/admin/audit` — audit trail
- `GET /api/admin/vehicles` — verification queue
- `POST /api/admin/vehicles/:id/verification` — staff verification after documentary review

## Tests

Run the offline HTTP integration test with `python3 test_weekly.py`. It validates auth, admin role isolation, HMAC webhook rejection and idempotence, balance holds, insufficient funds, approvals, payouts, rejection and audit records. It does not move money.