const mongoose = require('mongoose');
const attractionSchema = require('./Attraction');

const itinerarySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    name: { type: String, required: true },
    from: Date,
    to: Date,
    attractions: [attractionSchema]
});

module.exports = mongoose.models.Itinerary || mongoose.model('Itinerary', itinerarySchema);