const express = require("express");
const router = express.Router();
const Subject = require("../Models/Subject.model");

// Retrieve all subjects
router.get("/", async (req, res) => {
  try {
    const result = await Subject.find();
    res.send(result);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

// Add a new subject
router.post("/", async (req, res) => {
  try {
    const subject = new Subject(req.body);
    const result = await subject.save();
    res.send(result);
  } catch (error) {
    console.error(error.message);
  }
});

// Add a new subject to an existing group
router.patch("/:groupName", async (req, res) => {
  const groupName = req.params.groupName;
  const { name, URL } = req.body;

  try {
    // Find the group in the database
    let group = await Subject.findOne({ name: groupName });

    if (!group) {
      // If the group doesn't exist, create a new one
      group = new Subject({
        name: groupName,
        subjects: [{ name, URL }],
      });
    } else {
      // Add the new subject to the subjects array of the group
      group.subjects.push({ name, URL });
    }

    // Save the group
    const result = await group.save();

    res
      .status(200)
      .json({ message: "Subject added successfully", group: result });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

// Update an existing subject
router.put("/:subjectName", async (req, res) => {
  const subjectName = req.params.subjectName;
  const { newName } = req.body;

  try {
    const updatedSubject = await Subject.findOneAndUpdate(
      { "subjects.name": subjectName },
      { $set: { "subjects.$.name": newName } },
      { new: true }
    );

    if (!updatedSubject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    res.json({
      message: "Subject updated successfully",
      subject: updatedSubject,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

// Delete an existing subject
router.delete("/:groupName/:subjectName", async (req, res) => {
  const groupName = req.params.groupName;
  const subjectName = req.params.subjectName;

  try {
    const result = await Subject.findOneAndUpdate(
      { name: groupName },
      { $pull: { subjects: { name: subjectName } } },
      { new: true }
    );

    if (!result) {
      return res.status(404).json({ message: "Group or subject not found" });
    }

    res.json({ message: "Subject deleted successfully", group: result });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
