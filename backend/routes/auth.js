const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");

const createToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

router.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;

  if (!name || !email || !password) {
    return res.status(400).json({ message: "Name, email, and password are required" });
  }

  const existing = await User.findOne({ email });
  if (existing) return res.status(409).json({ message: "User already exists" });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    email,
    password: hashed,
    role: role || "subscriber"
  });

  res.status(201).json({ token: createToken(user), user: user.toJSON() });
});

router.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "No user found" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ message: "Wrong password" });

  res.json({ token: createToken(user), user: user.toJSON() });
});

router.post("/reset-password", async (req, res) => {
  const { email, newPassword } = req.body;

  if (!email || !newPassword) {
    return res.status(400).json({ message: "Email and new password are required" });
  }

  if (String(newPassword).length < 6) {
    return res.status(400).json({ message: "New password must be at least 6 characters" });
  }

  const user = await User.findOne({ email });
  if (!user) return res.status(404).json({ message: "No user found for that email" });

  user.password = await bcrypt.hash(newPassword, 10);
  await user.save();

  res.json({ message: "Password reset successful. You can log in now." });
});

router.get("/me", auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  res.json(user.toJSON());
});

router.post("/follow/:id", auth, async (req, res) => {
  const me = await User.findById(req.user.id);
  const target = await User.findById(req.params.id);

  if (!me || !target) return res.status(404).json({ message: "User not found" });
  if (String(me._id) === String(target._id)) {
    return res.status(400).json({ message: "You cannot follow yourself" });
  }

  if (!me.following.some((id) => String(id) === String(target._id))) me.following.push(target._id);
  if (!target.followers.some((id) => String(id) === String(me._id))) target.followers.push(me._id);

  await me.save();
  await target.save();

  res.json({ message: "Followed" });
});

module.exports = router;
