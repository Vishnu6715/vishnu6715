# Edu-Path Standalone Payment Page

A separate payment website using Node.js, Express and Razorpay Standard Checkout.

## 1. Local setup

```bash
npm install
cp .env.example .env
```

Edit `.env`:

```env
RAZORPAY_KEY_ID=rzp_test_xxxxx
RAZORPAY_KEY_SECRET=xxxxx
BASE44_APP_URL=https://your-app.base44.app
PORT=5000
```

Run:

```bash
npm run dev
```

Open:

```text
http://localhost:5000
```

## 2. Create Razorpay test keys

In Razorpay Dashboard, use Test Mode and generate API keys. Never add the key secret to frontend code or GitHub.

## 3. Upload to GitHub

```bash
git init
git add .
git commit -m "Add Edu-Path payment page"
git branch -M main
git remote add origin YOUR_GITHUB_REPOSITORY_URL
git push -u origin main
```

## 4. Host on Render

1. Sign in to Render.
2. Select **New → Web Service**.
3. Connect the GitHub repository.
4. Build command: `npm install`
5. Start command: `npm start`
6. Add environment variables:
   - `RAZORPAY_KEY_ID`
   - `RAZORPAY_KEY_SECRET`
   - `BASE44_APP_URL`
   - `NODE_VERSION=20.18.0`
7. Deploy.
8. Render gives a URL like `https://edupath-payment.onrender.com`.

## 5. Link it in Base44

Create an **Upgrade to Premium** button and set its action to open:

```text
https://edupath-payment.onrender.com
```

Recommended Base44 logic:

- Open the payment site in the same tab or a new tab.
- Pass the authenticated user's identity only through a secure backend-generated token.
- After payment, have a Base44 backend function call:
  `GET https://edupath-payment.onrender.com/api/payment-status/PAYMENT_ID`
- Grant premium only when the response says `verified: true`.

## Important production work

This starter keeps order and payment records in server memory. Before accepting real payments:

- Replace Maps with MongoDB, PostgreSQL or Base44 database storage.
- Protect `/api/payment-status/:paymentId` with server-to-server authentication.
- Add Razorpay webhooks.
- Make payment processing idempotent.
- Confirm that a payment is captured/paid before granting premium.
- Add terms, privacy, refund and cancellation pages.
- Complete Razorpay KYC/business verification with the legitimate account owner.
