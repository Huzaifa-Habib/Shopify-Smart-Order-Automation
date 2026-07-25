const rules = require("../config/rules");
const logger = require("./logger");

/**
 * Runs every rule against the order and returns the tags whose conditions
 * matched. A rule throwing an error is logged and skipped — one bad rule
 * should never block the others from tagging the order.
 */
function evaluateRules(order) {
  const matchedTags = [];

  for (const rule of rules) {
    try {
      if (rule.test(order)) {
        matchedTags.push(rule.tag);
      }
    } catch (err) {
      logger.error({ err, rule: rule.name }, "Rule threw an error, skipping it");
    }
  }

  return [...new Set(matchedTags)];
}

module.exports = { evaluateRules };
