# Sharacard Monorepo

This repository contains a simple client-server application for storing discount cards.

## Backend
Located in the `backend` directory. It is an Express server using Google OAuth for authentication. Uploaded images are stored per-user using a salted hash of the user's email so the actual address never appears in URLs. Images are served through the `/files` API which validates the requester's access before sending the file.

### Setup
```bash
cd backend
cp .env.sample .env        # update with Google credentials and set a unique SALT
npm install
npm start
```
`ADMIN_EMAILS` in `.env` should contain a comma-separated list of emails allowed to access admin APIs.
`TELEGRAM_GROUP` should contain the Telegram bot username used to issue group invites.

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
4. View your uploaded cards in the "Your Cards" tab.

## Telegram Bot
A simple Telegram bot is located in the `telegram-bot` directory. It greets new members
in the group and stores an email to Telegram ID mapping via the backend API.

### Setup
```bash
cd telegram-bot
cp .env.sample .env  # configure BOT_TOKEN, BACKEND_URL, TELEGRAM_SECRET and TELEGRAM_GROUP_ID
npm install
npm start
```
