FROM node:22-alpine AS build
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY prisma ./prisma
RUN pnpm exec prisma generate

COPY . .
RUN pnpm run build


FROM node:22-alpine
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN pnpm install --frozen-lockfile --prod
RUN pnpm exec prisma generate

COPY --from=build /app/dist ./dist

CMD ["sh", "-c", "for i in $(seq 1 5); do pnpm exec prisma db push && break; echo \"db push attempt $i failed, retrying in $((i * 2))s\"; sleep $((i * 2)); done && node dist/main.js"]
