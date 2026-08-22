import express from "express";
import Razorpay from "razorpay";
import crypto from "crypto";
import dotenv from "dotenv";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";

/* =========================================================
   1. PROJECT PATH
========================================================= */

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/* =========================================================
   2. LOAD .ENV FILE
========================================================= */

const envResult = dotenv.config({
  path: path.join(__dirname, ".env")
});

if (envResult.error) {
  console.error("Unable to load .env file.");
  console.error(envResult.error.message);
}

/* =========================================================
   3. VALIDATE ENVIRONMENT VARIABLES
========================================================= */

const RAZORPAY_KEY_ID =
  process.env.RAZORPAY_KEY_ID?.trim();

const RAZORPAY_KEY_SECRET =
  process.env.RAZORPAY_KEY_SECRET?.trim();

const BASE44_APP_URL =
  process.env.BASE44_APP_URL?.trim() || "";

const PORT =
  Number(process.env.PORT) || 5000;

if (!RAZORPAY_KEY_ID) {
  console.error(
    "RAZORPAY_KEY_ID is missing in the .env file."
  );
}

if (!RAZORPAY_KEY_SECRET) {
  console.error(
    "RAZORPAY_KEY_SECRET is missing in the .env file."
  );
}

if (
  !RAZORPAY_KEY_ID ||
  !RAZORPAY_KEY_SECRET
) {
  console.error("");
  console.error(
    "Create a .env file in the same folder as server.js."
  );

  console.error(
    "Add your real Razorpay Test Mode keys."
  );

  console.error("");

  process.exit(1);
}

/* =========================================================
   4. CREATE EXPRESS APP
========================================================= */

const app = express();

app.disable("x-powered-by");

/* =========================================================
   5. MIDDLEWARE
========================================================= */

app.use(
  cors({
    origin: true,
    methods: [
      "GET",
      "POST",
      "OPTIONS"
    ],
    allowedHeaders: [
      "Content-Type",
      "Authorization"
    ]
  })
);

app.use(
  express.json({
    limit: "100kb"
  })
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "100kb"
  })
);

/* =========================================================
   6. RAZORPAY CONFIGURATION
========================================================= */

const razorpay = new Razorpay({
  key_id: RAZORPAY_KEY_ID,
  key_secret: RAZORPAY_KEY_SECRET
});

/* =========================================================
   7. EDU-PATH PAYMENT PLANS

   Razorpay amount must be entered in paise.

   ₹49  = 4,900 paise
   ₹299 = 29,900 paise
   ₹499 = 49,900 paise
========================================================= */

const plans = Object.freeze({
  monthly: {
    name:
      "Edu-Path Premium - 1 Month",

    amount:
      4900,

    durationDays:
      30,

    description:
      "30 days of Edu-Path Premium access"
  },

  six_months: {
    name:
      "Edu-Path Premium - 6 Months",

    amount:
      29900,

    durationDays:
      180,

    description:
      "6 months of Edu-Path Premium access"
  },

  yearly: {
    name:
      "Edu-Path Premium - 1 Year",

    amount:
      49900,

    durationDays:
      365,

    description:
      "12 months of Edu-Path Premium access"
  }
});

/* =========================================================
   8. TEMPORARY STORAGE

   This is only for local testing.

   Before accepting real payments, replace these Maps with
   MongoDB, PostgreSQL or another permanent database.
========================================================= */

const orders = new Map();

const verifiedPayments =
  new Map();

/* =========================================================
   9. HELPER FUNCTIONS
========================================================= */

function cleanText(
  value,
  maximumLength = 150
) {
  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .slice(0, maximumLength);
}

function isValidEmail(email) {
  const emailPattern =
    /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

  return emailPattern.test(email);
}

function generatePaymentSignature(
  orderId,
  paymentId
) {
  return crypto
    .createHmac(
      "sha256",
      RAZORPAY_KEY_SECRET
    )
    .update(
      `${orderId}|${paymentId}`
    )
    .digest("hex");
}

function compareSignatures(
  generatedSignature,
  receivedSignature
) {
  const generatedBuffer =
    Buffer.from(
      generatedSignature,
      "utf8"
    );

  const receivedBuffer =
    Buffer.from(
      receivedSignature,
      "utf8"
    );

  if (
    generatedBuffer.length !==
    receivedBuffer.length
  ) {
    return false;
  }

  return crypto.timingSafeEqual(
    generatedBuffer,
    receivedBuffer
  );
}

