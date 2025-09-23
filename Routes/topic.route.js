const express = require("express");
const router = express.Router();
const Topic = require("../Models/Topic.model");

router.get("/", async (req, res, next) => {
  try {
    const result = await Topic.find();
    res.send(result);
  } catch (error) {
    console.log(error.message);
  }
});

// Add a new topic
router.post("/", async (req, res, next) => {
  try {
    const topic = new Topic(req.body);
    const result = await topic.save();
    res.send(result);
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Server Error");
  }
});

// PUT route to update a topic by name
router.put("/:name", async (req, res, next) => {
  try {
    const { name } = req.params;
    const { newName } = req.body; // Assuming you pass the new name in the request body

    const updatedTopic = await Topic.findOneAndUpdate(
      { name: name },
      { name: newName },
      { new: true }
    );

    if (!updatedTopic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    res.json(updatedTopic);
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

// DELETE route to delete a topic by name
router.delete("/:name", async (req, res, next) => {
  try {
    const { name } = req.params;

    const deletedTopic = await Topic.findOneAndDelete({ name: name });

    if (!deletedTopic) {
      return res.status(404).json({ message: "Topic not found" });
    }

    res.json({ message: "Topic deleted successfully" });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
