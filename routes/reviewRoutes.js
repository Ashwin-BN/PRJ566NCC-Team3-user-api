const express = require('express');
const router = express.Router();
const Review = require('../models/Review');
const { authenticateToken } = require('../middleware/authMiddleware');

// Get all reviews for an attraction
router.get('/:attractionId', async (req, res) => {
  try {
    const reviews = await Review.find({ attractionId: req.params.attractionId })
      .populate('userId', 'userName');
    res.json(reviews);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Create a new review
router.post('/', authenticateToken, async (req, res) => {
  try {
    const { attractionId, rating, comment } = req.body;

    const existing = await Review.findOne({
      attractionId,
      userId: req.user.id,
    });
    if (existing) {
      return res.status(400).json({ message: 'You have already reviewed this attraction.' });
    }

    const review = new Review({
      attractionId,
      rating,
      comment,
      userId: req.user.id,
    });

    await review.save();

    // Populate username before sending response
    const savedReview = await Review.findById(review._id).populate('userId', 'userName');
    res.status(201).json(savedReview);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Update a review
router.put('/:id', authenticateToken, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: 'Review not found' });

    if (review.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: 'Not authorized to edit this review' });
    }

    review.rating = req.body.rating ?? review.rating;
    review.comment = req.body.comment ?? review.comment;

    await review.save();
    res.json(review);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Delete a review
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ message: "Review not found" });

    if (review.userId.toString() !== req.user.id) {
      return res.status(403).json({ message: "Unauthorized" });
    }

    await Review.deleteOne({ _id: review._id });
    res.json({ message: "Review deleted successfully" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

module.exports = router;
