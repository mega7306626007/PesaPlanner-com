const assert = require('node:assert/strict');
const { once } = require('node:events');
const http = require('node:http');
const test = require('node:test');
const { createApp, createLicense } = require('../index');

const licenseSecret = 'test-license-secret-with-at-least-32-characters';

test('license lookup restores the best active paid entitlement, not an expired newer payment', async (t) => {
  const phone = '254717965112';
  const expired = createLicense(phone, 3, Date.now() - 1000, licenseSecret);
  const activeExpiry = Date.now() + 60 * 24 * 60 * 60 * 1000;
  const active = createLicense(phone, 2, activeExpiry, licenseSecret);
  const pool = {
    async query() {
      return {
        rows: [
          { license_token: expired, tier: 3, created_at: new Date(), reference: 'newer-expired', paystack_transaction_id: '1' },
          { license_token: active, tier: 2, created_at: new Date(Date.now() - 1000), reference: 'older-active', paystack_transaction_id: '2' }
        ]
      };
    }
  };
  const { app } = createApp({ pool, paystackSecret: 'sk_test_example', licenseSecret });
  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/license/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '+254717965112' })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.tier, 2);
  assert.equal(body.expires_at, activeExpiry);
  assert.equal(body.token, active);
  assert.equal(body.reference, '2');
});
