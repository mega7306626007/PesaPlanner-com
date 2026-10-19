const crypto = require('crypto');
const express = require('express');
const { Pool } = require('pg');

const PORT = Number(process.env.PORT || 3000);
const PUBLIC_BASE_URL = (process.env.PUBLIC_BASE_URL || 'https://pesaplanner-com.onrender.com').replace(/\/+$/, '');
const PAYSTACK_API = 'https://api.paystack.co';
const PAYMENT_CALLBACK_PATH = '/payment/callback';
const PAYSTACK_WEBHOOK_PATH = '/api/webhook';
const TIER_PRICES = Object.freeze({ 1: 49, 2: 89, 3: 129 });
const BILLING_PERIODS = Object.freeze({ month: 1, semester: 4, year: 12 });
const ACCESS_TOKEN_BYTES = 32;
const DAY_MS = 24 * 60 * 60 * 1000;

function normalizeKenyanPhone(value) {
  const digits = String(value || '').replace(/\D/g, '');
  if (/^254[17]\d{8}$/.test(digits)) return digits;
  if (/^0[17]\d{8}$/.test(digits)) return `254${digits.slice(1)}`;
  return null;
}

function validEmail(value) {
  return typeof value === 'string' && value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function createLicense(phone, tier, expiresAt, secret) {
  const payload = `${phone}|${tier}|${expiresAt}`;
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return `${payload}||${signature}`;
}

function verifyLicense(token, secret, allowExpired = false) {
  if (typeof token !== 'string' || token.length > 512) return null;
  const parts = token.split('||');
  if (parts.length !== 2) return null;
  const expected = crypto.createHmac('sha256', secret).update(parts[0]).digest();
  let supplied;
  try {
    supplied = Buffer.from(parts[1], 'hex');
  } catch {
    return null;
  }
  if (supplied.length !== expected.length || !crypto.timingSafeEqual(supplied, expected)) return null;
  const [phone, tierText, expiryText] = parts[0].split('|');
  const tier = Number(tierText);
  const expiresAt = Number(expiryText);
  if (!normalizeKenyanPhone(phone) || !TIER_PRICES[tier] || !Number.isSafeInteger(expiresAt) || (!allowExpired && expiresAt <= Date.now())) return null;
  return { phone, tier, expiresAt };
}

function accessTokenHash(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function timingSafeHexEqual(left, right) {
  if (typeof left !== 'string' || typeof right !== 'string' || !/^[a-f0-9]+$/i.test(left) || !/^[a-f0-9]+$/i.test(right)) return false;
  const leftBytes = Buffer.from(left, 'hex');
  const rightBytes = Buffer.from(right, 'hex');
  return leftBytes.length === rightBytes.length && crypto.timingSafeEqual(leftBytes, rightBytes);
}

function createApp({ pool, fetchImpl = fetch, paystackSecret, licenseSecret, publicBaseUrl = PUBLIC_BASE_URL }) {
  if (!pool) throw new Error('A PostgreSQL pool is required.');
  if (!paystackSecret || !paystackSecret.startsWith('sk_')) throw new Error('PAYSTACK_SECRET_KEY is missing or invalid.');
  if (!licenseSecret || licenseSecret.length < 32) throw new Error('LICENSE_SECRET_KEY must contain at least 32 characters.');

  const app = express();
  const normalizedPublicBaseUrl = String(publicBaseUrl).replace(/\/+$/, '');
  app.disable('x-powered-by');
  app.set('trust proxy', 1);
  app.use(express.json({
    limit: '16kb',
    verify(req, res, body) {
      req.rawBody = Buffer.from(body);
    }
  }));

  async function initializeDatabase() {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS subscription_payments (
        reference TEXT PRIMARY KEY,
        access_token_hash TEXT NOT NULL,
        email TEXT NOT NULL,
        phone TEXT NOT NULL,
        tier SMALLINT NOT NULL CHECK (tier BETWEEN 1 AND 3),
        amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
        duration_months SMALLINT NOT NULL DEFAULT 1 CHECK (duration_months IN (1, 4, 12)),
        currency CHAR(3) NOT NULL DEFAULT 'KES',
        billing_type TEXT NOT NULL DEFAULT 'fresh_purchase',
        fixed_expiry BIGINT,
        status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'success', 'failed')),
        last_verification_at TIMESTAMPTZ,
        license_token TEXT,
        paystack_transaction_id TEXT UNIQUE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )
    `);
    await pool.query('ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS duration_months SMALLINT NOT NULL DEFAULT 1');
    await pool.query('ALTER TABLE subscription_payments ADD COLUMN IF NOT EXISTS last_verification_at TIMESTAMPTZ');
  }

  async function paystackRequest(path, options = {}) {
    const response = await fetchImpl(`${PAYSTACK_API}${path}`, {
      ...options,
      headers: {
        Authorization: `Bearer ${paystackSecret}`,
        'Content-Type': 'application/json',
        ...(options.headers || {})
      }
    });
    const body = await response.json().catch(() => null);
    if (!response.ok || body?.status !== true) {
      const error = new Error('Paystack could not complete the request.');
      error.status = response.status;
      throw error;
    }
    return body.data;
  }

  async function verifyAndActivate(reference) {
    const paymentResult = await pool.query(
      'SELECT * FROM subscription_payments WHERE reference = $1 LIMIT 1',
      [reference]
    );
    const payment = paymentResult.rows[0];
    if (!payment || payment.status !== 'pending') return payment;

    const verified = await paystackRequest(`/transaction/verify/${encodeURIComponent(reference)}`);
    if (['failed', 'abandoned'].includes(String(verified.status || '').toLowerCase())) {
      const failed = await pool.query(
        "UPDATE subscription_payments SET status = 'failed', updated_at = NOW() WHERE reference = $1 AND status = 'pending' RETURNING *",
        [payment.reference]
      );
      return failed.rows[0] || payment;
    }
    const metadata = verified.metadata && typeof verified.metadata === 'object' ? verified.metadata : {};
    const verifiedTier = Number(metadata.target_tier);
    const verifiedPhone = normalizeKenyanPhone(metadata.phone_number);
    const isPaymentAuthentic = verified.reference === payment.reference &&
      verified.status === 'success' &&
      verified.currency === payment.currency.trim() &&
      Number(verified.amount) === payment.amount_minor &&
      verifiedTier === payment.tier &&
      Number(metadata.duration_months) === Number(payment.duration_months || 1) &&
      verifiedPhone === payment.phone &&
      metadata.billing_type === payment.billing_type;

    if (!isPaymentAuthentic) return payment;

    const expiresAt = payment.fixed_expiry ? Number(payment.fixed_expiry) : addCalendarMonths(Date.now(), Number(payment.duration_months || 1));
    if (!Number.isSafeInteger(expiresAt) || expiresAt <= Date.now()) return payment;
    const token = createLicense(payment.phone, payment.tier, expiresAt, licenseSecret);
    const updated = await pool.query(
      `UPDATE subscription_payments
       SET status = 'success', license_token = $2, paystack_transaction_id = $3, updated_at = NOW()
       WHERE reference = $1 AND status = 'pending'
       RETURNING *`,
      [payment.reference, token, String(verified.id)]
    );
    if (updated.rows[0]) return updated.rows[0];
    return (await pool.query('SELECT * FROM subscription_payments WHERE reference = $1 LIMIT 1', [reference])).rows[0];
  }

  async function startCheckout({ phone, email, tier, durationMonths = 1, billingType = 'fresh_purchase', fixedExpiry = null, amountKsh = null }) {
    const normalizedPhone = normalizeKenyanPhone(phone);
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const normalizedTier = Number(tier);
    const normalizedMonths = Number(durationMonths);
    const priceKsh = amountKsh == null ? TIER_PRICES[normalizedTier] * normalizedMonths : Number(amountKsh);
    if (!normalizedPhone || !validEmail(normalizedEmail) || !TIER_PRICES[normalizedTier] || !Object.values(BILLING_PERIODS).includes(normalizedMonths) || !Number.isInteger(priceKsh) || priceKsh < 10) {
      const error = new Error('Enter a valid Kenyan phone number, email, and plan.');
      error.status = 400;
      throw error;
    }

    const reference = `pp-${crypto.randomBytes(18).toString('hex')}`;
    const accessToken = crypto.randomBytes(ACCESS_TOKEN_BYTES).toString('base64url');
    const amountMinor = priceKsh * 100;
    await pool.query(
      `INSERT INTO subscription_payments
       (reference, access_token_hash, email, phone, tier, amount_minor, duration_months, billing_type, fixed_expiry)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [reference, accessTokenHash(accessToken), normalizedEmail, normalizedPhone, normalizedTier, amountMinor, normalizedMonths, billingType, fixedExpiry]
    );

    try {
      const checkout = await paystackRequest('/transaction/initialize', {
        method: 'POST',
        body: JSON.stringify({
          email: normalizedEmail,
          amount: String(amountMinor),
          currency: 'KES',
          channels: ['mobile_money'],
          reference,
          callback_url: `${normalizedPublicBaseUrl}${PAYMENT_CALLBACK_PATH}`,
          metadata: {
            billing_type: billingType,
            phone_number: normalizedPhone,
            target_tier: normalizedTier,
            duration_months: normalizedMonths
          }
        })
      });
      if (!checkout.authorization_url || checkout.reference !== reference) throw new Error('Paystack returned an invalid checkout session.');
      return {
        success: true,
        chargeKsh: priceKsh,
        data: { authorization_url: checkout.authorization_url, reference, access_token: accessToken }
      };
    } catch (error) {
      await pool.query(
        "UPDATE subscription_payments SET status = 'failed', updated_at = NOW() WHERE reference = $1 AND status = 'pending'",
        [reference]
      );
      throw error;
    }
  }

  app.get('/', (req, res) => res.json({ service: 'PesaPlanner billing', status: 'online' }));
  app.get('/health', async (req, res) => {
    try {
      await pool.query('SELECT 1');
      res.json({ status: 'ok' });
    } catch {
      res.status(503).json({ status: 'unavailable' });
    }
  });
  app.get(PAYMENT_CALLBACK_PATH, (req, res) => {
    res.type('html').send('<!doctype html><html lang="en"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Payment check</title><body style="font:16px system-ui;padding:2rem;background:#071b34;color:white"><h1>Checking your payment</h1><p>Return to PesaPlanner. Your plan activates only after Paystack confirms payment.</p></body></html>');
  });

  app.post('/api/pay', async (req, res) => {
    try {
      const { phone, email, tier, durationMonths = 1 } = req.body || {};
      res.status(200).json(await startCheckout({ phone, email, tier, durationMonths }));
    } catch (error) {
      res.status(error.status || 502).json({ success: false, message: error.status === 400 ? error.message : 'Checkout could not start. Please try again.' });
    }
  });

  app.post('/api/upgrade', async (req, res) => {
    try {
      const { currentToken, targetTier, phone, email, durationMonths = 1 } = req.body || {};
      const current = verifyLicense(currentToken, licenseSecret, true);
      const normalizedPhone = normalizeKenyanPhone(phone);
      const requestedTier = Number(targetTier);
      const normalizedMonths = Number(durationMonths);
      if (!current || !normalizedPhone || current.phone !== normalizedPhone || requestedTier < current.tier || !TIER_PRICES[requestedTier] || !Object.values(BILLING_PERIODS).includes(normalizedMonths)) {
        return res.status(400).json({ success: false, message: 'This plan upgrade could not be verified.' });
      }
      const daysRemaining = (current.expiresAt - Date.now()) / DAY_MS;
      if (requestedTier === current.tier) {
        const nextExpiry = addCalendarMonths(Math.max(current.expiresAt, Date.now()), normalizedMonths);
        const amountKsh = TIER_PRICES[current.tier] * normalizedMonths;
        const checkout = await startCheckout({ phone, email, tier: requestedTier, durationMonths: normalizedMonths, billingType: 'renewal', fixedExpiry: nextExpiry, amountKsh });
        return res.status(200).json(checkout);
      }
      if (daysRemaining <= 0) {
        const amountKsh = TIER_PRICES[requestedTier] * normalizedMonths;
        const nextExpiry = addCalendarMonths(Date.now(), normalizedMonths);
        const checkout = await startCheckout({ phone, email, tier: requestedTier, durationMonths: normalizedMonths, billingType: 'tier_upgrade', fixedExpiry: nextExpiry, amountKsh });
        return res.status(200).json(checkout);
      }
      const priceDifference = TIER_PRICES[requestedTier] - TIER_PRICES[current.tier];
      const amountKsh = Math.round(priceDifference * Math.min(daysRemaining / 30, 1));
      if (amountKsh < 10) return res.status(400).json({ success: false, message: 'There is too little time left to prorate this upgrade. Renew after expiry instead.' });
      const checkout = await startCheckout({ phone, email, tier: requestedTier, durationMonths: 1, billingType: 'tier_upgrade', fixedExpiry: current.expiresAt, amountKsh });
      res.status(200).json(checkout);
    } catch (error) {
      res.status(error.status || 502).json({ success: false, message: error.status === 400 ? error.message : 'Upgrade checkout could not start. Please try again.' });
    }
  });

  app.post('/api/pay/status', async (req, res) => {
    const reference = String(req.body?.reference || '');
    const accessToken = String(req.body?.access_token || '');
    if (!/^pp-[a-f0-9]{36}$/.test(reference) || accessToken.length < 32 || accessToken.length > 128) {
      return res.status(400).json({ success: false, message: 'Invalid checkout reference.' });
    }
    try {
      const result = await pool.query(
        'SELECT * FROM subscription_payments WHERE reference = $1 LIMIT 1',
        [reference]
      );
      let payment = result.rows[0];
      if (!payment || !timingSafeHexEqual(payment.access_token_hash, accessTokenHash(accessToken))) {
        return res.status(404).json({ success: false, message: 'Checkout session not found.' });
      }
      if (payment.status === 'pending') {
        try {
          const due = await pool.query(
            `UPDATE subscription_payments SET last_verification_at = NOW()
             WHERE reference = $1 AND status = 'pending'
               AND (last_verification_at IS NULL OR last_verification_at < NOW() - INTERVAL '10 seconds')
             RETURNING reference`,
            [reference]
          );
          if (due.rows[0]) payment = await verifyAndActivate(reference);
        } catch {
          return res.json({ success: true, status: 'pending' });
        }
      }
      if (payment?.status === 'success') {
        return res.json({
          success: true,
          status: 'success',
          license_token: payment.license_token,
          tier: payment.tier,
          expires_at: Number(payment.fixed_expiry || 0) || getTokenExpiry(payment.license_token, licenseSecret)
        });
      }
      res.json({ success: true, status: payment?.status || 'pending' });
    } catch {
      res.status(503).json({ success: false, message: 'Payment status is temporarily unavailable.' });
    }
  });

  app.post(PAYSTACK_WEBHOOK_PATH, async (req, res) => {
    const signature = req.get('x-paystack-signature');
    const expectedSignature = crypto.createHmac('sha512', paystackSecret).update(req.rawBody || Buffer.alloc(0)).digest('hex');
    if (!timingSafeHexEqual(signature, expectedSignature)) return res.status(401).send('Invalid signature.');
    if (req.body?.event !== 'charge.success') return res.sendStatus(200);

    const reference = String(req.body?.data?.reference || '');
    if (!/^pp-[a-f0-9]{36}$/.test(reference)) return res.sendStatus(200);
    try {
      await verifyAndActivate(reference);
      return res.sendStatus(200);
    } catch {
      return res.status(503).send('Temporary verification error.');
    }
  });

  return { app, initializeDatabase };
}

function getTokenExpiry(token, secret) {
  return verifyLicense(token, secret)?.expiresAt || 0;
}

function addCalendarMonths(timestamp, months) {
  const date = new Date(timestamp);
  const dayOfMonth = date.getUTCDate();
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + months);
  const finalDay = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0)).getUTCDate();
  date.setUTCDate(Math.min(dayOfMonth, finalDay));
  return date.getTime();
}

if (require.main === module) {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is required. Connect a persistent PostgreSQL database in Render.');
  const pool = new Pool({ connectionString: databaseUrl, ssl: process.env.PGSSL === 'false' ? false : { rejectUnauthorized: false } });
  const { app, initializeDatabase } = createApp({
    pool,
    paystackSecret: process.env.PAYSTACK_SECRET_KEY,
    licenseSecret: process.env.LICENSE_SECRET_KEY
  });
  initializeDatabase()
    .then(() => app.listen(PORT, () => console.log(`PesaPlanner billing service listening on ${PORT}`)))
    .catch((error) => {
      console.error('Billing database initialization failed:', error.message);
      process.exit(1);
    });
}

module.exports = { createApp, normalizeKenyanPhone, createLicense, verifyLicense, timingSafeHexEqual, TIER_PRICES };
