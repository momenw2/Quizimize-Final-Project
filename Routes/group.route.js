const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Group = require("../Models/Group.model");
const { requireAuth, checkUser } = require("../middleware/authMiddleware"); // Adjust path as needed
const Post = require("../Models/Post.model");
const Comment = require("../Models/Comment.model");
const { io } = require("../app"); // Import io from app.js
// Chat message model (you'll need to create this)
const ChatMessage = require("../Models/ChatMessage.model");
const Mission = require("../Models/Mission.model");

// Store online users for each group (in-memory, consider Redis for production)
const onlineUsers = new Map();

// GET groups page (just render the template - no data needed)
router.get("/", (req, res) => {
  res.render("groups", {
    user: res.locals.user,
  });
});

// API endpoint - return groups as JSON
router.get("/api", async (req, res, next) => {
  try {
    const groups = await Group.find();
    res.json(groups);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", async (req, res, next) => {
  try {
    const groupId = req.params.id;
    console.log("Received groupId:", groupId);

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      console.log("Invalid group ID");
      return res
        .status(400)
        .render("error", { message: "Invalid group ID", status: 400 });
    }

    const group = await Group.findById(groupId).populate(
      "members.user",
      "fullName level email"
    );
    console.log("Fetched group:", group);

    if (!group) {
      console.log("Group not found");
      return res
        .status(404)
        .render("error", { message: "Group not found", status: 404 });
    }

    // Check if current user is admin
    const currentUser = res.locals.user;
    const isAdmin = group.members.some(
      (member) =>
        member.user._id.toString() === currentUser._id.toString() &&
        member.role === "Admin"
    );

    res.render("group-details", {
      group,
      isAdmin,
      user: currentUser,
    });
  } catch (err) {
    console.error("Error fetching group details:", err);
    res
      .status(500)
      .render("error", { message: "Internal server error", status: 500 });
  }
});

// API endpoint for single group (optional, for AJAX requests)
router.get("/:id/api", async (req, res, next) => {
  try {
    const groupId = req.params.id;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

    const group = await Group.findById(groupId).populate(
      "members.user",
      "username email"
    );

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    res.json(group);
  } catch (err) {
    next(err);
  }
});

// Apply checkUser to all routes
router.use(checkUser);

// GET groups page (just render the template - no data needed)
router.get("/", requireAuth, (req, res) => {
  // Add requireAuth here
  res.render("groups");
});

// API endpoint - return groups as JSON
router.get("/api", requireAuth, async (req, res, next) => {
  // Add requireAuth here
  try {
    const groups = await Group.find();
    res.json(groups);
  } catch (err) {
    next(err);
  }
});

// POST create a group - PROTECT THIS ROUTE
router.post("/", requireAuth, async (req, res, next) => {
  // Add requireAuth here
  try {
    const { name, specialization } = req.body;

    // Validate input
    if (!name || !specialization) {
      return res
        .status(400)
        .json({ error: "Name and specialization are required" });
    }

    // Get the current user from res.locals
    const currentUser = res.locals.user;

    if (!currentUser) {
      return res
        .status(401)
        .json({ error: "You must be logged in to create a group" });
    }

    const newGroup = await Group.create({
      name,
      specialization,
      members: [
        {
          user: currentUser._id, // Use the actual logged-in user's ID
          role: "Admin",
        },
      ],
    });

    // Check if it's an AJAX request
    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.json({ success: true, group: newGroup });
    } else {
      // Regular form submission
      res.redirect("/groups");
    }
  } catch (err) {
    console.error("Error creating group:", err);

    if (err.code === 11000) {
      // MongoDB duplicate key error
      if (req.xhr || req.headers.accept.indexOf("json") > -1) {
        return res.status(400).json({ error: "Group name already exists" });
      }
    }

    next(err);
  }
});

