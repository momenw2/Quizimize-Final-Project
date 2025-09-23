const express = require("express");
const authController = require("../Controllers/authController");
const router = express.Router();
const User = require("../Models/User.model");
const jwt = require("jsonwebtoken");

router.get("/signup", authController.signup_get);
router.post("/signup", authController.signup_post);
router.get("/login", authController.login_get);
router.post("/login", authController.login_post);
router.get("/logout", authController.logout_get);
router.post("/saveQuizHistory", authController.saveQuizHistory);

// Define a route to fetch all data for the logged-in user
router.get("/userdata", async (req, res) => {
  try {
    // Check if the JWT token exists in the request cookies
    const token = req.cookies.jwt;
    if (!token) {
      throw new Error("JWT token not found in the cookie");
    }

    // Verify the JWT token
    const decodedToken = jwt.verify(token, "secret");

    // Extract the user ID from the decoded token
    const userId = decodedToken.id;

    // Retrieve the user's data from the database using the user ID
    const userData = await User.findById(userId);

    // Check if the user data exists
    if (!userData) {
      throw new Error("User data not found");
    }

    // Send the user's data as a response
    res.status(200).json(userData);
  } catch (err) {
    // Handle errors
    console.error("Error fetching user data:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Define a route to render edit profile page
router.get("/editProfile", async (req, res) => {
  try {
    // Check if the JWT token exists in the request cookies
    const token = req.cookies.jwt;
    if (!token) {
      throw new Error("JWT token not found in the cookie");
    }

    // Verify the JWT token
    const decodedToken = jwt.verify(token, "secret");

    // Extract the user ID from the decoded token
    const userId = decodedToken.id;

    // Retrieve the user's data from the database using the user ID
    const userData = await User.findById(userId);

    // Check if the user data exists
    if (!userData) {
      throw new Error("User data not found");
    }

    // Render the editProfilePage.ejs view and pass user data
    res.render("editProfilePage", { user: userData });
  } catch (err) {
    // Handle errors
    console.error("Error fetching user data:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// Define a route to update user profile
router.post("/updateProfile", async (req, res) => {
  try {
    // Check if the JWT token exists in the request cookies
    const token = req.cookies.jwt;
    if (!token) {
      throw new Error("JWT token not found in the cookie");
    }

    // Verify the JWT token
    const decodedToken = jwt.verify(token, "secret");

    // Extract the user ID from the decoded token
    const userId = decodedToken.id;

    // Update user data in the database
    const updatedUser = await User.findByIdAndUpdate(
      userId,
      {
        fullName: req.body.fullName,
        email: req.body.email,
      },
      { new: true }
    );

    // Check if the user data exists
    if (!updatedUser) {
      throw new Error("User data not found");
    }

    // Send the updated user data as a response
    res.status(200).json(updatedUser);
  } catch (err) {
    // Handle errors
    console.error("Error updating user data:", err.message);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
