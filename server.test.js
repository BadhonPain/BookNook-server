const assert = require('node:assert/strict');
const { after, before, test } = require('node:test');

const { app } = require('./server');
const { buildRecommendations } = require('./lib/recommendations');

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

test('recommendations require authentication', async () => {
  const response = await fetch(`${baseUrl}/recommendations`);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: 'Sign in to continue.' });
});

test('borrow history requires authentication', async () => {
  const response = await fetch(`${baseUrl}/borrows/history`);

  assert.equal(response.status, 401);
  assert.deepEqual(await response.json(), { message: 'Sign in to continue.' });
});

test('content-based recommendations rank category, author, and interest matches', () => {
  const books = [
    { _id: 'borrowed', title: 'Already read', author: 'A. Writer', category: 'Fiction' },
    { _id: 'author', title: 'Another story', author: 'A. Writer', category: 'History' },
    { _id: 'category', title: 'New history', author: 'B. Writer', category: 'History' },
    { _id: 'interest', title: 'Space travel', author: 'C. Writer', category: 'Science' },
    { _id: 'unmatched', title: 'A cookbook', author: 'D. Writer', category: 'Kids' },
  ];
  const recommendations = buildRecommendations({
    books,
    history: [{ bookId: 'borrowed', author: 'A. Writer', category: 'Fiction' }],
    preferences: { categories: ['History'], interests: ['space'] },
  });

  assert.deepEqual(recommendations.map(({ book }) => book._id), ['author', 'category', 'interest']);
  assert.ok(recommendations[0].reasons.some((reason) => reason.includes('author')));
  assert.ok(recommendations[2].reasons.some((reason) => reason.includes('space')));
});

test('recommendations use recent books as a fallback without reader signals', () => {
  const recommendations = buildRecommendations({
    books: [
      { _id: 'older', createdAt: '2024-01-01' },
      { _id: 'newer', createdAt: '2025-01-01' },
    ],
    history: [],
    preferences: { categories: [], interests: [] },
  });

  assert.equal(recommendations[0].book._id, 'newer');
  assert.deepEqual(recommendations[0].reasons, ['Recently added to the library']);
});
