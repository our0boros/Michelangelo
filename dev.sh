#!/usr/bin/env bash
# 米开朗基罗的工坊 — Vite 开发服务器快速启停脚本
#
# 用法:
#   ./dev.sh start     启动开发服务器（后台运行）
#   ./dev.sh stop      停止开发服务器
#   ./dev.sh restart   重启
#   ./dev.sh status    查看运行状态
#   ./dev.sh logs      实时查看日志（Ctrl+C 退出）
#
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PORT:-5173}"
HOST="${HOST:-0.0.0.0}"
PID_FILE="$ROOT/.dev.pid"
LOG_FILE="$ROOT/.dev.log"

is_running() {
  [[ -f "$PID_FILE" ]] || return 1
  local pid
  pid="$(cat "$PID_FILE" 2>/dev/null || true)"
  [[ -n "$pid" ]] || return 1
  kill -0 "$pid" 2>/dev/null
}

start() {
  if is_running; then
    echo "已经在运行 (PID $(cat "$PID_FILE"))，无需重复启动。"
    print_urls
    return 0
  fi
  [[ -d "$ROOT/node_modules" ]] || { echo "缺少依赖，正在安装..."; (cd "$ROOT" && npm install); }

  echo "正在启动开发服务器..."
  (cd "$ROOT" && nohup npm run dev -- --host "$HOST" --port "$PORT" > "$LOG_FILE" 2>&1 & echo $! > "$PID_FILE")

  # 等待端口就绪（最多 ~15 秒）
  for _ in $(seq 1 30); do
    if curl -s -o /dev/null "http://localhost:$PORT/"; then
      echo "启动成功 ✅"
      print_urls
      return 0
    fi
    sleep 0.5
  done
  echo "启动超时 ❌，请查看日志： $LOG_FILE"
  tail -n 20 "$LOG_FILE" || true
  return 1
}

stop() {
  if ! is_running; then
    echo "当前没有在运行。"
    rm -f "$PID_FILE"
    return 0
  fi
  local pid
  pid="$(cat "$PID_FILE")"
  echo "正在停止 (PID $pid)..."
  kill "$pid" 2>/dev/null || true
  for _ in $(seq 1 20); do
    kill -0 "$pid" 2>/dev/null || break
    sleep 0.25
  done
  kill -0 "$pid" 2>/dev/null && kill -9 "$pid" 2>/dev/null || true
  rm -f "$PID_FILE"
  echo "已停止 ✅"
}

status() {
  if is_running; then
    echo "运行中 🟢 (PID $(cat "$PID_FILE"), 端口 $PORT)"
    print_urls
  else
    echo "未运行 🔴"
  fi
}

print_urls() {
  local ip
  ip="$(hostname -I 2>/dev/null | awk '{print $1}')"
  echo "  本机: http://localhost:$PORT/"
  [[ -n "$ip" ]] && echo "  局域网: http://$ip:$PORT/"
}

case "${1:-}" in
  start)   start ;;
  stop)    stop ;;
  restart) stop; start ;;
  status)  status ;;
  logs)    tail -f "$LOG_FILE" ;;
  *) echo "用法: $0 {start|stop|restart|status|logs}"; exit 1 ;;
esac
