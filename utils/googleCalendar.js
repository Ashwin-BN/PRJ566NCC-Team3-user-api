const { google } = require('googleapis');

const oAuth2Client = new google.auth.OAuth2(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  `${process.env.API_URL}/api/itineraries/google/callback`
);

function getAuthUrl(itineraryId) {
  const url = oAuth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state: itineraryId, // ✅ THIS must be the actual ObjectId
  });

  return url;
}

module.exports = { oAuth2Client, getAuthUrl };
