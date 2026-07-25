const logger = require("./logger");

const SHOP = process.env.SHOPIFY_SHOP;
const TOKEN = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const API_VERSION = process.env.SHOPIFY_API_VERSION || "2025-10";

if (!SHOP || !TOKEN) {
  logger.warn(
    "SHOPIFY_SHOP or SHOPIFY_ADMIN_ACCESS_TOKEN is not set — API calls will fail until .env is configured."
  );
}

const ENDPOINT = `https://${SHOP}/admin/api/${API_VERSION}/graphql.json`;

/**
 * Low-level GraphQL request wrapper.
 * Handles Shopify's cost-based throttling by retrying with backoff
 * when the API returns a THROTTLED error.
 */
async function shopifyGraphQL(query, variables = {}, attempt = 1) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Shopify-Access-Token": TOKEN,
    },
    body: JSON.stringify({ query, variables }),
  });

  const body = await res.json();

  if (!res.ok) {
    throw new Error(`Shopify API HTTP ${res.status}: ${JSON.stringify(body)}`);
  }

  const throttled = body.errors?.some((e) => e.extensions?.code === "THROTTLED");
  if (throttled && attempt <= 4) {
    const waitMs = 500 * attempt; // simple linear backoff
    logger.warn({ attempt, waitMs }, "Shopify GraphQL throttled, retrying");
    await new Promise((r) => setTimeout(r, waitMs));
    return shopifyGraphQL(query, variables, attempt + 1);
  }

  if (body.errors) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(body.errors)}`);
  }

  return body.data;
}

/**
 * Add tags to an order (idempotent — Shopify de-duplicates tags automatically).
 * @param {string} orderGid e.g. "gid://shopify/Order/1234567890"
 * @param {string[]} tags
 */
async function addOrderTags(orderGid, tags) {
  const mutation = `
    mutation tagsAdd($id: ID!, $tags: [String!]!) {
      tagsAdd(id: $id, tags: $tags) {
        node { id }
        userErrors { field message }
      }
    }
  `;
  const data = await shopifyGraphQL(mutation, { id: orderGid, tags });
  const errors = data.tagsAdd.userErrors;
  if (errors?.length) {
    throw new Error(`tagsAdd userErrors: ${JSON.stringify(errors)}`);
  }
  return data.tagsAdd.node;
}

/**
 * Fetch existing tags for an order — used to avoid redundant API calls
 * and for idempotency checks (e.g. "has this webhook already been processed?").
 */
async function getOrderTags(orderGid) {
  const query = `
    query getOrderTags($id: ID!) {
      order(id: $id) { id tags }
    }
  `;
  const data = await shopifyGraphQL(query, { id: orderGid });
  return data.order?.tags ?? [];
}

module.exports = { shopifyGraphQL, addOrderTags, getOrderTags, API_VERSION, SHOP };
