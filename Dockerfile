# ---------- 1️⃣ Frontend Build ----------
FROM node:22 AS frontend-build
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies (includes both frontend & backend deps)
RUN npm install

# Copy all source files
COPY . .

# Ensure Vite uses production env
ENV NODE_ENV=production
RUN cp .env.production .env || true

# Build React frontend (output to /app/dist)
RUN npm run build


# ---------- 2️⃣ Backend (Runtime Image) ----------
FROM node:22
WORKDIR /app

# Copy only package files for efficient caching
COPY package*.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy server source
COPY server ./server

# Copy frontend build from previous stage
COPY --from=frontend-build /app/dist ./client/dist

# Environment variables
ENV NODE_ENV=production
ENV PORT=8080

# Expose Cloud Run port
EXPOSE 8080

# Start Node server
CMD ["node", "server/server.js"]

