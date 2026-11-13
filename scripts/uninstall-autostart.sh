#!/usr/bin/env bash
PLIST_FILE="$HOME/Library/LaunchAgents/com.saletro.server.plist"
UID_NUM="$(id -u)"

if [ -f "$PLIST_FILE" ]; then
    launchctl bootout "gui/$UID_NUM/com.saletro.server" 2>/dev/null || launchctl unload "$PLIST_FILE" 2>/dev/null || true
    rm -f "$PLIST_FILE"
    echo "✅ Đã gỡ bỏ tự động khởi động Sale Trọ thành công!"
else
    echo "Hệ thống chưa được cài đặt tự động khởi động."
fi
