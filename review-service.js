// review-service.js
const mongoose = require('mongoose');
const Review = require('./models/Review');
const Attraction = require('./models/Attraction');

let mongoDBConnectionString = process.env.MONGO_URL;

/**
 * 1) Connect to MongoDB
 */
module.exports.connect = function () {
  return mongoose.connect(mongoDBConnectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: 'easy_explore'
  });
};

/**
 * Small helper: try to decode a readable title from a hex-only string
 * (some providers pack titles in hex).
 */
function decodeHexTitle(maybeHex) {
  if (!maybeHex || typeof maybeHex !== 'string') return null;
  if (!/^[0-9a-f]+$/i.test(maybeHex) || maybeHex.length % 2 !== 0) return null;
  try {
    const s = Buffer.from(maybeHex, 'hex').toString('utf8');
    return /[ -~]/.test(s) ? s : null; // at least one printable ASCII
  } catch {
    return null;
  }
}

/**
 * 2) Add a new review
 *    Accepts optional snapshot fields:
 *    - attractionName
 *    - attractionAddress
 *    - attractionImage
 */
module.exports.addReview = function (userId, reviewData) {
  return new Promise(async (resolve, reject) => {
    try {
      const {
        attractionId,
        rating,
        comment,
        // optional snapshots
        attractionName,
        attractionAddress,
        attractionImage
      } = reviewData;

      if (!attractionId || !rating) {
        return reject('Attraction ID and rating are required.');
      }

      let userObjectId;
      try {
        userObjectId = new mongoose.Types.ObjectId(userId);
      } catch {
        return reject('Invalid userId format.');
      }

      // Prevent multiple reviews by same user for same attraction
      const existing = await Review.findOne({
        userId: userObjectId,
        attractionId: attractionId // keep as string
      });
      if (existing) return reject('You have already reviewed this attraction.');

      const newReview = new Review({
        attractionId,                 // keep as string
        userId: userObjectId,
        rating,
        comment,
        // snapshot fields (optional)
        attractionName,
        attractionAddress,
        attractionImage
      });

      const saved = await newReview.save();
      resolve(saved);
    } catch (err) {
      reject('Error saving review: ' + (err?.message || err));
    }
  });
};

/**
 * 3) Get all reviews for an attraction (sorted newest first)
 */
module.exports.getReviewsForAttraction = function (attractionId) {
  return Review.find({ attractionId }) // keep as string
      .sort({ createdAt: -1 })
      .populate('userId', 'userName')
      .lean()
      .exec();
};

/**
 * 4) Delete a review (only by owner)
 */
module.exports.deleteReview = async (reviewId, userId) => {
  const review = await Review.findById(reviewId);
  if (!review) return false;
  if (review.userId.toString() !== userId.toString()) return false;
  await Review.deleteOne({ _id: reviewId });
  return true;
};

/**
 * 5) Last N reviews for a user (prefers snapshot fields, falls back to Attraction join, then hex)
 */
module.exports.getRecentReviewsByUser = async function (userId, limit = 5) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const rows = await Review.aggregate([
    { $match: { userId: userObjectId } },
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'attractions',           // collection name
        localField: 'attractionId',    // Review.attractionId (string)
        foreignField: 'id',            // Attraction.id (string)
        as: 'attraction'
      }
    },
    { $unwind: { path: '$attraction', preserveNullAndEmptyArrays: true } },
    {
      // Prefer snapshot fields if present; otherwise use joined Attraction
      $project: {
        attractionId: 1,
        rating: 1,
        comment: 1,
        createdAt: 1,

        attractionName:    { $ifNull: ['$attractionName', '$attraction.name'] },
        attractionAddress: { $ifNull: ['$attractionAddress', '$attraction.address'] },
        attractionImage:   { $ifNull: ['$attractionImage', '$attraction.image'] },

        // keep full joined doc minimally (optional)
        'attraction.id': 1,
        'attraction.name': 1,
        'attraction.address': 1,
        'attraction.url': 1,
        'attraction.image': 1
      }
    }
  ]);

  // Final fallback: decode hex-ish attractionId to a readable name.
  return rows.map(r => {
    if (!r.attractionName) {
      const decoded = decodeHexTitle(r.attractionId);
      if (decoded) r.attractionName = decoded;
    }
    return r;
  });
};

/**
 * 6) Paginated reviews for a user (prefers snapshot fields, then Attraction join, then hex)
 */
module.exports.getReviewsByUser = async function (userId, { page = 1, limit = 10 } = {}) {
  const userObjectId = new mongoose.Types.ObjectId(userId);
  const skip = (page - 1) * limit;

  const [reviews, total] = await Promise.all([
    Review.find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
    Review.countDocuments({ userId: userObjectId })
  ]);

  // If snapshots missing, still try to enrich from Attraction
  const ids = [...new Set(reviews.map(r => r.attractionId))];
  const attractions = await Attraction.find({ id: { $in: ids } })
      .select('id name address image url')
      .lean();
  const byId = Object.fromEntries(attractions.map(a => [a.id, a]));

  const enriched = reviews.map(r => {
    const a = byId[r.attractionId];

    // prefer snapshots already on the review
    let attractionName    = r.attractionName    || a?.name    || null;
    let attractionAddress = r.attractionAddress || a?.address || null;
    let attractionImage   = r.attractionImage   || a?.image   || null;

    // last-resort hex decode to show something readable
    if (!attractionName) {
      const decoded = decodeHexTitle(r.attractionId);
      if (decoded) attractionName = decoded;
    }

    return {
      ...r,
      attractionName,
      attractionAddress,
      attractionImage,
      attraction: a || null
    };
  });

  return {
    reviews: enriched,
    total,
    page,
    pageCount: Math.ceil(total / limit)
  };
};