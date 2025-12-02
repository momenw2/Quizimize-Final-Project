const express = require("express");
const router = express.Router();
const University = require("../Models/University.model");

// GET universities page
router.get("/", (req, res) => {
  try {
    res.render("universities", {
      user: req.user || { _id: "67d9733be64bed89238cb710", fullName: "Moemen" },
    });
  } catch (error) {
    console.error("Error rendering universities page:", error);
    res.status(500).send("Error loading page");
  }
});

// GET universities API - Fixed: Remove populate for now
router.get("/api", async (req, res) => {
  try {
    console.log("Attempting to fetch universities from MongoDB...");

    // Remove populate since User model might not exist
    const universities = await University.find({}).sort({ createdAt: -1 });

    console.log("Successfully found", universities.length, "universities");
    res.json(universities);
  } catch (error) {
    console.error("❌ ERROR in /api endpoint:", error);
    console.error("Error details:", error.message);

    res.status(500).json({
      error: "Failed to fetch universities",
      details: error.message,
    });
  }
});

// POST create university - UPDATED with proper initialization
router.post("/", async (req, res) => {
  try {
    const { name, location, website, description } = req.body;

    // Check if university already exists
    const existingUniversity = await University.findOne({
      name: new RegExp(`^${name}$`, "i"),
    });

    if (existingUniversity) {
      return res.status(400).json({
        error: "University with this name already exists",
      });
    }

    // Create new university with proper initialization
    const university = new University({
      name,
      location,
      website: website || "",
      description: description || "",
      logoUrl: "/assets/default-university-logo.png",
      posts: [], // Explicitly initialize
      faculties: [], // Explicitly initialize
      members: [], // Explicitly initialize
      // These will be set by defaults in the model:
      totalXP: 0,
      averageLevel: 1,
      statistics: {
        totalQuizzes: 0,
        totalAssignments: 0,
        averagePerformance: 0,
        engagementRate: 0,
      },
    });

    await university.save();

    res.status(201).json({
      message: "University registered successfully!",
      university: university,
    });
  } catch (error) {
    console.error("Error creating university:", error);
    res.status(500).json({
      error: "Failed to create university",
      details: error.message,
    });
  }
});

// POST join university - FIXED VERSION
router.post("/:id/join", async (req, res) => {
  try {
    console.log("=== JOIN UNIVERSITY REQUEST ===");
    console.log("University ID:", req.params.id);
    console.log("Request Body:", req.body);
    console.log("Session User (req.user):", req.user); // Debug

    const university = await University.findById(req.params.id);

    if (!university) {
      console.log("University not found with ID:", req.params.id);
      return res.status(404).json({ error: "University not found" });
    }

    console.log("University found:", university.name);

    // FIX 1: Get user ID from request body FIRST, then from session
    let userId = req.body?.userId; // Get from body

    if (!userId && req.user?._id) {
      userId = req.user._id; // Fallback to session
    }

    if (!userId) {
      console.log("No user ID provided in request");
      return res.status(400).json({
        error: "User ID is required. Please log in again.",
      });
    }

    console.log("Attempting to join with User ID:", userId);
    console.log("University members before:", university.members?.length || 0);

    // FIX 2: Better debugging for membership check
    console.log("Checking if user is already a member...");
    let isAlreadyMember = false;

    if (university.members && university.members.length > 0) {
      university.members.forEach((member, index) => {
        const memberId = member.user?._id || member.user;
        console.log(`Member ${index}:`, {
          storedId: memberId,
          storedIdString: memberId?.toString(),
          userIdString: userId?.toString(),
          isMatch: memberId && memberId.toString() === userId.toString(),
        });

        if (memberId && memberId.toString() === userId.toString()) {
          isAlreadyMember = true;
        }
      });
    }

    if (isAlreadyMember) {
      console.log("User is already a member. Returning error.");
      return res
        .status(400)
        .json({ error: "You are already a member of this university" });
    }

    // Add as member
    university.members = university.members || [];
    university.members.push({
      user: userId,
      role: "student",
      joinedAt: new Date(),
      xp: 0,
      level: 1,
      studentInfo: {
        enrollmentDate: new Date(),
        currentLevel: 1,
      },
    });

    await university.save();

    console.log("User successfully added as member");
    console.log("University members after:", university.members.length);

    res.json({
      message: `Successfully joined ${university.name}!`,
      university: university,
    });
  } catch (error) {
    console.error("❌ ERROR joining university:", error);
    console.error("Error stack:", error.stack);
    res.status(500).json({
      error: "Failed to join university",
      details: error.message,
    });
  }
});

