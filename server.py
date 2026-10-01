# Server pengembangan kecil (opsional) — mencegah cache browser saat mengedit kode.
# Jalankan:  python server.py   lalu buka http://localhost:8613
from http.server import SimpleHTTPRequestHandler, HTTPServer

class Handler(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()

if __name__ == "__main__":
    HTTPServer(("127.0.0.1", 8613), Handler).serve_forever()
