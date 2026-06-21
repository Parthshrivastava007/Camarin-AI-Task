const User = require('../models/User');
const jwt = require('jsonwebtoken');
const config = require('../config');

// Helper to generate JWT token
const generateToken = (user) => {
  return jwt.sign(
    { id: user._id, username: user.username },
    config.jwtSecret,
    { expiresIn: config.jwtExpiresIn }
  );
};

// @desc    Register a new user
// @route   POST /api/auth/register
// @access  Public
const registerUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    if (!username || !password) {
      return res.status(400).json({ error: 'Please provide both username and password' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters long' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters long' });
    }

    // Check if user already exists
    const userExists = await User.findOne({ username });
    if (userExists) {
      return res.status(400).json({ error: 'Username is already taken' });
    }

    // Create user
    const user = await User.create({
      username,
      password,
    });

    if (user) {
      return res.status(201).json({
        token: generateToken(user),
        user: {
          id: user._id,
          username: user.username,
        },
      });
    } else {
      return res.status(400).json({ error: 'Invalid user data' });
    }
  } catch (error) {
    console.error('Register Error:', error);
    return res.status(500).json({ error: 'Server error during registration' });
  }
};

// @desc    Authenticate user & get token
// @route   POST /api/auth/login
// @access  Public
const loginUser = async (req, res) => {
  const { username, password } = req.body;

  try {
    if (!username || !password) {
      return res.status(400).json({ error: 'Please provide username and password' });
    }

    // Check for user
    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    // Check password match
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    return res.json({
      token: generateToken(user),
      user: {
        id: user._id,
        username: user.username,
      },
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ error: 'Server error during login' });
  }
};

module.exports = {
  registerUser,
  loginUser,
};
