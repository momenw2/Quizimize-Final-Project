const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const subjectSchema = new Schema({
  name: {
    type: String,
    required: true,
  },
  subjects: [
    {
      name: String,
      URL: String,
    },
  ],
});

const Subject = mongoose.model("subject", subjectSchema);

module.exports = Subject;
