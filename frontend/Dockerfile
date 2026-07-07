# --- build stage ---
FROM node:20-alpine AS build
WORKDIR /app

COPY package.json package-lock.json ./
# npm ci is stricter about the lockfile matching 1:1, which broke here: the
# lockfile was generated on Windows and lacks the linux-musl/WASM optional
# dependencies (e.g. lightningcss's fallback) needed on this alpine image.
RUN npm install

COPY . .

# Vite bakes VITE_-prefixed vars into the bundle at build time, so this must
# be a build ARG (not a container runtime env var on the nginx stage).
ARG VITE_API_BASE_URL=/api/v1
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
RUN npm run build

# --- final stage ---
FROM nginx:alpine

COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80
