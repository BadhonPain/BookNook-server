# BookNook API

Express and MongoDB API for the BookNook library client. Authentication is issued by BetterAuth in the client application and validated here against its public JWKS endpoint.

## Run locally

1. Install Node.js 20 or newer.
2. Copy `.env.example` to `.env` and set `MONGODB_URI`.
3. Start the API with `npm run server:dev`.
4. The API listens on `http://localhost:5000`; `GET /api/health` reports API and database availability.

The client application's BetterAuth URL, JWT audience, and the API's JWKS URL must agree. Keep `.env` out of source control; `.env.example` contains placeholders only.

## API routes

| Method | Path | Access | Purpose |
| --- | --- | --- | --- |
| `GET` | `/books` | Public | List books; supports `?category=Science`, `?available=true`, `?limit=6`, newest first, or `?sort=mostBorrowed` based on recorded borrows. |
| `GET` | `/books/:id` | Public | Read one book. |
| `POST` | `/books` | JWT | Add a book for the authenticated user. |
| `PATCH` | `/books/:id` | JWT + owner | Update an owned book. |
| `DELETE` | `/books/:id` | JWT + owner | Delete an owned book with no active borrows. |
| `POST` | `/borrows` | JWT | Borrow an available book. |
| `GET` | `/borrows` | JWT | List the authenticated user's active borrows. |
| `DELETE` | `/borrows/:id` | JWT + owner | Return a borrowed book. |

The borrow route atomically decrements available copies, prevents duplicate active borrows for a user/book pair, and restores a copy on return.
