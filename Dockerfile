# Use the official Playwright image which includes Chromium and all dependencies
FROM mcr.microsoft.com/playwright:v1.59.0-jammy

WORKDIR /app

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Copy server code
COPY server.js ./

# Expose the port the app runs on
EXPOSE 3000

# Start the server
CMD ["npm", "start"]
