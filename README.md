# SVVV_Notes

An independent, student-built notes sharing platform for the SVVV CSE community. It uses Express, EJS, MongoDB, Passport Local Mongoose, Multer, and Cloudinary in a clean MVC architecture.

## Project structure

- `app.js` configures Express, Atlas, sessions, Passport, shared view data, and global error handling.
- `models/` defines the MongoDB User and Note data shapes.
- `controllers/` contains page and database actions; `routes/` only maps URLs to those actions.
- `middleware/` holds reusable authentication and ownership checks.
- `config/cloudinary.js` configures direct PDF uploads to Cloudinary.
- `views/` holds server-rendered EJS templates; `public/` contains browser CSS and JavaScript.

## Run locally

1. Create a free MongoDB Atlas cluster. In Atlas, add your current IP address under **Network Access** and create a database user under **Database Access**.
2. Copy `.env.example` to `.env`, then replace the `MONGODB_URI` placeholder with Atlas's Node.js connection string. URL-encode any reserved characters in your password, such as `@` or `#`.
3. Add a session secret and Cloudinary credentials.
4. Install dependencies: `npm install`
5. Start the server: `npm run dev`
6. Visit `http://localhost:3000`

Cloudinary is configured for PDF uploads (`raw` resource type). This project is independent and is not an official SVVV website.

## Cloudinary PDFs in production

1. Create a Cloudinary account and copy its **Cloud name**, **API Key**, and **API Secret** from the dashboard.
2. Add `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_KEY`, and `CLOUDINARY_SECRET` to local `.env` and to your deployment provider's environment variables. Never commit `.env`.
3. PDFs are uploaded to the public `svvv-notes/pdfs` folder as Cloudinary `raw` assets. Their HTTPS URL is stored in MongoDB Atlas, so the deployed app needs no local upload storage.
4. Deploy with `npm start` (for example on Render or Railway), setting `NODE_ENV=production`, `MONGODB_URI`, `SESSION_SECRET`, and the Cloudinary variables in the host dashboard. Sessions are persisted to a `sessions` collection in MongoDB Atlas, so users remain signed in across restarts.
