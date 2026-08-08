# SVVV_Notes

An independent, student-built notes sharing platform for the SVVV CSE community. It uses Express, EJS, MongoDB, Passport Local Mongoose, Multer, and Cloudinary in a clean MVC architecture.

## Project structure

- `app.js` configures Express, Atlas, sessions, Passport, shared view data, and global error handling.
- `models/` defines the MongoDB User and Note data shapes.
- `controllers/` contains page and database actions; `routes/` only maps URLs to those actions.
- `middleware/` holds reusable authentication and ownership checks.
- `config/cloudinary.js` configures direct PDF uploads to Cloudinary.
- `config/mail.js` handles welcome email delivery using the urBackend Transactional Mail API.
- `views/` holds server-rendered EJS templates; `public/` contains browser CSS and JavaScript.

## Run locally

1. Create a free MongoDB Atlas cluster. In Atlas, add your current IP address under **Network Access** and create a database user under **Database Access**.
2. Copy `.env.example` to `.env`, then replace the `MONGODB_URI` placeholder with Atlas's Node.js connection string. URL-encode any reserved characters in your password, such as `@` or `#`.
3. Add a session secret and Cloudinary credentials.
4. (Optional) Create a project on the [urBackend Dashboard](https://urbackend.bitbros.in/dashboard), copy your **Secret Key**, and set it as `URBACKEND_API_KEY` in `.env` to enable automatic welcome emails on signup.
5. Install dependencies: `npm install`
6. Start the server: `npm run dev`
7. Visit `http://localhost:3000`

Cloudinary is configured for PDF uploads (`raw` resource type). This project is independent and is not an official SVVV website.

## Production Deployment (Render)

1. **Cloudinary Setup (Optional):** Create a Cloudinary account and copy the **Cloud name**, **API Key**, and **API Secret**.
2. **urBackend Setup (Optional):** Create a project on [urBackend](https://urbackend.bitbros.in/dashboard) and copy the **Secret Key**.
3. **Environment Variables:** In your **Render Dashboard** under **Environment**, define the following variables:
   - `NODE_ENV=production`
   - `MONGODB_URI` (Your MongoDB Atlas connection string)
   - `SESSION_SECRET` (A strong random string for sessions)
   - `CLOUDINARY_CLOUD_NAME` (Optional, for PDF uploads)
   - `CLOUDINARY_KEY` (Optional, for PDF uploads)
   - `CLOUDINARY_SECRET` (Optional, for PDF uploads)
   - `URBACKEND_API_KEY` (Optional, to enable Welcome emails on signup)
4. **Deploy:** Deploy the application. Render will automatically build the dependencies and start the app with `npm start`. Sessions are persisted to a `sessions` collection in MongoDB Atlas so users remain signed in across redeploys.

## Contributing

We welcome contributions from the SVVV community! To contribute:

1. **Fork the Repository:** Create a personal fork of this repository on GitHub.
2. **Clone your Fork:** Clone the repository to your local machine.
3. **Create a Branch:** Create a branch for your feature or bug fix:
   ```bash
   git checkout -b feature/your-feature-name
   ```
4. **Make Changes & Test:** Write clean code, adhere to the project structure, and verify changes locally.
5. **Commit & Push:** Commit your changes with a clear message and push them to your fork:
   ```bash
   git commit -m "Add feature details"
   git push origin feature/your-feature-name
   ```
6. **Open a Pull Request:** Go to the original repository on GitHub and open a Pull Request (PR) from your branch. Please describe your changes clearly in the PR description.
