"""Preview the static website (site/) locally, the way Cloudflare Pages serves it.

    python scripts/serve_site.py                 # http://127.0.0.1:8080
    python scripts/serve_site.py --port 9000
    python scripts/serve_site.py --app-url http://localhost:3000

Plain `python -m http.server` can't do two things Cloudflare does, so this adds
them:

* /app redirects to the app. In production that target is the line in
  site/_redirects; locally it is the app started with `docker compose up` (or
  `npm run dev` in frontend/), at http://localhost:3000 by default.
* The headers in site/_headers (Content-Security-Policy etc.) are sent, so a
  page that breaks under them breaks here first, not after publishing.

Standard library only; for local use, not for serving the site publicly.
"""

from __future__ import annotations

import argparse
import functools
import http.server
from pathlib import Path

SITE_DIR = Path(__file__).resolve().parent.parent / "site"


def read_global_headers(path: Path) -> list[tuple[str, str]]:
    """Headers listed under the `/*` rule of a Cloudflare _headers file."""
    headers: list[tuple[str, str]] = []
    in_global = False
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.rstrip()
        if not line or line.lstrip().startswith("#"):
            continue
        if not line[0].isspace():  # a URL pattern starts a new rule
            in_global = line.strip() == "/*"
        elif in_global and ":" in line:
            name, value = line.strip().split(":", 1)
            headers.append((name.strip(), value.strip()))
    return headers


class SiteHandler(http.server.SimpleHTTPRequestHandler):
    app_url = "http://localhost:3000/"
    extra_headers: list[tuple[str, str]] = []

    def _redirect_app(self) -> bool:
        if self.path.split("?", 1)[0].rstrip("/") != "/app":
            return False
        self.send_response(302)
        self.send_header("Location", self.app_url)
        self.end_headers()
        return True

    def do_GET(self) -> None:
        if not self._redirect_app():
            super().do_GET()

    def do_HEAD(self) -> None:
        if not self._redirect_app():
            super().do_HEAD()

    def end_headers(self) -> None:
        for name, value in self.extra_headers:
            # Browsers ignore HSTS over plain http, and localhost must stay http
            if name.lower() != "strict-transport-security":
                self.send_header(name, value)
        # Always fetch fresh files while editing
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    parser.add_argument("--port", type=int, default=8080)
    parser.add_argument("--app-url", default="http://localhost:3000/",
                        help="where /app (\"Find your market\") should go")
    args = parser.parse_args()

    SiteHandler.app_url = args.app_url
    SiteHandler.extra_headers = read_global_headers(SITE_DIR / "_headers")
    handler = functools.partial(SiteHandler, directory=str(SITE_DIR))

    with http.server.ThreadingHTTPServer(("127.0.0.1", args.port), handler) as server:
        print(f"Website: http://127.0.0.1:{args.port}/")
        print(f"/app  -> {args.app_url}  (start the app with `docker compose up`)")
        print("Ctrl+C to stop.")
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main()
