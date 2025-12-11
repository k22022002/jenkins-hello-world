# Sử dụng base image ổn định, đầy đủ công cụ
FROM node:20-bookworm

# Chuyển quyền sang root để cài đặt
USER root

# Cài đặt tất cả các công cụ cần thiết 1 lần duy nhất
# Kết hợp lệnh để giảm layer và dọn dẹp rác (rm -rf) để giảm dung lượng
RUN apt-get update && apt-get install -y \
    git \
    curl \
    jq \
    openjdk-17-jre \
    docker.io \
    && rm -rf /var/lib/apt/lists/*

# (Tùy chọn) Bạn có thể cài luôn Cosign và Trivy ở đây nếu muốn pipeline sạch hơn nữa
# Nhưng tạm thời cứ để pipeline cài 2 món đó cũng được.

# Thiết lập thư mục làm việc mặc định
WORKDIR /app
