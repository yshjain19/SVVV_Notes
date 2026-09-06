# Admin Moderation System - Task List

- [x] Research existing codebase
- [x] Create implementation plan

## Execution

- [/] `utils/emailDomainBlock.js` — New blocked domain helper
- [ ] `models/auditLog.js` — New audit log model
- [ ] `models/note.js` — Add status/verifiedBy/verifiedAt/rejectionReason fields
- [ ] `middleware/index.js` — isAdmin 403, login/register limiters
- [ ] `config/passport.js` — Block domain in Google OAuth
- [ ] `controllers/users.js` — Block domain in register/login/OTP/reset
- [ ] `controllers/notes.js` — Status filtering on ALL public queries
- [ ] `controllers/admin.js` — approveNote, rejectNote, moderationQueue, audit logs
- [ ] `routes/admin.js` — New moderation routes
- [ ] `app.js` — Home/sitemap status filter + migration
- [ ] `views/admin/notes.ejs` — New moderation queue page
- [ ] `views/admin/dashboard.ejs` — Update to use status field
- [ ] `views/notes/show.ejs` — Pending/rejected banner for owner
- [ ] `views/users/profile.ejs` — Status badges for note owner
- [ ] `.env.example` — Document BLOCKED_EMAIL_DOMAINS
- [ ] Git commit & push
