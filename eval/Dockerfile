FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --production

COPY dist/ ./dist/

ENV NODE_ENV=production
