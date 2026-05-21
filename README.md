# The Digital Archivist - Library Management System

The Digital Archivist is a full-stack library management system for managing books, students, circulation, fines, notices, notifications, and library-wide settings. The project uses a static HTML/CSS/JavaScript frontend served by an Express backend with MongoDB persistence.


## Codebase Overview

- `public/` contains the frontend pages, styles, and browser scripts.
- `public/pages/auth/` contains login, signup, and forgot-password pages.
- `public/pages/admin/` contains admin dashboards for books, users, transactions, and settings.
- `public/pages/student/` contains student dashboard, catalog browsing, account, and borrowed-books views.
- `backend/src/server.js` starts the Express API, connects to MongoDB, seeds a default admin account, and serves the frontend.
- `backend/src/routes/` defines API routes for auth, books, users, transactions, students, settings, notices, and notifications.
- `backend/src/models/` defines Mongoose models for users, books, transactions, settings, notices, and notifications.
- `backend/src/middleware/` handles JWT auth, role checks, maintenance mode, and book-cover uploads.

## Features

- JWT-based authentication with student, librarian, and admin roles.
- Student registration, login, profile updates, and password changes.
- Admin user management with status updates and password reset support.
- Book catalog CRUD with categories, filters, cover-image uploads, soft delete, and restore.
- Circulation workflow for borrowing, returning, renewing, overdue tracking, and fine payments.
- Student catalog browsing, active loans, history, holds, and dashboard stats.
- Library settings for loan days, fine policy, registration, maintenance mode, and library details.
- Notices and unread notification badges for admins and students.
- Security middleware including Helmet, CORS, request rate limiting, and password hashing.

## Tech Stack

- Frontend: HTML, CSS, JavaScript
- Backend: Node.js, Express
- Database: MongoDB with Mongoose
- Authentication: JWT, bcryptjs
- Uploads: Multer
- Utilities: dotenv, dayjs, morgan, compression, express-validator

## Getting Started

### 1. Clone the Repository

```bash
git clone https://github.com/RajHarsh03/Library-Management-System.git
cd Library-Management-System
```

### 2. Install Backend Dependencies

```bash
cd backend
npm install
```

### 3. Configure Environment Variables

Create a `.env` file inside the `backend/` directory:

```env
PORT=5000
NODE_ENV=development
MONGODB_URI=mongodb://localhost:27017/digital_archivist
JWT_SECRET=change_this_secret
JWT_EXPIRE=7d
ADMIN_EMAIL=admin@archivist.sys
ADMIN_PASSWORD=admin123
CORS_ORIGIN=*
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=500
```


### 4. Run the App

```bash
npm run dev
```

The app will be available at:

```text
http://localhost:5000
```

The health check endpoint is:

```text
http://localhost:5000/api/health
```

## Default Admin Account

On startup, the backend creates a default admin account if no admin exists:

```text
Email: admin@archivist.sys
Password: admin123
```

You can override these values with `ADMIN_EMAIL` and `ADMIN_PASSWORD` in `backend/.env`.

## Useful Scripts

Run these from the `backend/` directory:

```bash
npm start
npm run dev
npm test
npm run lint
```

## Main API Areas

- `POST /api/auth/register` - register a user
- `POST /api/auth/login` - log in and receive a JWT
- `GET /api/auth/me` - get the current user profile
- `GET /api/books` - browse/search books
- `POST /api/books` - create a book as admin or librarian
- `GET /api/users` - manage users as admin
- `POST /api/transactions/borrow` - issue a book
- `POST /api/transactions/return` - return a book
- `GET /api/student/dashboard` - student dashboard data
- `GET /api/settings/public` - public library settings
- `GET /api/notifications/unread-count` - unread notification count
- `GET /api/notices` - active notices

## Frontend Routes

- `/login`
- `/signup`
- `/forgot-password`
- `/admin/dashboard`
- `/admin/books`
- `/admin/users`
- `/admin/transactions`
- `/admin/settings`
- `/student/dashboard`
- `/student/browse`
- `/student/my-books`
- `/student/account`

## Project Structure

```text
Library Management System/
|-- backend/
|   |-- package.json
|   `-- src/
|       |-- config/
|       |-- controllers/
|       |-- middleware/
|       |-- models/
|       |-- routes/
|       |-- utils/
|       `-- server.js
|-- public/
|   |-- pages/
|   |-- scripts/
|   `-- styles/
|-- vercel.json
`-- README.md
```

## Notes

- The frontend API helper uses the current origin and calls endpoints under `/api`.
- Uploaded book covers are stored in `public/uploads/covers`.
- MongoDB must be running locally or available through the configured `MONGODB_URI`.
- In production, do not keep the default admin password or default JWT secret.

## Contributing

If you make an enhancement, bug fix, or useful improvement, please open a pull request so it can be reviewed and merged into the project.

## License - Free to Use

This project is free to use, modify, and distribute under the MIT License. You may use it for learning, personal projects, academic work, or as a starting point for your own library management system.
