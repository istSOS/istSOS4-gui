# ---- INSTALL ----
FROM node:20-bullseye AS installer
WORKDIR /home/node/app
COPY package*.json ./
RUN npm ci

# ---- BUILD ----
FROM node:20-bullseye AS builder
WORKDIR /home/node/app
COPY --from=installer /home/node/app/node_modules ./node_modules
COPY . .
RUN npm run build

# ---- RUNTIME ----
FROM node:20-bullseye-slim

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
    && adduser --system --uid 1001 nextjs

WORKDIR /home/node/app

COPY --from=builder --chown=nextjs:nodejs /home/node/app/public ./public
COPY --from=builder --chown=nextjs:nodejs /home/node/app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /home/node/app/.next/static ./.next/static

COPY ./environment_variables.sh /environment_variables.sh
RUN chmod +x /environment_variables.sh

EXPOSE 3000

ENTRYPOINT ["/environment_variables.sh"]
