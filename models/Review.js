// models/Review.js
const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const reviewSchema = new Schema({
  attractionId: { type: String, required: true },

  attractionName: { type: String, trim: true },
  attractionAddress: { type: String, trim: true },
  attractionImage: { type: String, trim: true },

  userId: {
    type: Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  rating: { type: Number, required: true, min: 1, max: 5 },
  comment: { type: String, trim: true },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.models.Review || mongoose.model('Review', reviewSchema);