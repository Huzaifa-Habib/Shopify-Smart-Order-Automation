const express = require("express");
const verifyShopifyWebhook = require("../lib/verifyWebhook");
const { evaluateRules } = require("../lib/ruleEngine");
const { addOrderTags } = require("../lib/shopify");
const { alreadyProcessed, markProcessed } = require("../lib/dedupe");
const logger = require("../lib/logger");

const router = express.Router();

// express.raw() keeps the body as a Buffer so HMAC verification works —
// do NOT put express.json() in front of this route.
router.post(
  "/orders/create",
  express.raw({ type: "application/json" }),
  verifyShopifyWebhook,
  async (req, res) => {
    const webhookId = req.get("X-Shopify-Webhook-Id");
    const order = req.shopifyPayload;

    // Acknowledge fast — Shopify expects a 2xx within 5 seconds or it
    // will retry (and eventually disable the webhook after repeated failures).
    res.status(200).send("ok");

    if (alreadyProcessed(webhookId)) {
      logger.info({ webhookId, orderId: order.id }, "Duplicate webhook delivery, skipping");
      return;
    }
    markProcessed(webhookId);

    try {
      const tagsToApply = evaluateRules(order);

      if (tagsToApply.length === 0) {
        logger.info({ orderId: order.id }, "No rules matched, no tags applied");
        return;
      }

      const orderGid = `gid://shopify/Order/${order.id}`;
      await addOrderTags(orderGid, tagsToApply);

      logger.info(
        { orderId: order.id, orderNumber: order.order_number, tags: tagsToApply },
        "Order tagged successfully"
      );
    } catch (err) {
      // Response was already sent, so log loudly for now.
      // In production, push this to an error tracker (Sentry, etc.)
      // and/or a dead-letter queue for manual retry.
      logger.error({ err, orderId: order?.id }, "Failed to process order webhook");
    }
  }
);

module.exports = router;
