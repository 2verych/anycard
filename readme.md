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

### Docker

#### Backend
To run the backend in a container, copy the sample environment file and start the stack:

```bash
cd backend
cp .env.sample .env  # update with your credentials
# defaults to .env; override with ENV_FILE=.prod.env or similar
docker compose up --build
```

The API will be available at `http://localhost:4000` by default. Environment variables are loaded from `backend/.env` unless overridden with `ENV_FILE`, e.g. `ENV_FILE=.prod.env docker compose up --build`.

Secrets from `.env` are never copied into the image: `*.env` and `.npmrc` are ignored by Docker. If you rely on private npm packages, pass your `.npmrc` at build time so tokens do not persist in layers:

```bash
docker compose build --secret npmrc=.npmrc
```

Runtime secrets like API keys or database credentials should be stored outside the image (e.g. in environment files or a secret manager).
#### Frontend
To build and serve the frontend from a container:

```bash
cd frontend
cp .env.sample .env  # configure VITE_API_URL
# defaults to .env; override with ENV_FILE=.prod.env or similar
docker compose up --build
```

The React app is compiled with the environment file mounted as a BuildKit secret, so the `.env` contents are not baked into image layers. The site will be available at `http://localhost:3000` by default.

#### Telegram Bot
To run the Telegram bot in a container:

```bash
cd telegram-bot
cp .env.sample .env  # configure BOT_TOKEN, BACKEND_URL, TELEGRAM_SECRET and TELEGRAM_GROUP_ID
# defaults to .env; override with ENV_FILE=.prod.env or similar
docker compose up --build
```

## Hosting

Each project has its own `docker-compose.yml`. To deploy, copy the project folder to your server, create an environment file such as `.prod.env`, and run:

```bash
ENV_FILE=.prod.env docker compose up -d --build
```

Repeat for `backend`, `frontend`, and `telegram-bot`. Keep your `.env` files out of version control and restrict their permissions on the host. Build images locally or in CI and push them to a registry if desired:

```bash
docker compose build
docker tag frontend_frontend:latest your-registry/anycard-frontend:latest
docker push your-registry/anycard-frontend:latest
```

Store secrets outside the images using env files, Docker secrets, or a secrets manager, and regularly scan built images to ensure nothing sensitive slipped into the layers.

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
