#!/bin/bash

set -euo pipefail

# 配置部分
DEFAULT_PORT=3000
PORT="${1:-$DEFAULT_PORT}"
HOST="${HOST:-0.0.0.0}"
LOG_DIR="${LOG_DIR:-logs}"
TS="$(date +'%Y%m%d')"
LOG_FILE="${LOG_DIR}/frontend_${TS}.log"
CONDA_ENV="cinemind"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# 辅助函数
function info() { echo -e "\033[32m[INFO]\033[0m $*"; }
function warn() { echo -e "\033[33m[WARN]\033[0m $*" >&2; }
function err()  { echo -e "\033[31m[ERROR]\033[0m $*" >&2; }

# 创建日志目录
mkdir -p "$LOG_DIR" || { err "无法创建日志目录: $LOG_DIR"; exit 1; }

info "正在初始化前端服务..."
info "目标端口: ${PORT}"
info "日志文件: ${LOG_FILE}"

# 端口占用检测与释放
function free_port() {
  local p="$1"
  if command -v fuser >/dev/null 2>&1; then
    if fuser "${p}/tcp" >/dev/null 2>&1; then
      warn "端口 ${p} 被占用，尝试释放..."
      if ! fuser -k "${p}/tcp"; then
        err "释放端口 ${p} 失败"
        return 1
      fi
      info "已释放端口 ${p}"
    fi
  elif command -v lsof >/dev/null 2>&1; then
    local pids
    pids="$(lsof -t -iTCP -sTCP:LISTEN -P -n ":${p}" || true)"
    if [[ -n "$pids" ]]; then
      warn "端口 ${p} 被占用，尝试终止进程: ${pids}"
      if ! kill -9 $pids; then
        err "终止端口 ${p} 进程失败"
        return 1
      fi
      info "已终止占用端口的进程: ${pids}"
    fi
  else
    warn "未找到端口检测工具 (fuser/lsof)，跳过端口检查"
    return 0
  fi
  return 0
}

free_port "$PORT" || warn "端口释放可能失败，继续尝试启动"

info "等待5秒以确保资源释放..."
sleep 5

# 激活 conda 环境
if [ -z "${CONDA_EXE:-}" ]; then
    POSSIBLE_CONDAS=(
        "$HOME/miniconda3/etc/profile.d/conda.sh"
        "$HOME/anaconda3/etc/profile.d/conda.sh"
        "/opt/conda/etc/profile.d/conda.sh"
        "/usr/local/miniconda3/etc/profile.d/conda.sh"
    )
    for path in "${POSSIBLE_CONDAS[@]}"; do
        if [ -f "$path" ]; then
            source "$path"
            break
        fi
    done
else
    CONDA_BASE=$(dirname $(dirname "$CONDA_EXE"))
    if [ -f "${CONDA_BASE}/etc/profile.d/conda.sh" ]; then
        source "${CONDA_BASE}/etc/profile.d/conda.sh"
    fi
fi

if command -v conda >/dev/null 2>&1; then
  eval "$(conda shell.bash hook)" || { err "初始化 conda shell 失败"; exit 1; }
  
  # 检查环境是否存在
  if ! conda env list | grep -q "^${CONDA_ENV} "; then
      err "Conda 环境 '${CONDA_ENV}' 不存在，请先创建环境"
      exit 1
  fi

  conda activate "$CONDA_ENV" || { err "激活 conda 环境失败: $CONDA_ENV"; exit 1; }
  info "已激活 Conda 环境: $CONDA_ENV"
else
  err "未检测到 conda，请先安装并配置"
  exit 1
fi

# 切换到 frontend 目录
if [ -d "fronted" ]; then
    cd fronted
    info "已切换到 fronted 目录"
elif [ ! -f "package.json" ]; then
    if [ ! -f "package.json" ]; then
        err "无法定位应用入口，请在项目根目录运行脚本"
        exit 1
    fi
fi

info "启动前端服务 (npm run dev -- --port ${PORT}) ..."

# 使用 nohup 后台启动
set +e
nohup npm run dev -- --port "${PORT}" --host "${HOST}" >> "${LOG_FILE}" 2>&1 &
PID=$!
set -e

# 检查启动状态
sleep 3
if ps -p "${PID}" >/dev/null 2>&1; then
  info "前端服务已启动"
  info "PID: ${PID}"
  info "日志: ${LOG_FILE}"
  exit 0
else
  err "前端启动失败，进程已退出"
  echo "--- 日志末尾 20 行 ---"
  tail -n 20 "${LOG_FILE}"
  exit 2
fi
