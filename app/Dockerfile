FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --only=production
COPY . .
# Biện pháp Hardening: Chạy container dưới quyền user non-root
USER node
EXPOSE 3000
CMD ["node", "server.js"]