// POST join university with code - FIXED
router.post("/join/:code", async (req, res) => {
  try {
    const universityCode = req.params.code.toUpperCase();
    const university = await University.findOne({
      "settings.joinCode": universityCode,
    });

    if (!university) {
      return res.status(404).json({ error: "Invalid university code" });
    }

    // FIX: Get user ID from body instead of hardcoded
    let userId = req.body?.userId;
    if (!userId && req.user?._id) {
      userId = req.user._id;
    }

    if (!userId) {
      return res.status(400).json({
        error: "User ID is required. Please log in again.",
      });
    }

    // Check if already a member
    const isMember = university.members?.some((member) => {
      const memberId = member.user?._id || member.user;
      return memberId && memberId.toString() === userId.toString();
    });

    if (isMember) {
      return res
        .status(400)
        .json({ error: "You are already a member of this university" });
    }

    // Add as member
    university.members = university.members || [];
    university.members.push({
      user: userId,
      role: "student",
      joinedAt: new Date(),
      xp: 0,
      level: 1,
      studentInfo: {
        enrollmentDate: new Date(),
        currentLevel: 1,
      },
    });

    await university.save();

    res.json({
      message: `Successfully joined ${university.name}!`,
      university: university,
    });
  } catch (error) {
    console.error("Error joining university with code:", error);
    res.status(500).json({
      error: "Failed to join university",
      details: error.message,
    });
  }
});

// GET university details page - FIXED
router.get("/:id", async (req, res) => {
  try {
    const university = await University.findById(req.params.id);

    if (!university) {
      return res.status(404).render("error", {
        error: "University not found",
        user: req.user,
      });
    }

    // Sort posts by creation date (newest first)
    university.posts.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Calculate user role and membership status
    const userId = req.user?._id || "67d9733be64bed89238cb710";
    const userRole = university.getUserRole(userId);
    const isMember = university.isMember(userId);

    console.log(`User ${userId} role in ${university.name}:`, userRole);
    console.log(`Is member:`, isMember);

    res.render("universityDetail", {
      university: university,
      user: req.user || { _id: "67d9733be64bed89238cb710", fullName: "Moemen" },
      userRole: userRole, // Add this line
      isMember: isMember, // Add this line
      title: `${university.name} - Quizmize`,
    });
  } catch (error) {
    console.error("Error fetching university:", error);
    res.status(500).render("error", {
      error: "Failed to load university",
      user: req.user,
    });
  }
});

// POST create a new post in university timeline
router.post("/:id/posts", async (req, res) => {
  try {
    const university = await University.findById(req.params.id);

    if (!university) {
      return res.status(404).json({ error: "University not found" });
    }

    const { content } = req.body;
    const userId = "67d9733be64bed89238cb710"; // Your actual user ID
    const userName = "Moemen"; // Replace with actual user name

    // Check if user is admin of this university
    const userRole = university.getUserRole(userId);
    if (userRole !== "admin") {
      return res.status(403).json({
        error: "Only university admins can create posts",
      });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        error: "Post content cannot be empty",
      });
    }

    await university.createPost(userId, userName, content.trim());

    res.status(201).json({
      message: "Post created successfully!",
      post: university.posts[0], // Return the newest post
    });
  } catch (error) {
    console.error("Error creating post:", error);
    res.status(500).json({
      error: "Failed to create post",
      details: error.message,
    });
  }
});

// GET university posts
router.get("/:id/posts", async (req, res) => {
  try {
    const university = await University.findById(req.params.id);

    if (!university) {
      return res.status(404).json({ error: "University not found" });
    }

    res.json({
      posts: university.posts || [],
    });
  } catch (error) {
    console.error("Error fetching posts:", error);
    res.status(500).json({
      error: "Failed to fetch posts",
      details: error.message,
    });
  }
});

