const express = require('express');
const router = express.Router();
const {
  syncItinerary,
  googleCallback, // ✅ make sure this is exported from controller
} = require('../controllers/syncController');

// POST /api/itineraries/:id/sync
router.post('/itineraries/:id/sync', syncItinerary);

// GET /api/itineraries/google/callback
router.get('/itineraries/google/callback', googleCallback);

module.exports = router;
