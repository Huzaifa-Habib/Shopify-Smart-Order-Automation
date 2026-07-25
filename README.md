# Order Auto-Tagger

A small production-grade Shopify app that listens for new orders and automatically
applies tags based on configurable rules — no manual work, no Shopify Flow needed.

**Example rules included out of the box:**
| Condition | Tag |
|---|---|
| Order total ≥ $200 | `VIP` |
| Line items include a gift-wrap product | `needs-gift-wrap` |
| Order note contains "rush"/"asap"/"urgent" | `rush` |
| Shipping country is not US | `international` |
| First order from this customer | `new-customer` |

Edit `src/config/rules.js` to add your own — each rule is just a small function
that returns true/false.

## Why this architecture

- **GraphQL Admin API**, not REST — REST is legacy on Shopify now; `tagsAdd` is the
  current, supported mutation.
- **Raw-body HMAC verification** on the webhook route, done *before* JSON parsing,
  so we can cryptographically prove the request came from Shopify and wasn't spoofed.
- **Idempotency guard** using `X-Shopify-Webhook-Id` — Shopify uses at-least-once
  delivery, so the same order can trigger the webhook more than once. We de-dupe so
  tags never get applied redundantly or trigger duplicate side effects.
- **Fast ack, async processing** — the route responds `200` immediately, then does the
  rule evaluation + API call. Shopify expects a response within 5 seconds or it treats
  the delivery as failed and retries.
- **Backoff on Shopify's cost-based rate limiting** — GraphQL calls that get
  `THROTTLED` are retried automatically with linear backoff.

## Setup

### 1. Create a custom app in Shopify Admin

Shopify Admin → Settings → Apps and sales channels → Develop apps → Create an app.

Under **Configuration → Admin API scopes**, enable:
- `read_orders`
- `write_orders`

Install the app on your store, then copy the **Admin API access token**
(starts with `shpat_`) — you only see it once.

### 2. Get your webhook signing secret

Same custom app screen → **API credentials** tab → **Webhook API version / secret**.
(If you register webhooks via the Admin API as shown below, Shopify auto-generates
this secret for you — copy it from the same screen after creating the app.)

### 3. Configure environment

```bash
cp .env.example .env
```

Fill in `SHOPIFY_SHOP`, `SHOPIFY_ADMIN_ACCESS_TOKEN`, and `SHOPIFY_WEBHOOK_SECRET`.

### 4. Install and run locally

```bash
npm install
npm run dev
```

### 5. Expose your local server (for local testing only)

```bash
ngrok http 3000
```

Copy the `https://xxxx.ngrok-free.app` URL into `APP_PUBLIC_URL` in `.env`.

### 6. Register the webhook

```bash
npm run register-webhook
```

Verify it worked:

```bash
npm run list-webhooks
```

### 7. Test it

Place a test order in your Shopify store (or use Shopify's "Send test notification"
style tools / a draft order marked as paid). Within a couple seconds you should see:

```
INFO: Order tagged successfully { orderId: ..., tags: [ 'VIP' ] }
```

...and the tag will appear on the order in Shopify Admin.

## Deploying to production

Any Node host works (Render, Railway, Fly.io, a small VPS). Steps are the same:

1. Set the same environment variables from `.env` in your host's dashboard.
2. Deploy.
3. Update `APP_PUBLIC_URL` to your real domain and re-run `npm run register-webhook`
   (delete the old ngrok-pointed subscription first via `list-webhooks` + a small
   `webhookSubscriptionDelete` call, or just leave it — Shopify will disable webhooks
   that fail repeatedly).
4. If you expect high order volume across multiple server instances, swap
   `src/lib/dedupe.js`'s in-memory Map for Redis (`SET key val NX EX 600`) so all
   instances share dedupe state.

## Project structure

```
order-auto-tagger/
├── src/
│   ├── index.js              # Express app entry point
│   ├── config/rules.js       # ← the file you edit to change tagging logic
│   ├── lib/
│   │   ├── shopify.js        # GraphQL client, addOrderTags, retry/backoff
│   │   ├── verifyWebhook.js  # HMAC signature verification middleware
│   │   ├── ruleEngine.js     # Runs rules.js against an order payload
│   │   ├── dedupe.js         # Idempotency guard for retried webhooks
│   │   └── logger.js         # Structured logging (pino)
│   └── routes/webhooks.js    # POST /webhooks/orders/create
├── scripts/
│   ├── registerWebhook.js    # One-command webhook registration
│   └── listWebhooks.js       # Debugging helper
├── .env.example
└── package.json
```