// POST add comment to a post
router.post("/:id/posts/:postId/comments", async (req, res) => {
  try {
    const university = await University.findById(req.params.id);

    if (!university) {
      return res.status(404).json({ error: "University not found" });
    }

    const { content } = req.body;
    const userId = "67d9733be64bed89238cb710"; // Your actual user ID
    const userName = "Moemen"; // Replace with actual user name

    // Check if user is a member of this university
    if (!university.isMember(userId)) {
      return res.status(403).json({
        error: "You must be a member of this university to comment",
      });
    }

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        error: "Comment content cannot be empty",
      });
    }

    if (content.length > 500) {
      return res.status(400).json({
        error: "Comment cannot exceed 500 characters",
      });
    }

    await university.addCommentToPost(
      req.params.postId,
      userId,
      userName,
      content
    );

    // Get the updated post with the new comment
    const updatedPost = university.posts.id(req.params.postId);

    res.status(201).json({
      message: "Comment added successfully!",
      comment: updatedPost.comments[updatedPost.comments.length - 1],
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({
      error: "Failed to add comment",
      details: error.message,
    });
  }
});

// POST like/unlike a post
router.post("/:id/posts/:postId/like", async (req, res) => {
  try {
    const university = await University.findById(req.params.id);

    if (!university) {
      return res.status(404).json({ error: "University not found" });
    }

    const userId = "67d9733be64bed89238cb710"; // Your actual user ID

    // Check if user is a member of this university
    if (!university.isMember(userId)) {
      return res.status(403).json({
        error: "You must be a member of this university to like posts",
      });
    }

    await university.likePost(req.params.postId, userId);

    const updatedPost = university.posts.id(req.params.postId);
    const isLiked = updatedPost.likes.some(
      (like) => like.user.toString() === userId.toString()
    );

    res.json({
      message: isLiked ? "Post liked!" : "Post unliked!",
      likesCount: updatedPost.likes.length,
      isLiked: isLiked,
    });
  } catch (error) {
    console.error("Error liking post:", error);
    res.status(500).json({
      error: "Failed to like post",
      details: error.message,
    });
  }
});

// POST create faculty
router.post("/:id/faculties", async (req, res) => {
  try {
    const university = await University.findById(req.params.id);

    if (!university) {
      return res.status(404).json({ error: "University not found" });
    }

    const { name, description, contactEmail } = req.body;
    const userId = "67d9733be64bed89238cb710"; // Your actual user ID

    // Check if user is admin of this university
    const userRole = university.getUserRole(userId);
    if (userRole !== "admin") {
      return res.status(403).json({
        error: "Only university admins can create faculties",
      });
    }

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        error: "Faculty name is required",
      });
    }

    // Check if faculty with same name already exists
    const existingFaculty = university.faculties.find(
      (faculty) => faculty.name.toLowerCase() === name.toLowerCase().trim()
    );

    if (existingFaculty) {
      return res.status(400).json({
        error: "Faculty with this name already exists",
      });
    }

    // Create new faculty
    const newFaculty = {
      name: name.trim(),
      description: description ? description.trim() : "",
      courses: [],
    };

    // Add contact email if provided
    if (contactEmail && contactEmail.trim()) {
      newFaculty.contactEmail = contactEmail.trim().toLowerCase();
    }

    university.faculties.push(newFaculty);
    await university.save();

    res.status(201).json({
      message: "Faculty created successfully!",
      faculty: newFaculty,
    });
  } catch (error) {
    console.error("Error creating faculty:", error);
    res.status(500).json({
      error: "Failed to create faculty",
      details: error.message,
    });
  }
});

// GET faculties for a university
router.get("/:id/faculties", async (req, res) => {
  try {
    const university = await University.findById(req.params.id);

    if (!university) {
      return res.status(404).json({ error: "University not found" });
    }

    res.json({
      faculties: university.faculties || [],
    });
  } catch (error) {
    console.error("Error fetching faculties:", error);
    res.status(500).json({
      error: "Failed to fetch faculties",
      details: error.message,
    });
  }
});

