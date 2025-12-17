# 1. Sử dụng image nhẹ (Alpine)
FROM node:18-alpine

# 2. [Bảo mật] Cài đặt dumb-init để xử lý tín hiệu hệ thống (PID 1) tốt hơn
# Giúp container tắt mượt mà (graceful shutdown) khi deploy lại
RUN apk add --no-cache dumb-init

# 3. Thiết lập biến môi trường mặc định (Có thể ghi đè từ Jenkins/K8s)
ENV NODE_ENV=production
ENV PORT=3000

# 4. Thiết lập thư mục làm việc
WORKDIR /app

# 5. [Tối ưu Layer] Copy file dependency trước để tận dụng Docker Cache
COPY package.json package-lock.json ./

# 6. Cài đặt dependency
# --omit=dev: Giảm kích thước image
# && npm cache clean --force: Xóa cache npm để giảm rác
RUN npm ci --omit=dev && npm cache clean --force

# 7. Copy source code
COPY . .

# 8. [Bảo mật Quan Trọng] Đổi quyền sở hữu file cho user 'node'
# Mặc định container chạy root, rất nguy hiểm nếu bị hack.
# Image node:alpine đã có sẵn user tên là 'node'.
RUN chown -R node:node /app

# 9. [Bảo mật] Chuyển sang user thường (non-root)
USER node

# 10. Khai báo port sẽ dùng (Khớp với biến APP_PORT trong Jenkinsfile)
EXPOSE 3000

# 11. Chạy ứng dụng qua dumb-init
CMD ["dumb-init", "node", "src/index.js"]
