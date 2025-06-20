const mongoose = require('mongoose');
const Itinerary = require('./models/Itinerary');

let mongoDBConnectionString = process.env.MONGO_URL;

module.exports.connect = function () {
    return mongoose.connect(mongoDBConnectionString, {
        dbName: 'easy_explore',
    });
};

module.exports.createItinerary = function (data) {
    return new Promise((resolve, reject) => {
        const newItinerary = new Itinerary(data);

        newItinerary
            .save()
            .then(() => resolve("Itinerary successfully created"))
            .catch(err => reject("There was an error creating the itinerary: " + err));
    });
};

module.exports.getItinerariesByUser = function (userId) {
    return Itinerary.find({ userId }).exec();
};

module.exports.updateItinerary = function (itineraryId, updatedData) {
    return Itinerary.findByIdAndUpdate(itineraryId, updatedData, { new: true }).exec();
};

module.exports.deleteItinerary = function (itineraryId, userId) {
    return Itinerary.findOneAndDelete({ _id: itineraryId, userId }).exec();
};

module.exports.addAttraction = function (itineraryId, attraction) {
    return Itinerary.findOneAndUpdate(
        { _id: itineraryId, 'attractions.id': { $ne: attraction.id } },
        { $push: { attractions: attraction } },
        { new: true }
    ).exec();
};

module.exports.removeAttraction = function (itineraryId, attractionId) {
    return Itinerary.findByIdAndUpdate(
        itineraryId,
        { $pull: { attractions: { id: attractionId } } },
        { new: true }
    ).exec();
};