# ==============================
# STAGE 1: BUILDER
# ==============================
FROM node:20-alpine AS builder

WORKDIR /app

# Kopyahin ang dependencies files (package.json, package-lock.json)
COPY package*.json ./

# I-install ang dependencies
RUN npm install

# Kopyahin ang lahat ng source code
COPY . .

# I-build ang Vite app (Vite ay gumagamit ng 'dist' folder bilang default)
RUN npm run build


# ==============================
# STAGE 2: RUNNER (Nginx Server)
# ==============================
FROM nginx:alpine

# Kopyahin ang custom Nginx config para sa reverse proxy
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Kopyahin ang na-build na static files (galing sa 'dist' ng Vite)
COPY --from=builder /app/dist /usr/share/nginx/html

# Exposure ng port 80
EXPOSE 80

# Patakbuhin ang Nginx server
CMD ["nginx", "-g", "daemon off;"]