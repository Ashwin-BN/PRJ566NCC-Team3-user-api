const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    email: {
        type: String,
        unique: true
    },
    password: String,
    favorites: [{ type: Schema.Types.ObjectId, ref: 'Attraction' }],
    itineraries: [{ type: Schema.Types.ObjectId, ref: 'Itinerary' }],
    userName: String,
    friends: [String],
});

module.exports = mongoose.model('User', userSchema);