// POST create course
router.post("/:id/courses", async (req, res) => {
  try {
    const university = await University.findById(req.params.id);

    if (!university) {
      return res.status(404).json({ error: "University not found" });
    }

    const {
      facultyIndex,
      courseCode,
      courseName,
      description,
      credits,
      level,
    } = req.body;
    const userId = "67d9733be64bed89238cb710"; // Your actual user ID

    // Check if user is admin of this university
    const userRole = university.getUserRole(userId);
    if (userRole !== "admin") {
      return res.status(403).json({
        error: "Only university admins can create courses",
      });
    }

    // Validate required fields
    if (!facultyIndex || facultyIndex === "") {
      return res.status(400).json({ error: "Faculty selection is required" });
    }

    if (!courseCode || !courseCode.trim()) {
      return res.status(400).json({ error: "Course code is required" });
    }

    if (!courseName || !courseName.trim()) {
      return res.status(400).json({ error: "Course name is required" });
    }

    // Check if faculty exists
    if (!university.faculties || university.faculties.length <= facultyIndex) {
      return res.status(400).json({ error: "Selected faculty not found" });
    }

    const faculty = university.faculties[facultyIndex];

    // Check if course with same code already exists in this faculty
    const existingCourse = faculty.courses.find(
      (course) =>
        course.courseCode.toUpperCase() === courseCode.toUpperCase().trim()
    );

    if (existingCourse) {
      return res.status(400).json({
        error: "Course with this code already exists in the selected faculty",
      });
    }

    // Create new course
    const newCourse = {
      courseCode: courseCode.trim().toUpperCase(),
      courseName: courseName.trim(),
      description: description ? description.trim() : "",
      credits: credits || 3,
      level: level || 1,
      teacher: userId, // Using admin as teacher for now
      classrooms: [],
      posts: [], // Initialize empty posts array
    };

    faculty.courses.push(newCourse);
    await university.save();

    res.status(201).json({
      message: "Course created successfully!",
      course: newCourse,
      facultyName: faculty.name,
    });
  } catch (error) {
    console.error("Error creating course:", error);
    res.status(500).json({
      error: "Failed to create course",
      details: error.message,
    });
  }
});

// GET faculty courses page
router.get("/:id/faculties/:facultyIndex/courses", async (req, res) => {
  try {
    const university = await University.findById(req.params.id);
    const facultyIndex = parseInt(req.params.facultyIndex);
    const facultyName = req.query.name || "Faculty";

    if (!university) {
      return res.status(404).render("error", {
        error: "University not found",
        user: req.user,
      });
    }

    // Check if faculty exists
    if (!university.faculties || university.faculties.length <= facultyIndex) {
      return res.status(404).render("error", {
        error: "Faculty not found",
        user: req.user,
      });
    }

    const faculty = university.faculties[facultyIndex];

    res.render("facultyCourses", {
      university: university,
      faculty: faculty,
      facultyIndex: facultyIndex,
      facultyName: facultyName,
      user: req.user || { _id: "67d9733be64bed89238cb710", fullName: "Moemen" },
      title: `${faculty.name} Courses - ${university.name} - Quizmize`,
    });
  } catch (error) {
    console.error("Error fetching faculty courses:", error);
    res.status(500).render("error", {
      error: "Failed to load faculty courses",
      user: req.user,
    });
  }
});

// GET course details page - FIXED
router.get(
  "/:id/faculties/:facultyIndex/courses/:courseIndex",
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const courseIndex = parseInt(req.params.courseIndex);

      if (!university) {
        return res.status(404).render("error", {
          error: "University not found",
          user: req.user,
        });
      }

      // Check if faculty exists
      if (
        !university.faculties ||
        university.faculties.length <= facultyIndex
      ) {
        return res.status(404).render("error", {
          error: "Faculty not found",
          user: req.user,
        });
      }

      const faculty = university.faculties[facultyIndex];

      // Check if course exists
      if (!faculty.courses || faculty.courses.length <= courseIndex) {
        return res.status(404).render("error", {
          error: "Course not found",
          user: req.user,
        });
      }

      const course = faculty.courses[courseIndex];

      // Ensure posts array exists
      if (!course.posts) {
        course.posts = [];
        await university.save();
      }

      // Sort course posts by creation date (newest first)
      course.posts.sort(
        (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
      );

      // Calculate user role and membership status
      const userId = req.user?._id || "67d9733be64bed89238cb710";
      const userRole = university.getUserRole(userId);
      const isMember = university.isMember(userId);
      const isCourseTeacher = university.isCourseTeacher(
        facultyIndex,
        courseIndex,
        userId
      );

      res.render("courseDetails", {
        university: university,
        faculty: faculty,
        facultyIndex: facultyIndex,
        course: course,
        courseIndex: courseIndex,
        user: req.user || {
          _id: "67d9733be64bed89238cb710",
          fullName: "Moemen",
        },
        userRole: userRole, // Add this
        isMember: isMember, // Add this
        isCourseTeacher: isCourseTeacher, // Add this for course-specific permissions
        title: `${course.courseCode} - ${course.courseName} - ${university.name} - Quizmize`,
      });
    } catch (error) {
      console.error("Error fetching course details:", error);
      res.status(500).render("error", {
        error: "Failed to load course details",
        user: req.user,
      });
    }
  }
);