/* =========================================================
   9b. RAZORPAY CREDENTIALS SELF-CHECK

   Calls a harmless, low-cost Razorpay endpoint at startup so
   a bad Key ID / Key Secret pair is caught immediately with a
   clear message, instead of surfacing only when a customer
   tries to pay.
========================================================= */

async function verifyRazorpayCredentials() {
  try {
    await razorpay.orders.all({ count: 1 });

    console.log(
      "Razorpay credentials verified successfully."
    );
  } catch (error) {
    const statusCode = error?.statusCode;
    const description =
      error?.error?.description ||
      error?.message ||
      (statusCode
        ? `Request failed with status ${statusCode} (no error details returned — likely a network/firewall block reaching Razorpay, not a bad key).`
        : "Could not reach Razorpay at all (network/DNS/firewall issue). This is not necessarily a bad key.");

    console.error("");
    console.error(
      "=========================================================="
    );
    console.error(
      "RAZORPAY AUTHENTICATION CHECK FAILED"
    );
    console.error(
      "=========================================================="
    );
    console.error(
      `Razorpay says: ${description}`
    );
    console.error("");

    if (statusCode === 401) {
      console.error(
        "This means the RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET"
      );
      console.error(
        "in your .env file (or Render environment variables)"
      );
      console.error(
        "do not form a valid, matching pair. Common causes:"
      );
      console.error(
        "  1. The Key Secret was regenerated in the Razorpay"
      );
      console.error(
        "     dashboard after the .env file was last updated."
      );
      console.error(
        "     Regenerating a secret permanently invalidates the"
      );
      console.error(
        "     old one, even if the Key ID looks unchanged."
      );
      console.error(
        "  2. The Key ID and Key Secret were copied from"
      );
      console.error(
        "     different modes (Test vs Live) or different keys."
      );
      console.error(
        "  3. The keys were deactivated in the Razorpay dashboard."
      );
      console.error(
        "  4. On Render/hosted deployments: the environment"
      );
      console.error(
        "     variables in the hosting dashboard are stale or"
      );
      console.error(
        "     were never set (the .env file is not deployed)."
      );
      console.error("");
      console.error(
        "Fix: go to Razorpay Dashboard -> Settings -> API Keys,"
      );
      console.error(
        "generate a fresh Test Mode key pair, and paste BOTH the"
      );
      console.error(
        "new Key ID and new Key Secret together (do not mix an"
      );
      console.error(
        "old value with a new one)."
      );
    }

    console.error(
      "=========================================================="
    );
    console.error("");
  }
}

verifyRazorpayCredentials();

/* =========================================================
   10. HEALTH ROUTE
========================================================= */

app.get(
  "/health",
  (request, response) => {
    return response
      .status(200)
      .json({
        ok: true,

        message:
          "Edu-Path payment server is running.",

        time:
          new Date().toISOString()
      });
  }
);

/* =========================================================
   10b. RAZORPAY CREDENTIALS CHECK ROUTE

   Visit this in a browser (locally or on the deployed URL) to
   confirm, without digging through logs, whether the currently
   loaded RAZORPAY_KEY_ID / RAZORPAY_KEY_SECRET pair is valid.
   Never returns the secret itself.
========================================================= */

app.get(
  "/api/razorpay-check",
  async (request, response) => {
    try {
      await razorpay.orders.all({ count: 1 });

      return response.status(200).json({
        ok: true,
        message:
          "Razorpay credentials are valid.",
        keyId: RAZORPAY_KEY_ID
      });
    } catch (error) {
      const statusCode = error?.statusCode;
      const description =
        error?.error?.description || error?.message;

      return response.status(200).json({
        ok: false,
        statusCode,
        message: description || null,
        keyId: RAZORPAY_KEY_ID,
        hint:
          statusCode === 401
            ? "The Key ID and Key Secret loaded by this server do not form a valid pair. Regenerate both together in the Razorpay dashboard and update them here."
            : "Could not get a clear response from Razorpay (network/firewall issue, or Razorpay is unreachable from this server) rather than a confirmed bad key."
      });
    }
  }
);

/* =========================================================
   11. FRONTEND CONFIGURATION ROUTE

   The Key ID is safe for the frontend.

   Never send the Razorpay Key Secret to the frontend.
========================================================= */

app.get(
  "/api/config",
  (request, response) => {
    return response
      .status(200)
      .json({
        keyId:
          RAZORPAY_KEY_ID,

        base44Url:
          BASE44_APP_URL
      });
  }
);

/* =========================================================
   12. CREATE RAZORPAY ORDER
========================================================= */

