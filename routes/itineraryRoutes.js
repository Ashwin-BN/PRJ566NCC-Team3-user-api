const express = require('express');
const router = express.Router();
const syncController = require('../controllers/syncController');

// Sync itinerary to calendar
router.post('/itineraries/:id/sync', syncController.syncItinerary);

// Export router
module.exports = router;
