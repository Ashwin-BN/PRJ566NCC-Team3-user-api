const mongoose = require('mongoose');
const {Schema} = require("mongoose");

const itinerarySchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'users',
        required: true
    },
    name: { type: String, required: true },
    from: Date,
    to: Date,
    attractions: [{type: Schema.Types.ObjectId, ref: 'Attraction'}],
    public: { type: Boolean, default: false },
});

module.exports = mongoose.models.Itinerary || mongoose.model('Itinerary', itinerarySchema);