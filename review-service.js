const mongoose = require('mongoose');
const Review = require('./models/Review');
const Attraction = require('./models/Attraction');

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

// helper to enrich reviews with attraction doc (name/address/url)
async function enrichWithAttractions(reviews) {
  if (!reviews || reviews.length === 0) return reviews;

  try {
    const ids = [...new Set(reviews.map(r => r.attractionId))];
    const attractions = await Attraction.find({ id: { $in: ids } })
        .select('id name address url')
        .lean();
    const byId = Object.fromEntries(attractions.map(a => [a.id, a]));
    return reviews.map(r => ({ ...r, attraction: byId[r.attractionId] || null }));
  } catch (e) {
    console.warn('Attraction enrichment failed:', e?.message || e);
    return reviews; // fail open (don’t crash callers)
  }
}

// last N reviews for a user
module.exports.getRecentReviewsByUser = async function (userId, limit = 5) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  return Review.aggregate([
    {$match: {userId: userObjectId}},
    {$sort: {createdAt: -1}},
    {$limit: limit},
    {
      $lookup: {
        from: 'attractions',          // collection name
        localField: 'attractionId',   // Review.attractionId (string)
        foreignField: 'id',           // Attraction.id (string)
        as: 'attraction'
      }
    },
    {$unwind: {path: '$attraction', preserveNullAndEmptyArrays: true}},
    // Keep only what you need:
    {
      $project: {
        attractionId: 1,
        rating: 1,
        comment: 1,
        createdAt: 1,
        'attraction.id': 1,
        'attraction.name': 1,
        'attraction.address': 1,
        'attraction.url': 1
      }
    }
  ]);
};

// paginated reviews for a user
module.exports.getReviewsByUser = async function (userId, { page = 1, limit = 10 } = {}) {
  page = Math.max(parseInt(page, 10) || 1, 1);
  limit = Math.min(Math.max(parseInt(limit, 10) || 10, 1), 50);
  const skip = (page - 1) * limit;
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const [rows, [{ count: total } = { count: 0 }]] = await Promise.all([
    Review.aggregate([
      { $match: { userId: userObjectId } },
      { $sort: { createdAt: -1 } },
      { $skip: skip },
      { $limit: limit },
      {
        $lookup: {
          from: 'attractions',
          localField: 'attractionId',
          foreignField: 'id',
          as: 'attraction'
        }
      },
      { $unwind: { path: '$attraction', preserveNullAndEmptyArrays: true } },
      {
        $project: {
          attractionId: 1,
          rating: 1,
          comment: 1,
          createdAt: 1,
          'attraction.id': 1,
          'attraction.name': 1,
          'attraction.address': 1,
          'attraction.url': 1
        }
      }
    ]),
    Review.aggregate([{ $match: { userId: userObjectId } }, { $count: 'count' }])
  ]);

  return { reviews: rows, total, page, limit, pageCount: Math.ceil(total / limit) };
};

