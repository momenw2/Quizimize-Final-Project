const mongoose = require("mongoose");

const chatMessageSchema = new mongoose.Schema(
  {
    content: {
      type: String,
      required: true,
      maxlength: 500,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    userName: {
      type: String,
      required: true,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

// Create index for efficient querying
chatMessageSchema.index({ groupId: 1, createdAt: 1 });

module.exports = mongoose.model("ChatMessage", chatMessageSchema);
