const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

const { app } = require('./server');

let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await new Promise((resolve) => server.once('listening', resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (!server) return;
  const closed = new Promise((resolve) => server.close(resolve));
  server.closeAllConnections();
  await closed;
});

test('health endpoint reports when MongoDB is not connected', async () => {
  const response = await fetch(`${baseUrl}/api/health`);

  assert.equal(response.status, 503);
  assert.deepEqual(await response.json(), {
    status: 'unavailable',
    database: 'disconnected',
  });
});

test('unknown routes return a JSON 404', async () => {
  const response = await fetch(`${baseUrl}/unknown`);

  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { message: 'Route not found.' });
});

test('book creation requires authentication', async () => {
  const response = await fetch(`${baseUrl}/books`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: '{}',
  });

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: 'Sign in to continue.' });
});
