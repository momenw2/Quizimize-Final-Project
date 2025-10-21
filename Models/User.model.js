const mongoose = require("mongoose");
const { isEmail } = require("validator");
const bcrypt = require("bcrypt");
const Schema = mongoose.Schema;

const userSchema = new Schema({
  email: {
    type: String,
    required: [true, "Please enter an email"],
    unique: true,
    lowercase: true,
    validate: [isEmail, "Please enter a valid email"],
  },
  password: {
    type: String,
    required: [true, "Please enter a password"],
    minlength: [6, "Minimum password length is 6 characters"],
  },
  fullName: {
    type: String,
    required: true,
  },
  xp: {
    type: Number,
    default: 0,
  },
  level: {
    type: Number,
    default: 1,
  },
  totalXp: {
    type: Number,
    default: 0,
  },
  admin: {
    type: Boolean,
    default: false,
  },
  quizHistory: [
    {
      quizTopic: String,
      subject: String,
      quizList: String,
      score: Number,
      totalQuestions: Number,
      xp: Number,
      date: {
        type: String,
        default: () => new Date().toISOString().substr(0, 10),
      },
    },
  ],
  missionHistory: [
    {
      missionId: {
        type: Schema.Types.ObjectId,
        ref: "Mission",
      },
      missionTitle: String,
      groupId: {
        type: Schema.Types.ObjectId,
        ref: "Group",
      },
      score: Number,
      totalPoints: Number,
      xpEarned: Number,
      completedAt: {
        type: Date,
        default: Date.now,
      },
    },
  ],
});

// Calculate required XP for next level: Level 1 = 2000 XP, each level +500
userSchema.methods.getRequiredXp = function () {
  return 2000 + (this.level - 1) * 500;
};

// Add XP to user and handle level ups
userSchema.methods.addXp = async function (amount, source, metadata = {}) {
  console.log(
    `Adding ${amount} XP to user ${this._id}. Current Level: ${this.level}, Current XP: ${this.xp}, Total XP: ${this.totalXp}`
  );

  this.xp += amount;
  this.totalXp += amount;

  let leveledUp = false;
  let levelsGained = 0;

  // Check for level ups
  let requiredXp = this.getRequiredXp();
  console.log(`Required XP for level ${this.level}: ${requiredXp}`);

  while (this.xp >= requiredXp) {
    this.xp -= requiredXp;
    this.level += 1;
    leveledUp = true;
    levelsGained += 1;

    console.log(`🎉 User leveled up to level ${this.level}!`);
    console.log(`Remaining XP: ${this.xp}`);

    // Recalculate required XP for next level
    requiredXp = this.getRequiredXp();
    console.log(`Now needs ${requiredXp} XP for level ${this.level + 1}`);
  }

  // Add mission to history if it's a mission completion
  if (source === "mission_completion" && metadata.missionId) {
    this.missionHistory.push({
      missionId: metadata.missionId,
      missionTitle: metadata.missionTitle,
      groupId: metadata.groupId,
      score: metadata.score,
      totalPoints: metadata.totalPoints,
      xpEarned: amount,
    });
  }

  await this.save();
  console.log(
    `✅ User saved. Level: ${this.level}, XP: ${
      this.xp
    }/${this.getRequiredXp()}, Total XP: ${this.totalXp}`
  );

  return {
    leveledUp,
    levelsGained,
    newLevel: this.level,
    xp: this.xp,
    totalXp: this.totalXp,
    requiredXp: this.getRequiredXp(),
  };
};

// Get user level progress (for display)
userSchema.methods.getLevelProgress = function () {
  const requiredXp = this.getRequiredXp();
  const progress = (this.xp / requiredXp) * 100;
  return {
    level: this.level,
    xp: this.xp,
    totalXp: this.totalXp,
    requiredXp: requiredXp,
    progress: Math.round(progress),
    nextLevel: this.level + 1,
  };
};

// Fire a function before doc saved to DB
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt();
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Static method to login user
userSchema.statics.login = async function (email, password) {
  const user = await this.findOne({ email });
  if (user) {
    const auth = await bcrypt.compare(password, user.password);
    if (auth) {
      return user;
    }
    throw Error("Incorrect password");
  }
  throw Error("Incorrect email");
};

const User = mongoose.model("user", userSchema);

module.exports = User;
