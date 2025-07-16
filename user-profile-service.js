const User = require('./models/User');

// Update profile info (name, pfp, location, visited places, etc.)
module.exports.updateUserProfile = async function (userId, updates) {
    try {
        return await User.findOneAndUpdate(
            {_id: userId},
            {$set: updates},
            {new: true}
        );
    } catch (err) {
        throw new Error("Failed to update user profile: " + err.message);
    }
};

// Get profile by email (for page load)
module.exports.getUserProfile = async function (userId) {
    try {
        const user = await User.findById(userId);
        if (!user) throw new Error("User not found");
        return user;
    } catch (err) {
        throw new Error("Failed to retrieve profile: " + err.message);
    }
};