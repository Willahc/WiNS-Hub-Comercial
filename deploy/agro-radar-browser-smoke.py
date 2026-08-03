#!/usr/bin/env python3
"""Smoke real da SPA candidata contra o canário, antes do apply."""

from __future__ import annotations

import argparse
import http.server
import json
import subprocess
import threading
import urllib.error
import urllib.request
from pathlib import Path
from urllib.parse import urlsplit

from playwright.sync_api import sync_playwright


TABS = {
    "sinais": "SIGNAL",
    "candidatas": "CANDIDATE",
    "validacao": None,
    "validadas": None,
    "regras": None,
}


def container_context(container: str):
    data = json.loads(subprocess.check_output(["docker", "inspect", container], text=True))[0]
    networks = data["NetworkSettings"]["Networks"]
    address = next(value["IPAddress"] for value in networks.values() if value.get("IPAddress"))
    environment = dict(item.split("=", 1) for item in data["Config"]["Env"] if "=" in item)
    return address, environment["WINS_INTERNAL_SECRET"]


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--container", required=True)
    parser.add_argument("--dist", required=True)
    parser.add_argument("--output", required=True)
    args = parser.parse_args()
    dist = Path(args.dist).resolve()
    address, secret = container_context(args.container)

    class Handler(http.server.BaseHTTPRequestHandler):
        def do_GET(self):
            parsed = urlsplit(self.path)
            if parsed.path.startswith("/api/v1/"):
                headers = {
                    "X-WiNS-Authenticated-User": "agro-release-validator",
                    "X-WiNS-Display-Name": "Agro Release Validator",
                    "X-WiNS-Roles": "agro",
                    "X-WiNS-Auth-Mode": "maintenance",
                    "X-WiNS-Internal-Secret": secret,
                }
                request = urllib.request.Request(f"http://{address}:8000{self.path}", headers=headers)
                try:
                    response = urllib.request.urlopen(request, timeout=45)
                except urllib.error.HTTPError as error:
                    response = error
                body = response.read()
                self.send_response(response.status)
                self.send_header("Content-Type", response.headers.get("Content-Type", "application/json"))
                self.end_headers()
                self.wfile.write(body)
                return
            target = dist / (parsed.path.lstrip("/") or "index.html")
            if not target.is_file():
                target = dist / "index.html"
            self.send_response(200)
            self.send_header("Content-Type", self.guess_type(str(target)))
            self.end_headers()
            self.wfile.write(target.read_bytes())

        def guess_type(self, path):
            if path.endswith(".js"): return "text/javascript"
            if path.endswith(".css"): return "text/css"
            if path.endswith(".svg"): return "image/svg+xml"
            return "text/html"

        def log_message(self, *_):
            return

    server = http.server.ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    origin = f"http://127.0.0.1:{server.server_port}"
    rows = []
    try:
        with sync_playwright() as playwright:
            browser = playwright.chromium.launch(headless=True, args=["--no-sandbox"])
            for tab, expected in TABS.items():
                context = browser.new_context(viewport={"width": 1440, "height": 900})
                page = context.new_page()
                console_errors = []
                list_responses = []
                bad_responses = []
                page.on("console", lambda message, errors=console_errors: errors.append(message.text) if message.type == "error" else None)
                def capture(response, lists=list_responses, bad=bad_responses):
                    parsed = urlsplit(response.url)
                    if parsed.path == "/api/v1/agro/oportunidades":
                        lists.append({"url": response.url, "http": response.status})
                    if response.status >= 400:
                        bad.append({"url": response.url, "http": response.status})
                page.on("response", capture)
                page.goto(f"{origin}/agro/oportunidades?tab={tab}", wait_until="networkidle", timeout=60000)
                body = page.locator("body").inner_text()
                sent = None
                if list_responses:
                    query = urlsplit(list_responses[-1]["url"]).query
                    sent = next((part.split("=", 1)[1] for part in query.split("&") if part.startswith("stage=")), None)
                passed = (
                    (expected is None and not list_responses)
                    or (expected is not None and len(list_responses) == 1 and sent == expected and list_responses[0]["http"] == 200)
                )
                if tab == "candidatas":
                    passed = passed and all(text in body for text in (
                        "Candidatas: diagnóstico fail-closed",
                        "PROPERTY_QUERY_NOT_PERFORMANT",
                        "Nenhum registro foi fabricado",
                    )) and "Não foi possível carregar o diagnóstico de candidatas." not in body
                passed = passed and not console_errors and not bad_responses
                rows.append({
                    "tab": tab, "expected_stage": expected, "sent_stage": sent,
                    "http": list_responses[0]["http"] if list_responses else None,
                    "list_call_count": len(list_responses), "console_errors": console_errors,
                    "bad_responses": bad_responses, "result": "PASS" if passed else "FAIL",
                })
                context.close()
            browser.close()
    finally:
        server.shutdown()
        server.server_close()

    Path(args.output).write_text(json.dumps({"tabs": rows}, ensure_ascii=False, indent=2) + "\n")
    for row in rows:
        print(f'{row["tab"]} | {row["expected_stage"] or "sem chamada"} | {row["sent_stage"] or "sem chamada"} | {row["http"] or "-"} | {row["result"]}')
    return 1 if any(row["result"] == "FAIL" for row in rows) else 0


if __name__ == "__main__":
    raise SystemExit(main())
