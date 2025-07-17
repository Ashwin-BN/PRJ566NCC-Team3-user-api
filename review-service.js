const mongoose = require('mongoose');
const Review = require('./models/Review');

let mongoDBConnectionString = process.env.MONGO_URL;

// 1️⃣ Connect to MongoDB
module.exports.connect = function () {
  return mongoose.connect(mongoDBConnectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: 'easy_explore'
  });
};

// 2️⃣ Add a new review
module.exports.addReview = function (userId, reviewData) {
  return new Promise((resolve, reject) => {
    const { attractionId, rating, comment } = reviewData;

    if (!attractionId || !rating) {
      reject("Attraction ID and rating are required.");
      return;
    }

    let userObjectId;
    try {
      userObjectId = new mongoose.Types.ObjectId(userId);
    } catch (err) {
      reject("Invalid userId format.");
      return;
    }

    // Check if the user has already reviewed this attraction
    Review.findOne({
      userId: userObjectId,
      attractionId: attractionId // DO NOT convert to ObjectId!
    })
      .then(existing => {
        if (existing) {
          reject("You have already reviewed this attraction.");
        } else {
          const newReview = new Review({
            attractionId: attractionId, // KEEP AS STRING
            userId: userObjectId,
            rating,
            comment
          });

          newReview.save()
            .then(saved => resolve(saved))
            .catch(err => reject("Error saving review: " + err));
        }
      })
      .catch(err => reject("Error checking existing review: " + err));
  });
};

// 3️⃣ Get all reviews for an attraction
module.exports.getReviewsForAttraction = function (attractionId) {
  return Review.find({
    attractionId: attractionId // KEEP AS STRING
  })
    .sort({ createdAt: -1 })
    .populate('userId', 'userName')
    .exec();
};

module.exports.deleteReview = async (reviewId, userId) => {
  const review = await Review.findById(reviewId);
  if (!review) return false;
  if (review.userId.toString() !== userId.toString()) return false;
  await Review.deleteOne({ _id: reviewId });
  return true;
};

