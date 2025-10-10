const mongoose = require("mongoose");

const groupSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  specialization: { type: String, required: true },
  description: { type: String, default: "" },
  level: { type: Number, default: 1 },
  xp: { type: Number, default: 2000 }, // Current XP
  totalXp: { type: Number, default: 2000 }, // Total XP earned
  requiredXp: { type: Number, default: 2000 }, // XP needed for next level
  members: [
    {
      user: { type: mongoose.Schema.Types.ObjectId, ref: "user" },
      role: {
        type: String,
        enum: ["Admin", "Strategist", "Contributor", "Challenger", "Member"],
        default: "Member",
      },
    },
  ],
  createdAt: { type: Date, default: Date.now },
});

// Add method to calculate required XP for a level
groupSchema.methods.calculateRequiredXp = function (level = this.level) {
  return 2000 + level * 1000;
};

// Add method to add XP and handle level ups
groupSchema.methods.addXp = async function (
  amount,
  source = "system",
  sourceDetails = {}
) {
  this.xp += amount;
  this.totalXp += amount;

  const oldLevel = this.level;

  // Check for level up
  while (this.xp >= this.requiredXp) {
    this.xp -= this.requiredXp;
    this.level += 1;
    this.requiredXp = this.calculateRequiredXp();
  }

  const leveledUp = this.level > oldLevel;

  await this.save();

  return {
    newLevel: this.level,
    currentXp: this.xp,
    requiredXp: this.requiredXp,
    leveledUp: leveledUp,
    xpGained: amount,
    source: source,
    sourceDetails: sourceDetails,
  };
};

module.exports = mongoose.model("Group", groupSchema);
