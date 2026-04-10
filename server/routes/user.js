const express = require('express');
const router = express.Router();
const pool = require('../db'); // PostgreSQL pool

// Get logged-in user's profile info
router.get('/profile/info', async (req, res) => {
  try {
    if (!req.user || !req.user.google_id) {
      return res.status(401).json({ error: 'Not logged in' });
    }

    const googleId = req.user.google_id;

    const [userRes, postCountRes, followerData] = await Promise.all([
      pool.query(
        'SELECT username, bio, profile_pic FROM users WHERE google_id = $1',
        [googleId]
      ),
      pool.query('SELECT COUNT(*) FROM posts WHERE google_id = $1', [googleId]),
      pool.query(
        `SELECT
          (SELECT COUNT(*) FROM following WHERE following_id = $1) AS followers,
          (SELECT COUNT(*) FROM following WHERE follower_id = $1) AS following`,
        [googleId]
      )
    ]);

    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userRes.rows[0];
    const posts = parseInt(postCountRes.rows[0].count, 10);
    const followers = parseInt(followerData.rows[0].followers, 10);
    const following = parseInt(followerData.rows[0].following, 10);

    res.json({
      username: user.username,
      bio: user.bio,
      profile_pic: user.profile_pic,
      posts,
      followers,
      following
    });
  } catch (err) {
    console.error('Error in /api/user/profile/info:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get current user's Google ID
router.get('/me', (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Not logged in' });
  res.json({ google_id: req.user.google_id });
});

// Get logged-in user's email
router.get('/email', (req, res) => {
  if (!req.user || !req.user.email) {
    return res.status(401).json({ success: false, error: 'Not logged in' });
  }
  res.json({ success: true, email: req.user.email });
});

module.exports = router;