/**
 * Run with: npm run list-webhooks
 * Useful for confirming registration worked, or finding stale webhooks
 * pointing at an old ngrok URL that need to be deleted.
 */
require("dotenv").config();
const { shopifyGraphQL } = require("../src/lib/shopify");

async function main() {
  const query = `
    query {
      webhookSubscriptions(first: 25) {
        edges {
          node { id topic callbackUrl createdAt }
        }
      }
    }
  `;
  const data = await shopifyGraphQL(query);
  const subs = data.webhookSubscriptions.edges.map((e) => e.node);
  console.table(subs);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
