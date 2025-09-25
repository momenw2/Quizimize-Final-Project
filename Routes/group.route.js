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
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Post content is required" });
    }

    const post = new Post({
      content,
      author: res.locals.user._id,
      groupId: req.params.id,
    });

    await post.save();
    await post.populate("author", "fullName level");

    // Emit to all group members
    io.to(req.params.id).emit("new-post", post);

    res.status(201).json(post);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST add comment to a post
router.post("/posts/:postId/comments", requireAuth, async (req, res) => {
  try {
    const { content } = req.body;

    if (!content) {
      return res.status(400).json({ error: "Comment content is required" });
    }

    const comment = new Comment({
      content,
      author: res.locals.user._id,
      postId: req.params.postId,
    });

    await comment.save();
    await comment.populate("author", "fullName level");

    // Add comment to post
    await Post.findByIdAndUpdate(req.params.postId, {
      $push: { comments: comment._id },
    });

    // Get the post to get groupId for socket emission
    const post = await Post.findById(req.params.postId);
    io.to(post.groupId.toString()).emit("new-comment", {
      comment,
      postId: req.params.postId,
    });

    res.status(201).json(comment);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST vote on a post
router.post("/posts/:postId/vote", requireAuth, async (req, res) => {
  try {
    const { voteType } = req.body; // 'up' or 'down'
    const userId = res.locals.user._id;
    const postId = req.params.postId;

    const post = await Post.findById(postId);

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    // Check if user already voted
    const existingVote = post.voters.find(
      (v) => v.userId.toString() === userId.toString()
    );

    if (existingVote) {
      // Remove existing vote
      post.voters = post.voters.filter(
        (v) => v.userId.toString() !== userId.toString()
      );
      post.votes -= existingVote.voteType === "up" ? 1 : -1;
    }

    // Add new vote
    if (!existingVote || existingVote.voteType !== voteType) {
      post.voters.push({ userId, voteType });
      post.votes += voteType === "up" ? 1 : -1;
    }

    await post.save();

    // Emit vote update
    io.to(post.groupId.toString()).emit("vote-update", {
      postId,
      votes: post.votes,
    });

    res.json({ votes: post.votes });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
