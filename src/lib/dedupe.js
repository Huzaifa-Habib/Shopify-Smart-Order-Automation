/**
 * Shopify may deliver the same webhook more than once (at-least-once delivery,
 * e.g. after a timeout or network retry). This guard uses the unique
 * X-Shopify-Webhook-Id header to skip work we've already done.
 *
 * This is an in-memory implementation — fine for a single-instance deploy
 * or a portfolio demo. If you run multiple instances/dynos in production,
 * swap this for Redis (SET NX with a TTL) so all instances share state.
 */
const seen = new Map(); // webhookId -> expiryTimestamp
const TTL_MS = 10 * 60 * 1000; // 10 minutes is plenty for Shopify's retry window

function cleanup() {
  const now = Date.now();
  for (const [id, expiry] of seen) {
    if (expiry <= now) seen.delete(id);
  }
}

/**
 * @param {string} webhookId value of the X-Shopify-Webhook-Id header
 * @returns {boolean} true if this webhook was already processed
 */
function alreadyProcessed(webhookId) {
  cleanup();
  if (!webhookId) return false; // fail open — never block on a missing header
  return seen.has(webhookId);
}

function markProcessed(webhookId) {
  if (!webhookId) return;
  seen.set(webhookId, Date.now() + TTL_MS);
}

module.exports = { alreadyProcessed, markProcessed };
