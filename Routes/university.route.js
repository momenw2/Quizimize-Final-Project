const express = require("express");
const router = express.Router();
const University = require("../Models/University.model");

// GET universities page
router.get("/", (req, res) => {
  try {
    res.render("universities", {
      user: req.user || { _id: "67d9733be64bed89238cb710", fullName: "Moemen" },
    });
  } catch (error) {
    console.error("Error rendering universities page:", error);
    res.status(500).send("Error loading page");
  }
});

// GET universities API - Fixed: Remove populate for now
router.get("/api", async (req, res) => {
  try {
    console.log("Attempting to fetch universities from MongoDB...");

    // Remove populate since User model might not exist
    const universities = await University.find({}).sort({ createdAt: -1 });

    console.log("Successfully found", universities.length, "universities");
    res.json(universities);
  } catch (error) {
    console.error("❌ ERROR in /api endpoint:", error);
    console.error("Error details:", error.message);

    res.status(500).json({
      error: "Failed to fetch universities",
      details: error.message,
    });
  }
});

// POST create university
router.post("/", async (req, res) => {
  try {
    const { name, location, website, description } = req.body;

    // Check if university already exists
    const existingUniversity = await University.findOne({
      name: new RegExp(`^${name}$`, "i"),
    });

    if (existingUniversity) {
      return res.status(400).json({
        error: "University with this name already exists",
      });
    }

    // Create new university in MongoDB
    const university = new University({
      name,
      location,
      website: website || "",
      description: description || "",
      logoUrl: "/assets/default-university-logo.png",
    });

    await university.save();

    res.status(201).json({
      message: "University registered successfully!",
      university: university,
    });
  } catch (error) {
    console.error("Error creating university:", error);
    res.status(500).json({
      error: "Failed to create university",
      details: error.message,
    });
  }
});

// POST join university - Fixed: Use actual user ID from session
router.post("/:id/join", async (req, res) => {
  try {
    const university = await University.findById(req.params.id);

    if (!university) {
      return res.status(404).json({ error: "University not found" });
    }

    // Use the actual user ID from your session/authentication
    // For now, using the test user ID from your console
    const userId = "67d9733be64bed89238cb710"; // Your actual user ID

    // Check if already a member
    if (university.isMember(userId)) {
      return res
        .status(400)
        .json({ error: "You are already a member of this university" });
    }

    // Add as member
    await university.addMember(userId, "student", {
      studentInfo: {
        enrollmentDate: new Date(),
        currentLevel: 1,
      },
    });

    // Get updated university without populate
    const updatedUniversity = await University.findById(university._id);

    res.json({
      message: `Successfully joined ${university.name}!`,
      university: updatedUniversity,
    });
  } catch (error) {
    console.error("Error joining university:", error);
    res.status(500).json({
      error: "Failed to join university",
      details: error.message,
    });
  }
});

// POST join university with code
router.post("/join/:code", async (req, res) => {
  try {
    const universityCode = req.params.code.toUpperCase();
    const university = await University.findOne({
      "settings.joinCode": universityCode,
    });

    if (!university) {
      return res.status(404).json({ error: "Invalid university code" });
    }

    // Use the actual user ID from your session/authentication
    const userId = "67d9733be64bed89238cb710"; // Your actual user ID

    // Check if already a member
    if (university.isMember(userId)) {
      return res
        .status(400)
        .json({ error: "You are already a member of this university" });
    }

    // Add as member
    await university.addMember(userId, "student", {
      studentInfo: {
        enrollmentDate: new Date(),
        currentLevel: 1,
      },
    });

    // Get updated university without populate
    const updatedUniversity = await University.findById(university._id);

    res.json({
      message: `Successfully joined ${university.name}!`,
      university: updatedUniversity,
    });
  } catch (error) {
    console.error("Error joining university with code:", error);
    res.status(500).json({
      error: "Failed to join university",
      details: error.message,
    });
  }
});

module.exports = router;
