# 从 scratch 构建（旧 cache 镜像已丢失）
FROM --platform=linux/arm64 ubuntu:20.04

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=Asia/Shanghai \
    LANG=C.UTF-8

# 1. apt 源切换为阿里云 ports 源（arm64 用 ports 源）
RUN sed -i 's@http://ports.ubuntu.com/ubuntu-ports/@http://mirrors.aliyun.com/ubuntu-ports/@g' /etc/apt/sources.list

# 2. apt 基础工具 + python 软链接 + g++-11（better-sqlite3 v13 + electron 41 V8 头文件需要 C++20）
RUN apt-get update && \
    apt-get install -y curl git ca-certificates xz-utils build-essential python3 && \
    echo "deb [trusted=yes] http://ppa.launchpad.net/ubuntu-toolchain-r/test/ubuntu focal main" >> /etc/apt/sources.list && \
    apt-get update && \
    apt-get install -y g++-11 && \
    ln -sf /usr/bin/python3 /usr/bin/python && \
    update-alternatives --install /usr/bin/g++ g++ /usr/bin/g++-11 100 && \
    update-alternatives --install /usr/bin/gcc gcc /usr/bin/gcc-11 100 && \
    rm -rf /var/lib/apt/lists/*

# 3. Node.js arm64 从 npmmirror 二进制直下
ARG NODE_VERSION=24.13.0
RUN curl -fsSL https://registry.npmmirror.com/-/binary/node/v${NODE_VERSION}/node-v${NODE_VERSION}-linux-arm64.tar.xz \
    -o /tmp/node.tar.xz && \
    tar -xJf /tmp/node.tar.xz -C /usr/local --strip-components=1 && \
    rm -f /tmp/node.tar.xz && \
    ln -s /usr/local/bin/node /usr/local/bin/nodejs

# 4. npm 国内镜像 + 缓存目录显性化
ENV NPM_CONFIG_REGISTRY=https://registry.npmmirror.com \
    NPM_CONFIG_CACHE=/root/.npm \
    ELECTRON_MIRROR=https://npmmirror.com/mirrors/electron/ \
    ELECTRON_BUILDER_BINARIES_MIRROR=https://npmmirror.com/mirrors/electron-builder-binaries/ \
    ELECTRON_CACHE=/root/.cache/electron \
    ELECTRON_BUILDER_CACHE=/root/.cache/electron-builder \
    NODE_OPTIONS=--max-old-space-size=4096

WORKDIR /app

# 5. 拷贝 package.json + 源码
COPY package*.json ./
COPY . .

# 6. npm install（--ignore-scripts 跳过 electron postinstall，QEMU 下太慢）
#    electron 二进制在步骤 6.5 中手动下载到缓存
RUN npm install --ignore-scripts

# 6.5 下载 electron 二进制到缓存 + 安装 better-sqlite3 v13 并重编译
#     electron postinstall 被 --ignore-scripts 跳过，手动下载 zip 到 @electron/get 缓存目录
#     better-sqlite3 v13 使用 node-addon-api (N-API)，兼容 Electron 41 V8 API
#     预下载 electron 头文件，用 node-gyp --nodedir 直接编译，绕过 SHASUMS 校验失败
RUN ELECTRON_VERSION=$(node -p "require('/app/node_modules/electron/package.json').version") && \
    ELECTRON_ZIP="electron-v${ELECTRON_VERSION}-linux-arm64.zip" && \
    MIRROR_HASH=$(node -e "const c=require('crypto');const u=new URL('https://npmmirror.com/mirrors/electron/v'+'${ELECTRON_VERSION}'+'/'+'${ELECTRON_ZIP}');u.pathname=require('path').posix.dirname(u.pathname);console.log(c.createHash('sha256').update(u.toString()).digest('hex'))") && \
    GH_HASH=$(node -e "const c=require('crypto');const u=new URL('https://github.com/electron/electron/releases/download/v'+'${ELECTRON_VERSION}'+'/'+'${ELECTRON_ZIP}');u.pathname=require('path').posix.dirname(u.pathname);console.log(c.createHash('sha256').update(u.toString()).digest('hex'))") && \
    mkdir -p /root/.cache/electron/${MIRROR_HASH} /root/.cache/electron/${GH_HASH} && \
    curl -fsSL "https://npmmirror.com/mirrors/electron/v${ELECTRON_VERSION}/${ELECTRON_ZIP}" \
      -o /root/.cache/electron/${MIRROR_HASH}/${ELECTRON_ZIP} && \
    cp /root/.cache/electron/${MIRROR_HASH}/${ELECTRON_ZIP} \
       /root/.cache/electron/${GH_HASH}/${ELECTRON_ZIP} && \
    mkdir -p node_modules/better-sqlite3 node_modules/node-addon-api && \
    curl -fsSL "https://registry.npmmirror.com/better-sqlite3/-/better-sqlite3-13.0.3.tgz" \
      | tar -xz -C node_modules/better-sqlite3 --strip-components=1 && \
    curl -fsSL "https://registry.npmmirror.com/node-addon-api/-/node-addon-api-8.9.1.tgz" \
      | tar -xz -C node_modules/node-addon-api --strip-components=1 && \
    HEADERS_DIR=/root/.electron-gyp/${ELECTRON_VERSION} && \
    mkdir -p ${HEADERS_DIR} && \
    curl -fsSL "https://registry.npmmirror.com/-/binary/electron/v${ELECTRON_VERSION}/node-v${ELECTRON_VERSION}-headers.tar.gz" \
      | tar -xz -C ${HEADERS_DIR} --strip-components=1 && \
    cp ${HEADERS_DIR}/include/node/common.gypi ${HEADERS_DIR}/common.gypi && \
    cp ${HEADERS_DIR}/include/node/config.gypi ${HEADERS_DIR}/config.gypi && \
    rm -rf node_modules/better-sqlite3/prebuilds && \
    cd node_modules/better-sqlite3 && \
    node /app/node_modules/node-gyp/bin/node-gyp.js rebuild \
      --target=${ELECTRON_VERSION} --arch=arm64 --nodedir=${HEADERS_DIR}

# 7. 下载 Electron 运行时所需的 GTK 系统库 .deb 包（离线机器无法 apt-get install）
RUN mkdir -p /debs && \
    apt-get update && \
    cd /debs && \
    apt-get download $(apt-cache depends --recurse --no-recommends --no-suggests \
      --no-conflicts --no-breaks --no-replaces --no-enhances --no-pre-depends \
      libgtk-3-0 libnotify4 libnss3 libxss1 libxtst6 \
      libasound2 libatk-bridge2.0-0 libcups2 libdrm2 libgbm1 \
      libxkbcommon0 libxcb-dri3-0 2>/dev/null \
      | grep '^[a-zA-Z0-9]' | sort -u) && \
    rm -rf /var/lib/apt/lists/*

# 8. 打包到 /deps_bundle.tar.gz
RUN mkdir -p /root/.cache/electron /root/.cache/electron-builder && \
    tar -czf /deps_bundle.tar.gz \
    -C / \
    app \
    root/.npm \
    root/.cache/electron \
    root/.cache/electron-builder \
    debs