// COURSE POSTS ROUTES

// POST create a course post (Teacher only)
router.post(
  "/:id/faculties/:facultyIndex/courses/:courseIndex/posts",
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const courseIndex = parseInt(req.params.courseIndex);

      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      const { content, postType } = req.body;
      const userId = "67d9733be64bed89238cb710"; // Your actual user ID
      const userName = "Moemen"; // Replace with actual user name

      // Check if faculty and course exist
      if (
        !university.faculties[facultyIndex] ||
        !university.faculties[facultyIndex].courses[courseIndex]
      ) {
        return res.status(404).json({ error: "Course not found" });
      }

      const course = university.faculties[facultyIndex].courses[courseIndex];

      // Check if user is the teacher of this course
      if (course.teacher.toString() !== userId.toString()) {
        return res.status(403).json({
          error: "Only the course teacher can create posts",
        });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          error: "Post content cannot be empty",
        });
      }

      // Use the model method to create post
      await university.createCoursePost(
        facultyIndex,
        courseIndex,
        userId,
        userName,
        content.trim(),
        postType || "general"
      );

      // Get the updated course
      const updatedUniversity = await University.findById(req.params.id);
      const updatedCourse =
        updatedUniversity.faculties[facultyIndex].courses[courseIndex];

      res.status(201).json({
        message: "Post created successfully!",
        post: updatedCourse.posts[0], // Return the newest post
      });
    } catch (error) {
      console.error("Error creating course post:", error);
      res.status(500).json({
        error: "Failed to create post",
        details: error.message,
      });
    }
  }
);

// POST add comment to course post
router.post(
  "/:id/faculties/:facultyIndex/courses/:courseIndex/posts/:postIndex/comments",
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const courseIndex = parseInt(req.params.courseIndex);
      const postIndex = parseInt(req.params.postIndex);

      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      const { content } = req.body;
      const userId = "67d9733be64bed89238cb710"; // Your actual user ID
      const userName = "Moemen"; // Replace with actual user name

      // Check if user is a member of this university
      if (!university.isMember(userId)) {
        return res.status(403).json({
          error: "You must be a member of this university to comment",
        });
      }

      if (!content || content.trim().length === 0) {
        return res.status(400).json({
          error: "Comment content cannot be empty",
        });
      }

      if (content.length > 500) {
        return res.status(400).json({
          error: "Comment cannot exceed 500 characters",
        });
      }

      // Use the model method to add comment
      await university.addCommentToCoursePost(
        facultyIndex,
        courseIndex,
        postIndex,
        userId,
        userName,
        content.trim()
      );

      // Get the updated post
      const updatedUniversity = await University.findById(req.params.id);
      const updatedPost =
        updatedUniversity.faculties[facultyIndex].courses[courseIndex].posts[
          postIndex
        ];

      res.status(201).json({
        message: "Comment added successfully!",
        comment: updatedPost.comments[updatedPost.comments.length - 1],
      });
    } catch (error) {
      console.error("Error adding comment:", error);
      res.status(500).json({
        error: "Failed to add comment",
        details: error.message,
      });
    }
  }
);

// POST like/unlike course post
router.post(
  "/:id/faculties/:facultyIndex/courses/:courseIndex/posts/:postIndex/like",
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const courseIndex = parseInt(req.params.courseIndex);
      const postIndex = parseInt(req.params.postIndex);

      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      const userId = "67d9733be64bed89238cb710"; // Your actual user ID

      // Check if user is a member of this university
      if (!university.isMember(userId)) {
        return res.status(403).json({
          error: "You must be a member of this university to like posts",
        });
      }

      // Use the model method to like post
      await university.likeCoursePost(
        facultyIndex,
        courseIndex,
        postIndex,
        userId
      );

      // Get the updated post
      const updatedUniversity = await University.findById(req.params.id);
      const updatedPost =
        updatedUniversity.faculties[facultyIndex].courses[courseIndex].posts[
          postIndex
        ];

      const isLiked = updatedPost.likes.some(
        (like) => like.user.toString() === userId.toString()
      );

      res.json({
        message: isLiked ? "Post liked!" : "Post unliked!",
        likesCount: updatedPost.likes.length,
        isLiked: isLiked,
      });
    } catch (error) {
      console.error("Error liking post:", error);
      res.status(500).json({
        error: "Failed to like post",
        details: error.message,
      });
    }
  }
);