app.post(
  "/api/create-order",
  async (request, response) => {
    try {
      const requestBody =
        request.body || {};

      const selectedPlanName =
        cleanText(
          requestBody.plan,
          30
        );

      const name =
        cleanText(
          requestBody.name,
          100
        );

      const email =
        cleanText(
          requestBody.email,
          150
        ).toLowerCase();

      const userId =
        cleanText(
          requestBody.userId,
          100
        );

      const selectedPlan =
        plans[selectedPlanName];

      if (!selectedPlan) {
        return response
          .status(400)
          .json({
            success: false,

            message:
              "Invalid payment plan selected."
          });
      }

      if (!name) {
        return response
          .status(400)
          .json({
            success: false,

            message:
              "Full name is required."
          });
      }

      if (!email) {
        return response
          .status(400)
          .json({
            success: false,

            message:
              "Email address is required."
          });
      }

      if (!isValidEmail(email)) {
        return response
          .status(400)
          .json({
            success: false,

            message:
              "Enter a valid email address."
          });
      }

      if (!userId) {
        return response
          .status(400)
          .json({
            success: false,

            message:
              "Edu-Path User ID is required."
          });
      }

      /*
        The amount is selected only on the server.

        Do not accept the price or amount from index.html.
      */

      const receipt =
        `edupath_${Date.now()}`;

      const order =
        await razorpay.orders.create({
          amount:
            selectedPlan.amount,

          currency:
            "INR",

          receipt,

          notes: {
            plan:
              selectedPlanName,

            planName:
              selectedPlan.name,

            name,

            email,

            userId
          }
        });

      const orderRecord = {
        orderId:
          order.id,

        receipt,

        plan:
          selectedPlanName,

        planName:
          selectedPlan.name,

        amount:
          selectedPlan.amount,

        currency:
          "INR",

        durationDays:
          selectedPlan.durationDays,

        name,

        email,

        userId,

        status:
          order.status || "created",

        createdAt:
          new Date().toISOString()
      };

      orders.set(
        order.id,
        orderRecord
      );

      return response
        .status(201)
        .json({
          success: true,

          orderId:
            order.id,

          amount:
            selectedPlan.amount,

          currency:
            "INR",

          plan:
            selectedPlanName,

          planName:
            selectedPlan.name,

          description:
            selectedPlan.description
        });
    } catch (error) {
      console.error(
        "Create order error:",
        error
      );

      const errorMessage =
        error?.error?.description ||
        error?.error?.reason ||
        error?.message ||
        "Unable to create Razorpay order.";

      return response
        .status(500)
        .json({
          success: false,

          message:
            errorMessage
        });
    }
  }
);

/* =========================================================
   13. VERIFY RAZORPAY PAYMENT
========================================================= */

