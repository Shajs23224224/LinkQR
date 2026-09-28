FROM node:22-alpine AS build

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM node:22-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production
ENV DATABASE_PATH=/data/linkqr-billing.db

COPY package*.json ./
RUN npm install --omit=dev

COPY --from=build /app/dist ./dist

RUN mkdir -p /data \
  && chown -R node:node /app /data

USER node

EXPOSE 8080
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8080/ready').then(r=>process.exit(r.ok ? 0 : 1)).catch(()=>process.exit(1))"

CMD ["node", "dist/server.js"]