// GET course posts
router.get(
  "/:id/faculties/:facultyIndex/courses/:courseIndex/posts",
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const courseIndex = parseInt(req.params.courseIndex);

      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      // Check if faculty and course exist
      if (
        !university.faculties[facultyIndex] ||
        !university.faculties[facultyIndex].courses[courseIndex]
      ) {
        return res.status(404).json({ error: "Course not found" });
      }

      const course = university.faculties[facultyIndex].courses[courseIndex];

      // Ensure posts array exists
      if (!course.posts) {
        course.posts = [];
      }

      res.json({
        posts: course.posts || [],
      });
    } catch (error) {
      console.error("Error fetching course posts:", error);
      res.status(500).json({
        error: "Failed to fetch course posts",
        details: error.message,
      });
    }
  }
);

// FIX ROUTES FOR EXISTING DATA

// PUT initialize posts for all courses in a university
router.put("/:id/initialize-course-posts", async (req, res) => {
  try {
    const university = await University.findById(req.params.id);

    if (!university) {
      return res.status(404).json({ error: "University not found" });
    }

    let updatedCount = 0;

    // Initialize posts array for all courses
    university.faculties.forEach((faculty) => {
      faculty.courses.forEach((course) => {
        if (!course.posts) {
          course.posts = [];
          updatedCount++;
        }
      });
    });

    await university.save();

    res.json({
      message: `Successfully initialized posts for ${updatedCount} courses`,
      university: university,
    });
  } catch (error) {
    console.error("Error initializing course posts:", error);
    res.status(500).json({
      error: "Failed to initialize course posts",
      details: error.message,
    });
  }
});

// TEMPORARY: Fix course posts for your university
router.get("/fix-posts", async (req, res) => {
  try {
    const universityId = "690c644e76a79fe8d121fe21";
    const university = await University.findById(universityId);

    if (!university) {
      return res.status(404).json({ error: "University not found" });
    }

    // Initialize posts for all courses
    university.faculties.forEach((faculty) => {
      faculty.courses.forEach((course) => {
        if (!course.posts) {
          course.posts = [];
          console.log(`Initialized posts for course: ${course.courseCode}`);
        }
      });
    });

    await university.save();

    res.json({
      message: "Course posts initialized successfully!",
      courses: university.faculties.flatMap((f) =>
        f.courses.map((c) => ({
          name: c.courseName,
          code: c.courseCode,
          hasPosts: !!c.posts,
          postCount: c.posts ? c.posts.length : 0,
        }))
      ),
    });
  } catch (error) {
    console.error("Error fixing posts:", error);
    res.status(500).json({
      error: "Failed to fix posts",
      details: error.message,
    });
  }
});

// FIX ALL UNIVERSITIES - Run this once
router.get("/fix-all-universities", async (req, res) => {
  try {
    const universities = await University.find({});
    let fixedCount = 0;
    let coursesFixed = 0;

    for (let university of universities) {
      let needsFix = false;

      // Ensure posts array exists
      if (!university.posts) {
        university.posts = [];
        needsFix = true;
      }

      // Ensure faculties array exists and has proper structure
      if (!university.faculties) {
        university.faculties = [];
        needsFix = true;
      }

      // Fix each faculty and its courses
      university.faculties.forEach((faculty) => {
        if (!faculty.courses) {
          faculty.courses = [];
          needsFix = true;
        }

        // Fix each course to have posts array
        faculty.courses.forEach((course) => {
          if (!course.posts) {
            course.posts = [];
            coursesFixed++;
            needsFix = true;
          }
        });
      });

      if (needsFix) {
        await university.save();
        fixedCount++;
        console.log(`Fixed university: ${university.name}`);
      }
    }

    res.json({
      message: `Successfully fixed ${fixedCount} universities and ${coursesFixed} courses!`,
      totalUniversities: universities.length,
      fixedUniversities: fixedCount,
      fixedCourses: coursesFixed,
    });
  } catch (error) {
    console.error("Error fixing all universities:", error);
    res.status(500).json({
      error: "Failed to fix universities",
      details: error.message,
    });
  }
});

