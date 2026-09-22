FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
RUN apk add --no-cache su-exec
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .
# sed strips any stray \r (a Windows checkout can carry CRLF regardless of .gitattributes), which would
# otherwise break the #!/bin/sh shebang below with a baffling "exec: no such file or directory".
RUN sed -i 's/\r$//' docker-entrypoint.sh && chmod +x docker-entrypoint.sh && mkdir -p /app/data && chown -R node:node /app/data
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s CMD wget -qO- http://127.0.0.1:3000/robots.txt >/dev/null || exit 1
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["node", "server.js"]
