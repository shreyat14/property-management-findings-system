const assert = require("node:assert/strict");
const test = require("node:test");

const { createApp } = require("../src/app");

test("GET /api/v1/health returns API and database status", async () => {
  const app = createApp({
    checkDatabase: async () => {},
  });
  const server = app.listen(0);

  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}/api/v1/health`);
    const body = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(body, {
      status: "ok",
      api: "running",
      database: "connected",
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve();
      });
    });
  }
});
