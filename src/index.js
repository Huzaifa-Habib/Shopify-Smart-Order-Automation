require("dotenv").config();

const express = require("express");
const pinoHttp = require("pino-http");
const logger = require("./lib/logger");
const webhookRoutes = require("./routes/webhooks");

const app = express();

app.use(pinoHttp({ logger }));

app.get("/", (_req, res) => {
  res.status(200).send("Order Auto-Tagger is running.");
});

app.get("/health", (_req, res) => {
  res.status(200).json({ status: "ok", time: new Date().toISOString() });
});

app.use("/webhooks", webhookRoutes);

// Fallback error handler — keeps the process alive on unexpected errors.
app.use((err, req, res, _next) => {
  logger.error({ err }, "Unhandled error");
  res.status(500).send("Internal server error");
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  logger.info(`Order Auto-Tagger listening on port ${PORT}`);
});
