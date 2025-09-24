const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  specialization: { type: String, required: true }, // e.g., JavaScript, React, SQL
  level: { type: Number, default: 1 },
  members: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
      role: {
        type: String,
        enum: ["Admin", "Strategist", "Contributor", "Challenger", "Member"],
        default: "Member",
      },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Group", groupSchema);
