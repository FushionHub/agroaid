const functions = require("firebase-functions");
const admin = require("firebase-admin");
const paystack = require("paystack")(functions.config().paystack.secret_key);
const crypto = require("crypto");

/**
 * Initializes a payment transaction with Paystack.
 */
exports.initializePayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "You must be logged in to make a payment."
    );
  }

  const { amount, email } = data;

  if (!amount || !email) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Missing required fields: amount, email"
    );
  }

  const params = {
    amount: amount * 100, // Paystack expects the amount in kobo
    email,
  };

  try {
    const response = await paystack.transaction.initialize(params);
    return response.data;
  } catch (error) {
    console.error("Error initializing Paystack payment:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Error initializing Paystack payment."
    );
  }
});

/**
 * Verifies a Paystack payment and updates the user's wallet.
 */
exports.verifyPayment = functions.https.onRequest(async (req, res) => {
  const secret = functions.config().paystack.secret_key;
  const hash = crypto
    .createHmac("sha512", secret)
    .update(JSON.stringify(req.body))
    .digest("hex");

  if (hash !== req.headers["x-paystack-signature"]) {
    console.error("Invalid Paystack signature");
    res.status(401).send("Invalid signature");
    return;
  }

  const { event, data } = req.body;

  if (event === "charge.success") {
    const { email } = data.customer;
    const amount = data.amount / 100; // Convert from kobo to NGN

    try {
      const userRecord = await admin.auth().getUserByEmail(email);
      const uid = userRecord.uid;
      const walletRef = admin.firestore().collection("wallets").doc(uid);
      const walletDoc = await walletRef.get();

      if (!walletDoc.exists) {
        await createWallet(uid);
      }

      await walletRef.update({
        balance: admin.firestore.FieldValue.increment(amount),
      });

      console.log(`Wallet for ${email} credited with NGN ${amount}`);
    } catch (error) {
      console.error("Error updating wallet:", error);
    }
  }

  res.status(200).send("Webhook received");
});

/**
 * Creates a new wallet for a user.
 * @param {string} uid The user's UID.
 */
const createWallet = async (uid) => {
  const walletRef = admin.firestore().collection("wallets").doc(uid);
  const wallet = {
    balance: 0,
    currency: "NGN",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  };
  await walletRef.set(wallet);
};
