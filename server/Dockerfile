FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY --from=build /app/dist ./dist
COPY scripts ./scripts
RUN mkdir -p /data/attachments && chown -R node:node /data/attachments /app
USER node
EXPOSE 3020
CMD ["node", "dist/index.js"]
