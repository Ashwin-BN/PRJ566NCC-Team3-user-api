const mongoose = require('mongoose');
const Itinerary = require('./models/Itinerary');
const Attraction = require('./models/Attraction');
const User = require('./models/User');

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

module.exports.updateItinerary = function (itineraryId, updatedData) {
    return Itinerary.findByIdAndUpdate(itineraryId, updatedData, { new: true }).exec();
};

module.exports.deleteItinerary = function (itineraryId, userId) {
    return Itinerary.findOneAndDelete({ _id: itineraryId, userId }).exec();
};

module.exports.addAttraction = async function (itineraryId, attractionData) {
    let attraction = await Attraction.findOne({ id: attractionData.id });

    if (!attraction) {
        attraction = await new Attraction(attractionData).save();
    }

    return Itinerary.findOneAndUpdate(
        { _id: itineraryId, attractions: { $ne: attraction._id } },
        { $push: { attractions: attraction._id } },
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

module.exports.getItineraryById = function (id) {
    return Itinerary.findById(id)
        .populate('collaborators', '_id userName email')
        .populate('attractions')
        .exec();
};

module.exports.getItinerariesByUser = function (userId) {
    return Itinerary.find({
        $or: [
            { userId },
            { collaborators: userId }
        ]
    })
        .populate('collaborators')
        .populate('attractions')
        .exec();
};

module.exports.getPublicItinerariesByUserId = function (userId) {
    return Itinerary.find({ userId, public: true })
        .populate('attractions')
        .populate('collaborators', '_id userName email')
        .lean()
        .exec();
};

module.exports.getUserByEmail = function (email) {
    return User.findOne({ email }).exec();
};

module.exports.addCollaborator = function (itineraryId, userId) {
    return Itinerary.findByIdAndUpdate(
        itineraryId,
        { $addToSet: { collaborators: userId } }, // Prevent duplicates
        { new: true }
    ).exec();
};

module.exports.removeCollaborator = function (itineraryId, userId) {
    return Itinerary.findByIdAndUpdate(
        itineraryId,
        { $pull: { collaborators: userId } },
        { new: true }
    ).exec();
};