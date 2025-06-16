const express = require('express');
const app = express();
const cors = require("cors");
const dotenv = require("dotenv");
dotenv.config();
const userService = require("./user-service.js");
const itineraryService = require("./itinerary-service.js");
const jwt = require('jsonwebtoken');
const passport = require('passport');
const passportJWT = require('passport-jwt');

const HTTP_PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(cors({
    origin: ["http://localhost:3000", "https://prj-566-ncc-team3-riu86sa9r-ashwin-bns-projects.vercel.app/"],
    credentials: true
}));
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
passport.authenticate('jwt', { session: false })

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

        const token = jwt.sign(payload, process.env.JWT_SECRET);
        
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

// Delete an itinerary
app.delete('/api/itineraries/:id', passport.authenticate('jwt', { session: false }), (req, res) => {
    itineraryService.deleteItinerary(req.params.id)
        .then(() => res.json({ message: 'Itinerary deleted' }))
        .catch(err => res.status(500).json({ message: err }));
});

// Add attraction to itinerary
app.post('/api/itineraries/:id/attractions', passport.authenticate('jwt', { session: false }), (req, res) => {
    itineraryService.addAttraction(req.params.id, req.body)
        .then(updated => res.json(updated))
        .catch(err => res.status(500).json({ message: err }));
});

// Remove attraction from itinerary
app.delete('/api/itineraries/:id/attractions/:attractionId', passport.authenticate('jwt', { session: false }), (req, res) => {
    itineraryService.removeAttraction(req.params.id, req.params.attractionId)
        .then(updated => res.json(updated))
        .catch(err => res.status(500).json({ message: err }));
});

// ========== ATTRACTION ROUTES ========== //

// Add a new attraction to an itinerary
app.post('/api/itineraries/:itineraryId/attractions', authenticate, (req, res) => {
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
app.delete('/api/itineraries/:itineraryId/attractions/:attractionId', authenticate, (req, res) => {
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
app.get('/api/itineraries/:itineraryId/attractions', authenticate, (req, res) => {
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


Promise.all([
    userService.connect(),
    itineraryService.connect()
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