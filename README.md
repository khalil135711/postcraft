# Postcraft

A self-hosted, Canva-style editor for company social media posts. Python (Flask) backend, Fabric.js canvas frontend, Docker-ready.

## Run

    docker compose up --build

Open http://localhost:8000. Designs (SQLite) and uploaded images persist in the `postcraft-data` Docker volume.

## Features
- Sizes for Instagram (post, portrait, story), LinkedIn, X and Facebook
- Text, shapes, image upload, background colours, layer order, duplicate, undo/redo
- Save and reopen designs; export full-resolution PNG
- Shortcuts: Ctrl+Z / Ctrl+Y undo/redo, Ctrl+D duplicate, Delete removes

## Layout
    app/main.py          Flask API (designs, uploads)
    app/static/          index.html, style.css, app.js (editor)

## Ideas for next steps
Login (Flask-Login), per-company brand kits, templates, scheduling via the platform APIs, vendoring Fabric.js and fonts for offline use.
