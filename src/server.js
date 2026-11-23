
// StockDesk: tiny stock-tracking API. Node.js 18+, no dependency.
const http = require("http");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { checkDatabase } = require("./db");

const config = {
  port: Number(process.env.PORT || 3000),
  dbHost: process.env.DB_HOST || "localhost",
  dbPort: Number(process.env.DB_PORT || 5432),
  dbUser: process.env.DB_USER || "stockdesk",
  dbPassword: process.env.DB_PASSWORD || "",
  apiKey: process.env.API_KEY || "",
};

// Seeded in-memory data (the real application would read it from PostgreSQL).
const products = [
  { sku: "BOLT-M6", name: "Hex bolt M6", stock: 1200 },
  { sku: "NUT-M6", name: "Hex nut M6", stock: 950 },
  { sku: "WASH-M6", name: "Flat washer M6", stock: 40 },
  { sku: "DRILL-18V", name: "Cordless drill 18V", stock: 12 },
  { sku: "GLOVE-L", name: "Work gloves, size L", stock: 75 },
];

// Maximum accepted request body: 16 KB.
const MAX_BODY_BYTES = 16 * 1024;

// Return only safe configuration details. Never return actual secrets.
function safeConfig(c = config) {
  return {
    port: c.port,
    dbHost: c.dbHost,
    dbPort: c.dbPort,
    dbUser: c.dbUser,
    dbPasswordSet: Boolean(c.dbPassword),
    apiKeySet: Boolean(c.apiKey),
  };
}

function send(res, code, body) {
  res.writeHead(code, {
    "Content-Type": "application/json; charset=utf-8",
  });
  res.end(JSON.stringify(body));
}

function createServer() {
  return http.createServer(async (req, res) => {
    const url = new URL(req.url, "http://localhost");

    // Liveness: checks whether the application process is alive.
    if (req.method === "GET" && url.pathname === "/livez") {
      return send(res, 200, { status: "alive" });
    }

    // Readiness: checks whether the application can reach its database.
    if (req.method === "GET" && url.pathname === "/health") {
      const dbOk = await checkDatabase(config.dbHost, config.dbPort);

      return dbOk
        ? send(res, 200, { status: "ok", database: "up" })
        : send(res, 503, { status: "degraded", database: "down" });
    }

    if (req.method === "GET" && url.pathname === "/api/products") {
      return send(res, 200, products);
    }

    const match = url.pathname.match(
      /^\/api\/products\/([A-Z0-9-]+)\/adjust$/
    );

    if (req.method === "POST" && match) {
      if (!config.apiKey || req.headers["x-api-key"] !== config.apiKey) {
        return send(res, 401, { error: "Missing or invalid API key" });
      }

      const product = products.find((p) => p.sku === match[1]);

      if (!product) {
        return send(res, 404, { error: "Unknown SKU" });
      }

      let raw = "";
      let bodySize = 0;
      let tooLarge = false;

      req.on("data", (chunk) => {
        if (tooLarge) return;

        bodySize += chunk.length;

        if (bodySize > MAX_BODY_BYTES) {
          tooLarge = true;
          res.writeHead(413, {
            "Content-Type": "application/json; charset=utf-8",
            Connection: "close",
          });
          res.end(JSON.stringify({ error: "Request body too large" }));

          // Close the request after the response has been sent.
          res.on("finish", () => req.destroy());
          return;
        }

        raw += chunk.toString("utf8");
      });

      req.on("end", () => {
        if (tooLarge) return;

        let body;

        try {
          body = JSON.parse(raw || "{}");
        } catch {
          return send(res, 400, { error: "Invalid JSON" });
        }

        if (
          body === null ||
          typeof body !== "object" ||
          Array.isArray(body) ||
          !Number.isInteger(body.delta)
        ) {
          return send(res, 400, { error: "delta must be an integer" });
        }

        if (product.stock + body.delta < 0) {
          return send(res, 409, { error: "Stock cannot go below zero" });
        }

        product.stock += body.delta;
        return send(res, 200, product);
      });

      return;
    }

    return send(res, 404, { error: "Not found" });
  });
}

function start() {
  console.log(
    "StockDesk starting with config:",
    JSON.stringify(safeConfig())
  );

  // Temporary startup marker used by the support team.
  fs.writeFileSync(
    path.join(os.tmpdir(), "stockdesk-started.txt"),
    new Date().toISOString()
  );

  const server = createServer();

  server.listen(config.port, () => {
    console.log("StockDesk listening on port " + config.port);
  });

  return server;
}

if (require.main === module) start();

module.exports = {
  createServer,
  config,
  products,
  safeConfig,
  MAX_BODY_BYTES,
};
