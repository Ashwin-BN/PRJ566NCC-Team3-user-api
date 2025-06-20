const mongoose = require('mongoose');

const attractionSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    name: String,
    image: String,
    address: String,
    description: String,
    rating: Number,
    id: String
});

module.exports = mongoose.models.Attraction || mongoose.model('Attraction', attractionSchema);