const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { requireAuth, checkUser } = require("./middleware/authMiddleware");
const ChatMessage = require("./Models/ChatMessage.model"); // Add this import

// Create app first
const app = express();

// Then create HTTP server
const http = require("http").createServer(app);
const io = require("socket.io")(http);

// const path = require("path"); // Import the path module

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

// ####### univeristy Pages #######
app.get("/university", (req, res) => res.render("university"));
app.get("/universityDetail", (req, res) => res.render("universityDetail"));
app.get("/facultyCourses", (req, res) => res.render("facultyCourses"));
app.get("/courseDetails", (req, res) => res.render("courseDetails"));
app.get("/manageCourses", (req, res) => res.render("manageCourses"));

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

// Univeristy Router
const universityRoute = require("./Routes/university.route");
app.use("/universities", universityRoute);

// Post Router
const postRoute = require("./Routes/post.route");
app.use("/post", postRoute);

// Store online users for each group
const onlineUsers = new Map();

// Socket.io connection handling - REPLACE YOUR CURRENT SOCKET CODE WITH THIS
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // Store user info when they authenticate
  socket.on("authenticate", (userData) => {
    socket.userData = userData;
    console.log("User authenticated:", userData.userName);
  });

  socket.on("join-group", (groupId) => {
    socket.join(groupId);

    // Add user to online users
    if (!onlineUsers.has(groupId)) {
      onlineUsers.set(groupId, new Map());
    }

    // Store socket ID with user info
    const userName = socket.userData?.userName || "Unknown User";
    const userId = socket.userData?.userId || "unknown";

    onlineUsers.get(groupId).set(socket.id, {
      socketId: socket.id,
      userId: userId,
      userName: userName,
    });

    console.log(`User ${userName} joined group: ${groupId}`);

    // Notify others in the group
    socket.to(groupId).emit("user-joined-chat", {
      userName: userName,
      userId: userId,
      onlineCount: onlineUsers.get(groupId).size,
    });

    // Send current online count to all group members
    io.to(groupId).emit("online-count", onlineUsers.get(groupId).size);
  });

  // Existing timeline events
  socket.on("new-post", (data) => {
    socket.to(data.groupId).emit("new-post", data.post);
  });

  socket.on("new-comment", (data) => {
    socket.to(data.groupId).emit("new-comment", data);
  });

  socket.on("vote-update", (data) => {
    socket.to(data.groupId).emit("vote-update", data);
  });

  // NEW CHAT EVENTS
  socket.on("get-chat-history", async (groupId) => {
    try {
      const messages = await ChatMessage.find({ groupId })
        .sort({ createdAt: 1 })
        .limit(100);

      socket.emit("chat-history", messages);
      console.log(
        `Sent chat history for group ${groupId}: ${messages.length} messages`
      );
    } catch (error) {
      console.error("Error fetching chat history:", error);
    }
  });

  socket.on("chat-message", async (data) => {
    try {
      const message = new ChatMessage({
        content: data.content,
        userId: data.userId,
        groupId: data.groupId,
        userName: data.userName,
      });

      await message.save();

      console.log(
        `New chat message in group ${data.groupId} from ${data.userName}`
      );

      // Emit to all group members including the sender
      io.to(data.groupId).emit("chat-message", {
        _id: message._id,
        content: message.content,
        userName: data.userName,
        userId: data.userId,
        timestamp: message.createdAt,
      });
    } catch (error) {
      console.error("Error saving chat message:", error);
    }
  });

  socket.on("typing-start", (data) => {
    socket.to(data.groupId).emit("typing-start", data);
  });

  socket.on("typing-stop", (data) => {
    socket.to(data.groupId).emit("typing-stop", data);
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // Remove user from online users and notify others
    onlineUsers.forEach((users, groupId) => {
      if (users.has(socket.id)) {
        const userInfo = users.get(socket.id);
        users.delete(socket.id);

        console.log(`User ${userInfo.userName} left group ${groupId}`);

        // Notify others in the group
        socket.to(groupId).emit("user-left-chat", {
          userName: userInfo.userName,
          userId: userInfo.userId,
          onlineCount: users.size,
        });

        // Update online count for all group members
        io.to(groupId).emit("online-count", users.size);

        // Remove group from map if empty
        if (users.size === 0) {
          onlineUsers.delete(groupId);
          console.log(`Group ${groupId} has no more online users`);
        }
      }
    });
  });
});

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

// Remove the duplicate app.listen and use only http.listen
const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});

// Export both app and io for use in other files
module.exports = { app, io };
