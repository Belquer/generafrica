#!/bin/bash
cd "$(dirname "$0")"
echo ""
echo "  🥁 Percussion Jam"
echo "  =================="
echo ""
echo "  Server: http://localhost:8000"
echo "  Press Ctrl+C to stop"
echo ""

# Clear any stored API key on fresh start (optional - comment out to keep stored keys)
# This ensures the API key prompt always shows

# Small delay then open browser
sleep 1
open "http://localhost:8000"

python3 -m http.server 8000
