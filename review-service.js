const mongoose = require('mongoose');
const Review = require('./models/Review');
const Attraction = require('./models/Attraction');

let mongoDBConnectionString = process.env.MONGO_URL;

// 1) Connect
module.exports.connect = function () {
  return mongoose.connect(mongoDBConnectionString, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
    dbName: 'easy_explore'
  });
};

// ---------- Helpers ----------

// Is a string mostly printable?
function isMostlyPrintable(s) {
  if (!s) return false;
  const printable = s.replace(/[^\p{L}\p{N}\p{P}\p{Zs}]/gu, '');
  return printable.length / s.length > 0.6 && printable.trim().length >= 4;
}

// Hex -> UTF8 (browser-safe equivalent, but here we’re in Node)
function hexToUtf8Safe(hex) {
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return '';
  try {
    const buf = Buffer.from(hex, 'hex');
    const txt = buf.toString('utf8');
    return isMostlyPrintable(txt) ? txt : '';
  } catch {
    return '';
  }
}

// Base64 -> UTF8
function b64ToUtf8Safe(b64) {
  if (!/^[A-Za-z0-9+/=]+$/.test(b64) || b64.length % 4 !== 0) return '';
  try {
    const txt = Buffer.from(b64, 'base64').toString('utf8');
    return isMostlyPrintable(txt) ? txt : '';
  } catch {
    return '';
  }
}

// Extract a nice, human title from a weird string:
// - split on non-printables, take the LONGEST segment
function prettifyTitle(s) {
  if (!s) return '';
  const segments = s.split(/[^\p{L}\p{N}\p{P}\p{Zs}]+/gu).filter(Boolean);
  if (!segments.length) return s.trim();
  segments.sort((a, b) => b.length - a.length);
  return segments[0].trim();
}

// Best-effort decode of an attractionId to a readable title
function decodeAttractionIdToName(id) {
  if (!id || typeof id !== 'string') return '';

  // Try hex
  const hex = hexToUtf8Safe(id);
  if (hex) return prettifyTitle(hex);

  // Try base64
  const b64 = b64ToUtf8Safe(id);
  if (b64) return prettifyTitle(b64);

  // Fallback: prettify the raw id
  return prettifyTitle(id);
}

// Build flattened fields for the frontend
function flattenAttractionFields(row) {
  // Prefer real Attraction doc
  let name = row?.attraction?.name || '';
  let image = row?.attraction?.image || '';
  let address = row?.attraction?.address || '';
  let url = row?.attraction?.url || '';

  if (!name) {
    // No doc matched -> derive from id
    name = decodeAttractionIdToName(row.attractionId) || '';
  } else {
    // Even when we have a name, clean it just in case
    name = prettifyTitle(name);
  }

  return {
    attractionName: name || 'Attraction',
    attractionImage: image || '',
    attractionAddress: address || '',
    attractionUrl: url || ''
  };
}

// ---------- Public API ----------

// 2) Add a new review
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

    Review.findOne({
      userId: userObjectId,
      attractionId: attractionId // keep string
    })
        .then(existing => {
          if (existing) {
            reject("You have already reviewed this attraction.");
          } else {
            const newReview = new Review({
              attractionId,
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

// 3) Get all reviews for an attraction
module.exports.getReviewsForAttraction = function (attractionId) {
  return Review.find({ attractionId })
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

// Last N reviews for a user (flattened + cleaned)
module.exports.getRecentReviewsByUser = async function (userId, limit = 5) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const rows = await Review.aggregate([
    { $match: { userId: userObjectId } },
    { $sort: { createdAt: -1 } },
    { $limit: limit },
    {
      $lookup: {
        from: 'attractions',
        localField: 'attractionId', // string id
        foreignField: 'id',         // Attraction.id (string)
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
        attraction: {
          id: '$attraction.id',
          name: '$attraction.name',
          image: '$attraction.image',
          address: '$attraction.address',
          url: '$attraction.url'
        }
      }
    }
  ]);

  // flatten + clean
  return rows.map(r => {
    const flat = flattenAttractionFields(r);
    // Keep original fields + flattened ones; drop bulky attraction object if you want
    return {
      _id: r._id,
      attractionId: r.attractionId,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      ...flat
    };
  });
};

// Paginated reviews for a user (flattened + cleaned)
module.exports.getReviewsByUser = async function (userId, { page = 1, limit = 10 } = {}) {
  const userObjectId = new mongoose.Types.ObjectId(userId);

  const [rows, total] = await Promise.all([
    Review.aggregate([
      { $match: { userId: userObjectId } },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
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
          attraction: {
            id: '$attraction.id',
            name: '$attraction.name',
            image: '$attraction.image',
            address: '$attraction.address',
            url: '$attraction.url'
          }
        }
      }
    ]),
    Review.countDocuments({ userId: userObjectId })
  ]);

  const reviews = rows.map(r => {
    const flat = flattenAttractionFields(r);
    return {
      _id: r._id,
      attractionId: r.attractionId,
      rating: r.rating,
      comment: r.comment,
      createdAt: r.createdAt,
      ...flat
    };
  });

  return {
    reviews,
    total,
    page,
    pageCount: Math.ceil(total / limit)
  };
};