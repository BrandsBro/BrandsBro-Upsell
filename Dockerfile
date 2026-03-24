FROM node:20-alpine
RUN apk add --no-cache openssl
EXPOSE 10000
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=10000
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev && npm cache clean --force
COPY . .
RUN npx prisma generate
RUN npm run build
CMD ["npm", "run", "start"]
