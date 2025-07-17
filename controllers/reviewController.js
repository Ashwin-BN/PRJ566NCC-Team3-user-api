// controllers/reviewController.js
const Review = require('../models/reviewModel');

// Create a new review
exports.createReview = async (req, res) => {
  try {
    const { attractionId, rating, comment } = req.body;
    const userId = req.user._id;

    // Check if the user already reviewed this attraction
    const existing = await Review.findOne({ attractionId, userId });
    if (existing) {
      return res.status(400).json({ message: 'You have already reviewed this attraction.' });
    }

    const review = new Review({
      userId,
      attractionId,
      rating,
      comment,
    });
    await review.save();

    res.status(201).json(review);
  } catch (error) {
    console.error('Error creating review:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Get all reviews for an attraction
exports.getReviews = async (req, res) => {
  try {
    const { attractionId } = req.params;
    const reviews = await Review.find({ attractionId }).populate('userId', 'userName');
    res.json(reviews);
  } catch (error) {
    console.error('Error fetching reviews:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Update a review
exports.updateReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { rating, comment } = req.body;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found.' });
    }

    // Only allow the owner to update
    if (review.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    review.rating = rating;
    review.comment = comment;
    await review.save();

    res.json(review);
  } catch (error) {
    console.error('Error updating review:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};

// Delete a review
exports.deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: 'Review not found.' });
    }

    // Only allow the owner to delete
    if (review.userId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ message: 'Not authorized.' });
    }

    await review.deleteOne();
    res.json({ message: 'Review deleted successfully.' });
  } catch (error) {
    console.error('Error deleting review:', error);
    res.status(500).json({ message: 'Server error.' });
  }
};
