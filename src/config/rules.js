/**
 * Each rule is: { name, test(order) => boolean, tag }
 * `order` is the raw Shopify orders/create webhook payload (REST-shaped JSON,
 * which is what the webhook always sends regardless of API version).
 *
 * Add/remove rules here — no other file needs to change for simple cases.
 * Multiple matching rules all apply; tags are de-duplicated automatically
 * by Shopify's tagsAdd mutation.
 */

const VIP_THRESHOLD = 200; // USD, adjust to taste or read from env
const GIFT_WRAP_PRODUCT_TITLES = ["Gift Wrap", "Gift Box"];
const GIFT_WRAP_SKUS = ["GIFTWRAP-001"];
const RUSH_TAGS_FROM_NOTES = ["rush", "asap", "urgent"];

const rules = [
  {
    name: "high-value-order",
    tag: "VIP",
    test: (order) => parseFloat(order.total_price ?? order.current_total_price ?? "0") >= VIP_THRESHOLD,
  },
  {
    name: "gift-wrap-requested",
    tag: "needs-gift-wrap",
    test: (order) =>
      (order.line_items || []).some(
        (item) =>
          GIFT_WRAP_PRODUCT_TITLES.some((title) =>
            item.title?.toLowerCase().includes(title.toLowerCase())
          ) || GIFT_WRAP_SKUS.includes(item.sku)
      ),
  },
  {
    name: "rush-order-note",
    tag: "rush",
    test: (order) => {
      const note = (order.note || "").toLowerCase();
      return RUSH_TAGS_FROM_NOTES.some((kw) => note.includes(kw));
    },
  },
  {
    name: "international-order",
    tag: "international",
    test: (order) => {
      const shipCountry = order.shipping_address?.country_code;
      return shipCountry && shipCountry !== "US";
    },
  },
  {
    name: "first-time-customer",
    tag: "new-customer",
    test: (order) => order.customer && order.customer.orders_count === 1,
  },
];

module.exports = rules;