// GET manage courses page
router.get("/:id/manage-courses", async (req, res) => {
  try {
    const university = await University.findById(req.params.id);

    if (!university) {
      return res.status(404).render("error", {
        error: "University not found",
        user: req.user,
      });
    }

    // Check if user is admin
    const userId = req.user?._id || "67d9733be64bed89238cb710";
    const userRole = university.getUserRole(userId);

    if (userRole !== "admin") {
      return res.status(403).render("error", {
        error: "Only university admins can manage courses",
        user: req.user,
      });
    }

    // Gather all courses with faculty information
    const allCourses = [];
    university.faculties.forEach((faculty, facultyIndex) => {
      faculty.courses.forEach((course, courseIndex) => {
        allCourses.push({
          facultyName: faculty.name,
          facultyIndex: facultyIndex,
          courseCode: course.courseCode,
          courseName: course.courseName,
          courseIndex: courseIndex,
          description: course.description,
          level: course.level,
          credits: course.credits,
          teacher: course.teacher,
          totalStudents: course.classrooms
            ? course.classrooms.reduce(
                (sum, classroom) =>
                  sum + (classroom.students ? classroom.students.length : 0),
                0
              )
            : 0,
          classrooms: course.classrooms || [],
        });
      });
    });

    res.render("manageCourses", {
      university: university,
      courses: allCourses,
      user: req.user || { _id: "67d9733be64bed89238cb710", fullName: "Moemen" },
      title: `Manage Courses - ${university.name} - Quizmize`,
    });
  } catch (error) {
    console.error("Error fetching courses for management:", error);
    res.status(500).render("error", {
      error: "Failed to load course management",
      user: req.user,
    });
  }
});

// GET course management details
router.get(
  "/:id/faculties/:facultyIndex/courses/:courseIndex/manage",
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const courseIndex = parseInt(req.params.courseIndex);

      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      // Check if user is admin
      const userId = req.user?._id || "67d9733be64bed89238cb710";
      const userRole = university.getUserRole(userId);

      if (userRole !== "admin") {
        return res
          .status(403)
          .json({ error: "Only university admins can manage courses" });
      }

      // Check if faculty and course exist
      if (
        !university.faculties[facultyIndex] ||
        !university.faculties[facultyIndex].courses[courseIndex]
      ) {
        return res.status(404).json({ error: "Course not found" });
      }

      const faculty = university.faculties[facultyIndex];
      const course = faculty.courses[courseIndex];

      // Get all university members
      const universityMembers = university.members.map((member) => ({
        userId: member.user,
        role: member.role,
        xp: member.xp,
        level: member.level,
      }));

      // Get course participants (from all classrooms)
      const courseParticipants = [];
      if (course.classrooms) {
        course.classrooms.forEach((classroom) => {
          if (classroom.students) {
            classroom.students.forEach((student) => {
              courseParticipants.push({
                userId: student.student,
                classroom: classroom.name,
                status: student.status,
                joinedAt: student.joinedAt,
              });
            });
          }
        });
      }

      res.json({
        course: {
          facultyName: faculty.name,
          facultyIndex: facultyIndex,
          courseCode: course.courseCode,
          courseName: course.courseName,
          courseIndex: courseIndex,
          description: course.description,
          teacher: course.teacher,
          classrooms: course.classrooms || [],
        },
        universityMembers: universityMembers,
        courseParticipants: courseParticipants,
        totalMembers: university.members.length,
      });
    } catch (error) {
      console.error("Error fetching course management details:", error);
      res.status(500).json({
        error: "Failed to fetch course details",
        details: error.message,
      });
    }
  }
);

// POST assign teacher to course
router.post(
  "/:id/faculties/:facultyIndex/courses/:courseIndex/assign-teacher",
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const courseIndex = parseInt(req.params.courseIndex);
      const { teacherId } = req.body;

      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      // Check if user is admin
      const userId = req.user?._id || "67d9733be64bed89238cb710";
      const userRole = university.getUserRole(userId);

      if (userRole !== "admin") {
        return res
          .status(403)
          .json({ error: "Only university admins can assign teachers" });
      }

      // Check if faculty and course exist
      if (
        !university.faculties[facultyIndex] ||
        !university.faculties[facultyIndex].courses[courseIndex]
      ) {
        return res.status(404).json({ error: "Course not found" });
      }

      // Check if teacher is a member of the university
      const isTeacherMember = university.isMember(teacherId);
      if (!isTeacherMember) {
        return res.status(400).json({
          error: "Selected teacher is not a member of this university",
        });
      }

      // Update teacher
      university.faculties[facultyIndex].courses[courseIndex].teacher =
        teacherId;
      await university.save();

      res.json({
        message: "Teacher assigned successfully!",
        teacherId: teacherId,
      });
    } catch (error) {
      console.error("Error assigning teacher:", error);
      res.status(500).json({
        error: "Failed to assign teacher",
        details: error.message,
      });
    }
  }
);

