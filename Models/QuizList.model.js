const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const quizListSchema = new Schema({
  quizTopic: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  quizlist: [
    {
      cardTitle: String,
      cardDifficulty: String,
      Difficulty: String,
      cardBackground: String,
      URL: String,
      // status: Boolean,
    },
  ],
});

const QuizList = mongoose.model("quizList", quizListSchema);

module.exports = QuizList;
