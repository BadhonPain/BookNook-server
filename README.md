# BookNook — API

**The REST API behind BookNook, a community-powered library for sharing and borrowing books.**

[![Visit BookNook](https://img.shields.io/badge/Visit-BookNook-537861?style=for-the-badge)](https://book-nook-client-cyan.vercel.app/)
[![API repository](https://img.shields.io/badge/GitHub-API-181717?style=for-the-badge&logo=github)](https://github.com/BadhonPain/BookNook-server)
[![Client repository](https://img.shields.io/badge/GitHub-Client-181717?style=for-the-badge&logo=github)](https://github.com/BadhonPain/BookNook-client)

**Live application:** [book-nook-client-cyan.vercel.app](https://book-nook-client-cyan.vercel.app/)

BookNook API is an Express and MongoDB service for the [BookNook web client](https://github.com/BadhonPain/BookNook-client). It provides catalog, borrowing, reading-history, and personalized-recommendation endpoints. The client handles accounts with Better Auth; this API verifies its signed access tokens using the issuer's public JWKS.

## Features

- Public catalog and individual book lookups, with category, availability, newest, and most-borrowed filters.
- Authenticated book creation and owner-only edits and deletion.
- Borrow and return workflows that keep available-copy counts in sync and prevent duplicate active loans.
- Per-reader active loans and return history.
- Personalized book recommendations based on reading history, favorite categories, authors, and interests.
- Reader preference validation and persistence.
- CORS allowlisting, request validation, JSON error responses, and a database health endpoint.

## Technology

- Node.js and Express 5
- MongoDB Node.js driver
- Better Auth JWT verification with `jose`
- Node.js built-in test runner

## Run locally

### Prerequisites

- Node.js 20 or newer
- npm
- MongoDB, local or hosted

### Setup

```powershell
npm install
Copy-Item .env.example .env
```

Set the values in `.env`:

| Variable | Purpose |
| --- | --- |
| `PORT` | Local API port; defaults to `5000`. |
| `MONGODB_URI` | MongoDB connection string. Required. |
| `MONGODB_DATABASE` | Database name; defaults to `booknook`. |
| `CLIENT_URL` | Allowed client origin(s) for CORS. Separate multiple origins with commas. |
| `BETTER_AUTH_URL` | Base URL of the client application's Better Auth issuer. |
| `AUTH_JWKS_URL` | Public JWKS endpoint used to verify client-issued tokens. Defaults to `<BETTER_AUTH_URL>/api/auth/jwks`. |
| `JWT_AUDIENCE` | Expected JWT audience; defaults to `booknook-api`. |

Start the API:

```powershell
npm run dev
```

The API listens at [http://localhost:5000](http://localhost:5000). Check its health at [http://localhost:5000/api/health](http://localhost:5000/api/health); a healthy response includes `"status":"ok"` and `"database":"connected"`.

To run the client locally as well, follow the setup instructions in the [client README](https://github.com/BadhonPain/BookNook-client#run-locally).

## API reference

All paths are relative to the API base URL. Routes marked **Authenticated** require a valid access token issued by the configured Better Auth application. Book edits and deletions also require that the signed-in reader owns the listing.

### Health and books

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/api/health` | Public | Report API and MongoDB availability. |
| `GET` | `/books` | Public | List books. Supports `category`, `available=true\|false`, `limit` (1–100), and `sort=newest\|mostBorrowed`. |
| `GET` | `/books/:id` | Public | Get a book by ID. |
| `POST` | `/books` | Authenticated | Add a book. |
| `PATCH` | `/books/:id` | Authenticated + owner | Update an owned book. |
| `DELETE` | `/books/:id` | Authenticated + owner | Delete an owned book when it has no active loans. |

### Borrowing

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `POST` | `/borrows` | Authenticated | Borrow an available book. `bookId` is required; `returnDate` is optional and defaults to seven days after borrowing. |
| `GET` | `/borrows` | Authenticated | List the reader's active loans. |
| `GET` | `/borrows/history` | Authenticated | List the reader's returned books. |
| `DELETE` | `/borrows/:id` | Authenticated + borrower | Return a loan. |

### Recommendations

| Method | Path | Access | Description |
| --- | --- | --- | --- |
| `GET` | `/recommendations` | Authenticated | Get recommendations and saved preferences. Supports `limit` (1–30; defaults to 10). |
| `PUT` | `/recommendations/preferences` | Authenticated | Save favorite categories and up to 20 author, topic, or theme interests. |

The borrow endpoint decrements an available copy before recording a loan and restores the copy if recording fails. A unique partial MongoDB index prevents a reader from having more than one active loan for the same book. Recommendations use content-based category, author, title, and description matches, with borrow history and saved preferences as reader signals.

## Available scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API with Node.js watch mode. |
| `npm start` | Start the API for production. |
| `npm test` | Run the automated tests with Node's built-in test runner. |

## Deployment

Deploy the Express API separately from the Next.js client. Configure the environment variables above in the hosting provider, use a production MongoDB connection, and set `CLIENT_URL` to the exact deployed client origin. Configure the client's `NEXT_PUBLIC_API_URL` to point to the deployed API.

The live BookNook web application is [book-nook-client-cyan.vercel.app](https://book-nook-client-cyan.vercel.app/). Its API deployment URL depends on the active hosting configuration; use that URL for the client's `NEXT_PUBLIC_API_URL` and for the API health check.

Never commit `.env`, MongoDB credentials, or authentication configuration secrets. Use `.env.example` as the safe local template.

## Contributing

1. Fork the repository and create a feature branch.
2. Keep changes focused and run `npm test`.
3. Open a pull request describing the change and how it was verified.

## License

No license is currently specified. Contact the repository owner before redistributing or reusing this project.
