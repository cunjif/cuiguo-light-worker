# =============================================================================
# 离线 Arm64 (Kylin V10SP1 2403 / glibc 2.31) 全套编译依赖打包 Dockerfile
#
# 目标机器: kylin-desktop-v10-sp1-2403, ARM64 kirin 9000C, glibc 2.31, Node v24.13.0
# 基础镜像: ubuntu:20.04 arm64 (glibc 2.31, 与 Kylin V10SP1 完全匹配)
# 构建机:   x86_64 Docker + QEMU 模拟 arm64 (buildx linux/arm64)
#
# 产物: /chatmcp.tar.gz
#   ├── app/                      项目源码 + node_modules(含预编译 better-sqlite3)
#   ├── root/.npm/                npm 缓存(离线 npm install)
#   ├── root/.cache/electron/     Electron arm64 二进制
#   ├── root/.cache/electron-builder/  electron-builder 二进制(fpm 等)
#   ├── debs/                     Electron 运行时系统库 .deb
#   ├── toolchain-debs/           编译工具链 .deb(g++-11/python3/make, 重编译 native 用)
#   └── setup-offline-env.sh      目标机器一键部署脚本
# =============================================================================

FROM --platform=linux/arm64 ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Asia/Shanghai \
    LANG=C.UTF-8

