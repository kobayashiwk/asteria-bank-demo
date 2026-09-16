import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../src/server.js';

async function withServer(run) {
  const server = createServer();
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  try { await run(`http://127.0.0.1:${server.address().port}`); }
  finally { await new Promise(resolve => server.close(resolve)); }
}

test('serves the application', () => withServer(async origin => {
  const response = await fetch(origin);
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Asteria Bank/);
}));

test('an account is scoped to the current user', () => withServer(async origin => {
  const response = await fetch(`${origin}/api/accounts/2001`, { headers: { 'x-demo-user': '1' } });
  assert.equal(response.status, 404);
}));

test('rejects a non-positive transfer', () => withServer(async origin => {
  const response = await fetch(`${origin}/api/transfers`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-demo-user': '1' }, body: JSON.stringify({ fromAccount: 1001, toAccount: 2001, amount: -10 }) });
  assert.equal(response.status, 400);
}));
