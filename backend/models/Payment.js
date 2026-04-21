const mongoose = require("mongoose");

const paymentSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    provider: { type: String, enum: ["stripe", "demo"], default: "demo" },
    status: {
      type: String,
      enum: ["pending", "paid", "failed"],
      default: "pending"
    },
    amount: { type: Number, required: true },
    currency: { type: String, default: "usd" },
    plan: { type: String, default: "monthly" },
    stripeSessionId: String
  },
  { timestamps: true }
);

module.exports = mongoose.model("Payment", paymentSchema);
