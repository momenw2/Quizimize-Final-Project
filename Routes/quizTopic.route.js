const express = require("express");
const router = express.Router();
const QuizTopic = require("../Models/QuizTopic.model");

router.get("/", async (req, res) => {
  try {
    const result = await QuizTopic.find();
    res.send(result);
  } catch (error) {
    console.log(error.message);
  }
});

router.post("/", async (req, res) => {
  try {
    const quizTopic = new QuizTopic(req.body);
    const result = await quizTopic.save();
    res.send(result);
  } catch (error) {
    console.log(error.message);
  }
});

// Add a new subject to an existing group
router.patch("/:groupSubject/:groupName", async (req, res) => {
  const groupSubject = req.params.groupSubject;
  const groupName = req.params.groupName;
  const { name, URL, total, done } = req.body;

  try {
    // Find the group in the database
    let group = await QuizTopic.findOne({
      subject: groupName,
      name: groupSubject,
    });

    if (!group) {
      console.log("Group not found. Creating new group...");
      // If the group doesn't exist, create a new one
      group = new QuizTopic({
        subject: groupName,
        name: groupSubject,
        quizTopics: [{ name, URL, total, done }],
      });
    } else {
      // Check if the subject already exists in the group
      const existingSubject = group.quizTopics.find(
        (topic) => topic.name.toLowerCase() === name.toLowerCase()
      );
      if (existingSubject) {
        console.log("Subject already exists in the group.");
        return res
          .status(400)
          .json({ message: "Subject already exists in the group" });
      }

      // Add the new subject to the subjects array of the group
      group.quizTopics.push({ name, URL, total, done });
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
    const updatedSubject = await QuizTopic.findOneAndUpdate(
      { "quizTopics.name": subjectName },
      { $set: { "quizTopics.$.name": newName } },
      { new: true }
    );

    if (!updatedSubject) {
      return res.status(404).json({ message: "Subject not found" });
    }

    res.json({
      message: "Subject updated successfully",
      quizTopic: updatedSubject,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

// Delete a quizTopic
router.delete("/:groupSubject/:topicName", async (req, res) => {
  const groupSubject = req.params.groupSubject;
  const topicName = req.params.topicName;

  try {
    const updatedGroup = await QuizTopic.findOneAndUpdate(
      { name: groupSubject },
      { $pull: { quizTopics: { name: topicName } } },
      { new: true }
    );

    if (!updatedGroup) {
      return res.status(404).json({ message: "Group not found" });
    }

    res.json({
      message: "Quiz topic deleted successfully",
      group: updatedGroup,
    });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
