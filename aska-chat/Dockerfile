# Собирается на сервере из репозитория evaspace: контекст сборки — корень репозитория
# (нужны папки aska-chat и aska — оттуда берётся дизайн «Аськи»).
FROM node:24-alpine AS build
WORKDIR /src/aska-chat
COPY aska-chat/package.json aska-chat/package-lock.json ./
RUN npm ci --ignore-scripts
COPY aska /src/aska
COPY aska-chat ./
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production DATA_DIR=/data STATIC_DIR=/app/client/dist
COPY aska-chat/package.json aska-chat/package-lock.json ./
RUN npm ci --omit=dev --ignore-scripts && npm cache clean --force
COPY aska-chat/server server
COPY --from=build /src/aska-chat/client/dist client/dist
USER node
CMD ["node", "--disable-warning=ExperimentalWarning", "server/src/index.js"]
