const mongoose = require("mongoose");

const contentSchema = new mongoose.Schema(
  {
    creatorId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    creatorName: { type: String, required: true },
    title: { type: String, required: true, trim: true },
    summary: { type: String, default: "", trim: true },
    body: { type: String, required: true },
    type: {
      type: String,
      enum: ["article", "video", "course"],
      default: "article"
    },
    category: {
      type: String,
      enum: ["Business", "Design", "Marketing", "Technology", "Wellness", "Education"],
      default: "Technology"
    },
    accessLevel: {
      type: String,
      enum: ["free", "premium"],
      default: "premium"
    },
    durationMinutes: { type: Number, default: 0 },
    thumbnailUrl: { type: String, default: "" },
    videoUrl: { type: String, default: "" },
    lessonCount: { type: Number, default: 0 },
    metrics: {
      views: { type: Number, default: 0 },
      likes: { type: Number, default: 0 },
      completions: { type: Number, default: 0 },
      saves: { type: Number, default: 0 }
    },
    tags: [{ type: String, trim: true }],
    comments: [
      {
        text: { type: String, trim: true },
        userName: String,
        createdAt: { type: Date, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

module.exports = mongoose.model("Content", contentSchema);
