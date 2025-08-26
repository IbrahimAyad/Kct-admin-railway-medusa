const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const { Client } = require("pg");
const cors = require("cors");
const jwt = require("jsonwebtoken");

// Create a router for admin auth
const createAdminAuthRouter = () => {
  const router = express.Router();
  
  // Generate JWT token
  const generateToken = (user) => {
    return jwt.sign(
      { 
        id: user.id, 
        email: user.email,
        role: user.role 
      },
      process.env.JWT_SECRET || "supersecret",
      { expiresIn: "7d" }
    );
  };

  // POST /admin/auth - Login endpoint
  router.post("/auth", async (req, res) => {
    console.log("Admin auth endpoint called");
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        message: "Email and password are required" 
      });
    }

    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      const result = await client.query(
        `SELECT id, email, first_name, last_name, password_hash, role, api_token, created_at, updated_at 
         FROM "user" 
         WHERE email = $1 AND role = 'admin'`,
        [email]
      );

      if (result.rows.length === 0) {
        console.log("Admin user not found:", email);
        return res.status(401).json({ 
          message: "Invalid email or password" 
        });
      }

      const user = result.rows[0];
      const isValid = await bcrypt.compare(password, user.password_hash);
      
      if (!isValid) {
        console.log("Invalid password for:", email);
        return res.status(401).json({ 
          message: "Invalid email or password" 
        });
      }

      // Generate token
      const token = generateToken(user);
      
      // Set session
      req.session.jwt = token;
      req.session.user_id = user.id;
      req.session.user = {
        id: user.id,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        role: user.role
      };
      
      console.log("Login successful for:", email);
      
      // Return user with token
      res.json({
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name || "",
          last_name: user.last_name || "",
          role: user.role,
          api_token: token,
          created_at: user.created_at,
          updated_at: user.updated_at
        }
      });

    } catch (error) {
      console.error("Auth error:", error);
      res.status(500).json({ 
        message: "Internal server error" 
      });
    } finally {
      await client.end();
    }
  });

  // GET /admin/auth - Get current user
  router.get("/auth", async (req, res) => {
    console.log("Get auth endpoint called");
    
    if (!req.session || !req.session.user_id) {
      return res.status(401).json({ 
        message: "Not authenticated" 
      });
    }

    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      const result = await client.query(
        `SELECT id, email, first_name, last_name, role, api_token, created_at, updated_at 
         FROM "user" 
         WHERE id = $1`,
        [req.session.user_id]
      );

      if (result.rows.length === 0) {
        req.session.destroy();
        return res.status(401).json({ 
          message: "User not found" 
        });
      }

      const user = result.rows[0];
      
      res.json({
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name || "",
          last_name: user.last_name || "",
          role: user.role,
          api_token: req.session.jwt || user.api_token,
          created_at: user.created_at,
          updated_at: user.updated_at
        }
      });

    } catch (error) {
      console.error("Get auth error:", error);
      res.status(500).json({ 
        message: "Internal server error" 
      });
    } finally {
      await client.end();
    }
  });

  // DELETE /admin/auth - Logout
  router.delete("/auth", (req, res) => {
    console.log("Logout endpoint called");
    
    if (req.session) {
      req.session.destroy((err) => {
        if (err) {
          console.error("Session destroy error:", err);
        }
      });
    }
    
    res.status(200).json({ success: true });
  });

  // GET /admin/users - List users (required by admin panel)
  router.get("/users", async (req, res) => {
    console.log("List users endpoint called");
    
    if (!req.session || !req.session.user_id) {
      return res.status(401).json({ 
        message: "Not authenticated" 
      });
    }

    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      const result = await client.query(
        `SELECT id, email, first_name, last_name, role, created_at, updated_at 
         FROM "user" 
         ORDER BY created_at DESC`
      );

      res.json({
        users: result.rows.map(user => ({
          id: user.id,
          email: user.email,
          first_name: user.first_name || "",
          last_name: user.last_name || "",
          role: user.role || "member",
          created_at: user.created_at,
          updated_at: user.updated_at
        })),
        count: result.rows.length,
        offset: 0,
        limit: 100
      });

    } catch (error) {
      console.error("List users error:", error);
      res.status(500).json({ 
        message: "Internal server error" 
      });
    } finally {
      await client.end();
    }
  });

  // GET /admin/users/me - Get current user
  router.get("/users/me", async (req, res) => {
    console.log("Get current user endpoint called");
    
    if (!req.session || !req.session.user_id) {
      return res.status(401).json({ 
        message: "Not authenticated" 
      });
    }

    const client = new Client({
      connectionString: process.env.DATABASE_URL
    });

    try {
      await client.connect();
      
      const result = await client.query(
        `SELECT id, email, first_name, last_name, role, api_token, created_at, updated_at 
         FROM "user" 
         WHERE id = $1`,
        [req.session.user_id]
      );

      if (result.rows.length === 0) {
        req.session.destroy();
        return res.status(401).json({ 
          message: "User not found" 
        });
      }

      const user = result.rows[0];
      
      res.json({
        user: {
          id: user.id,
          email: user.email,
          first_name: user.first_name || "",
          last_name: user.last_name || "",
          role: user.role,
          api_token: req.session.jwt || user.api_token,
          created_at: user.created_at,
          updated_at: user.updated_at
        }
      });

    } catch (error) {
      console.error("Get current user error:", error);
      res.status(500).json({ 
        message: "Internal server error" 
      });
    } finally {
      await client.end();
    }
  });

  return router;
};

module.exports = { createAdminAuthRouter };