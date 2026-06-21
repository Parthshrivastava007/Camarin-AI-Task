FROM node:18-alpine

WORKDIR /app

# Copy package configurations
COPY package*.json ./

# Install packages
RUN npm install

# Copy source code files
COPY src/ ./src
COPY tests/ ./tests

# Expose backend API port
EXPOSE 5000

# Default command (overridden in compose)
CMD ["npm", "run", "start:api"]
