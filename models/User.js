const mongoose = require('mongoose');
const attraction = require('./Attraction');
const itinerary = require('./Itinerary');

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        unique: true
    },
    password: String,
    favorites: [attraction],
    itineraries: [itinerary],
    userName: String,
    friends: [String],
});

module.exports = userSchema;