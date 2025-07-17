const express = require('express');
const app = express();
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const userService = require("./user-service.js");
const userProfileService = require("./user-profile-service.js");
const itineraryService = require("./itinerary-service");
const savedAttractionService = require('./savedAttraction-service');
const jwt = require('jsonwebtoken');
const passport = require('passport');
const passportJWT = require('passport-jwt');

const HTTP_PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(cors());

// JSON Web Token Setup
let ExtractJwt = passportJWT.ExtractJwt;
let JwtStrategy = passportJWT.Strategy;

// Configure its options
let jwtOptions = {
    jwtFromRequest: ExtractJwt.fromAuthHeaderWithScheme('jwt'),
    secretOrKey: process.env.JWT_SECRET
};

let strategy = new JwtStrategy(jwtOptions, function (jwt_payload, next) {
    console.log('payload received', jwt_payload);

    if (jwt_payload) {
        next(null, {
            _id: jwt_payload._id,
            email: jwt_payload.email
        });
    }
    else next(null, false);
});

passport.use(strategy);
app.use(passport.initialize());

app.post("/api/user/register", (req, res) => {
    userService.registerUser(req.body)
        .then((msg) => {
            res.json({ "message": msg });
        }).catch((msg) => {
        res.status(422).json({ "message": msg });
    });
});

app.post("/api/user/login", (req, res) => {
    userService.checkUser(req.body)
        .then((user) => {
            const payload = {
                _id: user._id,
                email: user.email
            };

            const token = jwt.sign(
  {
    ...payload,
    iat: Math.floor(Date.now() / 1000),        // optional: adds issued time
    jti: Math.random().toString(36).substring(2), // optional: adds random ID
  },
  process.env.JWT_SECRET,
  { expiresIn: "1h" } // token will expire in 1 hour
);

console.log("User from checkUser:", user);
console.log("Payload before signing:", payload);
console.log("Generated token:", token);

            const userData = {
                _id: user._id,
                email: user.email,
                userName: user.userName,
                favorites: user.favorites,
                itineraries: user.itineraries,
                friends: user.friends
            };

            res.json({ "message": "login successful",
                "token": token,
                "user": userData
            });
        }).catch(msg => {
        res.status(422).json({ "message": msg });
    });
});

// GET current user profile
app.get("/api/user/profile", passport.authenticate("jwt", { session: false }), async (req, res) => {
    try {
        const user = await userProfileService.getUserProfile(req.user._id);
        if (!user) return res.status(404).json({ message: "User not found" });
        res.json(user);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch profile", error: err });
    }
});

// PUT update user profile
app.put("/api/user/profile", passport.authenticate("jwt", { session: false }), async (req, res) => {
    try {
        const updated = await userProfileService.updateUserProfile(req.user._id, req.body);
        const user = await
        res.json({ message: "Profile updated", user: updated });
    } catch (err) {
        res.status(500).json({ message: "Failed to update profile", error: err });
    }
});

// ========== ITINERARY ROUTES ========== //

// Create a new itinerary
app.post('/api/itineraries', passport.authenticate('jwt', { session: false }), (req, res) => {
    const data = {
        userId: req.user._id,
        name: req.body.name,
        from: req.body.from,
        to: req.body.to,
        attractions: req.body.attractions || []
    };

    itineraryService.createItinerary(data)
        .then(msg => res.json({ message: msg }))
        .catch(err => res.status(500).json({ message: err }));
});

// Get all itineraries for logged-in user
app.get('/api/itineraries', passport.authenticate('jwt', { session: false }), (req, res) => {
    itineraryService.getItinerariesByUser(req.user._id)
        .then(itins => res.json(itins))
        .catch(err => res.status(500).json({ message: err }));
});

// Update an itinerary
app.put('/api/itineraries/:id', passport.authenticate('jwt', { session: false }), (req, res) => {
    itineraryService.updateItinerary(req.params.id, req.body)
        .then(updated => res.json(updated))
        .catch(err => res.status(500).json({ message: err }));
});

app.delete('/api/itineraries/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
    try {
        const userId = req.user._id;
        const deleted = await itineraryService.deleteItinerary(req.params.id, userId);

        if (!deleted) {
            return res.status(404).json({ message: 'Itinerary not found or unauthorized' });
        }

        res.json({ message: 'Itinerary deleted' });
    } catch (err) {
        res.status(500).json({ message: err.message || 'Server error' });
    }
});

// Add collaborator to itinerary
app.post('/api/itineraries/:id/collaborators', passport.authenticate('jwt', { session: false }), async (req, res) => {
    const itineraryId = req.params.id;
    const { collaboratorEmail } = req.body;

    try {
        const itinerary = await itineraryService.getItineraryById(itineraryId);

        if (!itinerary) return res.status(404).json({ message: "Itinerary not found" });

        if (String(itinerary.userId) !== String(req.user._id)) {
            return res.status(403).json({ message: "Only the owner can add collaborators" });
        }

        const userToAdd = await itineraryService.getUserByEmail(collaboratorEmail);
        if (!userToAdd) return res.status(404).json({ message: "User not found" });

        const alreadyAdded = itinerary.collaborators.some(id => id.equals(userToAdd._id));
        if (alreadyAdded) return res.status(400).json({ message: "User already a collaborator" });

        const updated = await itineraryService.addCollaborator(itineraryId, userToAdd._id);
        res.json({ message: "Collaborator added", itinerary: updated });
    } catch (err) {
        res.status(500).json({ message: "Server error", error: err.message });
    }
});

