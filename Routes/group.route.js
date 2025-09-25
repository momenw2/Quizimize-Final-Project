const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Group = require("../Models/Group.model");
const { requireAuth, checkUser } = require("../middleware/authMiddleware"); // Adjust path as needed

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

// GET single group details - SIMPLIFIED VERSION
router.get("/:id", async (req, res, next) => {
  try {
    const groupId = req.params.id;
    console.log("Fetching group details for:", groupId);

    // Validate if the ID is a valid MongoDB ObjectId
    if (!mongoose.Types.ObjectId.isValid(groupId)) {
      return res.status(400).render("error", {
        message: "Invalid group ID",
        status: 400,
      });
    }

    // Don't populate the user field to avoid the error
    const group = await Group.findById(groupId);

    if (!group) {
      return res.status(404).render("error", {
        message: "Group not found",
        status: 404,
      });
    }

    console.log("Group found:", group.name);
    res.render("group-details", {
      group: group,
    });
  } catch (err) {
    console.error("Error fetching group details:", err);
    res.status(500).render("error", {
      message: "Internal server error",
      status: 500,
    });
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

module.exports = router;
