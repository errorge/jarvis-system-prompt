#!/bin/bash
# 一键安装：把本目录注册为 magpie 插件
set -euo pipefail
DIR="$(cd "$(dirname "$0")" && pwd)"

if command -v magpie >/dev/null 2>&1; then
  M=magpie
elif [ -x /Applications/magpie.app/Contents/MacOS/magpie ]; then
  M=/Applications/magpie.app/Contents/MacOS/magpie
else
  echo "找不到 magpie。请先安装 magpie，或手动执行：" >&2
  echo "  magpie plugin add \"$DIR\"" >&2
  exit 1
fi

"$M" plugin add "$DIR"
echo
echo "安装完成。打开 magpie 侧栏 → 插件 → Jarvis（贾维斯）进行配置。"
echo "查看状态：$M plugin list"
