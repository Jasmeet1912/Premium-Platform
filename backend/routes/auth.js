const router = require("express").Router();
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const auth = require("../middleware/auth");

const createToken = (user) =>
  jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });

const namePattern = /^[\p{L}][\p{L}\p{M} .'-]{1,49}$/u;
const usernamePattern = /^[a-z0-9_]{3,24}$/;

router.post("/register", async (req, res) => {
  const { password, role } = req.body;
  const name = String(req.body.name || "").trim();
  const username = String(req.body.username || "").trim().toLowerCase();
  const email = String(req.body.email || "").trim().toLowerCase();

  if (!name || !username || !email || !password) {
    return res.status(400).json({ message: "Name, username, email, and password are required" });
  }

  if (!namePattern.test(name)) {
    return res.status(400).json({
      message: "Name must be 2-50 letters. Spaces, apostrophes, hyphens, and periods are allowed."
    });
  }

  if (!usernamePattern.test(username)) {
    return res.status(400).json({
      message: "Username must be 3-24 characters and use only lowercase letters, numbers, and underscores."
    });
  }

  const existing = await User.findOne({ $or: [{ email }, { username }] });
  if (existing?.email === email) return res.status(409).json({ message: "Email already exists" });
  if (existing?.username === username) return res.status(409).json({ message: "Username already exists" });

  const hashed = await bcrypt.hash(password, 10);
  const user = await User.create({
    name,
    username,
    email,
    password: hashed,
    role: role || "subscriber"
  });

  res.status(201).json({ token: createToken(user), user: user.toJSON() });
});

router.post("/login", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const { password } = req.body;
  const user = await User.findOne({ email });
  if (!user) return res.status(400).json({ message: "No user found" });

  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ message: "Wrong password" });

  res.json({ token: createToken(user), user: user.toJSON() });
});

router.post("/reset-password", async (req, res) => {
  const email = String(req.body.email || "").trim().toLowerCase();
  const { newPassword } = req.body;

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
