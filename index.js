const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// 🔐 Hidden configurations inside your Render Dashboard environment settings
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const LICENSE_SECRET_KEY = process.env.LICENSE_SECRET_KEY || "pesaplanner_crypto_salt_2026";

// Static pricing tiers
const TIER_PRICES = { 1: 49, 2: 89, 3: 129 };

// Helper 1: Cryptographic offline token generator
function generateLicense(phone, tier, expiryTime) {
    const payload = `${phone}|${tier}|${expiryTime}`;
    const signature = crypto.createHmac('sha256', LICENSE_SECRET_KEY).update(payload).digest('hex');
    return `${payload}||${signature}`;
}

// 1. ENDPOINT: Standard Fresh Checkout Initialization
app.post('/api/pay', async (req, res) => {
    try {
        const { phone, email, tier } = req.body;
        const targetPrice = TIER_PRICES[parseInt(tier)];

        if (!phone || !email || !targetPrice) {
            return res.status(400).json({ success: false, message: "Missing phone, email or invalid tier level" });
        }

        const formattedPhone = phone.replace('+', '').trim();
        const paystackAmount = targetPrice * 100; // Paystack expects amount in KSh cents

        const response = await axios.post(
            'https://paystack.co',
            {
                email: email,
                amount: paystackAmount,
                currency: "KES",
                channels: ["mobile_money"],
                metadata: {
                    billing_type: "fresh_purchase",
                    phone_number: formattedPhone,
                    target_tier: tier
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({ success: true, data: response.data.data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.response ? error.response.data : error.message });
    }
});

// 2. ENDPOINT: Prorated Mid-Month Plan Upgrade
app.post('/api/upgrade', async (req, res) => {
    try {
        const { currentToken, targetTier, phone, email } = req.body;

        const parts = currentToken.split("||");
        if (parts.length !== 2) return res.status(400).json({ success: false, message: "Malformed token layout" });

        const [payload, signature] = parts;
        const expectedSignature = crypto.createHmac('sha256', LICENSE_SECRET_KEY).update(payload).digest('hex');
        if (expectedSignature !== signature) return res.status(401).json({ success: false, message: "Token integrity validation failed" });

        const [tokenPhone, currentTier, expiryTimestamp] = payload.split("|");
        const daysRemaining = Math.max(0, (parseInt(expiryTimestamp) - Date.now()) / (1000 * 60 * 60 * 24));

        if (daysRemaining <= 0) return res.status(400).json({ success: false, message: "Subscription has expired. Buy a fresh plan." });

        const currentPrice = TIER_PRICES[parseInt(currentTier)];
        const targetPrice = TIER_PRICES[parseInt(targetTier)];

        if (targetPrice <= currentPrice) return res.status(400).json({ success: false, message: "Cannot upgrade to a lower or equivalent tier" });

        // Math: Charge difference matching remaining lifetime days
        let rawBalance = (targetPrice - currentPrice) * (daysRemaining / 30);
        let absoluteChargeKsh = Math.max(10, Math.round(rawBalance)); // Minimum KSh 10 fallback floor

        const formattedPhone = phone.replace('+', '').trim();

        const response = await axios.post(
            'https://paystack.co',
            {
                email: email,
                amount: absoluteChargeKsh * 100,
                currency: "KES",
                channels: ["mobile_money"],
                metadata: {
                    billing_type: "tier_upgrade",
                    phone_number: formattedPhone,
                    target_tier: targetTier,
                    fixed_expiry: expiryTimestamp
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({ success: true, chargeKsh: absoluteChargeKsh, data: response.data.data });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

// 3. ENDPOINT: The Webhook Router to Listen for Successful Mobile Money Transfers
app.post('/api/webhook', (req, res) => {
    const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(JSON.stringify(req.body)).digest('hex');
    if (hash !== req.headers['x-paystack-signature']) return res.status(401).send('Unauthorized signature header');

    const event = req.body;
    if (event.event === 'charge.success') {
        const data = event.data;
        const meta = data.metadata;
        const phone = meta.phone_number;
        const targetTier = meta.target_tier;

        let expiryTime;
        if (meta.billing_type === "fresh_purchase") {
            const d = new Date();
            d.setDate(d.getDate() + 30);
            expiryTime = d.getTime().toString();
        } else {
            expiryTime = meta.fixed_expiry; // Preserve the original timestamp layout for upgrades
        }

        const issuedToken = generateLicense(phone, targetTier, expiryTime);
        console.log(`🔑 [TOKEN GENERATED] For ${phone} Tier ${targetTier}: ${issuedToken}`);

        // TODO: Pass 'issuedToken' back to device. For this database-less setup, 
        // the Android client parses the transaction reference directly via long-polling or an explicit fetch.
    }
    res.sendStatus(200);
});

// Fast Check Route
app.get('/', (req, res) => res.send('PesaPlanner Paystack Testing Engine: Active 🚀'));

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Active server on port ${PORT}`));
