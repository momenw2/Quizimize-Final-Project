// const express = require("express");
// const mongoose = require("mongoose");
// const router = express.Router();
// const Group = require("../Models/Group.model");

// // GET all groups (renders EJS)
// router.get("/", async (req, res, next) => {
//   try {
//     console.log("🚀 === GROUPS ROUTE START ===");
//     console.log("1. Route handler is executing");

//     // Test if we can access the Group model
//     console.log("2. Group model:", Group ? "✓ EXISTS" : "✗ UNDEFINED");

//     // Fetch groups from database
//     console.log("3. Fetching groups from database...");
//     const groups = await Group.find();
//     console.log("4. Database query successful");
//     console.log("5. Number of groups found:", groups.length);

//     // Test data as fallback
//     const testGroups = [
//       {
//         name: "Test Group 1",
//         specialization: "JavaScript",
//         level: 1,
//         members: [],
//       },
//       { name: "Test Group 2", specialization: "React", level: 2, members: [] },
//     ];

//     // Use actual data from database
//     const groupsToRender = groups.length > 0 ? groups : testGroups;

//     console.log("6. Groups to render:", groupsToRender.length);
//     console.log("7. Rendering EJS template...");

//     // Render the EJS template with explicit data
//     res.render("groups", {
//       groups: groupsToRender,
//     });

//     console.log("8. ✅ Render command sent successfully");
//     console.log("🎉 === GROUPS ROUTE END ===");
//   } catch (err) {
//     console.error("❌ ERROR in groups route:", err);

//     // Even on error, ensure groups variable is defined
//     res.render("groups", {
//       groups: [
//         { name: "Error Group", specialization: "Error", level: 1, members: [] },
//       ],
//     });
//   }
// });

// // Keep your API endpoint
// router.get("/api", async (req, res, next) => {
//   try {
//     const groups = await Group.find();
//     res.json(groups);
//   } catch (err) {
//     next(err);
//   }
// });

// module.exports = router;

const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Group = require("../Models/Group.model");

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

// POST create a group - handle both form submissions and AJAX
router.post("/", async (req, res, next) => {
  try {
    const { name, specialization } = req.body;

    // Validate input
    if (!name || !specialization) {
      return res
        .status(400)
        .json({ error: "Name and specialization are required" });
    }

    const newGroup = await Group.create({
      name,
      specialization,
      members: [{ user: new mongoose.Types.ObjectId(), role: "Admin" }],
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
