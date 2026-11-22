# Roadily + Peygo payment bridge
Roadily reuses the *pattern* in [Duesily](https://github.com/KingAmada/Duesily): GitHub Pages frontend → trusted app API → Peygo/Wix payment backend → verified bank notifications. [Poolily](https://github.com/KingAmada/poolily) also demonstrates a Supabase/Wix gateway, but its browser-side withdrawal success simulation must **not** be used for real money.

## Frontend configuration
Set public values in `roadily.config.js` only after deploying the Roadily API:
```js
window.ROADILY_API_BASE = 'https://api.your-domain.com';
window.ROADILY_PUBLIC_ORIGIN = 'https://api.your-domain.com';
```
Never commit API keys, transfer signing secrets or session credentials.

## Payment endpoints expected by the updated interface
- `POST /api/register`, `POST /api/login` return a user and opaque bearer token.
- `GET /api/me` validates a session.
- `GET /api/wallet` returns a verified ledger-derived balance or null.
- `GET /api/wallet/vehicle-accounts` returns accounts issued for the signed-in user's vehicles.
- `POST /api/vehicles/{id}/peygo-account` provisions a genuine Peygo payment account **only after vehicle ownership or driver authorisation is verified**.
- `POST /api/rewards` returns `{status:"awaiting_bank_transfer",plate,amount,account:{bank_name,account_name,account_number}}`; this is a payment instruction, **not a transfer confirmation**.
- `POST /api/wallet/withdraw` must remain disabled until a bank-confirmed transfer/reconciliation implementation exists.

## Peygo/Wix integration to implement
Your [Duesily](https://github.com/KingAmada/Duesily/blob/main/app.js) frontend calls `https://peygo.net/_functions/apiDuesilyCreateAccount` for estate virtual accounts and the resident-specific endpoint for residents. Those routes are application-specific. Implement **a new authenticated** `apiRoadilyCreateAccount` handler within the Peygo/Wix backend, with idempotent allocation, cross-product account number uniqueness, account ownership verification, and a bank-confirmed account alias. Its proposed contract:
```json
{"app":"Roadily","vehicle_id":25,"plate":"ABC123X","owner_id":1,"idempotency_key":"roadily-vehicle-25"}
```
Response:
```json
{"success":true,"account_number":"<issued 10-digit number>","account_name":"<verified beneficiary name>","bank_name":"Stanbic IBTC Bank","reference":"<provider reference>"}
```

## Signed deposit notifications
Have the trusted Peygo/Stanbic webhook processor forward **already verified settled events**, not raw browser reports. Example payload:
```json
{"event_id":"<unique-id>","account_number":"<issued-number>","amount_kobo":150000,"status":"settled"}
```
Sign exact body bytes with HMAC-SHA256 in `X-Roadily-Peygo-Signature` and a backend-only shared secret. Deduplicate by event ID, reject unknown accounts and support reversals/reconciliation before accepting live funds.

## Backend starter
The companion application backend (available separately as ZIP in this conversation) contains these routes, the Peygo adapter, signature validation, pending bank-transfer instructions and a ledger of authenticated credits. It is **development code**, not an audited production payment system. It must be deployed separately from GitHub Pages. An existing local `roadily.db` can be migrated by backing it up and using the supplied server, not by uploading it to the public repository.

**Launch gate:** Real funds remain disabled until the Peygo/Wix route is implemented, the HTTPS backend is deployed, bank alias agreement is confirmed, ownership checks are working, and webhook/payout reconciliation is tested. The bank account shown must be issued by the provider, never invented in the frontend.
