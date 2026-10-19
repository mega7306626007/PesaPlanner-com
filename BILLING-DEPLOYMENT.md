# Paystack and Render billing setup

The Android app starts checkout through the Render API and activates a plan only after the API verifies the transaction with Paystack. Keep all Paystack secrets on Render; never put them in Android, the website, or a source-control file.

Plans currently charge the selected tier's monthly price for 1, 4 (semester), or 12 (annual) months. These are single payments, not automatic recurring charges; users see remaining days and renew from the app. Active-plan upgrades prorate the tier difference through the current expiry.

## Render service

Use the existing Render web service at `https://pesaplanner-com.onrender.com` (do not create a second service). Set its root directory to the repository root, build command to `npm install`, and start command to `npm start`. Attach a persistent PostgreSQL database and set:

- `DATABASE_URL`: the database's internal connection string from Render.
- `PAYSTACK_SECRET_KEY`: the **Live** secret key from Paystack.
- `LICENSE_SECRET_KEY`: a new random secret of at least 32 characters. Store it only in Render and keep it stable, or existing plan tokens will no longer validate.
- `PUBLIC_BASE_URL`: `https://pesaplanner-com.onrender.com`.

Deploy, then check `https://pesaplanner-com.onrender.com/health`; it should return `{"status":"ok"}`.

## Paystack dashboard

In the **Live** account, add this exact webhook URL: `https://pesaplanner-com.onrender.com/api/webhook` (one slash before `api`). Do not append a second slash. The endpoint accepts Paystack POST requests; opening it in a browser sends GET and may show `Cannot GET`, which is expected. Ensure mobile money / M-Pesa is enabled for the account and KES is available. The API initializes each transaction and supplies the callback URL; no secret belongs in the callback URL. Paystack approval in the dashboard is not proof that a live payment has been tested.

## Release and smoke test

Commit and push the backend files (`index.js`, `package.json`, and this guide) to the branch watched by Render, then wait for Render's deploy to finish. Build and install the updated Android app. Test a real low-value purchase only after confirming the live plan price and account settlement details; verify that a successful payment activates the matching tier and that cancelling or an unverified redirect does not unlock it. Check Render logs and Paystack transactions/webhook delivery if status stays pending.

Do not paste or send API keys in chat. If a secret was ever committed or shared, rotate it in Paystack/Render.
