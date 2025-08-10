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
function decodeHexTitle(maybeHex) {
  if (!maybeHex || typeof maybeHex !== 'string') return null;
  // hex-ish? even length & only hex digits
  if (!/^[0-9a-f]+$/i.test(maybeHex) || maybeHex.length % 2 !== 0) return null;
  try {
    const s = Buffer.from(maybeHex, 'hex').toString('utf8');
    // basic sanity: has some printable chars
    return /[ -~]/.test(s) ? s : null;
  } catch {
    return null;
  }
}

// last N reviews for a user
module.exports.getRecentReviewsByUser = async function (userId, limit = 5) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const rows = await Review.aggregate([
    { $match: { userId: userObjectId } },
    { $sort: { createdAt: -1 } },
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
  ]);

  // Fallback: if no attraction found, try to decode a readable name from the hex id
  return rows.map(r => {
    if (!r.attraction) {
      const decoded = decodeHexTitle(r.attractionId);
      if (decoded) {
        r.attraction = { id: r.attractionId, name: decoded };
      }
    }
    return r;
  });
};

// paginated reviews for a user
module.exports.getReviewsByUser = async function (userId, { page = 1, limit = 10 } = {}) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const [reviews, total] = await Promise.all([
    Review.find({ userId: userObjectId })
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    Review.countDocuments({ userId: userObjectId })
  ]);

  // Option A: keep your existing enrichment via Attraction model
  const ids = [...new Set(reviews.map(r => r.attractionId))];
  const attractions = await Attraction.find({ id: { $in: ids } })
      .select('id name address url')
      .lean();
  const byId = Object.fromEntries(attractions.map(a => [a.id, a]));

  const enriched = reviews.map(r => {
    let attraction = byId[r.attractionId] || null;

    // 🔁 Fallback to hex-decoded name when we don't have an Attraction doc
    if (!attraction) {
      const decoded = decodeHexTitle(r.attractionId);
      if (decoded) {
        attraction = { id: r.attractionId, name: decoded };
      }
    }

    return { ...r, attraction };
  });

  return {
    reviews: enriched,
    total,
    page,
    pageCount: Math.ceil(total / limit)
  };
};

