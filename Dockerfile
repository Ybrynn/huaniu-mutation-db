FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
RUN cp mutations.db seed-mutations.db 2>/dev/null || true
RUN chmod +x docker-entrypoint.sh
RUN mkdir -p uploads backups
EXPOSE 3001
ENTRYPOINT ["./docker-entrypoint.sh"]
