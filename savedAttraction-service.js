const mongoose = require('mongoose');
const Attraction = require('./models/Attraction');

let mongoDBConnectionString = process.env.MONGO_URL;

module.exports.connect = function () {
    return mongoose.connect(mongoDBConnectionString, {
        dbName: 'easy_explore',
    });
};

// Save an attraction for a user
module.exports.saveAttraction = function (userId, attractionData) {
    return new Promise((resolve, reject) => {
        const newAttraction = new Attraction({ ...attractionData, userId });

        newAttraction
            .save()
            .then(() => resolve("Attraction successfully saved"))
            .catch(err => reject("Error saving attraction: " + err));
    });
};

// Get all saved attractions for a user
module.exports.getSavedAttractionsByUser = function (userId) {
    return Attraction.find({ userId }).exec();
};

// Remove a saved attraction
module.exports.removeSavedAttraction = function (userId, attractionId) {
    return Attraction.findOneAndDelete({ userId, id: attractionId }).exec();
};