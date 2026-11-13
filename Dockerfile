FROM node:22-alpine AS builder

WORKDIR /app

# Copy root and web package files
COPY package*.json ./
COPY web/package*.json ./web/

# Install dependencies
RUN npm install
RUN npm --prefix web install

# Copy source code
COPY . .

# Build frontend production bundle
RUN npm --prefix web run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=builder /app/web/dist ./web/dist
COPY --from=builder /app/server ./server
COPY --from=builder /app/data ./data

EXPOSE 3000

CMD ["node", "server/index.js"]
