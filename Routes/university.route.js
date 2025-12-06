const express = require("express");
const router = express.Router();
const University = require("../Models/University.model");
const {
  checkUser,
  requireAuth,
  requireAdmin,
} = require("../middleware/authMiddleware");
const authMiddleware = requireAuth;

// Apply checkUser middleware to all routes
router.use(checkUser);

// Helper function to get user info (updated to use res.locals)
const getUserInfo = (req, res) => {
  const user = res.locals.user;
  if (user) {
    return {
      _id: user._id,
      fullName: user.fullName || user.username || "User",
      email: user.email,
      role: user.role || "student",
      // Add any other user properties you need
    };
  }
  return null;
};

// GET universities page
router.get("/", (req, res) => {
  try {
    res.render("universities", {
      user: res.locals.user || null,
    });
  } catch (error) {
    console.error("Error rendering universities page:", error);
    res.status(500).send("Error loading page");
  }
});

// GET universities API
router.get("/api", async (req, res) => {
  try {
    console.log("Attempting to fetch universities from MongoDB...");
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

// POST create university
router.post("/", requireAuth, async (req, res) => {
  try {
    const { name, location, website, description } = req.body;
    const currentUser = res.locals.user;

    if (!currentUser) {
      return res.status(401).json({
        error: "You must be logged in to create a university",
      });
    }

    // Check if university already exists
    const existingUniversity = await University.findOne({
      name: new RegExp(`^${name}$`, "i"),
    });

    if (existingUniversity) {
      return res.status(400).json({
        error: "University with this name already exists",
      });
    }

    // Get user info
    const userName = currentUser.fullName || currentUser.username || "User";
    const userEmail = currentUser.email;

    // Create new university with proper initialization
    const university = new University({
      name,
      location,
      website: website || "",
      description: description || "",
      logoUrl: "/assets/default-university-logo.png",
      posts: [],
      faculties: [],
      members: [
        // Add the creator as first member and admin
        {
          user: currentUser._id,
          userName: userName, // Add this
          userEmail: userEmail, // Add this
          role: "admin",
          joinedAt: new Date(),
          xp: 0,
          level: 1,
        },
      ],
      totalXP: 0,
      averageLevel: 1,
      statistics: {
        totalQuizzes: 0,
        totalAssignments: 0,
        averagePerformance: 0,
        engagementRate: 0,
      },
      createdBy: currentUser._id,
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

// POST join university
router.post("/:id/join", requireAuth, async (req, res) => {
  try {
    console.log("=== JOIN UNIVERSITY REQUEST ===");
    console.log("University ID:", req.params.id);

    const currentUser = res.locals.user;
    console.log("Current User:", currentUser);

    const university = await University.findById(req.params.id);

    if (!university) {
      console.log("University not found with ID:", req.params.id);
      return res.status(404).json({ error: "University not found" });
    }

    console.log("University found:", university.name);

    if (!currentUser) {
      return res.status(404).json({
        error: "You must be logged in to join a university",
      });
    }

    const userId = currentUser._id;
    const userName = currentUser.fullName || currentUser.username || "User";
    const userEmail = currentUser.email;

    console.log("Attempting to join with User ID:", userId);
    console.log("University members before:", university.members?.length || 0);

    // Check if user is already a member
    let isAlreadyMember = false;

    if (university.members && university.members.length > 0) {
      university.members.forEach((member) => {
        const memberId = member.user?._id || member.user;
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

    // Add as member with user info
    university.members = university.members || [];
    university.members.push({
      user: userId,
      userName: userName, // Store user name
      userEmail: userEmail, // Store user email
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

// POST join university with code
router.post("/join/:code", requireAuth, async (req, res) => {
  try {
    const universityCode = req.params.code.toUpperCase();
    const university = await University.findOne({
      "settings.joinCode": universityCode,
    });

    if (!university) {
      return res.status(404).json({ error: "Invalid university code" });
    }

    const currentUser = res.locals.user;
    const userId = currentUser._id;
    const userName = currentUser.fullName || currentUser.username || "User";
    const userEmail = currentUser.email;

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

    // Add as member with user info
    university.members = university.members || [];
    university.members.push({
      user: userId,
      userName: userName, // Add this
      userEmail: userEmail, // Add this
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

// GET university details page
router.get("/:id", async (req, res) => {
  try {
    // Populate the members.user field with user data
    const university = await University.findById(req.params.id)
      .populate({
        path: "members.user",
        select: "fullName username email", // Select the fields you want
      })
      .populate({
        path: "posts.author",
        select: "fullName username",
      })
      .populate({
        path: "posts.comments.author",
        select: "fullName username",
      });

    // Also populate course posts authors if needed
    university.faculties.forEach((faculty) => {
      faculty.courses.forEach((course) => {
        if (course.posts && course.posts.length > 0) {
          // You may need to manually populate these if needed
        }
      });
    });

    const currentUser = res.locals.user;

    if (!university) {
      return res.status(404).render("error", {
        error: "University not found",
        user: currentUser,
      });
    }

    // Sort posts by creation date (newest first)
    university.posts.sort(
      (a, b) => new Date(b.createdAt) - new Date(a.createdAt)
    );

    // Calculate user role and membership status
    const userId = currentUser?._id;
    let userRole = null;
    let isMember = false;

    if (userId) {
      userRole = university.getUserRole(userId);
      isMember = university.isMember(userId);
    }

    console.log(`User ${userId} role in ${university.name}:`, userRole);
    console.log(`Is member:`, isMember);

    res.render("universityDetail", {
      university: university,
      user: currentUser,
      userRole: userRole,
      isMember: isMember,
      title: `${university.name} - Quizmize`,
    });
  } catch (error) {
    console.error("Error fetching university:", error);
    res.status(500).render("error", {
      error: "Failed to load university",
      user: res.locals.user,
    });
  }
});

// POST create a new post in university timeline
router.post("/:id/posts", requireAuth, async (req, res) => {
  try {
    const university = await University.findById(req.params.id);
    const currentUser = res.locals.user;

    if (!university) {
      return res.status(404).json({ error: "University not found" });
    }

    const { content } = req.body;

    if (!currentUser) {
      return res.status(401).json({
        error: "You must be logged in to create posts",
      });
    }

    const userId = currentUser._id;
    const userName = currentUser.fullName || currentUser.username || "User";

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
      post: university.posts[0],
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
router.post("/:id/posts/:postId/comments", requireAuth, async (req, res) => {
  try {
    const university = await University.findById(req.params.id);
    const currentUser = res.locals.user;

    if (!university) {
      return res.status(404).json({ error: "University not found" });
    }

    const { content } = req.body;

    if (!currentUser) {
      return res.status(401).json({
        error: "You must be logged in to comment",
      });
    }

    const userId = currentUser._id;
    const userName = currentUser.fullName || currentUser.username || "User";

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
router.post("/:id/posts/:postId/like", requireAuth, async (req, res) => {
  try {
    const university = await University.findById(req.params.id);
    const currentUser = res.locals.user;

    if (!university) {
      return res.status(404).json({ error: "University not found" });
    }

    if (!currentUser) {
      return res.status(401).json({
        error: "You must be logged in to like posts",
      });
    }

    const userId = currentUser._id;

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
router.post("/:id/faculties", requireAuth, async (req, res) => {
  try {
    const university = await University.findById(req.params.id);
    const currentUser = res.locals.user;

    if (!university) {
      return res.status(404).json({ error: "University not found" });
    }

    const { name, description, contactEmail } = req.body;

    if (!currentUser) {
      return res.status(401).json({
        error: "You must be logged in to create faculties",
      });
    }

    const userId = currentUser._id;

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
router.post("/:id/courses", requireAuth, async (req, res) => {
  try {
    const university = await University.findById(req.params.id);
    const currentUser = res.locals.user;

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

    if (!currentUser) {
      return res.status(401).json({
        error: "You must be logged in to create courses",
      });
    }

    const userId = currentUser._id;

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
      teacher: userId,
      classrooms: [],
      posts: [],
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
    const currentUser = res.locals.user;

    if (!university) {
      return res.status(404).render("error", {
        error: "University not found",
        user: currentUser,
      });
    }

    // Check if faculty exists
    if (!university.faculties || university.faculties.length <= facultyIndex) {
      return res.status(404).render("error", {
        error: "Faculty not found",
        user: currentUser,
      });
    }

    const faculty = university.faculties[facultyIndex];

    res.render("facultyCourses", {
      university: university,
      faculty: faculty,
      facultyIndex: facultyIndex,
      facultyName: facultyName,
      user: currentUser,
      title: `${faculty.name} Courses - ${university.name} - Quizmize`,
    });
  } catch (error) {
    console.error("Error fetching faculty courses:", error);
    res.status(500).render("error", {
      error: "Failed to load faculty courses",
      user: res.locals.user,
    });
  }
});

// Route to show course details
router.get(
  "/:universityId/faculties/:facultyIndex/courses/:courseIndex",
  async (req, res) => {
    try {
      const { universityId, facultyIndex, courseIndex } = req.params;
      const user = req.user;

      const university = await University.findById(universityId);
      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      // Check if faculty exists
      if (!university.faculties[facultyIndex]) {
        return res.status(404).json({ error: "Faculty not found" });
      }

      const faculty = university.faculties[facultyIndex];

      // Check if course exists
      if (!faculty.courses[courseIndex]) {
        return res.status(404).json({ error: "Course not found" });
      }

      const course = faculty.courses[courseIndex];

      // Check if user is a member of the university
      const isMember = university.isMember(user._id);

      // Check if user is the dean of the faculty
      const isDean =
        faculty.dean && faculty.dean.toString() === user._id.toString();

      // Debug log
      console.log("Route Debug:", {
        facultyDean: faculty.dean,
        userId: user._id,
        isDean: isDean,
      });

      res.render("courseDetails", {
        title: `${course.courseCode} - ${course.courseName}`,
        university: {
          _id: university._id,
          name: university.name,
          // Only include necessary data
        },
        faculty: {
          name: faculty.name,
          dean: faculty.dean,
          deanName: faculty.deanName,
          // Only include necessary data
        },
        facultyIndex: parseInt(facultyIndex),
        course: {
          courseCode: course.courseCode,
          courseName: course.courseName,
          description: course.description,
          level: course.level,
          credits: course.credits,
          teacher: course.teacher,
          enrolledStudents: course.enrolledStudents || [],
          posts: course.posts || [],
          classrooms: course.classrooms || [],
        },
        courseIndex: parseInt(courseIndex),
        user: {
          _id: user._id.toString(),
          fullName: user.fullName || user.username,
          // Only include necessary data
        },
        isMember: isMember,
        isDean: isDean, // Pass the calculated value
      });
    } catch (error) {
      console.error("Error fetching course details:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// In your course routes file
router.post(
  "/:universityId/faculties/:facultyIndex/courses/:courseIndex/posts",
  async (req, res) => {
    try {
      const { universityId, facultyIndex, courseIndex } = req.params;
      const { content, postType } = req.body;
      const user = req.user;

      console.log("POST Route - User ID:", user._id);
      console.log("POST Route - Request body:", req.body);

      if (!content || !content.trim()) {
        return res.status(400).json({ error: "Post content is required" });
      }

      const university = await University.findById(universityId);
      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      // Convert indices to numbers
      const facultyIdx = parseInt(facultyIndex);
      const courseIdx = parseInt(courseIndex);

      // Check if faculty exists
      if (!university.faculties[facultyIdx]) {
        return res.status(404).json({ error: "Faculty not found" });
      }

      const faculty = university.faculties[facultyIdx];

      console.log("POST Route - Faculty Dean ID:", faculty.dean);
      console.log("POST Route - Faculty Dean ID type:", typeof faculty.dean);
      console.log("POST Route - User ID:", user._id);
      console.log("POST Route - User ID type:", typeof user._id);

      // Check if user is the dean of this faculty
      if (!faculty.dean) {
        console.log("POST Route - No dean assigned to faculty");
        return res.status(403).json({
          error: "No dean assigned to this faculty",
        });
      }

      // Convert both to strings for comparison
      const facultyDeanId = faculty.dean.toString();
      const userId = user._id.toString();

      console.log("POST Route - Dean comparison:", {
        facultyDeanId,
        userId,
        areEqual: facultyDeanId === userId,
      });

      if (facultyDeanId !== userId) {
        return res.status(403).json({
          error: "Only the faculty dean can create posts",
        });
      }

      // Check if course exists
      if (!faculty.courses[courseIdx]) {
        return res.status(404).json({ error: "Course not found" });
      }

      // Create the post using the model method
      await university.createCoursePost(
        facultyIdx,
        courseIdx,
        user._id,
        user.fullName || user.username || "Dean",
        content,
        postType || "general"
      );

      res.status(201).json({
        message: "Post created successfully",
        isDean: true,
      });
    } catch (error) {
      console.error("Error creating course post:", error);
      res.status(500).json({ error: "Internal server error" });
    }
  }
);

// POST add comment to course post
router.post(
  "/:id/faculties/:facultyIndex/courses/:courseIndex/posts/:postIndex/comments",
  requireAuth,
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const courseIndex = parseInt(req.params.courseIndex);
      const postIndex = parseInt(req.params.postIndex);
      const currentUser = res.locals.user;

      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      const { content } = req.body;

      if (!currentUser) {
        return res.status(401).json({
          error: "You must be logged in to comment",
        });
      }

      const userId = currentUser._id;
      const userName = currentUser.fullName || currentUser.username || "User";

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
  requireAuth,
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const courseIndex = parseInt(req.params.courseIndex);
      const postIndex = parseInt(req.params.postIndex);
      const currentUser = res.locals.user;

      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      if (!currentUser) {
        return res.status(401).json({
          error: "You must be logged in to like posts",
        });
      }

      const userId = currentUser._id;

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

// PUT initialize posts for all courses in a university
router.put("/:id/initialize-course-posts", requireAdmin, async (req, res) => {
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
router.get("/fix-posts", requireAdmin, async (req, res) => {
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
router.get("/fix-all-universities", requireAdmin, async (req, res) => {
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
router.get("/:id/manage-courses", requireAuth, async (req, res) => {
  try {
    const university = await University.findById(req.params.id);
    const currentUser = res.locals.user;

    if (!university) {
      return res.status(404).render("error", {
        error: "University not found",
        user: currentUser,
      });
    }

    if (!currentUser) {
      return res.status(401).json({
        error: "You must be logged in to manage courses",
      });
    }

    // Check if user is admin
    const userId = currentUser._id;
    const userRole = university.getUserRole(userId);

    if (userRole !== "admin") {
      return res.status(403).render("error", {
        error: "Only university admins can manage courses",
        user: currentUser,
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
      user: currentUser,
      title: `Manage Courses - ${university.name} - Quizmize`,
    });
  } catch (error) {
    console.error("Error fetching courses for management:", error);
    res.status(500).render("error", {
      error: "Failed to load course management",
      user: res.locals.user,
    });
  }
});

// GET course management details
router.get(
  "/:id/faculties/:facultyIndex/courses/:courseIndex/manage",
  requireAuth,
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const courseIndex = parseInt(req.params.courseIndex);
      const currentUser = res.locals.user;

      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      if (!currentUser) {
        return res.status(401).json({
          error: "You must be logged in to manage courses",
        });
      }

      // Check if user is admin
      const userId = currentUser._id;
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
  requireAuth,
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const courseIndex = parseInt(req.params.courseIndex);
      const { teacherId } = req.body;
      const currentUser = res.locals.user;

      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      if (!currentUser) {
        return res.status(401).json({
          error: "You must be logged in to assign teachers",
        });
      }

      // Check if user is admin
      const userId = currentUser._id;
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
  requireAuth,
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const courseIndex = parseInt(req.params.courseIndex);
      const classroomIndex = parseInt(req.params.classroomIndex);
      const { action, studentId } = req.body;
      const currentUser = res.locals.user;

      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      if (!currentUser) {
        return res.status(401).json({
          error: "You must be logged in to manage students",
        });
      }

      // Check if user is admin
      const userId = currentUser._id;
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
  requireAuth,
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const courseIndex = parseInt(req.params.courseIndex);
      const { name, section, schedule } = req.body;
      const currentUser = res.locals.user;

      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      if (!currentUser) {
        return res.status(401).json({
          error: "You must be logged in to create classrooms",
        });
      }

      // Check if user is admin
      const userId = currentUser._id;
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

// Create a temporary migration route in your university.route.js
router.get("/migrate-user-names", requireAdmin, async (req, res) => {
  try {
    const User = require("../Models/User.model"); // Make sure to import User model
    const universities = await University.find({});
    let updatedCount = 0;

    for (let university of universities) {
      let needsUpdate = false;

      for (let member of university.members) {
        // If userName doesn't exist but we have user reference
        if (!member.userName && member.user) {
          try {
            const user = await User.findById(member.user);
            if (user) {
              member.userName = user.fullName || user.username || "User";
              member.userEmail = user.email;
              needsUpdate = true;
              console.log(
                `Updated member ${member.user} with name: ${member.userName}`
              );
            }
          } catch (userError) {
            console.error(`Error fetching user ${member.user}:`, userError);
          }
        }
      }

      if (needsUpdate) {
        await university.save();
        updatedCount++;
      }
    }

    res.json({
      message: `Successfully migrated ${updatedCount} universities!`,
    });
  } catch (error) {
    console.error("Error migrating user names:", error);
    res.status(500).json({
      error: "Failed to migrate user names",
      details: error.message,
    });
  }
});

// POST enroll in course classroom
router.post(
  "/:id/faculties/:facultyIndex/courses/:courseIndex/enroll",
  requireAuth,
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const courseIndex = parseInt(req.params.courseIndex);
      const currentUser = res.locals.user;

      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      if (!currentUser) {
        return res.status(401).json({
          error: "You must be logged in to enroll in a course",
        });
      }

      const userId = currentUser._id;
      const { classroomIndex } = req.body;

      // Check if user is a member of the university
      if (!university.isMember(userId)) {
        return res.status(403).json({
          error: "You must be a member of this university to enroll in courses",
        });
      }

      // Check if faculty and course exist
      if (
        !university.faculties[facultyIndex] ||
        !university.faculties[facultyIndex].courses[courseIndex]
      ) {
        return res.status(404).json({ error: "Course not found" });
      }

      const course = university.faculties[facultyIndex].courses[courseIndex];

      // Check if user is the teacher (teachers cannot enroll as students)
      if (course.teacher.toString() === userId.toString()) {
        return res.status(400).json({
          error: "Teachers cannot enroll as students in their own course",
        });
      }

      // Check if classroom exists
      if (!course.classrooms || course.classrooms.length <= classroomIndex) {
        return res.status(404).json({ error: "Classroom not found" });
      }

      const classroom = course.classrooms[classroomIndex];

      // Check if user is already enrolled in this classroom
      const isAlreadyEnrolled = classroom.students?.some(
        (student) => student.student.toString() === userId.toString()
      );

      if (isAlreadyEnrolled) {
        return res
          .status(400)
          .json({ error: "You are already enrolled in this classroom" });
      }

      // Add student to classroom
      if (!classroom.students) {
        classroom.students = [];
      }

      classroom.students.push({
        student: userId,
        joinedAt: new Date(),
        status: "active",
      });

      await university.save();

      res.json({
        message: `Successfully enrolled in ${classroom.name}!`,
        classroom: classroom,
      });
    } catch (error) {
      console.error("Error enrolling in classroom:", error);
      res.status(500).json({
        error: "Failed to enroll in classroom",
        details: error.message,
      });
    }
  }
);

// POST leave course classroom
router.post(
  "/:id/faculties/:facultyIndex/courses/:courseIndex/leave",
  requireAuth,
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const courseIndex = parseInt(req.params.courseIndex);
      const currentUser = res.locals.user;

      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      if (!currentUser) {
        return res.status(401).json({
          error: "You must be logged in to leave a classroom",
        });
      }

      const userId = currentUser._id;
      const { classroomIndex } = req.body;

      // Check if faculty and course exist
      if (
        !university.faculties[facultyIndex] ||
        !university.faculties[facultyIndex].courses[courseIndex]
      ) {
        return res.status(404).json({ error: "Course not found" });
      }

      const course = university.faculties[facultyIndex].courses[courseIndex];

      // Check if classroom exists
      if (!course.classrooms || course.classrooms.length <= classroomIndex) {
        return res.status(404).json({ error: "Classroom not found" });
      }

      const classroom = course.classrooms[classroomIndex];

      // Check if user is enrolled in this classroom
      const studentIndex = classroom.students?.findIndex(
        (student) => student.student.toString() === userId.toString()
      );

      if (studentIndex === -1) {
        return res
          .status(400)
          .json({ error: "You are not enrolled in this classroom" });
      }

      // Remove student from classroom
      classroom.students.splice(studentIndex, 1);

      await university.save();

      res.json({
        message: `Successfully left ${classroom.name}`,
        classroom: classroom,
      });
    } catch (error) {
      console.error("Error leaving classroom:", error);
      res.status(500).json({
        error: "Failed to leave classroom",
        details: error.message,
      });
    }
  }
);

// POST route to enroll in course
router.post(
  "/:uniId/faculties/:facultyIndex/courses/:courseIndex/enroll-course",
  requireAuth, // Changed from authMiddleware to requireAuth
  async (req, res) => {
    try {
      const { uniId, facultyIndex, courseIndex } = req.params;
      const userId = req.user ? req.user._id : res.locals.user?._id; // Get user from either req.user or res.locals

      if (!userId) {
        return res
          .status(401)
          .json({ error: "You must be logged in to enroll in courses" });
      }

      const university = await University.findById(uniId);
      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      // Check if user is a member of the university
      if (!university.isMember(userId)) {
        return res.status(403).json({
          error: "You must be a member of this university to enroll in courses",
        });
      }

      // Check if user is the teacher
      if (
        university.isCourseTeacher(
          parseInt(facultyIndex),
          parseInt(courseIndex),
          userId
        )
      ) {
        return res.status(403).json({
          error: "Teachers cannot enroll as students in their own course",
        });
      }

      // Check if already enrolled
      if (
        university.isStudentEnrolledInCourse(
          parseInt(facultyIndex),
          parseInt(courseIndex),
          userId
        )
      ) {
        return res.status(400).json({
          error: "You are already enrolled in this course",
        });
      }

      // Enroll student in course
      await university.enrollStudentInCourse(
        parseInt(facultyIndex),
        parseInt(courseIndex),
        userId
      );

      // Get updated university to get the latest data
      const updatedUniversity = await University.findById(uniId);
      const course =
        updatedUniversity.faculties[parseInt(facultyIndex)].courses[
          parseInt(courseIndex)
        ];

      res.json({
        success: true,
        message: "Successfully enrolled in course",
        enrolledStudents: course.enrolledStudents
          ? course.enrolledStudents.length
          : 0,
      });
    } catch (error) {
      console.error("Error enrolling in course:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// POST route to leave course
router.post(
  "/:uniId/faculties/:facultyIndex/courses/:courseIndex/leave-course",
  requireAuth, // Changed from authMiddleware to requireAuth
  async (req, res) => {
    try {
      const { uniId, facultyIndex, courseIndex } = req.params;
      const userId = req.user ? req.user._id : res.locals.user?._id; // Get user from either req.user or res.locals

      if (!userId) {
        return res
          .status(401)
          .json({ error: "You must be logged in to leave a course" });
      }

      const university = await University.findById(uniId);
      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      // Check if student is enrolled
      if (
        !university.isStudentEnrolledInCourse(
          parseInt(facultyIndex),
          parseInt(courseIndex),
          userId
        )
      ) {
        return res.status(400).json({
          error: "You are not enrolled in this course",
        });
      }

      // Unenroll student from course
      await university.unenrollStudentFromCourse(
        parseInt(facultyIndex),
        parseInt(courseIndex),
        userId
      );

      res.json({
        success: true,
        message: "Successfully left the course",
      });
    } catch (error) {
      console.error("Error leaving course:", error);
      res.status(500).json({ error: error.message });
    }
  }
);

// GET manage faculties page
router.get("/:id/manage-faculties", requireAuth, async (req, res) => {
  try {
    const university = await University.findById(req.params.id);
    const currentUser = res.locals.user;

    if (!university) {
      return res.status(404).render("error", {
        error: "University not found",
        user: currentUser,
      });
    }

    if (!currentUser) {
      return res.status(401).json({
        error: "You must be logged in to manage faculties",
      });
    }

    // Check if user is admin
    const userId = currentUser._id;
    const userRole = university.getUserRole(userId);

    if (userRole !== "admin") {
      return res.status(403).render("error", {
        error: "Only university admins can manage faculties",
        user: currentUser,
      });
    }

    res.render("manageFaculties", {
      university: university,
      user: currentUser,
      title: `Manage Faculties - ${university.name} - Quizmize`,
    });
  } catch (error) {
    console.error("Error fetching faculties for management:", error);
    res.status(500).render("error", {
      error: "Failed to load faculty management",
      user: res.locals.user,
    });
  }
});

// PUT update faculty
router.put("/:id/faculties/:facultyIndex", requireAuth, async (req, res) => {
  try {
    const university = await University.findById(req.params.id);
    const facultyIndex = parseInt(req.params.facultyIndex);
    const currentUser = res.locals.user;

    if (!university) {
      return res.status(404).json({ error: "University not found" });
    }

    if (!currentUser) {
      return res.status(401).json({
        error: "You must be logged in to update faculties",
      });
    }

    const { name, description, contactEmail } = req.body;

    // Check if user is admin
    const userId = currentUser._id;
    const userRole = university.getUserRole(userId);

    if (userRole !== "admin") {
      return res.status(403).json({
        error: "Only university admins can update faculties",
      });
    }

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({
        error: "Faculty name is required",
      });
    }

    // Check if faculty exists
    if (!university.faculties || university.faculties.length <= facultyIndex) {
      return res.status(404).json({ error: "Faculty not found" });
    }

    const faculty = university.faculties[facultyIndex];

    // Check if another faculty has the same name (excluding current)
    const duplicateFaculty = university.faculties.find(
      (fac, index) =>
        index !== facultyIndex &&
        fac.name.toLowerCase() === name.toLowerCase().trim()
    );

    if (duplicateFaculty) {
      return res.status(400).json({
        error: "Another faculty with this name already exists",
      });
    }

    // Update faculty
    faculty.name = name.trim();
    faculty.description = description ? description.trim() : "";

    // Update contact email if provided, remove if empty
    if (contactEmail && contactEmail.trim()) {
      faculty.contactEmail = contactEmail.trim().toLowerCase();
    } else {
      delete faculty.contactEmail;
    }

    faculty.updatedAt = new Date();

    await university.save();

    res.json({
      message: "Faculty updated successfully!",
      faculty: faculty,
    });
  } catch (error) {
    console.error("Error updating faculty:", error);
    res.status(500).json({
      error: "Failed to update faculty",
      details: error.message,
    });
  }
});

// DELETE faculty
router.delete("/:id/faculties/:facultyIndex", requireAuth, async (req, res) => {
  try {
    const university = await University.findById(req.params.id);
    const facultyIndex = parseInt(req.params.facultyIndex);
    const currentUser = res.locals.user;

    if (!university) {
      return res.status(404).json({ error: "University not found" });
    }

    if (!currentUser) {
      return res.status(401).json({
        error: "You must be logged in to delete faculties",
      });
    }

    // Check if user is admin
    const userId = currentUser._id;
    const userRole = university.getUserRole(userId);

    if (userRole !== "admin") {
      return res.status(403).json({
        error: "Only university admins can delete faculties",
      });
    }

    // Check if faculty exists
    if (!university.faculties || university.faculties.length <= facultyIndex) {
      return res.status(404).json({ error: "Faculty not found" });
    }

    const faculty = university.faculties[facultyIndex];

    // Check if faculty has courses
    if (faculty.courses && faculty.courses.length > 0) {
      return res.status(400).json({
        error:
          "Cannot delete faculty that has courses. Please delete or move the courses first.",
        courseCount: faculty.courses.length,
      });
    }

    // Remove faculty
    university.faculties.splice(facultyIndex, 1);

    await university.save();

    res.json({
      message: "Faculty deleted successfully!",
      deletedFaculty: faculty,
    });
  } catch (error) {
    console.error("Error deleting faculty:", error);
    res.status(500).json({
      error: "Failed to delete faculty",
      details: error.message,
    });
  }
});

// GET faculty details for editing
router.get(
  "/:id/faculties/:facultyIndex/edit",
  requireAuth,
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const currentUser = res.locals.user;

      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      if (!currentUser) {
        return res.status(401).json({
          error: "You must be logged in to edit faculties",
        });
      }

      // Check if user is admin
      const userId = currentUser._id;
      const userRole = university.getUserRole(userId);

      if (userRole !== "admin") {
        return res.status(403).json({
          error: "Only university admins can edit faculties",
        });
      }

      // Check if faculty exists
      if (
        !university.faculties ||
        university.faculties.length <= facultyIndex
      ) {
        return res.status(404).json({ error: "Faculty not found" });
      }

      const faculty = university.faculties[facultyIndex];

      res.json({
        faculty: faculty,
        facultyIndex: facultyIndex,
      });
    } catch (error) {
      console.error("Error fetching faculty details:", error);
      res.status(500).json({
        error: "Failed to fetch faculty details",
        details: error.message,
      });
    }
  }
);

// POST assign dean to faculty
router.post(
  "/:id/faculties/:facultyIndex/assign-dean",
  requireAuth,
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const { deanId } = req.body;
      const currentUser = res.locals.user;

      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      if (!currentUser) {
        return res.status(401).json({
          error: "You must be logged in to assign dean",
        });
      }

      // Check if user is admin
      const userId = currentUser._id;
      const userRole = university.getUserRole(userId);

      if (userRole !== "admin") {
        return res.status(403).json({
          error: "Only university admins can assign deans",
        });
      }

      // Check if faculty exists
      if (
        !university.faculties ||
        university.faculties.length <= facultyIndex
      ) {
        return res.status(404).json({ error: "Faculty not found" });
      }

      const faculty = university.faculties[facultyIndex];

      // If deanId is empty/null, remove dean
      if (!deanId || deanId.trim() === "") {
        faculty.dean = null;
        faculty.deanName = null;
        await university.save();

        return res.json({
          message: "Dean removed successfully!",
          faculty: faculty,
        });
      }

      // Check if dean is a member of the university
      const isMember = university.isMember(deanId);
      if (!isMember) {
        return res.status(400).json({
          error: "Selected dean must be a member of this university",
        });
      }

      // Get dean's details
      const deanMember = university.members.find(
        (member) => member.user.toString() === deanId.toString()
      );

      // Update dean
      faculty.dean = deanId;
      faculty.deanName = deanMember.userName || "Dean";

      await university.save();

      res.json({
        message: "Dean assigned successfully!",
        faculty: faculty,
      });
    } catch (error) {
      console.error("Error assigning dean:", error);
      res.status(500).json({
        error: "Failed to assign dean",
        details: error.message,
      });
    }
  }
);

// GET available deans for a faculty
router.get(
  "/:id/faculties/:facultyIndex/available-deans",
  requireAuth,
  async (req, res) => {
    try {
      const university = await University.findById(req.params.id);
      const facultyIndex = parseInt(req.params.facultyIndex);
      const currentUser = res.locals.user;

      if (!university) {
        return res.status(404).json({ error: "University not found" });
      }

      if (!currentUser) {
        return res.status(401).json({
          error: "You must be logged in to view deans",
        });
      }

      // Check if user is admin
      const userId = currentUser._id;
      const userRole = university.getUserRole(userId);

      if (userRole !== "admin") {
        return res.status(403).json({
          error: "Only university admins can view available deans",
        });
      }

      // Check if faculty exists
      if (
        !university.faculties ||
        university.faculties.length <= facultyIndex
      ) {
        return res.status(404).json({ error: "Faculty not found" });
      }

      // Get all university members who are teachers or admins (potential deans)
      const potentialDeans = university.members
        .filter(
          (member) =>
            member.role === "admin" ||
            member.role === "teacher" ||
            member.role === "student" // You might want to restrict this
        )
        .map((member) => ({
          _id: member.user,
          name: member.userName || "User",
          email: member.userEmail || "",
          role: member.role,
          level: member.level,
          xp: member.xp,
        }));

      res.json({
        availableDeans: potentialDeans,
        currentDean: university.faculties[facultyIndex].dean,
        currentDeanName: university.faculties[facultyIndex].deanName,
      });
    } catch (error) {
      console.error("Error fetching available deans:", error);
      res.status(500).json({
        error: "Failed to fetch available deans",
        details: error.message,
      });
    }
  }
);

module.exports = router;
