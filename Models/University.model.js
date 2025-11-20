const mongoose = require("mongoose");

const universitySchema = new mongoose.Schema(
  {
    // Basic University Information
    name: {
      type: String,
      required: [true, "University name is required"],
      trim: true,
      unique: true,
      maxlength: [200, "University name cannot exceed 200 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [500, "Description cannot exceed 500 characters"],
    },
    location: {
      type: String,
      required: [true, "Location is required"],
      enum: [
        "North America",
        "Europe",
        "Asia",
        "Australia",
        "Africa",
        "South America",
      ],
    },
    website: {
      type: String,
      trim: true,
      match: [/^https?:\/\/.+\..+/, "Please enter a valid website URL"],
    },
    logoUrl: {
      type: String,
      default: "/assets/default-university-logo.png",
    },

    // Posts System
    posts: [
      {
        content: {
          type: String,
          required: [true, "Post content is required"],
          trim: true,
          maxlength: [1000, "Post cannot exceed 1000 characters"],
        },
        author: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        authorName: {
          type: String,
          required: true,
        },
        createdAt: {
          type: Date,
          default: Date.now,
        },
        updatedAt: {
          type: Date,
          default: Date.now,
        },
        likes: [
          {
            user: {
              type: mongoose.Schema.Types.ObjectId,
              required: true,
            },
            likedAt: {
              type: Date,
              default: Date.now,
            },
          },
        ],
        comments: [
          {
            content: {
              type: String,
              required: true,
              trim: true,
              maxlength: [500, "Comment cannot exceed 500 characters"],
            },
            author: {
              type: mongoose.Schema.Types.ObjectId,
              required: true,
            },
            authorName: {
              type: String,
              required: true,
            },
            createdAt: {
              type: Date,
              default: Date.now,
            },
          },
        ],
      },
    ],

    // Institutional Structure
    faculties: [
      {
        name: {
          type: String,
          required: [true, "Faculty name is required"],
          trim: true,
        },
        description: {
          type: String,
          trim: true,
          maxlength: [300, "Faculty description cannot exceed 300 characters"],
        },
        dean: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "User",
        },
        courses: [
          {
            courseCode: {
              type: String,
              required: [true, "Course code is required"],
              trim: true,
              uppercase: true,
            },
            courseName: {
              type: String,
              required: [true, "Course name is required"],
              trim: true,
            },
            description: {
              type: String,
              trim: true,
            },
            credits: {
              type: Number,
              min: 1,
              max: 10,
              default: 3,
            },
            level: {
              type: Number,
              min: 1,
              max: 5,
              required: true,
            },
            teacher: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "User",
              required: true,
            },
            classrooms: [
              {
                name: {
                  type: String,
                  required: [true, "Classroom name is required"],
                  trim: true,
                },
                section: {
                  type: String,
                  trim: true,
                },
                schedule: {
                  day: {
                    type: String,
                    enum: [
                      "Monday",
                      "Tuesday",
                      "Wednesday",
                      "Thursday",
                      "Friday",
                      "Saturday",
                      "Sunday",
                    ],
                  },
                  time: String,
                  location: String,
                },
                students: [
                  {
                    student: {
                      type: mongoose.Schema.Types.ObjectId,
                      ref: "User",
                    },
                    joinedAt: {
                      type: Date,
                      default: Date.now,
                    },
                    status: {
                      type: String,
                      enum: ["active", "inactive", "suspended"],
                      default: "active",
                    },
                  },
                ],
                xp: {
                  type: Number,
                  default: 0,
                  min: 0,
                },
                level: {
                  type: Number,
                  default: 1,
                  min: 1,
                  max: 100,
                },
              },
            ],
          },
        ],
      },
    ],

    // University Members & Roles
    members: [
      {
        user: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        role: {
          type: String,
          enum: ["admin", "teacher", "student"],
          required: true,
        },
        joinedAt: {
          type: Date,
          default: Date.now,
        },
        xp: {
          type: Number,
          default: 0,
        },
        level: {
          type: Number,
          default: 1,
        },
        studentInfo: {
          enrollmentDate: Date,
          currentLevel: {
            type: Number,
            default: 1,
          },
        },
      },
    ],

    // University-wide XP and Level
    totalXP: {
      type: Number,
      default: 0,
      min: 0,
    },
    averageLevel: {
      type: Number,
      default: 1,
      min: 1,
      max: 100,
    },

    // University Settings & Configuration
    settings: {
      joinCode: {
        type: String,
        unique: true,
        sparse: true,
        uppercase: true,
        match: [
          /^[A-Z0-9]{8}$/,
          "Join code must be exactly 8 alphanumeric characters",
        ],
      },
      isPublic: {
        type: Boolean,
        default: false,
      },
      allowStudentRegistration: {
        type: Boolean,
        default: true,
      },
      maxMembers: {
        type: Number,
        default: 10000,
      },
      theme: {
        primaryColor: {
          type: String,
          default: "#4A90E2",
        },
        secondaryColor: {
          type: String,
          default: "#357ABD",
        },
      },
    },

    // Analytics & Statistics
    statistics: {
      totalQuizzes: {
        type: Number,
        default: 0,
      },
      totalAssignments: {
        type: Number,
        default: 0,
      },
      averagePerformance: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
      engagementRate: {
        type: Number,
        default: 0,
        min: 0,
        max: 100,
      },
    },

    // Timestamps
    createdAt: {
      type: Date,
      default: Date.now,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
universitySchema.index({ name: "text", description: "text" });
universitySchema.index({ location: 1 });
universitySchema.index({ "settings.joinCode": 1 }, { sparse: true });
universitySchema.index({ "members.user": 1 });
universitySchema.index({ "members.role": 1 });
universitySchema.index({ "posts.createdAt": -1 });

// Pre-save middleware to generate join code if not exists
universitySchema.pre("save", function (next) {
  if (!this.settings.joinCode) {
    this.settings.joinCode = this.generateJoinCode();
  }

  // Calculate average level
  if (this.members.length > 0) {
    const totalLevel = this.members.reduce(
      (sum, member) => sum + member.level,
      0
    );
    this.averageLevel = Math.round(totalLevel / this.members.length);
  }

  this.updatedAt = Date.now();
  next();
});

// Instance method to generate random join code
universitySchema.methods.generateJoinCode = function () {
  const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let result = "";
  for (let i = 0; i < 8; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
};

// Instance method to add member
universitySchema.methods.addMember = function (
  userId,
  role,
  additionalInfo = {}
) {
  const member = {
    user: userId,
    role: role,
    ...additionalInfo,
  };

  this.members.push(member);
  return this.save();
};

// Instance method to remove member
universitySchema.methods.removeMember = function (userId) {
  this.members = this.members.filter(
    (member) => member.user.toString() !== userId.toString()
  );
  return this.save();
};

// Instance method to check if user is member
universitySchema.methods.isMember = function (userId) {
  return this.members.some(
    (member) => member.user.toString() === userId.toString()
  );
};

// Instance method to get user's role
universitySchema.methods.getUserRole = function (userId) {
  const member = this.members.find(
    (member) => member.user.toString() === userId.toString()
  );
  return member ? member.role : null;
};

// Instance method to add XP to member
universitySchema.methods.addXP = function (userId, xpAmount) {
  const member = this.members.find(
    (member) => member.user.toString() === userId.toString()
  );

  if (member) {
    member.xp += xpAmount;
    // Simple level calculation: 1000 XP per level
    member.level = Math.floor(member.xp / 1000) + 1;
    this.totalXP += xpAmount;
    return this.save();
  }

  return Promise.reject(new Error("User not found in university"));
};

// Instance method to create a post
universitySchema.methods.createPost = function (authorId, authorName, content) {
  const post = {
    content: content,
    author: authorId,
    authorName: authorName,
    createdAt: new Date(),
    updatedAt: new Date(),
    likes: [],
    comments: [],
  };

  this.posts.unshift(post); // Add to beginning of array (newest first)
  return this.save();
};

// Instance method to add a comment to a post
universitySchema.methods.addCommentToPost = function (
  postId,
  authorId,
  authorName,
  content
) {
  const post = this.posts.id(postId);
  if (!post) {
    throw new Error("Post not found");
  }

  const comment = {
    content: content.trim(),
    author: authorId,
    authorName: authorName,
    createdAt: new Date(),
  };

  post.comments.push(comment);
  return this.save();
};

// Instance method to like a post
universitySchema.methods.likePost = function (postId, userId) {
  const post = this.posts.id(postId);
  if (!post) {
    throw new Error("Post not found");
  }

  // Check if user already liked the post
  const alreadyLiked = post.likes.some(
    (like) => like.user.toString() === userId.toString()
  );
  if (alreadyLiked) {
    // Unlike the post
    post.likes = post.likes.filter(
      (like) => like.user.toString() !== userId.toString()
    );
  } else {
    // Like the post
    post.likes.push({
      user: userId,
      likedAt: new Date(),
    });
  }

  return this.save();
};

// Static method to find by join code
universitySchema.statics.findByJoinCode = function (joinCode) {
  return this.findOne({ "settings.joinCode": joinCode.toUpperCase() });
};

// Static method to get universities by location
universitySchema.statics.findByLocation = function (location) {
  return this.find({ location: new RegExp(location, "i") });
};

// Virtual for member count
universitySchema.virtual("memberCount").get(function () {
  return this.members.length;
});

// Virtual for admin count
universitySchema.virtual("adminCount").get(function () {
  return this.members.filter((member) => member.role === "admin").length;
});

// Virtual for teacher count
universitySchema.virtual("teacherCount").get(function () {
  return this.members.filter((member) => member.role === "teacher").length;
});

// Virtual for student count
universitySchema.virtual("studentCount").get(function () {
  return this.members.filter((member) => member.role === "student").length;
});

// Transform output to include virtuals
universitySchema.set("toJSON", { virtuals: true });
universitySchema.set("toObject", { virtuals: true });

module.exports = mongoose.model("University", universitySchema);
