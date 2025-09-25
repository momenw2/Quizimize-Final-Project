const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { requireAuth, checkUser } = require("./middleware/authMiddleware");

// const path = require("path"); // Import the path module

const app = express();
app.use(express.static("public"));
app.set("view engine", "ejs");
app.use(express.json());
app.use(cookieParser());

// app.use(cors());
// app.use(cors({ origin: "http://localhost:5500", credentials: true }));
// app.use(express.json());
// app.use(cookieParser());
// app.use(express.static(path.join(__dirname, "../frontend")));

mongoose.connect("mongodb://localhost:27017/Quizimize").then(() => {
  console.log("Mongodb connected....");
});

app.get("*", checkUser);

app.get("/", (req, res) => res.render("home"));
app.get("/login", (req, res) => res.render("loginPage"));
app.get("/signup", (req, res) => res.render("signupPage"));
app.get("/topics", (req, res) => res.render("topicsPage"));
app.get("/subjects", requireAuth, (req, res) => res.render("subject"));
app.get("/quizTopics", (req, res) => res.render("quiztopic"));
app.get("/quizLists", (req, res) => res.render("quizList"));
app.get("/quizPages", (req, res) => res.render("quizPage"));
app.get("/resultPage", (req, res) => res.render("resultPage"));
app.get("/profilePage", (req, res) => res.render("profilePage"));
app.get("/editProfile", (req, res) => res.render("editProfilePage"));
app.get("/aboutUs", (req, res) => res.render("aboutUs"));

// ####### Group Pages #######
app.get("/groups", (req, res) => res.render("groups"));
app.get("/group-detailed", (req, res) => res.render("group-detailed"));

// ##### Admin Pages #####
app.get("/adminDashboard", (req, res) => res.render("adminDashboardPage"));
app.get("/adminSubject", (req, res) => res.render("adminSubjectPage"));
app.get("/adminQuizTopic", (req, res) => res.render("adminQuizTopicPage"));
app.get("/adminQuizList", (req, res) => res.render("adminQuizListPage"));
app.get("/adminQuiz", (req, res) => res.render("adminQuizPage"));

// ## Routes ##

// Topic Router
const topicRoute = require("./Routes/topic.route");
app.use("/topic", topicRoute);

// Subject Router
const subjectRoute = require("./Routes/subject.route");
app.use("/subject", subjectRoute);

// Quiz Topic Router
const quizTopic = require("./Routes/quizTopic.route");
app.use("/quizTopic", quizTopic);

// Quiz List Router
const quizList = require("./Routes/quizList.route");
app.use("/quizList", quizList);

// Quiz Page Router
const quizPage = require("./Routes/quizPage.route");
app.use("/quizPage", quizPage);

// User  Router
const authRoutes = require("./Routes/auth-route");
app.use("/user", authRoutes);
// app.use(authRoutes);

// Group Router
const groupRoute = require("./Routes/group.route");
app.use("/groups", groupRoute);

// Post Router
const postRoute = require("./Routes/post.route");
app.use("/post", postRoute);

//Error Handler
app.use((req, res, next) => {
  const err = new Error("Not found");
  err.status = 404;
  next(err);
});

app.use((err, req, res, next) => {
  res.status(err.status || 500);
  res.send({
    error: {
      status: err.status || 500,
      message: err.message,
    },
  });
});

app.listen(3000, () => {
  console.log("server started on port 3000.....");
});
