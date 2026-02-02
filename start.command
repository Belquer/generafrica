#!/bin/bash
cd "$(dirname "$0")"
echo ""
echo "  🌍 GenerAfrica"
echo "  ==============="
echo ""
echo "  Server: http://localhost:8000"
echo "  Press Ctrl+C to stop"
echo ""

# Small delay then open browser
sleep 1
open "http://localhost:8000"

# Serve with no-cache headers to avoid stale files
python3 -c "
import http.server, functools

class NoCacheHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')
        self.send_header('Pragma', 'no-cache')
        self.send_header('Expires', '0')
        super().end_headers()

http.server.HTTPServer(('', 8000), NoCacheHandler).serve_forever()
"
