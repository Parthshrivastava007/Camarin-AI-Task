FROM node:20-alpine

WORKDIR /app

# Copy package configurations
COPY package*.json ./

# Install packages
RUN npm install --legacy-peer-deps

# Copy source code assets
COPY src/ ./src
COPY public/ ./public
COPY index.html ./
COPY vite.config.js ./
COPY eslint.config.js ./

# Expose Vite dev server port
EXPOSE 3000

# Run dev server binding to 0.0.0.0
CMD ["npm", "run", "dev", "--", "--host", "0.0.0.0", "--port", "3000"]
