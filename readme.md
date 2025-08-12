# Sharacard Monorepo

This repository contains a simple client-server application for storing discount cards.

## Backend
Located in the `backend` directory. It is an Express server using Google OAuth for authentication. Uploaded images are stored per-user using a salted hash of the user's email so the actual address never appears in URLs. Images are served through the `/files` API which validates the requester's access before sending the file.

### Setup
```bash
cd backend
# optionally copy .env.sample to .env for local development
npm install
npm start
```
`ADMIN_EMAILS` and `TELEGRAM_GROUP` should be provided via environment variables.

## Frontend
Located in the `frontend` directory. Built with React and Material UI using Vite.

### Setup
```bash
cd frontend
npm install
npm run dev
```

Set `VITE_API_URL` in your environment or create a local `.env` based on `.env.sample`.

### Docker

#### Backend
To run the backend in a container, define the required variables in your shell or pass an env file:

```bash
cd backend
docker compose --env-file .env up --build
```

The API will be available at `http://localhost:4000` by default. Environment variables come from your shell or the file provided with `--env-file`.

Secrets from `.env` are never copied into the image: `*.env` and `.npmrc` are ignored by Docker. If you rely on private npm packages, pass your `.npmrc` at build time so tokens do not persist in layers:

```bash
docker compose build --secret npmrc=.npmrc
```

Runtime secrets like API keys or database credentials should be stored outside the image (e.g. in environment files or a secret manager).
#### Frontend
To build and serve the frontend from a container:

```bash
cd frontend
docker compose --env-file .env up --build
```

Set `VITE_API_URL` in the environment file or shell before building. The site will be available at `http://localhost:3000` by default.

#### Telegram Bot
To run the Telegram bot in a container:

```bash
cd telegram-bot
docker compose --env-file .env up --build
```

Provide `BOT_TOKEN`, `BACKEND_URL`, `TELEGRAM_SECRET` and `TELEGRAM_GROUP_ID` via environment variables or an env file.

## Hosting

Each project has its own `docker-compose.yml`. To deploy, copy the project folder to your server, create an environment file such as `.prod.env`, and run:

```bash
docker compose --env-file .prod.env up -d --build
```

Repeat for `backend`, `frontend`, and `telegram-bot`. Keep your environment files out of version control and restrict their permissions on the host. Build images locally or in CI and push them to a registry if desired:

```bash
docker compose build
docker tag frontend_frontend:latest your-registry/anycard-frontend:latest
docker push your-registry/anycard-frontend:latest
```

Store secrets outside the images using env files, Docker secrets, or a secrets manager, and regularly scan built images to ensure nothing sensitive slipped into the layers.

In GitHub Actions, define all required variables as repository Secrets and expose them as environment variables. No `.env` file is needed in CI.

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
# configure BOT_TOKEN, BACKEND_URL, TELEGRAM_SECRET and TELEGRAM_GROUP_ID in your environment
npm install
npm start
```
