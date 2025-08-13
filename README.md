# ![Easy Explore Logo](./img/logo.png) EasyExplore Backend API

The **EasyExplore Backend** is a RESTful Node.js API built with **Express** and **MongoDB** that powers the EasyExplore travel planning application.  
It handles **user authentication, itinerary management, saved attractions, reviews**, and **Google Calendar / iCal syncing**.

- **Frontend Repository:** [PRJ566NCC-Team3](https://github.com/Ashwin-BN/PRJ566NCC-Team3)  
- **Backend Deployment:** [Vercel API](https://prj-566-ncc-team3-user-api.vercel.app/)

---

## Features

- **User Authentication**  
  - JWT-based login & registration  
  - Secure password hashing with bcrypt  
  - Protected routes using Passport JWT  

- **Itinerary Management**  
  - Create, read, update, delete itineraries  
  - Add/remove attractions  
  - Collaborator management (invite/remove)  
  - Public sharing of itineraries  

- **Saved Attractions**  
  - Save attractions for quick access  
  - Remove saved attractions  

- **Reviews System**  
  - Add, view, and delete reviews for attractions  
  - Recent reviews & paginated review fetching  

- **Profile Management**  
  - Update profile details (bio, location, picture, visited cities)  
  - View public profiles with itineraries & reviews  

- **Calendar Sync**  
  - Integration with Google Calendar and iCal  

---

## Project Structure

```

.
├── README.md
├── controllers/
│   ├── reviewController.js
│   └── syncController.js
├── itinerary-service.js
├── middleware/
│   └── authMiddleware.js
├── models/
│   ├── Attraction.js
│   ├── Itinerary.js
│   ├── Review\.js
│   └── User.js
├── package-lock.json
├── package.json
├── review-service.js
├── routes/
│   ├── itineraryRoutes.js
│   ├── reviewRoutes.js
│   └── syncRoutes.js
├── savedAttraction-service.js
├── server.js
├── user-profile-service.js
├── user-service.js
├── utils/
│   ├── googleCalendar.js
│   └── icalHelper.js
└── vercel.json

````

---

## Tech Stack

- **Backend:** Node.js, Express  
- **Database:** MongoDB + Mongoose  
- **Authentication:** JWT + Passport  
- **Other:** bcryptjs, dotenv, cors, axios, moment, googleapis, ics  

---

## Installation

### Clone the repository
```bash
git clone https://github.com/<your-org>/PRJ566NCC-Team3-user-api.git
cd PRJ566NCC-Team3-user-api
````

### Install dependencies

```bash
npm install
```

### Set up environment variables

Create a `.env` file in the root directory with the following:

```env
PORT=8080
MONGO_URL=<your-mongodb-connection-string>
JWT_SECRET=<your-jwt-secret>
CORS_ORIGINS=http://localhost:3000,https://yourfrontend.com
GOOGLE_CLIENT_ID=<optional>
GOOGLE_CLIENT_SECRET=<optional>
```

### Start the server

```bash
npm start
```

---

## API Endpoints

### **Auth**

| Method | Endpoint             | Description          |
| ------ | -------------------- | -------------------- |
| POST   | `/api/user/register` | Register new user    |
| POST   | `/api/user/login`    | Login user & get JWT |

### **Profile**

| Method | Endpoint                           | Description                    |
| ------ | ---------------------------------- | ------------------------------ |
| GET    | `/api/user/profile`                | Get logged-in user's profile   |
| PUT    | `/api/user/profile`                | Update profile info            |
| GET    | `/api/user/profile/username/:name` | Get public profile by username |

### **Itineraries**

| Method | Endpoint                                 | Description             |
| ------ | ---------------------------------------- | ----------------------- |
| POST   | `/api/itineraries`                       | Create itinerary        |
| GET    | `/api/itineraries`                       | List user's itineraries |
| GET    | `/api/itineraries/:id`                   | Get itinerary by ID     |
| PUT    | `/api/itineraries/:id`                   | Update itinerary        |
| DELETE | `/api/itineraries/:id`                   | Delete itinerary        |
| POST   | `/api/itineraries/:id/collaborators`     | Add collaborator        |
| DELETE | `/api/itineraries/:id/collaborators/:id` | Remove collaborator     |
| POST   | `/api/itineraries/:id/share`             | Make itinerary public   |
| GET    | `/api/itineraries/shared/:id`            | View public itinerary   |

### **Saved Attractions**

| Method | Endpoint                     | Description             |
| ------ | ---------------------------- | ----------------------- |
| GET    | `/api/saved-attractions`     | Get saved attractions   |
| POST   | `/api/saved-attractions`     | Save attraction         |
| DELETE | `/api/saved-attractions/:id` | Remove saved attraction |

### **Reviews**

| Method | Endpoint                      | Description                   |
| ------ | ----------------------------- | ----------------------------- |
| POST   | `/api/reviews`                | Add review                    |
| GET    | `/api/reviews/:attractionId`  | Get reviews for an attraction |
| DELETE | `/api/reviews/:reviewId`      | Delete review                 |
| GET    | `/api/user/reviews`           | Get current user's reviews    |
| GET    | `/api/user/:username/reviews` | Get reviews by username       |

---

## Deployment

This backend is configured for **Vercel deployment** (`vercel.json` included).
Ensure MongoDB is accessible from the deployed environment and `.env` variables are set in the Vercel dashboard.

---

## 👥 Contributors

* **Ashwin BN** — Full-stack Developer ([GitHub](https://github.com/Ashwin-BN))
* **Alex Leung** — Collaborator ([GitHub](https://github.com/Alex-Leungg))
* **Jeelkumar Patel** — Collaborator ([GitHub](https://github.com/jeelpatel22))
* **Juan Moncayo** — Collaborator ([GitHub](https://github.com/Juancinn))
* **Suraj Sapkota** — Collaborator ([GitHub](https://github.com/surajsapkota))

---

## License

This project is licensed under the **ISC License**.
