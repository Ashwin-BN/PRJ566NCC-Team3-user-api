const { google } = require('googleapis');
const mongoose = require('mongoose');
const Itinerary = require('../models/Itinerary');
const { getAuthUrl, oAuth2Client } = require('../utils/googleCalendar');
const { createEvent } = require('../utils/icalHelper');

// ✅ POST /api/itineraries/:id/sync
exports.syncItinerary = async (req, res) => {
  const itineraryId = req.params.id;
  const { calendarType } = req.body;

  try {
    const itinerary = await Itinerary.findById(itineraryId);
    if (!itinerary) {
      return res.status(404).json({ error: 'Itinerary not found' });
    }

    if (itinerary.isSynced && itinerary.calendarType === calendarType) {
      return res.status(200).json({ message: 'Already synced with this calendar.' });
    }

    console.log('📥 Received calendarType:', calendarType);

    if (calendarType === 'google') {
      // Redirect to Google OAuth with itineraryId as state
      const authUrl = getAuthUrl(itineraryId.toString());

      return res.status(200).json({
        type: 'google',
        authUrl,
        message: 'Redirecting to Google Calendar authorization...',
      });
    }

    if (calendarType === 'ical') {
      const icsContent = createEvent(itinerary);

      itinerary.isSynced = true;
      itinerary.calendarType = 'ical';
      await itinerary.save();

      res.setHeader('Content-Disposition', 'attachment; filename=itinerary.ics');
      res.setHeader('Content-Type', 'text/calendar');
      return res.send(icsContent);
    }

    return res.status(400).json({ error: 'Invalid calendar type' });
  } catch (err) {
    console.error('Sync failed:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

// ✅ GET /api/itineraries/google/callback?code=...&state=itineraryId
exports.googleCallback = async (req, res) => {
  const { code, state: itineraryId } = req.query;
  console.log("📨 Received itineraryId from state:", itineraryId);

  if (!code || !itineraryId) {
    return res.status(400).send('Missing authorization code or itinerary ID');
  }

  // ✅ Validate itineraryId format
  if (!mongoose.Types.ObjectId.isValid(itineraryId)) {
    return res.status(400).send('Invalid itinerary ID');
  }

  try {
    const { tokens } = await oAuth2Client.getToken(code);
    oAuth2Client.setCredentials(tokens);

    const itinerary = await Itinerary.findById(itineraryId);
    if (!itinerary) {
      return res.status(404).send('Itinerary not found after auth');
    }

    const calendar = google.calendar({ version: 'v3', auth: oAuth2Client });

    const event = {
      summary: itinerary.name,
      location: itinerary.location || 'Unknown location',
      description: `Trip with TravaMate by ${itinerary.userId}`,
      start: {
        dateTime: new Date(itinerary.from).toISOString(),
        timeZone: 'America/Toronto',
      },
      end: {
        dateTime: new Date(itinerary.to).toISOString(),
        timeZone: 'America/Toronto',
      },
    };

    const result = await calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    itinerary.isSynced = true;
    itinerary.calendarType = 'google';
    await itinerary.save();

    console.log('✅ Event created:', result.data.htmlLink);
    return res.send(`✅ Event created in Google Calendar! <a href="${result.data.htmlLink}" target="_blank">View it</a>`);
  } catch (err) {
    console.error('OAuth callback error:', err.response?.data || err.message);
    return res.status(500).send('Failed to create calendar event');
  }
};