// POST manage classroom students
router.post(
  "/:id/faculties/:facultyIndex/courses/:courseIndex/classrooms/:classroomIndex/manage-students",
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const courseIndex = parseInt(req.params.courseIndex);
      const classroomIndex = parseInt(req.params.classroomIndex);
      const { action, studentId } = req.body;

      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      // Check if user is admin
      const userId = req.user?._id || "67d9733be64bed89238cb710";
      const userRole = university.getUserRole(userId);

      if (userRole !== "admin") {
        return res.status(403).json({
          error: "Only university admins can manage classroom students",
        });
      }

      // Check if faculty, course and classroom exist
      if (
        !university.faculties[facultyIndex] ||
        !university.faculties[facultyIndex].courses[courseIndex] ||
        !university.faculties[facultyIndex].courses[courseIndex].classrooms[
          classroomIndex
        ]
      ) {
        return res.status(404).json({ error: "Classroom not found" });
      }

      const classroom =
        university.faculties[facultyIndex].courses[courseIndex].classrooms[
          classroomIndex
        ];

      switch (action) {
        case "add":
          // Check if student is already in classroom
          const existingStudent = classroom.students.find(
            (s) => s.student.toString() === studentId.toString()
          );
          if (existingStudent) {
            return res
              .status(400)
              .json({ error: "Student already in this classroom" });
          }

          // Check if student is a member of the university
          const isMember = university.isMember(studentId);
          if (!isMember) {
            return res
              .status(400)
              .json({ error: "Student is not a member of this university" });
          }

          classroom.students.push({
            student: studentId,
            joinedAt: new Date(),
            status: "active",
          });
          break;

        case "remove":
          classroom.students = classroom.students.filter(
            (s) => s.student.toString() !== studentId.toString()
          );
          break;

        case "updateStatus":
          const { status } = req.body;
          const student = classroom.students.find(
            (s) => s.student.toString() === studentId.toString()
          );
          if (student) {
            student.status = status;
          }
          break;

        default:
          return res.status(400).json({ error: "Invalid action" });
      }

      await university.save();

      res.json({
        message: `Student ${action}ed successfully!`,
        classroom: classroom,
      });
    } catch (error) {
      console.error("Error managing classroom students:", error);
      res.status(500).json({
        error: "Failed to manage classroom students",
        details: error.message,
      });
    }
  }
);

// POST create new classroom
router.post(
  "/:id/faculties/:facultyIndex/courses/:courseIndex/create-classroom",
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const courseIndex = parseInt(req.params.courseIndex);
      const { name, section, schedule } = req.body;

      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      // Check if user is admin
      const userId = req.user?._id || "67d9733be64bed89238cb710";
      const userRole = university.getUserRole(userId);

      if (userRole !== "admin") {
        return res
          .status(403)
          .json({ error: "Only university admins can create classrooms" });
      }

      // Check if faculty and course exist
      if (
        !university.faculties[facultyIndex] ||
        !university.faculties[facultyIndex].courses[courseIndex]
      ) {
        return res.status(404).json({ error: "Course not found" });
      }

      const course = university.faculties[facultyIndex].courses[courseIndex];

      // Check if classroom with same name already exists
      const existingClassroom = course.classrooms.find(
        (c) => c.name.toLowerCase() === name.toLowerCase()
      );
      if (existingClassroom) {
        return res
          .status(400)
          .json({ error: "Classroom with this name already exists" });
      }

      // Create new classroom
      const newClassroom = {
        name: name.trim(),
        section: section ? section.trim() : "",
        schedule: schedule || {},
        students: [],
        xp: 0,
        level: 1,
      };

      if (!course.classrooms) {
        course.classrooms = [];
      }

      course.classrooms.push(newClassroom);
      await university.save();

      res.status(201).json({
        message: "Classroom created successfully!",
        classroom: newClassroom,
      });
    } catch (error) {
      console.error("Error creating classroom:", error);
      res.status(500).json({
        error: "Failed to create classroom",
        details: error.message,
      });
    }
  }
);

module.exports = router;
