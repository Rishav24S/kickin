# KickIn

A responsive event website where you can browse upcoming events, search and filter them, and register for the ones you like. I built it for the K Explore web designing task using plain HTML, CSS and JavaScript.

**Live site:** https://kickin-events.vercel.app/

## What it does
- Browse event cards with a photo, date, venue and short description
- Search by name or venue, filter by category, sort by date, price or name
- Click an event to see details, the agenda and a countdown to the start
- Register with name, email, phone and number of tickets. The form checks every field and shows a confirmation with a booking ID
- View or cancel your registrations from the "My registrations" panel
- Dark and light mode, and a layout that works on phones, tablets and desktops

## How it's built
- `index.html` – page layout
- `css/style.css` – styles, theme colours and responsive rules
- `js/events.js` – the list of events
- `js/app.js` – search, filters, the event popup, form validation and saving

Registrations are saved in the browser's localStorage, so there is no backend. They stay on the device you registered from, and no email is actually sent.

## Run it
Open `index.html` in a browser.

## Notes
- Event photos come from Unsplash. If one doesn't load, the card shows a gradient and emoji instead.
- Event dates are set relative to today, so the events always look upcoming.
- Next features: a backend and real email confirmations.
