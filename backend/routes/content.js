const router = require("express").Router();
const jwt = require("jsonwebtoken");
const Content = require("../models/Content");
const User = require("../models/User");
const auth = require("../middleware/auth");

const canReadFullContent = ({ content, viewerId, isSubscribed }) =>
  content.accessLevel === "free" || isSubscribed || String(content.creatorId) === String(viewerId);

const sanitizeContent = (content, viewer) => {
  const fullAccess = canReadFullContent({
    content,
    viewerId: viewer?.id,
    isSubscribed: viewer?.isSubscribed
  });

  return {
    ...content.toObject(),
    body: fullAccess ? content.body : `${content.summary || content.body.slice(0, 180)}...`,
    fullAccess,
    lockedReason: fullAccess ? null : "Subscribe to unlock premium content"
  };
};

const getViewerFromRequest = async (req) => {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : header;

  if (!token) return null;

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(decoded.id);
    return user ? { id: user._id, isSubscribed: user.isSubscribed } : null;
  } catch {
    return null;
  }
};

router.post("/", auth, async (req, res) => {
  const user = await User.findById(req.user.id);
  if (!user) return res.status(404).json({ message: "User not found" });
  if (!["creator", "admin"].includes(user.role)) {
    return res.status(403).json({ message: "Only creators can publish content" });
  }

  const content = await Content.create({
    creatorId: user._id,
    creatorName: user.name,
    title: req.body.title,
    summary: req.body.summary,
    body: req.body.body,
    type: req.body.type,
    category: req.body.category,
    accessLevel: req.body.accessLevel,
    durationMinutes: Number(req.body.durationMinutes || 0),
    thumbnailUrl: req.body.thumbnailUrl || "",
    videoUrl: req.body.videoUrl || "",
    lessonCount: Number(req.body.lessonCount || 0),
    tags: Array.isArray(req.body.tags)
      ? req.body.tags
      : String(req.body.tags || "")
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean)
  });

  user.uploads += 1;
  await user.save();

  res.status(201).json(content);
});

router.get("/", async (req, res) => {
  const { category, type, accessLevel, q, creatorId } = req.query;
  const query = {};

  if (category) query.category = category;
  if (type) query.type = type;
  if (accessLevel) query.accessLevel = accessLevel;
  if (creatorId) query.creatorId = creatorId;
  if (q) {
    query.$or = [
      { title: { $regex: q, $options: "i" } },
      { summary: { $regex: q, $options: "i" } },
      { tags: { $regex: q, $options: "i" } }
    ];
  }

  const [data, viewer] = await Promise.all([
    Content.find(query).sort({ createdAt: -1 }),
    getViewerFromRequest(req)
  ]);

  res.json(data.map((item) => sanitizeContent(item, viewer)));
});

router.get("/mine", auth, async (req, res) => {
  const items = await Content.find({ creatorId: req.user.id }).sort({ createdAt: -1 });
  res.json(items);
});

router.post("/like/:id", auth, async (req, res) => {
  const content = await Content.findById(req.params.id);
  if (!content) return res.status(404).json({ message: "Content not found" });

  content.metrics.likes += 1;
  await content.save();

  res.json(content);
});

router.post("/comment/:id", auth, async (req, res) => {
  const [content, user] = await Promise.all([Content.findById(req.params.id), User.findById(req.user.id)]);
  if (!content || !user) return res.status(404).json({ message: "Unable to comment" });

  content.comments.push({ text: req.body.text, userName: user.name });
  await content.save();

  res.json(content);
});

router.post("/engagement/:id", auth, async (req, res) => {
  const content = await Content.findById(req.params.id);
  if (!content) return res.status(404).json({ message: "Content not found" });

  const action = req.body.action;
  if (action === "view") content.metrics.views += 1;
  if (action === "complete") content.metrics.completions += 1;
  if (action === "save") content.metrics.saves += 1;

  await content.save();
  res.json(content);
});

module.exports = router;
