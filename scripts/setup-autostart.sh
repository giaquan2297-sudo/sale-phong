#!/usr/bin/env bash
set -e

DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
mkdir -p "$DIR/logs"
mkdir -p "$HOME/Library/LaunchAgents"

PLIST_FILE="$HOME/Library/LaunchAgents/com.saletro.server.plist"
NODE_BIN="$(which node 2>/dev/null || echo '/usr/local/bin/node')"
UID_NUM="$(id -u)"

cat <<EOF > "$PLIST_FILE"
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.saletro.server</string>
    <key>ProgramArguments</key>
    <array>
        <string>$NODE_BIN</string>
        <string>$DIR/server/index.js</string>
    </array>
    <key>EnvironmentVariables</key>
    <dict>
        <key>NODE_ENV</key>
        <string>production</string>
        <key>PORT</key>
        <string>3000</string>
        <key>HOST</key>
        <string>0.0.0.0</string>
    </dict>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>$DIR/logs/server.log</string>
    <key>StandardErrorPath</key>
    <string>$DIR/logs/server.error.log</string>
    <key>WorkingDirectory</key>
    <string>$DIR</string>
</dict>
</plist>
EOF

# Try modern launchctl bootout/bootstrap, fallback to load/unload
launchctl bootout "gui/$UID_NUM/com.saletro.server" 2>/dev/null || launchctl unload "$PLIST_FILE" 2>/dev/null || true
launchctl bootstrap "gui/$UID_NUM" "$PLIST_FILE" 2>/dev/null || launchctl load -w "$PLIST_FILE" 2>/dev/null || true

echo "=========================================================="
echo "✅ Đã cài đặt tự động khởi động Sale Trọ cùng macOS!"
echo "📍 Mỗi khi mở máy Mac, hệ thống sẽ tự động chạy sẵn ngầm."
echo "🌐 Máy tính:  http://localhost:3000"
echo "📱 Điện thoại: Mở Cài đặt trong web để xem IP Wi-Fi và mã QR"
echo "=========================================================="
