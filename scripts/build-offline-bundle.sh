#!/usr/bin/env bash
# =============================================================================
# 离线 Arm64 编译依赖打包 - 构建脚本 (在 x86_64 开发机上运行)
#
# 功能: 用 Docker buildx + QEMU 模拟 arm64 构建, 导出 chatmcp.tar.gz
# 产物: ./chatmcp.tar.gz (拷贝到目标 Kylin V10SP1 机器解压即可)
#
# 用法:
#   bash scripts/build-offline-bundle.sh            # 默认构建
#   bash scripts/build-offline-bundle.sh --no-cache # 不用缓存
#   bash scripts/build-offline-bundle.sh --node 24.13.0  # 指定 Node 版本
# =============================================================================
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
OUTPUT_FILE="$PROJECT_DIR/chatmcp.tar.gz"
IMAGE_TAG="chat-mcp-offline-builder:arm64"
NODE_VERSION="24.13.0"
NO_CACHE=""

# 解析参数
while [[ $# -gt 0 ]]; do
  case "$1" in
    --no-cache) NO_CACHE="--no-cache"; shift ;;
    --node) NODE_VERSION="$2"; shift 2 ;;
    --output) OUTPUT_FILE="$2"; shift 2 ;;
    *) echo "未知参数: $1"; exit 1 ;;
  esac
done

echo "============================================================"
echo "  离线 Arm64 编译依赖打包"
echo "============================================================"
echo "项目目录:   $PROJECT_DIR"
echo "产物文件:   $OUTPUT_FILE"
echo "Node 版本:  $NODE_VERSION"
echo "镜像标签:   $IMAGE_TAG"
echo "构建参数:   $NO_CACHE"
echo "============================================================"
echo ""

# 1. 检查 Docker
if ! command -v docker &>/dev/null; then
  echo "ERROR: 未找到 docker, 请先安装 Docker Desktop。"
  exit 1
fi
if ! docker info &>/dev/null; then
  echo "ERROR: Docker daemon 未运行, 请启动 Docker Desktop。"
  exit 1
fi

# 2. 确保 buildx 可用且支持 arm64
echo "[1/5] 检查 Docker buildx 与 QEMU arm64 支持..."
if ! docker buildx version &>/dev/null; then
  echo "ERROR: docker buildx 不可用, 请升级 Docker Desktop。"
  exit 1
fi

# 检查 arm64 是否支持 (通过 binfmt)
if ! docker run --rm --platform linux/arm64 alpine:latest echo "arm64 OK" &>/dev/null; then
  echo "  QEMU arm64 未注册, 尝试注册..."
  docker run --rm --privileged tonistiigi/binfmt --install arm64
fi
echo "  OK: arm64 模拟可用。"
echo ""

# 3. 构建 arm64 镜像
echo "[2/5] 构建 arm64 Docker 镜像 (QEMU 模拟, 较慢, 请耐心等待)..."
cd "$PROJECT_DIR"
docker buildx build \
  --platform linux/arm64 \
  --build-arg NODE_VERSION="$NODE_VERSION" \
  --tag "$IMAGE_TAG" \
  --load \
  $NO_CACHE \
  -f Dockerfile \
  .
echo "  OK: 镜像构建完成。"
echo ""

# 4. 从镜像中导出 offline-bundle.tar.gz
echo "[3/5] 从镜像中导出 chatmcp.tar.gz..."
CONTAINER_NAME="tmp-offline-export-$$"
docker create --name "$CONTAINER_NAME" "$IMAGE_TAG" >/dev/null
docker cp "$CONTAINER_NAME:/chatmcp.tar.gz" "$OUTPUT_FILE"
docker rm "$CONTAINER_NAME" >/dev/null
echo "  OK: 已导出到 $OUTPUT_FILE"
echo ""

# 5. 验证产物
echo "[4/5] 验证产物..."
if [ ! -f "$OUTPUT_FILE" ]; then
  echo "ERROR: 产物文件不存在!"
  exit 1
fi
FILE_SIZE=$(du -h "$OUTPUT_FILE" | cut -f1)
echo "  文件大小: $FILE_SIZE"
echo "  文件类型: $(file "$OUTPUT_FILE" 2>/dev/null || echo 'tar.gz')"

# 列出 tar.gz 顶层内容
echo "  顶层内容:"
tar -tzf "$OUTPUT_FILE" 2>/dev/null | head -20 | sed 's/^/    /'
echo ""

# 6. 输出部署说明
echo "[5/5] 完成!"
echo ""
echo "============================================================"
echo "  交付物: $OUTPUT_FILE ($FILE_SIZE)"
echo "============================================================"
echo ""
echo "部署到目标 Kylin V10SP1 机器步骤:"
echo "  1. 将 $OUTPUT_FILE 拷贝到目标机器"
echo "  2. tar -xzf chatmcp.tar.gz"
echo "  3. bash setup-offline-env.sh"
echo "  4. cd app && source ../env-offline.sh"
echo "  5. npm run start      # 启动应用"
echo "     npm run build-app  # 打包 deb"
echo "     npm run pack:mcp   # 打包 MCP 服务器"
echo ""