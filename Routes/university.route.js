const express = require("express");
const router = express.Router();
const University = require("../Models/University.model");

// Remove 'auth' from these routes temporarily:
router.get("/", async (req, res) => {
  try {
    res.render("universities", {
      user: req.user || { _id: "test-user-id", fullName: "Test User" },
    });
  } catch (error) {
    res
      .status(500)
      .render("error", { error: "Failed to load universities page" });
  }
});

router.get("/api", async (req, res) => {
  try {
    const universities = await University.find({})
      .populate("members.user", "fullName email")
      .sort({ createdAt: -1 });
    res.json(universities);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch universities" });
  }
});

router.post("/", async (req, res) => {
  try {
    const { name, location, website, description } = req.body;

    const university = new University({
      name,
      location,
      website: website || undefined,
      description: description || undefined,
    });

    await university.save();

    res.status(201).json({
      message: "University registered successfully!",
      university: university,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to create university" });
  }
});

router.post("/:id/join", async (req, res) => {
  try {
    const university = await University.findById(req.params.id);

    if (!university) {
      return res.status(404).json({ error: "University not found" });
    }

    // For testing - use a test user ID
    const testUserId = "65d8a1b5c8b9e7f4a2c3d4e5";

    if (university.isMember(testUserId)) {
      return res.status(400).json({ error: "Already a member" });
    }

    await university.addMember(testUserId, "student", {
      studentInfo: {
        enrollmentDate: new Date(),
        currentLevel: 1,
      },
    });

    res.json({
      message: `Successfully joined ${university.name}!`,
    });
  } catch (error) {
    res.status(500).json({ error: "Failed to join university" });
  }
});

module.exports = router;
