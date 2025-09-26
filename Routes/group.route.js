const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Group = require("../Models/Group.model");
const { requireAuth, checkUser } = require("../middleware/authMiddleware"); // Adjust path as needed
const Post = require("../Models/Post.model");
const Comment = require("../Models/Comment.model");
const { io } = require("../app"); // Import io from app.js

// GET groups page (just render the template - no data needed)
router.get("/", (req, res) => {
  res.render("groups");
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

    res.render("group-details", { group });
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

// POST create a new post
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

    // Emit to all group members
    if (io) {
      io.to(req.params.id).emit("new-post", post);
      console.log("Socket event emitted");
    } else {
      console.log("Socket.io not available");
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

// POST add comment to a post
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

    // Emit to all group members
    if (io) {
      io.to(post.groupId.toString()).emit("new-comment", {
        comment,
        postId: req.params.postId,
      });
      console.log("Socket event emitted for new comment");
    } else {
      console.log("Socket.io not available for comment");
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

// POST vote on a post
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
    }

    post.votes += voteChange;
    console.log("Final vote count:", post.votes);

    await post.save();
    console.log("Post saved with updated votes");

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

// POST join a group
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

    // Emit socket event for real-time update (if needed)
    if (io) {
      io.to(groupId).emit("member-joined", {
        groupId: groupId,
        newMember: {
          user: res.locals.user,
          role: "Member",
        },
        totalMembers: group.members.length,
      });
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

module.exports = router;
