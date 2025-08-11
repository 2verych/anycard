# Use official Node.js 20 LTS image
FROM node:20

# Set working directory
WORKDIR /usr/src/app

# Install dependencies based on package.json and package-lock.json
COPY package*.json ./
RUN npm ci --omit=dev

# Copy source files
COPY . .

# Start the bot
CMD ["npm", "start"]
