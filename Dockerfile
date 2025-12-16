# Sử dụng Node.js image nhẹ (Alpine)
FROM node:18-alpine

# Thiết lập thư mục làm việc
WORKDIR /app

# Copy file dependency trước
COPY package.json package-lock.json ./

# Cài đặt dependency bằng 'npm ci'
# 'npm ci' xóa node_modules cũ (nếu có) và cài chính xác theo package-lock.json
# --omit=dev: Không cài devDependencies (như eslint, jest...) để giảm nhẹ image
RUN npm ci --omit=dev

# Copy source code vào (Lúc này .dockerignore sẽ chặn rác bay vào)
COPY . .

# Chạy ứng dụng
CMD ["node", "src/index.js"]
