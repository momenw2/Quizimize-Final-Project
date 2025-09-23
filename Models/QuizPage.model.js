const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const quizPageSchema = new Schema({
  topic: {
    type: String,
    required: true,
  },
  subject: {
    type: String,
    required: true,
  },
  quizTopic: {
    type: String,
    required: true,
  },
  quizPage: [
    {
      quizList: String,
      quiz: [
        {
          question: String,
          choices: Array,
          answer: Number,
        },
      ],
    },
  ],
});

const QuizPage = mongoose.model("quizPage", quizPageSchema);

module.exports = QuizPage;
