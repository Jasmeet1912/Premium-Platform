const router = require("express").Router();
const auth = require("../middleware/auth");
const Content = require("../models/Content");
const Payment = require("../models/Payment");
const User = require("../models/User");

const toCsv = (rows) => {
  const headers = Object.keys(rows[0] || {});
  const escape = (value) => `"${String(value ?? "").replace(/"/g, '""')}"`;
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
};

router.get("/overview", auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user || !["creator", "admin"].includes(user.role)) {
    return res.status(403).json({ message: "Only creators can access reports" });
  }

  const creatorFilter = user.role === "admin" ? {} : { creatorId: user._id };
  const [contents, payments, subscribers, allPremiumContent] = await Promise.all([
    Content.find(creatorFilter),
    Payment.find({ status: "paid" }),
    User.countDocuments({ subscriptionStatus: "active" }),
    Content.find({ accessLevel: "premium" })
  ]);

  const totals = contents.reduce(
    (acc, item) => {
      acc.views += item.metrics.views;
      acc.likes += item.metrics.likes;
      acc.completions += item.metrics.completions;
      return acc;
    },
    { views: 0, likes: 0, completions: 0 }
  );

  const totalRevenue = payments.reduce((sum, payment) => sum + payment.amount, 0) / 100;
  const premiumViews = contents
    .filter((item) => item.accessLevel === "premium")
    .reduce((sum, item) => sum + item.metrics.views, 0);
  const totalPremiumViews = allPremiumContent.reduce((sum, item) => sum + item.metrics.views, 0);
  const estimatedRevenue =
    totalPremiumViews > 0 ? Number(((premiumViews / totalPremiumViews) * totalRevenue).toFixed(2)) : 0;

  const byCategory = contents.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {});

  res.json({
    summary: {
      totalContent: contents.length,
      totalViews: totals.views,
      totalLikes: totals.likes,
      completions: totals.completions,
      activeSubscribers: subscribers,
      platformRevenue: Number(totalRevenue.toFixed(2)),
      estimatedRevenue
    },
    categoryMix: byCategory,
    content: contents.map((item) => ({
      id: item._id,
      title: item.title,
      type: item.type,
      category: item.category,
      accessLevel: item.accessLevel,
      views: item.metrics.views,
      likes: item.metrics.likes,
      completions: item.metrics.completions,
      createdAt: item.createdAt
    }))
  });
});

router.get("/export.csv", auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user || !["creator", "admin"].includes(user.role)) {
    return res.status(403).json({ message: "Only creators can export reports" });
  }

  const contents = await Content.find(user.role === "admin" ? {} : { creatorId: user._id }).sort({ createdAt: -1 });
  const rows = contents.map((item) => ({
    title: item.title,
    type: item.type,
    category: item.category,
    accessLevel: item.accessLevel,
    views: item.metrics.views,
    likes: item.metrics.likes,
    completions: item.metrics.completions,
    saves: item.metrics.saves,
    publishedAt: item.createdAt.toISOString()
  }));

  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", "attachment; filename=creator-report.csv");
  res.send(toCsv(rows));
});

module.exports = router;
