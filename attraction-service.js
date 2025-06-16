const mongoose = require('mongoose');
const itinerarySchema = require('./models/Itinerary');

let mongoDBConnectionString = process.env.MONGO_URL;

let Itinerary = mongoose.models.Itinerary || mongoose.model('Itinerary', itinerarySchema);

module.exports.connect = function () {
    return mongoose.connect(mongoDBConnectionString, {
        dbName: 'easy_explore',
    });
};

// Add attraction to itinerary (if not already present by `id`)
module.exports.addAttractionToItinerary = function (itineraryId, attraction) {
    return Itinerary.findOneAndUpdate(
        { _id: itineraryId, 'attractions.id': { $ne: attraction.id } },
        { $push: { attractions: attraction } },
        { new: true }
    ).exec();
};

// Remove attraction from itinerary by attraction.id
module.exports.removeAttractionFromItinerary = function (itineraryId, attractionId) {
    return Itinerary.findByIdAndUpdate(
        itineraryId,
        { $pull: { attractions: { id: attractionId } } },
        { new: true }
    ).exec();
};

// Get all attractions for an itinerary
module.exports.getAttractionsForItinerary = function (itineraryId) {
    return Itinerary.findById(itineraryId).select('attractions').exec();
};