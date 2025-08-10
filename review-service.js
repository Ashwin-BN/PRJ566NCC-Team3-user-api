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

// ---------- Helpers to extract a readable title from weird ids ----------

function hexToUtf8OrNull(hex) {
  if (typeof hex !== 'string') return null;
  if (!/^[0-9a-fA-F]+$/.test(hex) || hex.length % 2 !== 0) return null;
  try {
    return Buffer.from(hex, 'hex').toString('utf8');
  } catch {
    return null;
  }
}

function base64ToUtf8OrNull(b64) {
  if (typeof b64 !== 'string') return null;
  if (!/^[A-Za-z0-9+/=]+$/.test(b64) || b64.length % 4 !== 0) return null;
  try {
    return Buffer.from(b64, 'base64').toString('utf8');
  } catch {
    return null;
  }
}

function isMostlyPrintable(s) {
  if (!s) return false;
  // keep letters, numbers, punctuation, spaces
  const printable = s.replace(/[^\p{L}\p{N}\p{P}\p{Zs}]/gu, '');
  return printable.length / s.length > 0.6 && printable.trim().length >= 4;
}

function extractLongestPrintableSegment(s) {
  if (!s) return '';
  // split on non-printables; keep letters/numbers/punctuation/spaces
  const segments = s.split(/[^\p{L}\p{N}\p{P}\p{Zs}]+/gu).filter(Boolean);
  if (!segments.length) return '';
  // bias toward the end (titles are often appended)
  segments.sort((a, b) => b.length - a.length);
  // if there are ties, prefer the later segment
  let best = segments[0];
  for (const seg of segments) {
    if (seg.length < best.length) break;
    best = seg; // keep moving — later wins on equal length
  }
  return best;
}

function sanitizeTitle(s) {
  if (!s) return '';
  // collapse whitespace and trim
  s = s.replace(/\s+/g, ' ').trim();
  // strip leading junk like #/&/punct/control bytes
  s = s.replace(/^[^\p{L}\p{N}]+/u, '');
  // strip trailing junk
  s = s.replace(/[^\p{L}\p{N})]+$/u, '').trim();
  return s;
}

function safeTitleFromId(id) {
  if (!id || typeof id !== 'string') return '';

  // 1) HEX → UTF8, then ALWAYS try to extract a printable tail
  let decoded = hexToUtf8OrNull(id);
  if (decoded) {
    const seg = extractLongestPrintableSegment(decoded);
    const clean = sanitizeTitle(seg);
    if (clean.length >= 3) return clean;
  }

  // 2) Base64 → UTF8, same approach
  decoded = base64ToUtf8OrNull(id);
  if (decoded) {
    const seg = extractLongestPrintableSegment(decoded);
    const clean = sanitizeTitle(seg);
    if (clean.length >= 3) return clean;
  }

  // 3) Last-resort: try directly on the raw id
  const seg = extractLongestPrintableSegment(id);
  const clean = sanitizeTitle(seg);
  if (clean.length >= 3) return clean;

  return '';
}

// flatten a review doc + optional attraction doc into UI-friendly fields
function flattenReviewRow(row) {
  const attractionDoc = row.attraction || null;

  // Base fields
  const out = {
    _id: row._id,
    attractionId: row.attractionId,
    rating: row.rating,
    comment: row.comment,
    createdAt: row.createdAt,
  };

  // Prefer real Attraction name; else decode from id; else raw id
  const decoded = safeTitleFromId(row.attractionId);
  out.attractionName =
      (attractionDoc && attractionDoc.name) ||
      decoded ||
      row.attractionId ||
      'Attraction';

  out.attractionAddress = (attractionDoc && attractionDoc.address) || '';
  out.attractionImage   = (attractionDoc && attractionDoc.image)   || '';
  out.attractionUrl     = (attractionDoc && attractionDoc.url)     || '';

  return out;
}

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
    } catch {
      reject("Invalid userId format.");
      return;
    }

    Review.findOne({ userId: userObjectId, attractionId })
        .then(existing => {
          if (existing) return reject("You have already reviewed this attraction.");

          const newReview = new Review({
            attractionId, // keep as string
            userId: userObjectId,
            rating,
            comment
          });

          newReview.save()
              .then(saved => resolve(saved))
              .catch(err => reject("Error saving review: " + err));
        })
        .catch(err => reject("Error checking existing review: " + err));
  });
};

// 3) Reviews for a given attraction (kept as-is)
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

// 4) Last N reviews for a user (with enrichment + clean name)
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
        'attraction.image': 1,
        'attraction.url': 1
      }
    }
  ]);

  return rows.map(flattenReviewRow);
};

// 5) Paginated reviews for a user (same cleaning)
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

  // fetch any matching Attraction docs in one go
  const ids = [...new Set(reviews.map(r => r.attractionId))];
  const attractions = await Attraction.find({ id: { $in: ids } })
      .select('id name address image url')
      .lean();
  const byId = Object.fromEntries(attractions.map(a => [a.id, a]));

  const enriched = reviews.map(r => flattenReviewRow({ ...r, attraction: byId[r.attractionId] || null }));

  return {
    reviews: enriched,
    total,
    page,
    pageCount: Math.ceil(total / limit)
  };
};