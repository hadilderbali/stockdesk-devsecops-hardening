

FROM node:24-alpine

# Remove package managers that the application does not need at runtime.
RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \
    && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack

ENV NODE_ENV=production

WORKDIR /app

COPY package.json ./
COPY src ./src

USER 1000:1000

EXPOSE 3000

CMD ["node", "src/server.js"]

