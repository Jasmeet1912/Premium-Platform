const router = require("express").Router();
const auth = require("../middleware/auth");
const Payment = require("../models/Payment");
const User = require("../models/User");

const stripe = process.env.STRIPE_SECRET ? require("stripe")(process.env.STRIPE_SECRET) : null;
const PREMIUM_PRICE_INR = 99900;

const getAppUrl = (req) => {
  if (process.env.APP_URL) {
    return process.env.APP_URL.replace(/\/$/, "");
  }

  return `${req.protocol}://${req.get("host")}/profile`;
};

const activateSubscription = async (userId, paymentData = {}) => {
  const subscriptionEndsAt = new Date();
  subscriptionEndsAt.setMonth(subscriptionEndsAt.getMonth() + 1);

  const user = await User.findByIdAndUpdate(
    userId,
    {
      subscriptionStatus: "active",
      subscriptionStartedAt: new Date(),
      subscriptionEndsAt
    },
    { new: true }
  );

  await Payment.create({
    userId,
    amount: paymentData.amount || PREMIUM_PRICE_INR,
    currency: paymentData.currency || "inr",
    provider: paymentData.provider || "demo",
    plan: paymentData.plan || "monthly",
    stripeSessionId: paymentData.stripeSessionId,
    status: "paid"
  });

  return user;
};

router.post("/checkout", auth, async (req, res) => {
  if (!stripe) {
    return res.json({
      mode: "demo",
      message: "Stripe is not configured. Use the demo subscription endpoint instead."
    });
  }

  const appUrl = getAppUrl(req);
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "inr",
          product_data: {
            name: "Premium Creator Platform Membership",
            description: "Monthly access to premium articles, videos, and courses"
          },
          recurring: { interval: "month" },
          unit_amount: PREMIUM_PRICE_INR
        },
        quantity: 1
      }
    ],
    mode: "subscription",
    metadata: { userId: req.user.id },
    success_url: `${appUrl}?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${appUrl}?checkout=cancelled`
  });

  await Payment.create({
    userId: req.user.id,
    provider: "stripe",
    status: "pending",
    amount: PREMIUM_PRICE_INR,
    currency: "inr",
    plan: "monthly",
    stripeSessionId: session.id
  });

  res.json({ mode: "stripe", url: session.url, sessionId: session.id });
});

router.post("/checkout/demo", auth, async (req, res) => {
  const user = await activateSubscription(req.user.id, {
    provider: "demo",
    amount: PREMIUM_PRICE_INR,
    currency: "inr",
    plan: "monthly"
  });

  res.json({ message: "Demo subscription activated", user: user.toJSON() });
});

router.post("/confirm", auth, async (req, res) => {
  const { sessionId } = req.body;
  if (!stripe || !sessionId) {
    return res.status(400).json({ message: "Missing Stripe session" });
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId);
  if (!["paid", "no_payment_required"].includes(session.payment_status)) {
    return res.status(400).json({ message: "Payment not completed yet" });
  }

  const existingPaid = await Payment.findOne({ stripeSessionId: sessionId, status: "paid" });
  if (existingPaid) {
    const user = await User.findById(req.user.id);
    return res.json({ message: "Subscription already active", user: user.toJSON() });
  }

  await Payment.findOneAndUpdate({ stripeSessionId: sessionId }, { status: "paid" });
  const user = await User.findByIdAndUpdate(
    req.user.id,
    {
      subscriptionStatus: "active",
      subscriptionStartedAt: new Date(),
      subscriptionEndsAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
    },
    { new: true }
  );

  res.json({ message: "Subscription confirmed", user: user.toJSON() });
});

module.exports = router;
