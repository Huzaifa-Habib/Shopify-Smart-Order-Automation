const crypto = require("crypto");
const logger = require("./logger");

/**
 * Verifies that a webhook request genuinely came from Shopify by checking
 * the X-Shopify-Hmac-Sha256 header against an HMAC computed from the raw
 * request body and your webhook signing secret.
 *
 * IMPORTANT: this must run against the *raw* unparsed request body.
 * That's why index.js mounts express.raw() only on the webhook route,
 * before any JSON body parser touches it.
 */
function verifyShopifyWebhook(req, res, next) {
  const hmacHeader = req.get("X-Shopify-Hmac-Sha256");
  const secret = process.env.SHOPIFY_WEBHOOK_SECRET;

  if (!secret) {
    logger.error("SHOPIFY_WEBHOOK_SECRET is not set — rejecting webhook.");
    return res.status(500).send("Server misconfigured");
  }

  if (!hmacHeader || !Buffer.isBuffer(req.body)) {
    return res.status(401).send("Missing signature or raw body");
  }

  const digest = crypto
    .createHmac("sha256", secret)
    .update(req.body)
    .digest("base64");

  const valid =
    digest.length === hmacHeader.length &&
    crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(hmacHeader));

  if (!valid) {
    logger.warn("Webhook HMAC verification failed — possible spoofed request.");
    return res.status(401).send("Invalid signature");
  }

  // Body is verified — parse it now and attach for downstream handlers.
  try {
    req.shopifyPayload = JSON.parse(req.body.toString("utf8"));
  } catch (err) {
    logger.error({ err }, "Webhook body was not valid JSON after HMAC verification");
    return res.status(400).send("Invalid JSON");
  }

  next();
}

module.exports = verifyShopifyWebhook;
