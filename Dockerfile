FROM node:22-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps

COPY . .

# Assurer qu'un fallback exemple est toujours présent si le secret local n'est pas dans le contexte Docker
RUN if [ ! -f firebase-applet-config.json ] && [ -f firebase-applet-config.example.json ]; then \
      cp firebase-applet-config.example.json firebase-applet-config.json; \
    fi

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000

EXPOSE 3000

CMD ["npx", "tsx", "server.ts"]
