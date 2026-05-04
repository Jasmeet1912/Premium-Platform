const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      minlength: 3,
      maxlength: 24,
      match: /^[a-z0-9_]+$/
    },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true },
    role: {
      type: String,
      enum: ["subscriber", "creator", "admin"],
      default: "subscriber"
    },
    subscriptionStatus: {
      type: String,
      enum: ["inactive", "active", "past_due"],
      default: "inactive"
    },
    subscriptionPlan: { type: String, default: "monthly" },
    subscriptionStartedAt: Date,
    subscriptionEndsAt: Date,
    stripeCustomerId: String,
    uploads: { type: Number, default: 0 },
    followers: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
    following: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }]
  },
  { timestamps: true }
);

userSchema.virtual("isSubscribed").get(function isSubscribed() {
  return this.subscriptionStatus === "active";
});

userSchema.set("toJSON", {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.password;
    return ret;
  }
});

module.exports = mongoose.model("User", userSchema);
