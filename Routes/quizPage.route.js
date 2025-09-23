const express = require("express");
const router = express.Router();
const QuizPage = require("../Models/QuizPage.model");

router.get("/", async (req, res) => {
  try {
    const result = await QuizPage.find();
    res.send(result);
  } catch (error) {
    console.log(error.message);
  }
});

router.post("/", async (req, res) => {
  try {
    const quizPage = new QuizPage(req.body);
    const result = await quizPage.save();
    res.send(result);
  } catch (error) {
    console.log(error.message);
  }
});

router.patch("/", async (req, res) => {
  const {
    selectedSubjectName,
    selectedTopicName,
    selectedCardTitle,
    clickedCardName,
    newQuestion,
  } = req.body;

  try {
    let quizPage = await QuizPage.findOne({
      subject: selectedSubjectName,
      topic: clickedCardName,
      quizTopic: selectedTopicName,
    });

    if (!quizPage) {
      // If the quiz page does not exist, create a new one
      quizPage = new QuizPage({
        subject: selectedSubjectName,
        topic: clickedCardName,
        quizTopic: selectedTopicName,
        quizPage: [
          {
            quizList: selectedCardTitle,
            quiz: [newQuestion],
          },
        ],
      });
    } else {
      // If the quiz page exists, find the appropriate quiz list
      let quizList = quizPage.quizPage.find(
        (quizList) => quizList.quizList === selectedCardTitle
      );
      if (!quizList) {
        // If the quiz list does not exist, create a new one
        quizList = {
          quizList: selectedCardTitle,
          quiz: [newQuestion],
        };
        quizPage.quizPage.push(quizList);
      } else {
        // If the quiz list exists, add the new question to it
        quizList.quiz.push(newQuestion);
      }
    }

    // Save the changes
    const result = await quizPage.save();
    res.send(result);
  } catch (error) {
    console.log(error.message);
    res.status(500).send("Server Error");
  }
});

router.delete(
  "/:subject/:clickedCardName/:topic/:quizList/:index",
  async (req, res) => {
    const { subject, clickedCardName, topic, quizList, index } = req.params;

    try {
      let quizPage = await QuizPage.findOne({
        subject,
        topic: clickedCardName,
        quizTopic: topic,
      });

      if (!quizPage) {
        return res.status(404).json({ msg: "Quiz not found" });
      }

      const selectedQuizListIndex = quizPage.quizPage.findIndex(
        (list) => list.quizList === quizList
      );

      if (selectedQuizListIndex === -1) {
        return res.status(404).json({ msg: "Quiz list not found" });
      }

      quizPage.quizPage[selectedQuizListIndex].quiz.splice(index, 1);
      await quizPage.save();
      res.json({ msg: "Quiz deleted successfully" });
    } catch (error) {
      console.error(error.message);
      res.status(500).send("Server Error");
    }
  }
);

router.patch("/update/:index", async (req, res) => {
  const {
    selectedSubjectName,
    selectedTopicName,
    selectedCardTitle,
    clickedCardName,
    updatedQuestion,
  } = req.body;
  const { index } = req.params;

  try {
    let quizPage = await QuizPage.findOne({
      subject: selectedSubjectName,
      topic: clickedCardName,
      quizTopic: selectedTopicName,
    });

    if (!quizPage) {
      return res.status(404).json({ msg: "Quiz not found" });
    }

    const selectedQuizListIndex = quizPage.quizPage.findIndex(
      (list) => list.quizList === selectedCardTitle
    );

    if (selectedQuizListIndex === -1) {
      return res.status(404).json({ msg: "Quiz list not found" });
    }

    quizPage.quizPage[selectedQuizListIndex].quiz[index] = updatedQuestion;
    await quizPage.save();
    res.json({ msg: "Quiz updated successfully" });
  } catch (error) {
    console.error(error.message);
    res.status(500).send("Server Error");
  }
});

module.exports = router;
