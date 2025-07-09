# AnyCard Monorepo

This repository contains a simple client-server application for storing discount cards.

## Backend
Located in the `backend` directory. It is an Express server using Google OAuth for authentication. Uploaded images are stored per-user based on their email address.

### Setup
```bash
cd backend
cp .env.sample .env        # update with Google credentials
npm install
npm start
```

## Frontend
Located in the `frontend` directory. Built with React and Material UI using Vite.

### Setup
```bash
cd frontend
npm install
npm run dev
```

Create a `.env` based on `.env.sample` to configure the API URL.

## Usage
1. Start the backend and frontend.
2. Open the frontend URL in your browser.
3. Login with Google and upload images of your cards.
4. Organize cards into groups and add comments during upload.
5. View your uploaded cards in the "Your Cards" tab and filter by group.
