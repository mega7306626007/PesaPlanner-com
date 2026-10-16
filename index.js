const express = require('express');
const axios = require('axios');
const crypto = require('crypto');

const app = express();
app.use(express.json());

// Load the secret token from Render Environment Variables safely
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;

// 1. ENDPOINT TO INITIALIZE M-PESA STK PUSH (Called by your Android APK)
app.post('/api/pay', async (req, res) => {
    try {
        const { phone, email, amount } = req.body;

        if (!phone || !email || !amount) {
            return res.status(400).json({ success: false, message: "Missing required fields (phone, email, amount)" });
        }

        // Paystack expects amount in cents/pesewas. Multiply KSh by 100.
        const paystackAmount = parseInt(amount) * 100;

        // Clean up phone number format to remove any leading '+' if sent by app
        const formattedPhone = phone.replace('+', '').trim();

        const response = await axios.post(
            'https://paystack.co',
            {
                email: email,
                amount: paystackAmount,
                currency: "KES",
                channels: ["mobile_money"],
                metadata: {
                    custom_fields: [
                        {
                            display_name: "Phone Number",
                            variable_name: "phone_number",
                            value: formattedPhone
                        }
                    ]
                }
            },
            {
                headers: {
                    Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        res.status(200).json({
            success: true,
            message: "STK Push initialized",
            data: response.data.data
        });

    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to initialize checkout",
            error: error.response ? error.response.data : error.message
        });
    }
});

// 2. WEBHOOK ENDPOINT (Paystack calls this when a student enters their PIN successfully)
app.post('/api/webhook', (req, res) => {
    try {
        // Validate signature to make sure a clever student isn't spoofing payment flags
        const hash = crypto.createHmac('sha512', PAYSTACK_SECRET_KEY)
                           .update(JSON.stringify(req.body))
                           .digest('hex');

        if (hash !== req.headers['x-paystack-signature']) {
            return res.status(401).send('Unauthorized webhook signature');
        }

        const payload = req.body;

        if (payload.event === 'charge.success') {
            const transactionData = payload.data;
            const email = transactionData.customer.email;
            const amountKsh = transactionData.amount / 100;
            const reference = transactionData.reference;

            console.log(`[PAYMENT SUCCESS] KSh ${amountKsh} collected from ${email}. Ref: ${reference}`);

            // TODO: Unlocking Logic for Offline App
            // Since your app is fully offline, you can log this success or save it 
            // if you expand to a lightweight database later.
        }

        // Return 200 OK so Paystack knows you received it safely
        res.sendStatus(200);

    } catch (err) {
        console.error("Webhook processing error:", err.message);
        res.sendStatus(500);
    }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`PesaPlanner billing server running on port ${PORT}`));
