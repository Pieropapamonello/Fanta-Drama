FROM node:20-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
RUN npx prisma generate || true
RUN npm run build
CMD ["node", "dist/index.js"]
