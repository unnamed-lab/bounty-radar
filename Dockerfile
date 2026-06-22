# Playwright base image ships Chromium + system deps preinstalled.
# Match the tag to the playwright version in package.json.
FROM mcr.microsoft.com/playwright:v1.49.0-jammy

WORKDIR /app
COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

# Persist the SQLite file by mounting a volume at /app (or use Postgres).
CMD ["node", "dist/main.js"]
