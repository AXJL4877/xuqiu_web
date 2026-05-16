# 阿里云 ECS 生产镜像（Next.js standalone + Prisma）
FROM node:20-alpine

RUN apk add --no-cache libc6-compat openssl

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://xuqiu:xuqiu@localhost:5432/xuqiu?schema=public"

RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN chmod +x deploy/docker-entrypoint.sh

EXPOSE 3000
ENTRYPOINT ["./deploy/docker-entrypoint.sh"]
