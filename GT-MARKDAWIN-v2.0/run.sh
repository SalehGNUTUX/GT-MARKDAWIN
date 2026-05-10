#!/usr/bin/env bash
# تشغيل GT-MarkDaWin محلياً بدون اتصال بالإنترنت
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIST_DIR="$SCRIPT_DIR/dist"
PORT=3000

# Build if dist doesn't exist
if [ ! -d "$DIST_DIR" ]; then
  echo ":: Building GT-MarkDaWin..."
  cd "$SCRIPT_DIR"
  npm install
  npm run build
fi

echo ":: Starting GT-MarkDaWin on http://localhost:$PORT"

# Try different servers
if command -v python3 &>/dev/null; then
  echo ":: Using Python3 server"
  cd "$DIST_DIR"
  python3 -c "
import http.server, webbrowser, threading, os
os.chdir('$DIST_DIR')
class Handler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
    def end_headers(self):
        self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

server = http.server.HTTPServer(('localhost', $PORT), Handler)
threading.Timer(0.5, lambda: webbrowser.open('http://localhost:$PORT')).start()
print(':: Open: http://localhost:$PORT  (Ctrl+C to stop)')
try:
    server.serve_forever()
except KeyboardInterrupt:
    print('\n:: Server stopped.')
"
elif command -v node &>/dev/null && command -v npx &>/dev/null; then
  echo ":: Using npx serve"
  cd "$SCRIPT_DIR"
  npx vite preview --port $PORT --open
else
  echo "ERROR: Need python3 or node to run local server"
  exit 1
fi
