"""Exercise Python's actual static HTTP handler without opening a socket.

Useful in sandboxes that deny bind(); this does not claim a live browser pass.
Run from the repository root: python3 tests/http-smoke.py
"""
from html.parser import HTMLParser
from http.server import SimpleHTTPRequestHandler
from io import BytesIO
from pathlib import Path
import re


ROOT = Path(__file__).resolve().parents[1]


class Request:
    def __init__(self, path):
        self.input = BytesIO(f"GET {path} HTTP/1.0\r\nHost: localhost\r\n\r\n".encode())
        self.output = BytesIO()

    def makefile(self, *args):
        return self.input

    def sendall(self, data):
        self.output.write(data)


class Handler(SimpleHTTPRequestHandler):
    def log_message(self, *args):
        pass


def get(path, mime):
    request = Request(path)
    Handler(request, ("127.0.0.1", 0), None, directory=str(ROOT))
    header, body = request.output.getvalue().split(b"\r\n\r\n", 1)
    assert b"200 OK" in header, (path, header)
    assert mime.encode() in header, (path, header)
    assert body, path
    return body.decode("utf-8")


class Page(HTMLParser):
    ids = set()
    modules = []
    styles = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if "id" in attrs:
            assert attrs["id"] not in self.ids, f"duplicate id: {attrs['id']}"
            self.ids.add(attrs["id"])
        if tag == "script" and attrs.get("type") == "module":
            self.modules.append(attrs["src"])
        if tag == "link" and attrs.get("rel") == "stylesheet":
            self.styles.append(attrs["href"])


page = Page()
page.feed(get("/", "text/html"))
assert page.modules == ["js/game.js"]
for style in page.styles:
    get("/" + style, "text/css")

seen = set()


def check_module(path):
    path = path.resolve()
    relative = path.relative_to(ROOT).as_posix()
    if relative in seen:
        return
    seen.add(relative)
    source = get("/" + relative, "javascript")
    for dependency in re.findall(r"from\s+['\"]([^'\"]+)['\"]", source):
        assert dependency.startswith("./"), f"runtime dependency: {dependency}"
        check_module(path.parent / dependency)


for module in page.modules:
    check_module(ROOT / module)
assert "js/story.js" in seen
assert {"story-dialog", "journal-comms", "btn-story-skip", "ending-subtitle"} <= page.ids
print(f"PASS Python static HTTP handler: index, {len(page.styles)} stylesheet, {len(seen)} ES modules; correct MIME and unique DOM IDs")
