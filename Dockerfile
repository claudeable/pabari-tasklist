FROM node:20-alpine

WORKDIR /app

COPY package*.json .npmrc ./
RUN npm install --legacy-peer-deps

COPY . .
RUN npm run build

EXPOSE 3000

CMD ["sh", "-c", "node scripts/init-data.js && npm run start"]
