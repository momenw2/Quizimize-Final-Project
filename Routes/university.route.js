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

// POST join university - Fixed: Use actual user ID from session
router.post("/:id/join", async (req, res) => {
  try {
    const university = await University.findById(req.params.id);

    if (!university) {
      return res.status(404).json({ error: "University not found" });
    }

    // Use the actual user ID from your session/authentication
    // For now, using the test user ID from your console
    const userId = "67d9733be64bed89238cb710"; // Your actual user ID

    // Check if already a member
    if (university.isMember(userId)) {
      return res
        .status(400)
        .json({ error: "You are already a member of this university" });
    }

    // Add as member
    await university.addMember(userId, "student", {
      studentInfo: {
        enrollmentDate: new Date(),
        currentLevel: 1,
      },
    });

    // Get updated university without populate
    const updatedUniversity = await University.findById(university._id);

    res.json({
      message: `Successfully joined ${university.name}!`,
      university: updatedUniversity,
    });
  } catch (error) {
    console.error("Error joining university:", error);
    res.status(500).json({
      error: "Failed to join university",
      details: error.message,
    });
  }
});

// POST join university with code
router.post("/join/:code", async (req, res) => {
  try {
    const universityCode = req.params.code.toUpperCase();
    const university = await University.findOne({
      "settings.joinCode": universityCode,
    });

    if (!university) {
      return res.status(404).json({ error: "Invalid university code" });
    }

    // Use the actual user ID from your session/authentication
    const userId = "67d9733be64bed89238cb710"; // Your actual user ID

    // Check if already a member
    if (university.isMember(userId)) {
      return res
        .status(400)
        .json({ error: "You are already a member of this university" });
    }

    // Add as member
    await university.addMember(userId, "student", {
      studentInfo: {
        enrollmentDate: new Date(),
        currentLevel: 1,
      },
    });

    // Get updated university without populate
    const updatedUniversity = await University.findById(university._id);

    res.json({
      message: `Successfully joined ${university.name}!`,
      university: updatedUniversity,
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

module.exports = router;
