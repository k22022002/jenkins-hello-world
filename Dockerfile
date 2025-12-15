# Sử dụng Node.js image nhẹ (Alpine) để giảm tấn công bề mặt
FROM node:18-alpine

# Thiết lập thư mục làm việc
WORKDIR /app

# Copy file dependency trước để tận dụng cache của Docker
COPY package*.json ./

# Cài đặt dependency (production only để giảm nhẹ image)
RUN npm install --omit=dev

# Copy toàn bộ source code vào
COPY . .

# Chạy ứng dụng
CMD ["node", "src/index.js"]