# 1. apt 源切换阿里云 ports 源 + 安装基础工具与 g++-11
#    better-sqlite3 v13 + Electron 41 V8 头文件需要 C++20, focal 默认 g++-9 不够, 用 g++-11
RUN sed -i 's@http://ports.ubuntu.com/ubuntu-ports/@http://mirrors.aliyun.com/ubuntu-ports/@g' /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends \
        curl git ca-certificates xz-utils build-essential python3 python3-pip \
        pkg-config dpkg-dev fakeroot && \
    echo "deb [trusted=yes] http://ppa.launchpad.net/ubuntu-toolchain-r/test/ubuntu focal main" >> /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y --no-install-recommends g++-11 && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-11 100 && \
    update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-11 100 && \
    rm -rf /var/lib/apt/lists/*

# 2. Node.js arm64 (构建机用, 目标机器已自带 v24.13.0)
ARG NODE_VERSION=24.13.0
RUN curl -fsSL "https://registry.npmmirror.com/-/binary/node/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-arm64.tar.xz" \
      -o /tmp/node.tar.xz && \
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 && \
    rm -f /tmp/node.tar.xz && \
    ln -s /usr/local/bin/node /usr/local/bin/nodejs

# 3. npm 国内镜像 + 缓存目录显性化
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
    NPM_CONFIG_CACHE=/root/.npm \
    ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ \
    ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ \
    ELECTRON_CACHE=/root/.cache/electron \
    ELECTRON_BUILDER_CACHE=/root/.cache/electron-builder \
    NODE_OPTIONS=--max-old-space-size=4096

WORKDIR /app

# 4. 拷贝项目源码 (利用 .dockerignore 排除 node_modules/dist/artifacts 等)
COPY package*.json ./
COPY . .

# 5. 主项目 npm install (--ignore-scripts 跳过 electron postinstall, QEMU 下太慢)
RUN npm install --ignore-scripts

# 6. 下载 Electron arm64 二进制到 @electron/get 缓存 + 预下载头文件
#    electron postinstall 被 --ignore-scripts 跳过, 手动下载 zip 到缓存目录
#    同时下载 electron 头文件供 better-sqlite3 编译用
RUN ELECTRON_VERSION=$(node -p "require('/app/node_modules/electron/package.json').version") && \
    ELECTRON_ZIP="electron-v${ELECTRON_VERSION}-linux-arm64.zip" && \
    MIRROR_HASH=$(node -e "const c=require('crypto');const u=new URL('https://npmmirror.com/mirrors/electron/v'+'${ELECTRON_VERSION}'+'/'+'${ELECTRON_ZIP}');u.pathname=require('path').posix.dirname(u.pathname);console.log(c.createHash('sha256').update(u.toString()).digest('hex'))") && \
    GH_HASH=$(node -e "const c=require('crypto');const u=new URL('https://github.com/electron/electron/releases/download/v'+'${ELECTRON_VERSION}'+'/'+'${ELECTRON_ZIP}');u.pathname=require('path').posix.dirname(u.pathname);console.log(c.createHash('sha256').update(u.toString()).digest('hex'))") && \
    mkdir -p /root/.cache/electron/${MIRROR_HASH} /root/.cache/electron/${GH_HASH} && \
    curl -fsSL "https://npmmirror.com/mirrors/electron/v${ELECTRON_VERSION}/${ELECTRON_ZIP}" \
      -o /root/.cache/electron/${MIRROR_HASH}/${ELECTRON_ZIP} && \
    cp /root/.cache/electron/${MIRROR_HASH}/${ELECTRON_ZIP} \
       /root/.cache/electron/${GH_HASH}/${ELECTRON_ZIP} && \
    HEADERS_DIR=/root/.electron-gyp/${ELECTRON_VERSION} && \
    mkdir -p ${HEADERS_DIR} && \
    curl -fsSL "https://registry.npmmirror.com/-/binary/electron/v${ELECTRON_VERSION}/node-v${ELECTRON_VERSION}-headers.tar.gz" \
      | tar -xz -C ${HEADERS_DIR} --strip-components=1 && \
    cp ${HEADERS_DIR}/include/node/common.gypi ${HEADERS_DIR}/common.gypi && \
    cp ${HEADERS_DIR}/include/node/config.gypi ${HEADERS_DIR}/config.gypi && \
    echo "Electron ${ELECTRON_VERSION} arm64 binary + headers cached."

# 7. 编译 better-sqlite3 v13 for Electron arm64
#    better-sqlite3 v13 使用 node-addon-api (N-API), 兼容 Electron 41 V8 API
#    删除 prebuilds, 用 node-gyp --nodedir 指向 electron 头文件重编译
RUN ELECTRON_VERSION=$(node -p "require('/app/node_modules/electron/package.json').version") && \
    HEADERS_DIR=/root/.electron-gyp/${ELECTRON_VERSION} && \
    rm -rf node_modules/better-sqlite3/prebuilds && \
    cd node_modules/better-sqlite3 && \
    node /app/node_modules/node-gyp/bin/node-gyp.js rebuild \
      --target=${ELECTRON_VERSION} --arch=arm64 --nodedir=${HEADERS_DIR} && \
    echo "better-sqlite3 rebuilt for Electron ${ELECTRON_VERSION} arm64."

# 8. MCP 服务器依赖安装
#    markitdown-mcp-server: dependencies 为空, build 通过 pack:mcp 的 symlink 使用主项目 tsc
#    mcp-control: sharp ^0.34 通过 @img/sharp-linux-arm64 optionalDeps 获取预编译, --ignore-scripts 跳过 native 编译
#    playwright-mcp: playwright npm 包不含浏览器二进制, 构建命令为 pre-built, 无需下载浏览器
#    aigroup-mdtoword-mcp: 纯 JS 依赖
#    linux-control: 仅 @modelcontextprotocol/sdk
RUN cd /app/src/mcp-builtin/mcp-control && npm install --ignore-scripts && echo "mcp-control deps installed." ; \
    cd /app/src/mcp-builtin/playwright-mcp && npm install --ignore-scripts && echo "playwright-mcp deps installed." ; \
    cd /app/src/mcp-builtin/aigroup-mdtoword-mcp && npm install --ignore-scripts && echo "aigroup-mdtoword-mcp deps installed." ; \
    cd /app/src/mcp-builtin/linux-control && npm install --ignore-scripts && echo "linux-control deps installed." ; \
    cd /app/src/mcp-builtin/markitdown-mcp-server && npm install --ignore-scripts && echo "markitdown-mcp-server deps installed."

# 9. 运行 pack:mcp 构建 markitdown-mcp-server 并打包所有 MCP 服务器到 src/mcp-builtin/packages/
#    pack:mcp 会: 创建 symlink -> npm run build -> npm pack, 以及下载 @modelcontextprotocol/server-filesystem 和 bazi-mcp
RUN npm run pack:mcp || echo "WARN: pack:mcp partial failure, pre-built tgz may still be available."

# 10. 预下载 electron-builder 所需二进制 (fpm/app-builder 等) 到缓存
#     先 tsc 构建, 再用 electron-builder 完整打包 deb 预热缓存 (会下载 fpm 等工具到 ELECTRON_BUILDER_CACHE)
#     QEMU 下较慢, 用 timeout 限制 15 分钟, 允许失败 (缓存部分预热即可)
RUN npm run build 2>/dev/null ; \
    timeout 900 npx electron-builder --linux deb 2>/dev/null || \
    echo "WARN: electron-builder deb packaging partial failure, cache may be partially populated." ; \
    ELECTRON_VERSION=$(node -p "require('/app/node_modules/electron/package.json').version") && \
    echo "electron-builder cache prepared for electron ${ELECTRON_VERSION}." ; \
    ls -la /root/.cache/electron-builder/ 2>/dev/null || true

# 11. 下载 Electron 运行时所需的 GTK 系统库 .deb (离线机器无法 apt-get install)
RUN mkdir -p /debs && \
    apt-get update && \
    cd /debs && \
    apt-get download $(apt-cache depends --recurse --no-recommends --no-suggests \
      --no-conflicts --no-breaks --no-replaces --no-enhances --no-pre-depends \
      libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 \
      libasound2 libatk-bridge2.0-0 libcups2 libdrm2 libgbm1 \
      libxkbcommon0 libxcb-dri3-0 libsecret-1-0 libnspr4 \
      libatk1.0-0 libatspi2.0-0 libxcomposite1 libxdamage1 \
      libxfixes3 libxrandr2 libxshmfence1 libpangocairo-1.0-0 \
      libpango-1.0-0 libcairo2 libgdk-pixbuf2.0-0 2>/dev/null \
      | grep '^[a-zA-Z0-9]' | sort -u) && \
    rm -rf /var/lib/apt/lists/* && \
    echo "Downloaded $(ls /debs | wc -l) runtime .deb packages."

# 12. 下载编译工具链 .deb (目标机器重编译 native 模块用: better-sqlite3/sharp 等)
#     包含: g++-11, gcc-11, cpp-11, libstdc++-11-dev, python3, make, pkg-config 等
RUN mkdir -p /toolchain-debs && \
    apt-get update && \
    cd /toolchain-debs && \
    apt-get download $(apt-cache depends --recurse --no-recommends --no-suggests \
      --no-conflicts --no-breaks --no-replaces --no-enhances --no-pre-depends \
      g++-11 gcc-11 cpp-11 libstdc++-11-dev libgcc-11-dev \
      python3 python3-dev python3-distutils make pkg-config \
      build-essential dpkg-dev fakeroot xz-utils 2>/dev/null \
      | grep '^[a-zA-Z0-9]' | sort -u) && \
    rm -rf /var/lib/apt/lists/* && \
    echo "Downloaded $(ls /toolchain-debs | wc -l) toolchain .deb packages."

# 13. 写入目标机器一键部署脚本
RUN printf '#!/bin/bash\n\
# 离线环境一键部署脚本 (目标机器: Kylin V10SP1 2403 ARM64)\n\
set -e\n\
BUNDLE_DIR="$(cd "$(dirname "$0")" && pwd)"\n\
echo "=== 离线编译环境部署 ==="\n\
echo "Bundle: $BUNDLE_DIR"\n\
\n\
# 1. 安装 Electron 运行时系统库\n\
if [ -d "$BUNDLE_DIR/debs" ] && [ "$(ls -A "$BUNDLE_DIR/debs" 2>/dev/null)" ]; then\n\
  echo "[1/4] 安装 Electron 运行时系统库 (.deb)..."\n\
  sudo dpkg -i "$BUNDLE_DIR"/debs/*.deb 2>/dev/null || sudo apt-get install -f -y\n\
else\n\
  echo "[1/4] 跳过: 无 debs 目录"\n\
fi\n\
\n\
# 2. 安装编译工具链 (可选, 重编译 native 模块用)\n\
if [ -d "$BUNDLE_DIR/toolchain-debs" ] && [ "$(ls -A "$BUNDLE_DIR/toolchain-debs" 2>/dev/null)" ]; then\n\
  echo "[2/4] 安装编译工具链 (.deb)..."\n\
  sudo dpkg -i "$BUNDLE_DIR"/toolchain-debs/*.deb 2>/dev/null || sudo apt-get install -f -y\n\
  sudo ln -sf /usr/bin/python3 /usr/bin/python 2>/dev/null || true\n\
  if [ -x /usr/bin/g++-11 ]; then\n\
    sudo update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-11 100 2>/dev/null || true\n\
    sudo update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-11 100 2>/dev/null || true\n\
  fi\n\
else\n\
  echo "[2/4] 跳过: 无 toolchain-debs 目录"\n\
fi\n\
\n\
# 3. 配置 npm 与 electron 缓存环境变量\n\
echo "[3/4] 配置 npm/electron 离线缓存环境变量..."\n\
NPM_CACHE_DIR="$BUNDLE_DIR/root/.npm"\n\
ELECTRON_CACHE_DIR="$BUNDLE_DIR/root/.cache/electron"\n\
ELECTRON_BUILDER_CACHE_DIR="$BUNDLE_DIR/root/.cache/electron-builder"\n\
ENV_FILE="$BUNDLE_DIR/env-offline.sh"\n\
cat > "$ENV_FILE" <<EOF\n\
export NPM_CONFIG_CACHE="$NPM_CACHE_DIR"\n\
export NPM_CONFIG_OFFLINE=true\n\
export NPM_CONFIG_PREFER_OFFLINE=true\n\
export ELECTRON_CACHE="$ELECTRON_CACHE_DIR"\n\
export ELECTRON_BUILDER_CACHE="$ELECTRON_BUILDER_CACHE_DIR"\n\
export ELECTRON_SKIP_BINARY_DOWNLOAD=1\n\
export NODE_OPTIONS=--max-old-space-size=4096\n\
EOF\n\
echo "  环境变量已写入 $ENV_FILE"\n\
echo "  使用前请执行: source $ENV_FILE"\n\
\n\
# 4. 验证\n\
echo "[4/4] 验证项目..."\n\
cd "$BUNDLE_DIR/app"\n\
node -v\n\
npm -v\n\
if [ -d node_modules/better-sqlite3/build/Release ]; then\n\
  echo "  OK: better-sqlite3 native 模块已存在"\n\
else\n\
  echo "  WARN: better-sqlite3 native 模块缺失, 可能需要重编译"\n\
fi\n\
if [ -d node_modules/electron ]; then\n\
  echo "  OK: electron 已安装"\n\
fi\n\
echo ""\n\
echo "=== 部署完成 ==="\n\
echo "使用方法:"\n\
echo "  cd \"$BUNDLE_DIR/app\""\n\
echo "  source \"$BUNDLE_DIR/env-offline.sh\""\n\
echo "  npm run build      # 编译 TypeScript"\n\
echo "  npm run start      # 启动 Electron 应用"\n\
echo "  npm run build-app  # 打包 deb 安装包"\n\
echo "  npm run pack:mcp   # 打包 MCP 服务器"\n\
' > /app/setup-offline-env.sh && chmod +x /app/setup-offline-env.sh

# 14. 打包所有内容到 /chatmcp.tar (仅归档不压缩, QEMU下gzip太慢; 宿主机上再gzip)
#     包含: 项目源码+node_modules, npm缓存, electron缓存, electron-builder缓存, 系统库deb, 工具链deb, 部署脚本
#     使用 --ignore-failed-read 容忍缺失目录(如 electron-builder 缓存可能未生成)
RUN mkdir -p /root/.cache/electron /root/.cache/electron-builder && \
    tar --ignore-failed-read -cf /chatmcp.tar \
    -C / \
    app \
    root/.npm \
    root/.cache/electron \
    root/.cache/electron-builder \
    debs \
    toolchain-debs && \
    ls -lh /chatmcp.tar && \
    echo "=== Bundle complete ===" && \
    echo "Output: /chatmcp.tar (宿主机上执行 gzip -k chatmcp.tar 生成 chatmcp.tar.gz)"
