import os, sqlite3, uuid, json, time
from flask import Flask, jsonify, request, send_from_directory, abort

DATA_DIR = os.environ.get("DATA_DIR", "./data")
UPLOADS = os.path.join(DATA_DIR, "uploads")
DB = os.path.join(DATA_DIR, "designs.db")
ALLOWED = {"png", "jpg", "jpeg", "webp", "gif", "svg"}
os.makedirs(UPLOADS, exist_ok=True)

app = Flask(__name__, static_folder="static", static_url_path="")
app.config["MAX_CONTENT_LENGTH"] = 15 * 1024 * 1024  # 15 MB uploads


def db():
    con = sqlite3.connect(DB)
    con.row_factory = sqlite3.Row
    con.execute("""CREATE TABLE IF NOT EXISTS designs(
        id TEXT PRIMARY KEY, name TEXT, width INT, height INT,
        data TEXT, updated REAL)""")
    return con


@app.get("/")
def index():
    return app.send_static_file("index.html")


@app.get("/api/designs")
def list_designs():
    with db() as con:
        rows = con.execute(
            "SELECT id,name,width,height,updated FROM designs ORDER BY updated DESC"
        ).fetchall()
    return jsonify([dict(r) for r in rows])


@app.post("/api/designs")
def save_design():
    p = request.get_json(force=True)
    did = p.get("id") or uuid.uuid4().hex[:10]
    with db() as con:
        con.execute(
            "INSERT OR REPLACE INTO designs VALUES(?,?,?,?,?,?)",
            (did, (p.get("name") or "Untitled post")[:120], int(p["width"]),
             int(p["height"]), json.dumps(p["data"]), time.time()),
        )
    return jsonify({"id": did})


@app.get("/api/designs/<did>")
def get_design(did):
    with db() as con:
        r = con.execute("SELECT * FROM designs WHERE id=?", (did,)).fetchone()
    if not r:
        abort(404)
    d = dict(r)
    d["data"] = json.loads(d["data"])
    return jsonify(d)


@app.delete("/api/designs/<did>")
def delete_design(did):
    with db() as con:
        con.execute("DELETE FROM designs WHERE id=?", (did,))
    return jsonify({"ok": True})


@app.post("/api/upload")
def upload():
    f = request.files.get("file")
    ext = (f.filename.rsplit(".", 1)[-1].lower() if f and "." in f.filename else "")
    if ext not in ALLOWED:
        return jsonify({"error": "Use PNG, JPG, WEBP, GIF or SVG."}), 400
    name = f"{uuid.uuid4().hex}.{ext}"
    f.save(os.path.join(UPLOADS, name))
    return jsonify({"url": f"/uploads/{name}"})


@app.get("/uploads/<path:name>")
def uploads(name):
    return send_from_directory(UPLOADS, name)
