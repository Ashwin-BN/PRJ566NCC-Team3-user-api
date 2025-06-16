const mongoose = require('mongoose');

const attractionSchema = new mongoose.Schema({
    name: String,
    image: String,
    address: String,
    description: String,
    rating: Number,
    id: String
});

module.exports = attractionSchema;