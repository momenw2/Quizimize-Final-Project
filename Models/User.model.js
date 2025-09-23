const mongoose = require("mongoose");
const { isEmail } = require("validator");
const bcrypt = require("bcrypt");
const Schema = mongoose.Schema;

const userSchema = new Schema({
  email: {
    type: String,
    required: [true, "Plaese enter an email"],
    unique: true,
    lowercase: true,
    validate: [isEmail, "Please eneter a valid email"],
  },
  password: {
    type: String,
    required: [true, "Please enter a password"],
    minlength: [6, "Minimum password length is 6 characters"],
  },
  fullName: {
    type: String,
    require: true,
  },
  xp: {
    type: Number,
    default: 0,
  },
  level: {
    type: Number,
    default: 1,
  },
  admin: {
    type: Boolean,
    default: false,
  },
  quizHistory: [
    {
      quizTopic: String,
      subject: String,
      quizList: String,
      score: Number,
      totalQuestions: Number,
      xp: Number,
      date: {
        type: String,
        default: () => new Date().toISOString().substr(0, 10), // Extracting only the date part
      },
    },
  ],
});

// //Fire a function befor doc saveed to DB
userSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    const salt = await bcrypt.genSalt();
    this.password = await bcrypt.hash(this.password, salt);
  }
  next();
});

// Static method to login user
userSchema.statics.login = async function (email, password) {
  const user = await this.findOne({ email });
  if (user) {
    const auth = await bcrypt.compare(password, user.password);
    if (auth) {
      return user;
    }
    throw Error("Incorrect password");
  }
  throw Error("Incorrect email");
};

const User = mongoose.model("user", userSchema);

module.exports = User;