app.post(
  "/api/verify-payment",
  async (request, response) => {
    try {
      const requestBody =
        request.body || {};

      const razorpayOrderId =
        cleanText(
          requestBody.razorpay_order_id,
          150
        );

      const razorpayPaymentId =
        cleanText(
          requestBody.razorpay_payment_id,
          150
        );

      const razorpaySignature =
        cleanText(
          requestBody.razorpay_signature,
          300
        );

      if (
        !razorpayOrderId ||
        !razorpayPaymentId ||
        !razorpaySignature
      ) {
        return response
          .status(400)
          .json({
            verified: false,

            message:
              "Required payment details are missing."
          });
      }

      const storedOrder =
        orders.get(
          razorpayOrderId
        );

      if (!storedOrder) {
        return response
          .status(400)
          .json({
            verified: false,

            message:
              "Order was not found. The payment server may have restarted."
          });
      }

      /*
        Prevent duplicate payment processing.
      */

      const existingPayment =
        verifiedPayments.get(
          razorpayPaymentId
        );

      if (existingPayment) {
        return response
          .status(200)
          .json({
            ...existingPayment,

            message:
              "Payment was already verified."
          });
      }

      const generatedSignature =
        generatePaymentSignature(
          razorpayOrderId,
          razorpayPaymentId
        );

      const signatureIsValid =
        compareSignatures(
          generatedSignature,
          razorpaySignature
        );

      if (!signatureIsValid) {
        return response
          .status(400)
          .json({
            verified: false,

            message:
              "Payment signature verification failed."
          });
      }

      /*
        Fetch the payment directly from Razorpay.
      */

      const payment =
        await razorpay.payments.fetch(
          razorpayPaymentId
        );

      if (
        payment.order_id !==
        razorpayOrderId
      ) {
        return response
          .status(400)
          .json({
            verified: false,

            message:
              "Payment does not belong to this order."
          });
      }

      if (
        Number(payment.amount) !==
        Number(storedOrder.amount)
      ) {
        return response
          .status(400)
          .json({
            verified: false,

            message:
              "Payment amount does not match the selected plan."
          });
      }

      if (
        payment.currency !==
        storedOrder.currency
      ) {
        return response
          .status(400)
          .json({
            verified: false,

            message:
              "Payment currency does not match."
          });
      }

      const acceptedStatuses = [
        "authorized",
        "captured"
      ];

      if (
        !acceptedStatuses.includes(
          payment.status
        )
      ) {
        return response
          .status(400)
          .json({
            verified: false,

            message:
              `Payment is not complete. Current status: ${payment.status}`
          });
      }

      const verifiedDate =
        new Date();

      const expiryDate =
        new Date(verifiedDate);

      expiryDate.setDate(
        expiryDate.getDate() +
        storedOrder.durationDays
      );

      const paymentRecord = {
        verified: true,

        paymentId:
          razorpayPaymentId,

        orderId:
          razorpayOrderId,

        userId:
          storedOrder.userId,

        name:
          storedOrder.name,

        email:
          storedOrder.email,

        plan:
          storedOrder.plan,

        planName:
          storedOrder.planName,

        amount:
          storedOrder.amount,

        currency:
          storedOrder.currency,

        paymentStatus:
          payment.status,

        verifiedAt:
          verifiedDate.toISOString(),

        subscriptionExpiry:
          expiryDate.toISOString()
      };

      verifiedPayments.set(
        razorpayPaymentId,
        paymentRecord
      );

      orders.set(
        razorpayOrderId,
        {
          ...storedOrder,

          status:
            "paid",

          paymentId:
            razorpayPaymentId,

          verifiedAt:
            verifiedDate.toISOString(),

          subscriptionExpiry:
            expiryDate.toISOString()
        }
      );

      return response
        .status(200)
        .json({
          ...paymentRecord,

          message:
            "Payment verified successfully."
        });
    } catch (error) {
      console.error(
        "Payment verification error:",
        error
      );

      const errorMessage =
        error?.error?.description ||
        error?.error?.reason ||
        error?.message ||
        "Unable to verify payment.";

      return response
        .status(500)
        .json({
          verified: false,

          message:
            errorMessage
        });
    }
  }
);

/* =========================================================
   14. PAYMENT STATUS ROUTE
========================================================= */

app.get(
  "/api/payment-status/:paymentId",
  (request, response) => {
    const paymentId =
      cleanText(
        request.params.paymentId,
        150
      );

    const paymentRecord =
      verifiedPayments.get(
        paymentId
      );

    if (!paymentRecord) {
      return response
        .status(404)
        .json({
          verified: false,

          message:
            "Verified payment was not found."
        });
    }

    return response
      .status(200)
      .json(
        paymentRecord
      );
  }
);

/* =========================================================
   15. API 404 HANDLER

   This ensures invalid API routes return JSON rather than
   index.html.
========================================================= */

app.use(
  "/api",
  (request, response) => {
    return response
      .status(404)
      .json({
        success: false,

        message:
          `API route not found: ${request.method} ${request.originalUrl}`
      });
  }
);

/* =========================================================
   16. SERVE FRONTEND FILES
========================================================= */

app.use(
  express.static(
    path.join(
      __dirname,
      "public"
    )
  )
);

/* =========================================================
   17. PAGE FALLBACK

   This sends index.html for normal non-API routes.
========================================================= */

app.get(
  /.*/,
  (request, response) => {
    return response.sendFile(
      path.join(
        __dirname,
        "public",
        "index.html"
      )
    );
  }
);

/* =========================================================
   18. GLOBAL ERROR HANDLER
========================================================= */

app.use(
  (
    error,
    request,
    response,
    next
  ) => {
    console.error(
      "Unhandled server error:",
      error
    );

    if (
      request.originalUrl.startsWith(
        "/api"
      )
    ) {
      return response
        .status(500)
        .json({
          success: false,

          message:
            error.message ||
            "Internal payment server error."
        });
    }

    return response
      .status(500)
      .send(
        "Internal server error."
      );
  }
);

/* =========================================================
   19. START SERVER
========================================================= */

app.listen(
  PORT,
  "0.0.0.0",
  () => {
    console.log("");
    console.log(
      "Edu-Path payment server started successfully."
    );

    console.log(
      `Website: http://localhost:${PORT}`
    );

    console.log(
      `Health check: http://localhost:${PORT}/health`
    );

    console.log(
      `Payment configuration: http://localhost:${PORT}/api/config`
    );

    console.log("");
  }
);
