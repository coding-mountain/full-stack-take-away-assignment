## Prerequisites

- Node.js
- Postgres SQL Database
- npm

## Installation

Run a Postgres server and create a database named seismic_db.

Create a .env file inside server folder:

```
DATABASE_URL="postgresql://user:postgres@localhost:5432/seismic_db?schema=public"
```

## How to run the project

- **npm install** to install the packages for both client and server.
- **npm run dev** to run both server and client
- Client runs on port 5173
- Server runs on port 9797

## API Endpoints

- POST `/load-data`: insert new data into database form text file.
- GET `/stats/daily`: fetch all data form database with pagination.
- GET `/stats/day/2023/-1/10`: get data for specific date.
- GET `/stats/month/2023/01`: get data for specific month.
