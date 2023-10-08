FROM node:18.18.0-bookworm

WORKDIR /usr/src/app

# Put the packages in one layer
COPY package*.json ./
RUN npm install

# And the rest of our code above that
COPY . .

# Inbound OSC control
EXPOSE 7009/udp

# Inbound Alexa control
EXPOSE 12000

CMD ["node", "app.js"]