app.delete('/api/itineraries/:id/collaborators/:userId', passport.authenticate('jwt', { session: false }), async (req, res) => {
    const { id, userId } = req.params;

    try {
        const itinerary = await itineraryService.getItineraryById(id);
        if (!itinerary) return res.status(404).json({ message: "Itinerary not found" });

        if (String(itinerary.userId) !== String(req.user._id)) {
            return res.status(403).json({ message: "Only the owner can remove collaborators" });
        }

        const updated = await itineraryService.removeCollaborator(id, userId);
        res.json({ message: "Collaborator removed", itinerary: updated });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

app.put('/api/itineraries/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
    const itineraryId = req.params.id;
    const userId = req.user._id;

    try {
        const itinerary = await itineraryService.getItineraryById(itineraryId);
        if (!itinerary) return res.status(404).json({ message: "Itinerary not found" });

        const isOwner = String(itinerary.userId) === String(userId);
        const isCollaborator = itinerary.collaborators.some(id => id.equals(userId));

        if (!isOwner && !isCollaborator) {
            return res.status(403).json({ message: "You are not authorized to edit this itinerary" });
        }

        const updated = await itineraryService.updateItinerary(itineraryId, req.body);
        res.json(updated);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// Get one itinerary by ID
app.get('/api/itineraries/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
    try {
        const itinerary = await itineraryService.getItineraryById(req.params.id);
        if (!itinerary) {
            return res.status(404).json({ message: "Itinerary not found" });
        }

        const userId = req.user._id;
        const isOwner = String(itinerary.userId) === String(userId);
        const isCollaborator = itinerary.collaborators.some(id => id.equals(userId));

        if (!isOwner && !isCollaborator) {
            return res.status(403).json({ message: "You are not authorized to view this itinerary" });
        }

        res.json(itinerary);
    } catch (err) {
        res.status(500).json({ message: "Failed to fetch itinerary", error: err.message });
    }
});



// ========== ATTRACTION ROUTES ========== //

// Add a new attraction to an itinerary
app.post('/api/itineraries/:itineraryId/attractions', passport.authenticate('jwt', { session: false }), (req, res) => {
    const { itineraryId } = req.params;
    const attraction = req.body;

    itineraryService.addAttraction(itineraryId, attraction)
        .then(updated => {
            if (!updated) {
                res.status(409).json({ message: "Attraction already exists or itinerary not found" });
            } else {
                res.json({ message: "Attraction added", itinerary: updated });
            }
        })
        .catch(err => res.status(500).json({ message: "Failed to add attraction", error: err }));
});

// Remove an attraction from an itinerary
app.delete('/api/itineraries/:itineraryId/attractions/:attractionId', passport.authenticate('jwt', { session: false }), (req, res) => {
    const { itineraryId, attractionId } = req.params;

    itineraryService.removeAttraction(itineraryId, attractionId)
        .then(updated => {
            if (!updated) {
                res.status(404).json({ message: "Itinerary not found" });
            } else {
                res.json({ message: "Attraction removed", itinerary: updated });
            }
        })
        .catch(err => res.status(500).json({ message: "Failed to remove attraction", error: err }));
});

// Get all attractions in an itinerary
app.get('/api/itineraries/:itineraryId/attractions', passport.authenticate('jwt', { session: false }), (req, res) => {
    const { itineraryId } = req.params;

    itineraryService.getItinerariesByUser(req.user._id) // confirm ownership
        .then(itineraries => {
            const owned = itineraries.find(it => it._id.toString() === itineraryId);
            if (!owned) {
                return res.status(403).json({ message: "You do not own this itinerary" });
            }

            itineraryService.getAttractionsForItinerary(itineraryId)
                .then(result => res.json(result.attractions))
                .catch(err => res.status(500).json({ message: "Failed to fetch attractions", error: err }));
        })
        .catch(err => res.status(500).json({ message: "Failed to verify ownership", error: err }));
});

// ========== SAVED ATTRACTIONS ROUTES ========== //

// GET all saved attractions for logged-in user
app.get('/api/saved-attractions', passport.authenticate('jwt', { session: false }), async (req, res) => {
    try {
        const results = await savedAttractionService.getSavedAttractionsByUser(req.user._id);
        res.json(results);
    } catch (err) {
        res.status(500).json({ message: 'Failed to fetch saved attractions', error: err });
    }
});

// POST save an attraction
app.post('/api/saved-attractions', passport.authenticate('jwt', { session: false }), async (req, res) => {
    try {
        const msg = await savedAttractionService.saveAttraction(req.user._id, req.body);
        res.status(201).json({ message: msg });
    } catch (err) {
        res.status(500).json({ message: err });
    }
});

// DELETE a saved attraction
app.delete('/api/saved-attractions/:id', passport.authenticate('jwt', { session: false }), async (req, res) => {
    try {
        await savedAttractionService.removeSavedAttraction(req.user._id, req.params.id);
        res.json({ message: 'Attraction removed' });
    } catch (err) {
        res.status(500).json({ message: 'Failed to remove attraction', error: err });
    }
});

Promise.all([
    userService.connect(),
    itineraryService.connect(),
    savedAttractionService.connect()
])
    .then(() => {
        app.listen(HTTP_PORT, () => {
            console.log("API listening on: " + HTTP_PORT);
        });
    })
    .catch((err) => {
        console.error("Unable to start the server:", err);
        process.exit();
    });