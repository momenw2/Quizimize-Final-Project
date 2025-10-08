const mongoose = require("mongoose");

const missionSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    type: {
      type: String,
      enum: ["system", "custom"],
      required: true,
    },
    questions: [
      {
        text: {
          type: String,
          required: function () {
            return this.parent().type === "custom";
          },
        },
        choices: [
          {
            type: String,
            required: function () {
              return this.parent().type === "custom";
            },
          },
        ],
        correctAnswer: {
          type: Number,
          min: 0,
          max: 3,
          required: function () {
            return this.parent().type === "custom";
          },
        },
        explanation: {
          type: String,
          trim: true,
        },
      },
    ],
    points: {
      type: Number,
      default: 100,
      min: 1,
    },
    deadline: {
      type: Date,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Group",
      required: true,
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    status: {
      type: String,
      enum: ["active", "completed", "pending"],
      default: "active",
    },
  },
  {
    timestamps: true,
  }
);

// Index for efficient queries
missionSchema.index({ groupId: 1, createdAt: -1 });
missionSchema.index({ status: 1 });

module.exports = mongoose.model("Mission", missionSchema);
