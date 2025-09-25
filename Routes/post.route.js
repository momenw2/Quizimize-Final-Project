const express = require("express");
const mongoose = require("mongoose");
const Post = require("../Models/Post.model");
const Group = require("../Models/Group.model");
const { requireAuth, checkUser } = require("../middleware/authMiddleware");

const router = express.Router();

// ✅ Create Post
router.post("/:groupId", requireAuth, async (req, res) => {
  try {
    const { groupId } = req.params;
    const { content } = req.body;
    const currentUser = res.locals.user;

    const group = await Group.findById(groupId);
    if (!group) return res.status(404).json({ error: "Group not found" });

    if (
      !group.members.some(
        (m) => m.user.toString() === currentUser._id.toString()
      )
    ) {
      return res
        .status(403)
        .json({ error: "You are not a member of this group" });
    }

    const post = await Post.create({
      group: groupId,
      user: currentUser._id,
      content,
    });

    res.status(201).json(post);
  } catch (err) {
    console.error("Error creating post:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Get all posts for a group
router.get("/:groupId", requireAuth, async (req, res) => {
  try {
    const { groupId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).json({ error: "Invalid group ID" });
    }

    const posts = await Post.find({ group: groupId })
      .populate("user", "fullName email")
      .populate("comments.user", "fullName email")
      .sort({ createdAt: -1 });

    const postsWithVotes = posts.map((post) => {
      const upvotes = post.votes.filter((v) => v.value === 1).length;
      const downvotes = post.votes.filter((v) => v.value === -1).length;
      return {
        ...post.toObject(),
        upvotes,
        downvotes,
        voteCount: upvotes - downvotes,
      };
    });

    res.json(postsWithVotes);
  } catch (err) {
    console.error("Error fetching posts:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Vote on a post
router.post("/:postId/vote", requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { value } = req.body;
    const currentUser = res.locals.user;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    post.votes = post.votes.filter(
      (v) => v.user.toString() !== currentUser._id.toString()
    );
    post.votes.push({ user: currentUser._id, value });

    await post.save();

    const upvotes = post.votes.filter((v) => v.value === 1).length;
    const downvotes = post.votes.filter((v) => v.value === -1).length;

    res.json({ post, upvotes, downvotes, voteCount: upvotes - downvotes });
  } catch (err) {
    console.error("Error voting:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

// ✅ Comment on a post
router.post("/:postId/comment", requireAuth, async (req, res) => {
  try {
    const { postId } = req.params;
    const { text } = req.body;
    const currentUser = res.locals.user;

    const post = await Post.findById(postId);
    if (!post) return res.status(404).json({ error: "Post not found" });

    post.comments.push({ user: currentUser._id, text });
    await post.save();

    const populated = await post.populate("comments.user", "fullName email");
    res.json(populated.comments);
  } catch (err) {
    console.error("Error adding comment:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

module.exports = router;
