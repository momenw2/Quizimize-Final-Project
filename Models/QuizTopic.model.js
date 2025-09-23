const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const quizTopicSchema = new Schema({
  subject: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  quizTopics: [
    {
      name: String,
      URL: String,
      total: Number,
      done: Number,
    },
  ],
});

const QuizTopic = mongoose.model("quizTopic", quizTopicSchema);

module.exports = QuizTopic;
