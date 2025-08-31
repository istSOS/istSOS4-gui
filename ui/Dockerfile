FROM node:23.9.0-alpine3.21 AS installer
WORKDIR /home/node/app
COPY package*.json ./
RUN npm ci

FROM node:23.9.0-alpine3.21 AS builder
WORKDIR /home/node/app
RUN mkdir no_bp
RUN mkdir with_bp
COPY --from=installer /home/node/app/node_modules ./no_bp/node_modules
COPY --from=installer /home/node/app/node_modules ./with_bp/node_modules
COPY . ./no_bp
COPY . ./with_bp
WORKDIR /home/node/app/no_bp
RUN sed -i 's|/NEXT_APP_URL|''|g' ./next.config.js
RUN npm run build
WORKDIR /home/node/app/with_bp
RUN npm run build


FROM node:23.9.0-alpine3.21
ENV NODE_ENV=production
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
WORKDIR /home/node/app
RUN mkdir no_bp
RUN mkdir with_bp
WORKDIR /home/node/app/no_bp
COPY --from=builder --chown=nextjs:nodejs /home/node/app/no_bp/public ./public
COPY --from=builder --chown=nextjs:nodejs /home/node/app/no_bp/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /home/node/app/no_bp/.next/static ./.next/static
WORKDIR /home/node/app/with_bp
COPY --from=builder --chown=nextjs:nodejs /home/node/app/with_bp/public ./public
COPY --from=builder --chown=nextjs:nodejs /home/node/app/with_bp/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /home/node/app/with_bp/.next/static ./.next/static

COPY ./environment_variables.sh /environment_variables.sh
RUN chmod +x /environment_variables.sh

EXPOSE 3000

ENTRYPOINT ["/environment_variables.sh"]