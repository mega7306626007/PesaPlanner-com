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
    async query(sql) {
      if (sql.includes('SELECT reference FROM subscription_payments')) return { rows: [] };
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

test('license lookup verifies a recent paid checkout before returning no plan', async (t) => {
  const phone = '254717965112';
  const reference = `pp-${'a'.repeat(36)}`;
  const expiresAt = Date.now() + 30 * 24 * 60 * 60 * 1000;
  const payment = {
    reference,
    status: 'pending',
    phone,
    tier: 2,
    amount_minor: 8900,
    currency: 'KES',
    duration_months: 1,
    billing_type: 'fresh_purchase',
    fixed_expiry: null,
    license_token: null,
    access_token_hash: 'not-used-by-license-lookup'
  };
  const activeRows = [];
  const pool = {
    async query(sql, values = []) {
      if (sql.includes('SELECT reference FROM subscription_payments')) {
        return { rows: [{ reference }] };
      }
      if (sql.includes('SET last_verification_at = NOW()')) {
        return { rows: [{ reference: values[0] }] };
      }
      if (sql.includes('SELECT * FROM subscription_payments WHERE reference = $1')) {
        return { rows: [{ ...payment }] };
      }
      if (sql.includes("SET status = 'success', license_token")) {
        payment.status = 'success';
        payment.license_token = createLicense(phone, 2, expiresAt, licenseSecret);
        payment.paystack_transaction_id = 'paystack-transaction-1';
        activeRows.push({ ...payment });
        return { rows: [{ ...payment }] };
      }
      if (sql.includes('WHERE phone = $1 AND status = $2')) {
        return { rows: activeRows };
      }
      throw new Error(`Unexpected query: ${sql}`);
    }
  };
  let verificationCalls = 0;
  const fetchImpl = async () => {
    verificationCalls++;
    return {
      ok: true,
      async json() {
        return {
          status: true,
          data: {
            reference,
            status: 'success',
            currency: 'KES',
            amount: 8900,
            id: 12345,
            metadata: {
              phone_number: phone,
              target_tier: 2,
              duration_months: 1,
              billing_type: 'fresh_purchase'
            }
          }
        };
      }
    };
  };
  const { app } = createApp({ pool, fetchImpl, paystackSecret: 'sk_test_example', licenseSecret });
  const server = http.createServer(app);
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => server.close());

  const response = await fetch(`http://127.0.0.1:${server.address().port}/api/license/lookup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ phone: '0717 965 112' })
  });
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(body.success, true);
  assert.equal(body.tier, 2);
  assert.equal(body.token, payment.license_token);
  assert.equal(body.reference, 'paystack-transaction-1');
  assert.equal(verificationCalls, 1);
});
