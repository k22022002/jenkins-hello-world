# 1. Sử dụng image nhẹ (Alpine)
FROM node:18-alpine

# 2. Cài đặt dumb-init
RUN sed -i 's/https/http/' /etc/apk/repositories && apk add --no-cache dumb-init

# 3. Thiết lập biến môi trường
ENV NODE_ENV=production
ENV PORT=3000

# 4. Thiết lập thư mục làm việc
WORKDIR /app

# --- SỬA ĐỔI QUAN TRỌNG TẠI ĐÂY ---

# 5. Copy TOÀN BỘ source code vào trước (bao gồm package.json)
COPY . .

# 6. Cài đặt dependency SAU KHI copy code.
# Việc này đảm bảo node_modules được tạo ra là mới nhất, chuẩn Linux,
# và KHÔNG BAO GIỜ bị code từ máy thật ghi đè lên nữa.
# Dùng 'npm ci' tốt hơn 'npm install' cho CI/CD (nó cài chính xác theo package-lock.json)
RUN npm ci --omit=dev && npm cache clean --force

# ----------------------------------

# 7. Đổi quyền sở hữu file cho user 'node'
RUN chown -R node:node /app

# 8. Chuyển sang user thường
USER node

# 9. Khai báo port
EXPOSE 3000

# 10. Chạy ứng dụng
CMD ["dumb-init", "node", "src/server.js"]