// GET posts for a group
router.get("/:id/posts", requireAuth, async (req, res) => {
  try {
    const posts = await Post.find({ groupId: req.params.id })
      .populate("author", "fullName level")
      .populate({
        path: "comments",
        populate: { path: "author", select: "fullName level" },
      })
      .sort({ createdAt: -1 });

    res.json(posts);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST create a new post (with XP reward)
router.post("/:id/posts", requireAuth, async (req, res) => {
  try {
    console.log("=== POST CREATION STARTED ===");
    console.log("Request body:", req.body);
    console.log("Group ID:", req.params.id);
    console.log("User ID:", res.locals.user._id);

    const { content } = req.body;

    if (!content) {
      console.log("No content provided");
      return res.status(400).json({ error: "Post content is required" });
    }

    // Validate group ID
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      console.log("Invalid group ID");
      return res.status(400).json({ error: "Invalid group ID" });
    }

    // Check if group exists
    const group = await Group.findById(req.params.id);
    if (!group) {
      console.log("Group not found");
      return res.status(404).json({ error: "Group not found" });
    }

    console.log("Creating new post...");
    const post = new Post({
      content,
      author: res.locals.user._id,
      groupId: req.params.id,
    });

    console.log("Post object before save:", post);
    await post.save();
    console.log("Post saved successfully");

    // Populate the author info
    await post.populate("author", "fullName level");
    console.log("Post populated:", post);

    // Add XP reward for post creation (15 XP)
    const xpResult = await group.addXp(15, "post_creation", {
      postId: post._id,
      author: res.locals.user._id,
      authorName: res.locals.user.fullName,
    });

    console.log("XP added for post creation:", xpResult);

    // Emit to all group members
    if (io) {
      io.to(req.params.id).emit("new-post", post);

      // Emit XP update
      io.to(req.params.id).emit("group-xp-updated", {
        level: group.level,
        xp: group.xp,
        totalXp: group.totalXp,
        requiredXp: group.requiredXp,
        recentXp: {
          amount: 15,
          source: "Post Created",
          user: res.locals.user.fullName,
        },
      });

      if (xpResult.leveledUp) {
        io.to(req.params.id).emit("group-level-up", {
          level: group.level,
          xp: group.xp,
          totalXp: group.totalXp,
          requiredXp: group.requiredXp,
        });
      }
    }

    console.log("=== POST CREATION COMPLETED ===");
    res.status(201).json(post);
  } catch (error) {
    console.error("=== POST CREATION ERROR ===");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("=== END ERROR ===");

    res.status(500).json({ error: error.message });
  }
});

// POST add comment to a post (with XP reward)
router.post("/posts/:postId/comments", requireAuth, async (req, res) => {
  try {
    console.log("=== COMMENT CREATION STARTED ===");
    console.log("Request body:", req.body);
    console.log("Post ID:", req.params.postId);
    console.log("User ID:", res.locals.user._id);

    const { content } = req.body;

    if (!content) {
      console.log("No comment content provided");
      return res.status(400).json({ error: "Comment content is required" });
    }

    // Validate post ID
    if (!mongoose.Types.ObjectId.isValid(req.params.postId)) {
      console.log("Invalid post ID");
      return res.status(400).json({ error: "Invalid post ID" });
    }

    // Check if post exists
    const post = await Post.findById(req.params.postId);
    if (!post) {
      console.log("Post not found");
      return res.status(404).json({ error: "Post not found" });
    }

    console.log("Creating new comment...");
    const comment = new Comment({
      content,
      author: res.locals.user._id,
      postId: req.params.postId,
    });

    console.log("Comment object before save:", comment);
    await comment.save();
    console.log("Comment saved successfully");

    // Populate the author info
    await comment.populate("author", "fullName level");
    console.log("Comment populated:", comment);

    // Add comment to post
    await Post.findByIdAndUpdate(req.params.postId, {
      $push: { comments: comment._id },
    });
    console.log("Comment added to post");

    // Add XP reward for comment creation (10 XP)
    const group = await Group.findById(post.groupId);
    if (group) {
      const xpResult = await group.addXp(10, "comment_creation", {
        commentId: comment._id,
        postId: post._id,
        author: res.locals.user._id,
        authorName: res.locals.user.fullName,
      });

      console.log("XP added for comment creation:", xpResult);

      // Emit XP update
      if (io) {
        io.to(post.groupId.toString()).emit("group-xp-updated", {
          level: group.level,
          xp: group.xp,
          totalXp: group.totalXp,
          requiredXp: group.requiredXp,
          recentXp: {
            amount: 10,
            source: "Comment Created",
            user: res.locals.user.fullName,
          },
        });

        if (xpResult.leveledUp) {
          io.to(post.groupId.toString()).emit("group-level-up", {
            level: group.level,
            xp: group.xp,
            totalXp: group.totalXp,
            requiredXp: group.requiredXp,
          });
        }
      }
    }

    // Emit to all group members
    if (io) {
      io.to(post.groupId.toString()).emit("new-comment", {
        comment,
        postId: req.params.postId,
      });
      console.log("Socket event emitted for new comment");
    }

    console.log("=== COMMENT CREATION COMPLETED ===");
    res.status(201).json(comment);
  } catch (error) {
    console.error("=== COMMENT CREATION ERROR ===");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("=== END ERROR ===");

    res.status(500).json({ error: error.message });
  }
});

// POST vote on a post (with XP reward)
router.post("/posts/:postId/vote", requireAuth, async (req, res) => {
  try {
    console.log("=== VOTE PROCESSING STARTED ===");
    console.log("Request body:", req.body);
    console.log("Post ID:", req.params.postId);
    console.log("User ID:", res.locals.user._id);

    const { voteType } = req.body; // 'up' or 'down'
    const userId = res.locals.user._id;
    const postId = req.params.postId;

    if (!voteType || !["up", "down"].includes(voteType)) {
      console.log("Invalid vote type:", voteType);
      return res
        .status(400)
        .json({ error: "Vote type must be 'up' or 'down'" });
    }

    // Validate post ID
    if (!mongoose.Types.ObjectId.isValid(postId)) {
      console.log("Invalid post ID");
      return res.status(400).json({ error: "Invalid post ID" });
    }

    const post = await Post.findById(postId);

    if (!post) {
      console.log("Post not found");
      return res.status(404).json({ error: "Post not found" });
    }

    console.log("Current post votes:", post.votes);
    console.log("Current voters:", post.voters);

    // Check if user already voted
    const existingVoteIndex = post.voters.findIndex(
      (v) => v.userId && v.userId.toString() === userId.toString()
    );

    let voteChange = 0;
    let xpToAdd = 0;

    if (existingVoteIndex !== -1) {
      const existingVote = post.voters[existingVoteIndex];
      console.log("Existing vote found:", existingVote);

      // Remove existing vote
      post.voters.splice(existingVoteIndex, 1);
      voteChange -= existingVote.voteType === "up" ? 1 : -1;
      console.log("Removed existing vote, vote change:", voteChange);
    }

    // Add new vote if different from existing or no existing vote
    if (
      existingVoteIndex === -1 ||
      post.voters[existingVoteIndex]?.voteType !== voteType
    ) {
      post.voters.push({ userId, voteType });
      voteChange += voteType === "up" ? 1 : -1;
      console.log("Added new vote, vote change:", voteChange);

      // Add XP only for new upvotes
      if (voteType === "up") {
        xpToAdd = 5;
      }
    }

    post.votes += voteChange;
    console.log("Final vote count:", post.votes);

    await post.save();
    console.log("Post saved with updated votes");

    // Add XP reward for upvote (5 XP)
    if (xpToAdd > 0) {
      const group = await Group.findById(post.groupId);
      if (group) {
        const xpResult = await group.addXp(xpToAdd, "upvote", {
          postId: post._id,
          voter: res.locals.user._id,
          voterName: res.locals.user.fullName,
        });

        console.log("XP added for upvote:", xpResult);

        // Emit XP update
        if (io) {
          io.to(post.groupId.toString()).emit("group-xp-updated", {
            level: group.level,
            xp: group.xp,
            totalXp: group.totalXp,
            requiredXp: group.requiredXp,
            recentXp: {
              amount: xpToAdd,
              source: "Upvote Given",
              user: res.locals.user.fullName,
            },
          });

          if (xpResult.leveledUp) {
            io.to(post.groupId.toString()).emit("group-level-up", {
              level: group.level,
              xp: group.xp,
              totalXp: group.totalXp,
              requiredXp: group.requiredXp,
            });
          }
        }
      }
    }

    // Emit vote update
    if (io) {
      io.to(post.groupId.toString()).emit("vote-update", {
        postId,
        votes: post.votes,
      });
      console.log("Socket event emitted for vote update");
    }

    console.log("=== VOTE PROCESSING COMPLETED ===");
    res.json({
      votes: post.votes,
      userVote: voteType,
    });
  } catch (error) {
    console.error("=== VOTE PROCESSING ERROR ===");
    console.error("Error message:", error.message);
    console.error("Error stack:", error.stack);
    console.error("=== END ERROR ===");

    res.status(500).json({ error: error.message });
  }
});

// POST join a group (with XP reward)
router.post("/:id/join", requireAuth, async (req, res) => {
  try {
    console.log("=== JOIN GROUP REQUEST ===");
    console.log("Group ID:", req.params.id);
    console.log("User ID:", res.locals.user._id);

    const groupId = req.params.id;
    const userId = res.locals.user._id;

    // Validate group ID
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if user is already a member
    const isAlreadyMember = group.members.some(
      (member) => member.user && member.user.toString() === userId.toString()
    );

    if (isAlreadyMember) {
      return res
        .status(400)
        .json({ error: "You are already a member of this group" });
    }

    // Add user as a member with default role
    group.members.push({
      user: userId,
      role: "Member",
    });

    await group.save();

    // Populate the updated members list
    await group.populate("members.user", "fullName level email");

    // Add XP reward for new member (25 XP)
    const xpResult = await group.addXp(25, "new_member", {
      newMemberId: userId,
      newMemberName: res.locals.user.fullName,
    });

    console.log("XP added for new member:", xpResult);

    // Emit socket event for real-time update
    if (io) {
      io.to(groupId).emit("member-joined", {
        groupId: groupId,
        newMember: {
          user: res.locals.user,
          role: "Member",
        },
        totalMembers: group.members.length,
      });

      // Emit XP update
      io.to(groupId).emit("group-xp-updated", {
        level: group.level,
        xp: group.xp,
        totalXp: group.totalXp,
        requiredXp: group.requiredXp,
        recentXp: {
          amount: 25,
          source: "New Member Joined",
          user: res.locals.user.fullName,
        },
      });

      if (xpResult.leveledUp) {
        io.to(groupId).emit("group-level-up", {
          level: group.level,
          xp: group.xp,
          totalXp: group.totalXp,
          requiredXp: group.requiredXp,
        });
      }
    }

    console.log("User joined group successfully");
    res.json({
      success: true,
      message: "Successfully joined the group",
      group: group,
    });
  } catch (error) {
    console.error("Join group error:", error);
    res.status(500).json({ error: error.message });
  }
});

// Add this to your group.route.js (HTTP endpoint for chat history)
router.get("/:id/chat/history", requireAuth, async (req, res) => {
  try {
    const messages = await ChatMessage.find({ groupId: req.params.id })
      .sort({ createdAt: 1 })
      .limit(100);

    res.json(messages);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});
// Add these routes to your existing group.route.js file

// Dashboard route
router.get("/:id/dashboard", requireAuth, async (req, res) => {
  try {
    const groupId = req.params.id;
    const userId = res.locals.user._id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if user is admin
    const isAdmin = group.members.some(
      (member) =>
        member.user.toString() === userId.toString() && member.role === "Admin"
    );

    if (!isAdmin) {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    // Get dashboard data
    const totalPosts = await Post.countDocuments({ groupId });
    const weeklyPosts = await Post.countDocuments({
      groupId,
      createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });

    // Get all post IDs for this group to count comments
    const postIds = await Post.find({ groupId }).select("_id");
    const totalComments = await Comment.countDocuments({
      postId: { $in: postIds },
    });

    res.json({
      stats: {
        totalPosts,
        weeklyPosts,
        totalComments,
        totalMembers: group.members.length,
      },
      members: group.members,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get members for admin management
router.get("/:id/members", requireAuth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id).populate(
      "members.user",
      "fullName level email"
    );

    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if user is admin
    const isAdmin = group.members.some(
      (member) =>
        member.user._id.toString() === res.locals.user._id.toString() &&
        member.role === "Admin"
    );

    if (!isAdmin) {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    // Add joinedAt date to each member
    const membersWithJoinDate = group.members.map((member) => ({
      ...member.toObject(),
      joinedAt: member._id.getTimestamp(), // Use the ObjectId timestamp as join date
    }));

    res.json(membersWithJoinDate);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update member role
router.put("/:groupId/members/:userId/role", requireAuth, async (req, res) => {
  try {
    const { groupId, userId } = req.params;
    const { role } = req.body;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if requester is admin
    const isAdmin = group.members.some(
      (member) =>
        member.user.toString() === res.locals.user._id.toString() &&
        member.role === "Admin"
    );

    if (!isAdmin) {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    // Update member role
    const memberIndex = group.members.findIndex(
      (member) => member.user.toString() === userId
    );

    if (memberIndex === -1) {
      return res.status(404).json({ error: "Member not found" });
    }

    group.members[memberIndex].role = role;
    await group.save();

    res.json({ success: true, message: "Member role updated" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Remove member from group
router.delete("/:groupId/members/:userId", requireAuth, async (req, res) => {
  try {
    const { groupId, userId } = req.params;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if requester is admin
    const isAdmin = group.members.some(
      (member) =>
        member.user.toString() === res.locals.user._id.toString() &&
        member.role === "Admin"
    );

    if (!isAdmin) {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    // Cannot remove yourself
    if (userId === res.locals.user._id.toString()) {
      return res
        .status(400)
        .json({ error: "Cannot remove yourself from the group" });
    }

    // Remove member
    group.members = group.members.filter(
      (member) => member.user.toString() !== userId
    );

    await group.save();

    res.json({ success: true, message: "Member removed from group" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Update group settings
router.put("/:id/settings", requireAuth, async (req, res) => {
  try {
    const groupId = req.params.id;
    const { name, specialization, description } = req.body; // Add description

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if user is admin
    const isAdmin = group.members.some(
      (member) =>
        member.user.toString() === res.locals.user._id.toString() &&
        member.role === "Admin"
    );

    if (!isAdmin) {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    // Update group settings
    if (name) group.name = name;
    if (specialization) group.specialization = specialization;
    if (description !== undefined) group.description = description; // Add this line

    await group.save();

    res.json({ success: true, message: "Group settings updated", group });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get content for admin management
router.get("/:id/dashboard/content", requireAuth, async (req, res) => {
  try {
    const groupId = req.params.id;
    const { sort = "newest" } = req.query;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if user is admin
    const isAdmin = group.members.some(
      (member) =>
        member.user.toString() === res.locals.user._id.toString() &&
        member.role === "Admin"
    );

    if (!isAdmin) {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    // Build sort object
    let sortOptions = {};
    switch (sort) {
      case "oldest":
        sortOptions = { createdAt: 1 };
        break;
      case "most-comments":
        sortOptions = { commentsCount: -1, createdAt: -1 };
        break;
      case "most-votes":
        sortOptions = { votes: -1, createdAt: -1 };
        break;
      default: // newest
        sortOptions = { createdAt: -1 };
    }

    // Get posts with comments populated
    const posts = await Post.find({ groupId })
      .populate("author", "fullName level")
      .populate({
        path: "comments",
        populate: { path: "author", select: "fullName level" },
        options: { sort: { createdAt: -1 } },
      })
      .sort(sortOptions);

    res.json({ posts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a post (admin only)
router.delete("/posts/:postId", requireAuth, async (req, res) => {
  try {
    const postId = req.params.postId;

    const post = await Post.findById(postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Check if user is admin of the group
    const group = await Group.findById(post.groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const isAdmin = group.members.some(
      (member) =>
        member.user.toString() === res.locals.user._id.toString() &&
        member.role === "Admin"
    );

    if (!isAdmin) {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    // Delete all comments associated with this post
    await Comment.deleteMany({ postId: postId });

    // Delete the post
    await Post.findByIdAndDelete(postId);

    // Emit socket event to notify clients
    if (io) {
      io.to(post.groupId.toString()).emit("post-deleted", { postId });
    }

    res.json({
      success: true,
      message: "Post and associated comments deleted",
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a comment (admin only)
router.delete("/comments/:commentId", requireAuth, async (req, res) => {
  try {
    const commentId = req.params.commentId;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }

    // Get the post to check group membership
    const post = await Post.findById(comment.postId);
    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Check if user is admin of the group
    const group = await Group.findById(post.groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    const isAdmin = group.members.some(
      (member) =>
        member.user.toString() === res.locals.user._id.toString() &&
        member.role === "Admin"
    );

    if (!isAdmin) {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    // Remove comment from post
    await Post.findByIdAndUpdate(comment.postId, {
      $pull: { comments: commentId },
    });

    // Delete the comment
    await Comment.findByIdAndDelete(commentId);

    // Emit socket event to notify clients
    if (io) {
      io.to(post.groupId.toString()).emit("comment-deleted", {
        commentId,
        postId: comment.postId,
      });
    }

    res.json({ success: true, message: "Comment deleted" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Mission Routes

// Get all missions for a group
router.get("/:id/missions", requireAuth, async (req, res) => {
  try {
    const groupId = req.params.id;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if user is member of the group
    const isMember = group.members.some(
      (member) => member.user.toString() === res.locals.user._id.toString()
    );

    if (!isMember) {
      return res
        .status(403)
        .json({ error: "Access denied. Group members only." });
    }

    const missions = await Mission.find({ groupId }).sort({ createdAt: -1 });

    res.json(missions);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Create a new mission
router.post("/:id/missions", requireAuth, async (req, res) => {
  try {
    const groupId = req.params.id;
    const { title, description, type, questions, points, deadline, duration } =
      req.body;

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if user is admin
    const isAdmin = group.members.some(
      (member) =>
        member.user.toString() === res.locals.user._id.toString() &&
        member.role === "Admin"
    );

    if (!isAdmin) {
      return res.status(403).json({ error: "Access denied. Admin only." });
    }

    // Validate required fields
    if (!title || !type || !duration) {
      return res
        .status(400)
        .json({ error: "Title, type, and duration are required" });
    }

    // Validate duration (1-7 days)
    if (duration < 1 || duration > 7) {
      return res
        .status(400)
        .json({ error: "Mission duration must be between 1 and 7 days" });
    }

    // Validate custom questions
    if (type === "custom") {
      if (!questions || questions.length === 0) {
        return res
          .status(400)
          .json({ error: "Custom missions require at least one question" });
      }

      // Validate minimum questions requirement (5 per day)
      const minQuestionsRequired = duration * 5;
      if (questions.length < minQuestionsRequired) {
        return res.status(400).json({
          error: `For a ${duration}-day mission, you need at least ${minQuestionsRequired} questions`,
        });
      }

      // Validate each question
      for (const question of questions) {
        if (
          !question.text ||
          !question.choices ||
          question.choices.length !== 4
        ) {
          return res.status(400).json({
            error: "Each question must have text and exactly 4 choices",
          });
        }

        if (question.choices.some((choice) => !choice.trim())) {
          return res.status(400).json({ error: "All choices must be filled" });
        }

        if (question.correctAnswer < 0 || question.correctAnswer > 3) {
          return res
            .status(400)
            .json({ error: "Invalid correct answer index" });
        }
      }
    }

    // For system questions, calculate points based on duration
    let calculatedPoints = points;
    if (type === "system") {
      calculatedPoints = duration * 5 * 50; // 5 questions per day * 50 points each
    }

    const mission = new Mission({
      title,
      description,
      type,
      duration,
      questions: type === "custom" ? questions : undefined,
      points: calculatedPoints,
      deadline: deadline ? new Date(deadline) : undefined,
      groupId,
      createdBy: res.locals.user._id,
      status: "active",
    });

    await mission.save();

    // Emit socket event for real-time update
    if (io) {
      io.to(groupId).emit("new-mission", mission);
    }

    res.status(201).json(mission);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Delete a mission
router.delete(
  "/:groupId/missions/:missionId",
  requireAuth,
  async (req, res) => {
    try {
      const { groupId, missionId } = req.params;

      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      // Check if user is admin
      const isAdmin = group.members.some(
        (member) =>
          member.user.toString() === res.locals.user._id.toString() &&
          member.role === "Admin"
      );

      if (!isAdmin) {
        return res.status(403).json({ error: "Access denied. Admin only." });
      }

      const mission = await Mission.findOne({ _id: missionId, groupId });
      if (!mission) {
        return res.status(404).json({ error: "Mission not found" });
      }

      await Mission.findByIdAndDelete(missionId);

      // Emit socket event for real-time update
      if (io) {
        io.to(groupId).emit("mission-deleted", { missionId });
      }

      res.json({ success: true, message: "Mission deleted successfully" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Join a mission
router.post(
  "/:groupId/missions/:missionId/join",
  requireAuth,
  async (req, res) => {
    try {
      const { groupId, missionId } = req.params;
      const userId = res.locals.user._id;

      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      // Check if user is member of the group
      const isMember = group.members.some(
        (member) => member.user.toString() === userId.toString()
      );

      if (!isMember) {
        return res
          .status(403)
          .json({ error: "Access denied. Group members only." });
      }

      const mission = await Mission.findOne({ _id: missionId, groupId });
      if (!mission) {
        return res.status(404).json({ error: "Mission not found" });
      }

      // Check if mission is active
      if (mission.status !== "active") {
        return res.status(400).json({ error: "Mission is not active" });
      }

      // Check if user already joined
      const alreadyJoined = mission.participants.some(
        (participant) => participant.user.toString() === userId.toString()
      );

      if (alreadyJoined) {
        return res.status(400).json({ error: "Already joined this mission" });
      }

      // Add user to participants
      mission.participants.push({
        user: userId,
        joinedAt: new Date(),
      });

      await mission.save();

      res.json({ success: true, message: "Successfully joined mission" });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get mission questions for a participant
router.get(
  "/:groupId/missions/:missionId/questions",
  requireAuth,
  async (req, res) => {
    try {
      const { groupId, missionId } = req.params;
      const userId = res.locals.user._id;

      const mission = await Mission.findOne({ _id: missionId, groupId });
      if (!mission) {
        return res.status(404).json({ error: "Mission not found" });
      }

      // Check if user has joined the mission
      const participant = mission.participants.find(
        (p) => p.user.toString() === userId.toString()
      );

      if (!participant) {
        return res
          .status(403)
          .json({ error: "You must join the mission first" });
      }

      // For system missions, generate questions based on duration
      let questions = [];
      if (mission.type === "system") {
        questions = await generateSystemQuestions(mission.duration);
      } else {
        questions = mission.questions;
      }

      // Return questions without correct answers
      const safeQuestions = questions.map((q, index) => ({
        index: index,
        text: q.text,
        choices: q.choices,
        explanation: q.explanation,
      }));

      res.json({
        questions: safeQuestions,
        currentQuestion: participant.currentQuestion,
        totalQuestions: safeQuestions.length,
        missionTitle: mission.title,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Submit answer to a question
router.post(
  "/:groupId/missions/:missionId/answer",
  requireAuth,
  async (req, res) => {
    try {
      const { groupId, missionId } = req.params;
      const userId = res.locals.user._id;
      const { questionIndex, selectedAnswer } = req.body;

      const mission = await Mission.findOne({ _id: missionId, groupId });
      if (!mission) {
        return res.status(404).json({ error: "Mission not found" });
      }

      // Check if user has joined the mission
      const participantIndex = mission.participants.findIndex(
        (p) => p.user.toString() === userId.toString()
      );

      if (participantIndex === -1) {
        return res
          .status(403)
          .json({ error: "You must join the mission first" });
      }

      const participant = mission.participants[participantIndex];

      // Get questions (system or custom)
      let questions = [];
      if (mission.type === "system") {
        questions = await generateSystemQuestions(mission.duration);
      } else {
        questions = mission.questions;
      }

      // Check if question exists
      if (questionIndex >= questions.length) {
        return res.status(400).json({ error: "Invalid question index" });
      }

      const question = questions[questionIndex];
      const isCorrect = selectedAnswer === question.correctAnswer;

      // Record answer
      participant.answers.push({
        questionIndex,
        selectedAnswer,
        isCorrect,
        answeredAt: new Date(),
      });

      // Update score
      if (isCorrect) {
        participant.score += Math.floor(mission.points / questions.length);
      }

      // Move to next question
      participant.currentQuestion = questionIndex + 1;

      // Check if mission is completed
      if (participant.currentQuestion >= questions.length) {
        participant.completed = true;

        // Update user points (you'll need to implement this in your User model)
        await updateUserPoints(userId, participant.score);
      }

      await mission.save();

      res.json({
        isCorrect,
        correctAnswer: question.correctAnswer,
        explanation: question.explanation,
        currentScore: participant.score,
        completed: participant.completed,
        nextQuestion:
          participant.currentQuestion < questions.length
            ? participant.currentQuestion
            : null,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Mission completion with XP reward (50% of mission points)
router.post(
  "/:groupId/missions/:missionId/complete",
  requireAuth,
  async (req, res) => {
    try {
      const { groupId, missionId } = req.params;
      const userId = res.locals.user._id;
      const { score, totalPoints } = req.body;

      const group = await Group.findById(groupId);
      if (!group) {
        return res.status(404).json({ error: "Group not found" });
      }

      // Calculate XP reward (50% of mission points)
      const xpReward = Math.floor(totalPoints * 0.5);

      // Add XP reward for mission completion
      const xpResult = await group.addXp(xpReward, "mission_completion", {
        missionId: missionId,
        userId: userId,
        userName: res.locals.user.fullName,
        missionScore: score,
        missionPoints: totalPoints,
        xpReward: xpReward,
      });

      console.log("XP added for mission completion:", xpResult);

      // Emit XP update
      if (io) {
        io.to(groupId).emit("group-xp-updated", {
          level: group.level,
          xp: group.xp,
          totalXp: group.totalXp,
          requiredXp: group.requiredXp,
          recentXp: {
            amount: xpReward,
            source: "Mission Completed",
            user: res.locals.user.fullName,
            missionPoints: totalPoints,
          },
        });

        if (xpResult.leveledUp) {
          io.to(groupId).emit("group-level-up", {
            level: group.level,
            xp: group.xp,
            totalXp: group.totalXp,
            requiredXp: group.requiredXp,
          });
        }
      }

      res.json({
        success: true,
        xpReward: xpReward,
        missionCompleted: true,
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Get mission progress
router.get(
  "/:groupId/missions/:missionId/progress",
  requireAuth,
  async (req, res) => {
    try {
      const { groupId, missionId } = req.params;
      const userId = res.locals.user._id;

      const mission = await Mission.findOne({ _id: missionId, groupId });
      if (!mission) {
        return res.status(404).json({ error: "Mission not found" });
      }

      const participant = mission.participants.find(
        (p) => p.user.toString() === userId.toString()
      );

      if (!participant) {
        return res
          .status(403)
          .json({ error: "You must join the mission first" });
      }

      res.json({
        progress: {
          currentQuestion: participant.currentQuestion,
          totalQuestions:
            mission.type === "system"
              ? mission.duration * 5
              : mission.questions.length,
          score: participant.score,
          completed: participant.completed,
          joinedAt: participant.joinedAt,
        },
        mission: {
          title: mission.title,
          points: mission.points,
          status: mission.status,
        },
      });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
);

// Helper function to generate system questions (you'll need to implement this based on your question bank)
async function generateSystemQuestions(duration) {
  // This should fetch questions from your system question bank
  // For now, returning mock questions
  const totalQuestions = duration * 5;
  const questions = [];

  for (let i = 0; i < totalQuestions; i++) {
    questions.push({
      text: `System Question ${i + 1}?`,
      choices: ["Choice A", "Choice B", "Choice C", "Choice D"],
      correctAnswer: Math.floor(Math.random() * 4),
      explanation: "This is the explanation for the correct answer.",
    });
  }

  return questions;
}

// Helper function to update user points (implement based on your User model)
async function updateUserPoints(userId, points) {
  // Update user's total points in your User model
  // Example: await User.findByIdAndUpdate(userId, { $inc: { points: points } });
  console.log(`Adding ${points} points to user ${userId}`);
}

// Add XP to group
router.post("/:id/add-xp", requireAuth, async (req, res) => {
  try {
    const groupId = req.params.id;
    const { amount } = req.body;

    if (!amount || amount <= 0) {
      return res.status(400).json({ error: "Valid XP amount is required" });
    }

    const group = await Group.findById(groupId);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    // Check if user is member of the group
    const isMember = group.members.some(
      (member) => member.user.toString() === res.locals.user._id.toString()
    );

    if (!isMember) {
      return res
        .status(403)
        .json({ error: "Access denied. Group members only." });
    }

    const result = await group.addXp(amount);

    // Emit socket event for real-time update
    if (io) {
      io.to(groupId).emit("group-xp-updated", {
        level: group.level,
        xp: group.xp,
        totalXp: group.totalXp,
        requiredXp: group.requiredXp,
      });

      if (result.leveledUp) {
        io.to(groupId).emit("group-level-up", {
          level: group.level,
          xp: group.xp,
          totalXp: group.totalXp,
          requiredXp: group.requiredXp,
        });
      }
    }

    res.json({
      level: group.level,
      xp: group.xp,
      totalXp: group.totalXp,
      requiredXp: group.requiredXp,
      leveledUp: result.leveledUp,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get group XP info
router.get("/:id/xp", requireAuth, async (req, res) => {
  try {
    const group = await Group.findById(req.params.id);
    if (!group) {
      return res.status(404).json({ error: "Group not found" });
    }

    res.json({
      level: group.level,
      xp: group.xp,
      totalXp: group.totalXp,
      requiredXp: group.requiredXp,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
