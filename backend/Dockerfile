# syntax=docker/dockerfile:1.4
# Use official Node.js 20 LTS image
FROM node:20

# Set working directory
WORKDIR /usr/src/app

# Install dependencies based on package.json and package-lock.json
COPY package*.json ./
# Optionally mount a private npm token without baking it into layers
RUN --mount=type=secret,id=npmrc,target=/root/.npmrc,required=false \
    npm ci --omit=dev

# Copy source files
COPY . .

# Expose the port the app runs on
EXPOSE 4000

# Start the server
CMD ["npm", "start"]
