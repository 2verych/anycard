# syntax=docker/dockerfile:1.4

# Build stage: compile the React app
FROM node:20 AS build
WORKDIR /usr/src/app

# Install dependencies
COPY package*.json ./
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
    npm ci --omit=dev

# Copy source and build with env file mounted as secret
COPY . .
RUN --mount=type=secret,id=env,target=.env \
    npm run build

# Runtime stage: serve static files with nginx
FROM nginx:alpine
COPY --from=build /usr/src/app/dist /usr/share/nginx/html
EXPOSE 80
