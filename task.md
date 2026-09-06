# Admin Moderation System - Task List

- [x] Research existing codebase
- [x] Create implementation plan

## Execution

- [x] `utils/emailDomainBlock.js` — New blocked domain helper
- [x] `models/auditLog.js` — New audit log model
- [x] `models/note.js` — Add status/verifiedBy/verifiedAt/rejectionReason fields
- [x] `middleware/index.js` — isAdmin 403, login/register limiters
- [x] `config/passport.js` — Block domain in Google OAuth
- [x] `controllers/users.js` — Block domain in register/login/OTP/reset + profile status filter
- [x] `controllers/notes.js` — Status filtering on ALL public queries
- [x] `controllers/admin.js` — approveNote, rejectNote, moderationQueue, audit logs
- [x] `routes/admin.js` — New moderation routes
- [x] `app.js` — Home/sitemap status filter + migration
- [x] `views/admin/notes.ejs` — New moderation queue page
- [x] `views/admin/dashboard.ejs` — Update to use status field
- [x] `views/notes/show.ejs` — Pending/rejected banner for owner
- [x] `views/users/profile.ejs` — Status badges for note owner
- [x] `.env.example` — Document BLOCKED_EMAIL_DOMAINS
- [x] Node syntax validation — ALL SYNTAX OK
- [x] Git commit & push — `92c7059` pushed to main
