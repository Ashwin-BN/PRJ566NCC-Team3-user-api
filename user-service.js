const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const userSchema = require('./models/User');

let mongoDBConnectionString = process.env.MONGO_URL;

let User = mongoose.models.User || mongoose.model("users", userSchema);

module.exports.connect = function () {
    return mongoose.connect(mongoDBConnectionString, {
        dbName: "easy_explore"
    });
};

module.exports.registerUser = function (userData) {
    return new Promise(function (resolve, reject) {

        if (userData.password !== userData.password2) {
            reject("Passwords do not match");
            return;
        }

        bcrypt.hash(userData.password, 10)
            .then(hash => {
                userData.password = hash;
                let newUser = new User(userData);

                newUser.save().then(() => {
                    resolve("User " + userData.email + " successfully registered");
                }).catch(err => {
                    if (err.code === 11000) {
                        reject("Email already taken");
                    } else {
                        reject("There was an error creating the user: " + err);
                    }
                });
            }).catch(err => reject(err));
    });
};

module.exports.checkUser = function (userData) {
    return new Promise(function (resolve, reject) {
        User.findOne({ email: userData.email })
            .then(user => {
                if (!user) {
                    reject("Unable to find user " + userData.email);
                    return;
                }

                bcrypt.compare(userData.password, user.password)
                    .then(isMatch => {
                        if (isMatch) {
                            resolve(user);
                        } else {
                            reject("Incorrect password for user " + userData.email);
                        }
                    });
            }).catch(err => {
                reject("Unable to find user " + userData.email);
            });
    });
};
