FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN mkdir -p uploads backups
EXPOSE 3001
CMD ["node", "server.js"]
