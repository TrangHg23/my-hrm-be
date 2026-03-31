# --- Stage 1: Base ---
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
WORKDIR /app

# --- Stage 2: Dependencies ---
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
# Copy thư mục prisma vào sớm để script postinstall (prisma generate) có file config mà đọc
COPY prisma ./prisma

# Cài đặt tất cả (cả devDeps) để build và dùng cho Prisma
# Bỏ --ignore-scripts để các hàm native như bcrypt tự động biên dịch (.node)
RUN pnpm install --frozen-lockfile

# --- Stage 3: Builder ---
FROM base AS builder
# Dùng ARG cho build-time env
ARG DATABASE_URL="postgresql://postgres:password@localhost:5432/db"
ENV DATABASE_URL=$DATABASE_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate client & build source
RUN pnpm prisma generate
RUN pnpm build


# --- Stage 4: Runner ---
# Kế thừa "base" thay vì node:22-alpine thuần để không bị cắt đứt symlink của pnpm
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY package.json pnpm-lock.yaml ./

# Bước 1. Cài đặt các thư viện Môi trường Production
# Dùng npm pkg delete để loại bỏ "postinstall: prisma generate" do "prisma" là devDependencies
# Bỏ --ignore-scripts đi để native module được cài đặt đúng trên môi trường alpine.
RUN npm pkg delete scripts.postinstall && pnpm install --prod --frozen-lockfile

# Bước 2. Copy schema Prisma và generate Client ngay bên trong thư mục cuối cùng.
# Dùng npx prisma@6 để ép bản 6.x tương tự package.json, chặn tải Prisma v7 gây lỗi schema
COPY prisma ./prisma
RUN npx prisma@6 generate

# Bước 3. Nhập mã nguồn đã biên dịch từ bước Builder vào
COPY --from=builder /app/dist ./dist

EXPOSE 3000

# Endpoint healthcheck hợp lệ
HEALTHCHECK --interval=30s --timeout=3s \
  CMD wget --quiet --tries=1 --spider http://localhost:3000/health || exit 1

# Tự động đẩy file cấu trúc vào database (migrate deploy) trước khi start server
CMD ["sh", "-c", "npx prisma@6 migrate deploy && node dist/src/main.js"]