#!/bin/sh
rm -f /tmp/.X99-lock
Xvfb :99 -screen 0 1280x800x24 -nolisten tcp &
sleep 1
x11vnc -display :99 -forever -shared -rfbport 5900 -localhost -nopw -quiet &
websockify --web /usr/share/novnc 6080 localhost:5900 &
exec node server.js
