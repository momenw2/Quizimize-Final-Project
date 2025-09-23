const express = require("express");
const router = express.Router();
const QuizList = require("../Models/QuizList.model");

router.get("/", async (req, res) => {
  try {
    const result = await QuizList.find();
    res.send(result);
  } catch (error) {
    console.log(error.message);
  }
});

router.post("/", async (req, res) => {
  try {
    const quizList = new QuizList(req.body);
    const result = await quizList.save();
    res.send(result);
  } catch (error) {
    console.log(error.message);
  }
});

router.patch("/update/:quizTopic/:name", async (req, res) => {
  const { quizTopic, name } = req.params;
  const newQuiz = req.body;

  try {
    const updatedQuizList = await QuizList.findOneAndUpdate(
      { quizTopic, name },
      { $push: { quizlist: newQuiz } },
      { new: true }
    );
    res.send(updatedQuizList);
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
});

router.patch("/updateTitle/:quizTopic/:name/:index", async (req, res) => {
  try {
    const { quizTopic, name, index } = req.params;
    const { newTitle } = req.body;

    const updatedQuizList = await QuizList.findOneAndUpdate(
      { quizTopic, name },
      { $set: { [`quizlist.${index}.cardTitle`]: newTitle } },
      { new: true }
    );

    res.json(updatedQuizList);
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
});

router.delete("/delete/:quizTopic/:name/:quizId", async (req, res) => {
  try {
    const { quizTopic, name, quizId } = req.params;

    const updatedQuizList = await QuizList.findOneAndUpdate(
      { quizTopic, name },
      { $pull: { quizlist: { _id: quizId } } },
      { new: true }
    );

    res.json(updatedQuizList);
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Internal Server Error");
  }
});

module.exports = router;
