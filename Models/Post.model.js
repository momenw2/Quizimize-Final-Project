const mongoose = require("mongoose");

const postSchema = new mongoose.Schema(
  {
    content: { type: String, required: true },
    author: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "user",
      required: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    votes: { type: Number, default: 0 },
    voters: [
      {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
        voteType: { type: String, enum: ["up", "down"] },
      },
    ],
    comments: [{ type: mongoose.Schema.Types.ObjectId, ref: "Comment" }],
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Post", postSchema);
