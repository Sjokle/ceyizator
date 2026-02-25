# ===============================
# Frontend Build Stage
# ===============================
FROM node:20-bullseye-slim AS builder

WORKDIR /app

COPY package*.json ./

# Temiz bir kurulum yapıyoruz
RUN npm ci

# Hata alınan nokta burası: Vite'in binary dosyasına çalıştırma izni veriyoruz
# Alias kullanıldığı için bu dizini kontrol altına almalıyız
RUN chmod -R +x node_modules/.bin

# Uygulama dosyalarını kopyala
COPY . .

# Ortam değişkeni
ENV VITE_API_URL=http://46.101.145.40/api

# Artık izin hatası vermeyecektir
RUN npm run build

# ===============================
# Production Stage (Nginx)
# ===============================
FROM nginx:alpine

COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
