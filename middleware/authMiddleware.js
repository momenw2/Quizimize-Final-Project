const jwt = require("jsonwebtoken");
const User = require("../Models/User.model");

const requireAuth = (req, res, next) => {
  const token = req.cookies.jwt;

  // Check json web token exists and is verified
  if (token) {
    jwt.verify(token, "secret", (err, decodedToken) => {
      if (err) {
        console.log(err.message);

        // Check if it's an API request (JSON/XMLHttpRequest)
        if (req.xhr || req.headers.accept.indexOf("json") > -1) {
          return res.status(401).json({ error: "Authentication required" });
        } else {
          res.redirect("/login");
        }
      } else {
        console.log(decodedToken);
        next();
      }
    });
  } else {
    // Check if it's an API request (JSON/XMLHttpRequest)
    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.status(401).json({ error: "Authentication required" });
    } else {
      res.redirect("/login");
    }
  }
};

// Check current user
const checkUser = (req, res, next) => {
  const token = req.cookies.jwt;

  if (token) {
    jwt.verify(token, "secret", async (err, decodedToken) => {
      if (err) {
        console.log(err.message);
        res.locals.user = null;
        req.user = null; // Also set req.user for compatibility
        next();
      } else {
        try {
          let user = await User.findById(decodedToken.id);
          res.locals.user = user;
          req.user = user; // Also set req.user for compatibility
          next();
        } catch (error) {
          console.error("Error fetching user:", error);
          res.locals.user = null;
          req.user = null;
          next();
        }
      }
    });
  } else {
    res.locals.user = null;
    req.user = null; // Also set req.user for compatibility
    next();
  }
};

// Require admin role
const requireAdmin = (req, res, next) => {
  const token = req.cookies.jwt;

  if (token) {
    jwt.verify(token, "secret", async (err, decodedToken) => {
      if (err) {
        console.log(err.message);
        if (req.xhr || req.headers.accept.indexOf("json") > -1) {
          return res.status(401).json({ error: "Authentication required" });
        } else {
          res.redirect("/login");
        }
      } else {
        try {
          let user = await User.findById(decodedToken.id);

          // Check if user has admin role
          if (user && user.role === "admin") {
            res.locals.user = user;
            req.user = user;
            next();
          } else {
            if (req.xhr || req.headers.accept.indexOf("json") > -1) {
              return res.status(403).json({ error: "Admin access required" });
            } else {
              res.status(403).send("Admin access required");
            }
          }
        } catch (error) {
          console.error("Error fetching user:", error);
          if (req.xhr || req.headers.accept.indexOf("json") > -1) {
            return res.status(500).json({ error: "Server error" });
          } else {
            res.status(500).send("Server error");
          }
        }
      }
    });
  } else {
    if (req.xhr || req.headers.accept.indexOf("json") > -1) {
      return res.status(401).json({ error: "Authentication required" });
    } else {
      res.redirect("/login");
    }
  }
};

module.exports = { requireAuth, checkUser, requireAdmin };
