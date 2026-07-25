/**
 * Run with: npm run register-webhook
 *
 * Registers the orders/create webhook pointing at APP_PUBLIC_URL/webhooks/orders/create.
 * Safe to re-run — Shopify will just return an error you can ignore if the
 * webhook already exists at that address; script surfaces it either way.
 */
require("dotenv").config();
const { shopifyGraphQL } = require("../src/lib/shopify");

async function main() {
  const callbackUrl = `${process.env.APP_PUBLIC_URL}/webhooks/orders/create`;

  const mutation = `
    mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $webhookSubscription: WebhookSubscriptionInput!) {
      webhookSubscriptionCreate(topic: $topic, webhookSubscription: $webhookSubscription) {
        webhookSubscription { id callbackUrl topic }
        userErrors { field message }
      }
    }
  `;

  const data = await shopifyGraphQL(mutation, {
    topic: "ORDERS_CREATE",
    webhookSubscription: {
      callbackUrl,
      format: "JSON",
    },
  });

  const result = data.webhookSubscriptionCreate;
  if (result.userErrors?.length) {
    console.error("Failed to register webhook:", result.userErrors);
    process.exit(1);
  }

  console.log("Webhook registered:", result.webhookSubscription);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
