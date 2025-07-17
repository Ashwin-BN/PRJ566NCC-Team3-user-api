const mongoose = require('mongoose');
const Schema = mongoose.Schema;

const userSchema = new Schema({
    email: {
        type: String,
        unique: true
    },
    password: String,
    userName: String,
    profilePicture: {
        type: String,
        default: '',
    },
    currentLocation: {
        city: String,
        country: String,
    },
    visitedCities: [
        {
            city: String,
            countryCode: String,
            countryName: String,
        }
    ],
    favorites: [{ type: Schema.Types.ObjectId, ref: 'Attraction' }],
    itineraries: [{ type: Schema.Types.ObjectId, ref: 'Itinerary' }],
<<<<<<< Updated upstream
=======
    userName: String,
    friends: [String],
    bio: { type: String, default: "" },  
    country: { type: String, default: "" },
>>>>>>> Stashed changes
});

module.exports = mongoose.model('User', userSchema);