const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { once } = require('node:events');
const http = require('node:http');
const test = require('node:test');
const { createApp, createLicense } = require('../index');

const licenseSecret = 'test-license-secret-with-at-least-32-characters';
const phone = '254717965112';
const reference = `pp-${'a'.repeat(36)}`;
const deviceId = 'stable-test-device-id';
const token = createLicense(phone, 2, Date.now() + 30 * 24 * 60 * 60 * 1000, licenseSecret);

async function startServer(t, pool) {
  const { app } = createApp({ pool, paystackSecret: 'sk_test_example', licenseSecret });
  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());
  return `http://127.0.0.1:${server.address().port}/api/license/lookup`;
}

async function restore(url, overrides = {}) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone, reference, device_id: deviceId, ...overrides })
  });
  return { response, body: await response.json() };
}

function activePaymentPool(initialDeviceHash = null) {
  const payment = { reference, phone, status: 'success', tier: 2, license_token: token, restore_device_hash: initialDeviceHash };
  return {
    payment,
    async query(sql, values = []) {
      if (sql.includes('SELECT reference FROM subscription_payments')) return { rows: [] };
      if (sql.includes('SELECT * FROM subscription_payments') && sql.includes('WHERE reference = $1 AND phone = $2')) {
        return { rows: values[0] === payment.reference && values[1] === payment.phone ? [payment] : [] };
      }
      if (sql.includes('UPDATE subscription_payments SET restore_device_hash')) {
        if (values[0] !== payment.reference || values[2] !== payment.phone) return { rows: [] };
        if (payment.restore_device_hash && payment.restore_device_hash !== values[1]) return { rows: [] };
        payment.restore_device_hash = values[1];
        return { rows: [{ reference: payment.reference }] };
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
}

test('license restore requires the matching phone and receipt reference, then binds the purchase to this device', async (t) => {
  const pool = activePaymentPool();
  const url = await startServer(t, pool);
  const { response, body } = await restore(url);
  const expectedDeviceHash = crypto.createHmac('sha256', licenseSecret).update(deviceId).digest('hex');

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.tier, 2);
  assert.equal(body.token, token);
  assert.equal(body.reference, undefined);
  assert.equal(pool.payment.restore_device_hash, expectedDeviceHash);
});

test('wrong phone or receipt reference gets the same generic response and no license token', async (t) => {
  const url = await startServer(t, activePaymentPool());
  const wrongPhone = await restore(url, { phone: '254700000000' });
  const wrongReference = await restore(url, { reference: `pp-${'b'.repeat(36)}` });

  assert.equal(wrongPhone.body.success, false);
  assert.equal(wrongReference.body.success, false);
  assert.equal(wrongPhone.body.message, wrongReference.body.message);
  assert.equal(wrongPhone.body.token, null);
  assert.equal(wrongReference.body.token, null);
});

test('a receipt cannot restore the purchase onto a second device', async (t) => {
  const originalDeviceHash = crypto.createHmac('sha256', licenseSecret).update(deviceId).digest('hex');
  const url = await startServer(t, activePaymentPool(originalDeviceHash));
  const { response, body } = await restore(url, { device_id: 'another-device-id-123' });

  assert.equal(response.status, 200);
  assert.equal(body.success, false);
  assert.equal(body.token, null);
});

test('restore attempts are rate limited without revealing whether a phone has a plan', async (t) => {
  const url = await startServer(t, activePaymentPool());
  let lastResponse;
  for (let attempt = 0; attempt < 9; attempt += 1) {
    lastResponse = await restore(url, { reference: `pp-${String(attempt).padStart(36, 'b')}` });
  }

  assert.equal(lastResponse.response.status, 429);
  assert.equal(lastResponse.body.success, false);
  assert.equal(lastResponse.body.token, undefined);
});
