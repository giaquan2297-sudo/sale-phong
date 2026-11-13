#!/usr/bin/env bash
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
BIN="$DIR/bin/cloudflared"

if [ ! -f "$BIN" ]; then
    echo "Không tìm thấy file binary cloudflared tại $BIN."
    exit 1
fi

echo "=========================================================="
echo "🚀 Đang kết nối Cloudflare Quick Tunnel (Miễn phí 100%)..."
echo "🌐 Link HTTPS công khai sẽ hiển thị ngay bên dưới:"
echo "=========================================================="
exec "$BIN" tunnel --url http://127.0.0.1:3000
