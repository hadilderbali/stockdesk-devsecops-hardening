
const { test } = require("node:test");
const assert = require("node:assert");
const net = require("node:net");

const {
  createServer,
  config,
  safeConfig,
  MAX_BODY_BYTES,
} = require("../src/server");

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  return server.address().port;
}

async function close(server) {
  await new Promise((resolve) => {
    server.close(resolve);
    server.closeAllConnections();
  });
}

async function withServer(callback) {
  const server = createServer();
  const port = await listen(server);

  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await close(server);
  }
}

test("GET /api/products returns the seeded products", async () => {
  await withServer(async (url) => {
    const res = await fetch(`${url}/api/products`);

    assert.strictEqual(res.status, 200);

    const list = await res.json();

    assert.strictEqual(list.length, 5);
  });
});

test("GET /livez returns 200 even when the database is unreachable", async () => {
  config.dbHost = "127.0.0.1";
  config.dbPort = 1;

  await withServer(async (url) => {
    const res = await fetch(`${url}/livez`);

    assert.strictEqual(res.status, 200);
    assert.deepStrictEqual(await res.json(), { status: "alive" });
  });
});

test("GET /health is 503 when the database is unreachable", async () => {
  config.dbHost = "127.0.0.1";
  config.dbPort = 1;

  await withServer(async (url) => {
    const res = await fetch(`${url}/health`);

    assert.strictEqual(res.status, 503);
  });
});

test("GET /health is 200 when the database accepts connections", async () => {
  const fakeDb = net.createServer((socket) => socket.end());

  await new Promise((resolve, reject) => {
    fakeDb.once("error", reject);
    fakeDb.listen(0, "127.0.0.1", resolve);
  });

  config.dbHost = "127.0.0.1";
  config.dbPort = fakeDb.address().port;

  try {
    await withServer(async (url) => {
      const res = await fetch(`${url}/health`);

      assert.strictEqual(res.status, 200);
    });
  } finally {
    await new Promise((resolve) => fakeDb.close(resolve));
  }
});

test("POST adjust is refused without the API key", async () => {
  config.apiKey = "test-key";

  await withServer(async (url) => {
    const res = await fetch(`${url}/api/products/BOLT-M6/adjust`, {
      method: "POST",
      body: JSON.stringify({ delta: 1 }),
    });

    assert.strictEqual(res.status, 401);
  });
});

test("POST adjust is refused with an invalid API key", async () => {
  config.apiKey = "test-key";

  await withServer(async (url) => {
    const res = await fetch(`${url}/api/products/BOLT-M6/adjust`, {
      method: "POST",
      headers: { "x-api-key": "wrong-key" },
      body: JSON.stringify({ delta: 1 }),
    });

    assert.strictEqual(res.status, 401);
  });
});

test("POST adjust refuses a negative stock", async () => {
  config.apiKey = "test-key";

  await withServer(async (url) => {
    const res = await fetch(`${url}/api/products/DRILL-18V/adjust`, {
      method: "POST",
      headers: { "x-api-key": "test-key" },
      body: JSON.stringify({ delta: -999 }),
    });

    assert.strictEqual(res.status, 409);
  });
});

test("POST adjust rejects JSON null", async () => {
  config.apiKey = "test-key";

  await withServer(async (url) => {
    const res = await fetch(`${url}/api/products/BOLT-M6/adjust`, {
      method: "POST",
      headers: { "x-api-key": "test-key" },
      body: "null",
    });

    assert.strictEqual(res.status, 400);
  });
});

test("POST adjust refuses a body larger than the limit", async () => {
  config.apiKey = "test-key";

  await withServer(async (url) => {
    const res = await fetch(`${url}/api/products/BOLT-M6/adjust`, {
      method: "POST",
      headers: { "x-api-key": "test-key" },
      body: JSON.stringify({
        delta: 1,
        padding: "x".repeat(MAX_BODY_BYTES + 1),
      }),
    });

    assert.strictEqual(res.status, 413);
  });
});

test("safeConfig never exposes the database password or API key", () => {
  const logged = JSON.stringify(
    safeConfig({
      ...config,
      dbPassword: "example-db-password",
      apiKey: "example-api-key",
    })
  );

  assert.ok(!logged.includes("example-db-password"));
  assert.ok(!logged.includes("example-api-key"));
  assert.ok(logged.includes('"apiKeySet":true'));
  assert.ok(logged.includes('"dbPasswordSet":true'));
});
