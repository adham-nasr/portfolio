#!/usr/bin/env node
/* ==========================================================================
   Local admin server for the portfolio.

   Run it with:  node app.js
   Then open:
     http://localhost:5173/        — the site itself (live preview)
     http://localhost:5173/admin   — the CRUD dashboard for your projects

   This server is a LOCAL EDITING TOOL ONLY. It reads/writes
   data/projects.json and regenerates js/data.js as a plain static file.
   When you deploy, upload index.html, css/, and js/ — nothing here needs
   to run in production, and app.js / data/ / admin/ / lib/ can stay out
   of the deploy if you want a purely static bundle.

   No npm install required — everything uses Node's built-in modules.
   ========================================================================== */

const http = require("http");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const {
  ROOT,
  uniqueId,
  readProjects,
  writeProjects,
} = require("./lib/generate");

const PORT = process.env.PORT || 5173;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

/* ---------- small helpers ---------- */
function sendJson(res, status, data) {
  const body = JSON.stringify(data, null, 2);
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let chunks = "";
    req.on("data", (c) => {
      chunks += c;
      if (chunks.length > 5_000_000) req.destroy(); // 5MB safety cap
    });
    req.on("end", () => {
      if (!chunks) return resolve({});
      try {
        resolve(JSON.parse(chunks));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
  });
}

/* Only allow serving files that live inside the project root. */
function safeJoin(root, urlPath) {
  const decoded = decodeURIComponent(urlPath.split("?")[0]);
  const full = path.normalize(path.join(root, decoded));
  if (!full.startsWith(root)) return null;
  return full;
}

function serveStatic(req, res, pathname) {
  let filePath = safeJoin(ROOT, pathname);
  if (!filePath) {
    res.writeHead(400);
    return res.end("Bad request");
  }
  if (pathname === "/") filePath = path.join(ROOT, "index.html");
  if (pathname === "/admin" || pathname === "/admin/")
    filePath = path.join(ROOT, "admin", "index.html");

  fs.stat(filePath, (err, stat) => {
    if (err || !stat.isFile()) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    fs.createReadStream(filePath).pipe(res);
  });
}

/* ---------- validation ---------- */
function cleanProject(input, existingId) {
  const p = { ...input };
  if (!p.title || !String(p.title).trim()) {
    throw new Error("Title is required.");
  }
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => String(x).trim() !== "") : []);
  const links = {};
  if (p.links && typeof p.links === "object") {
    ["live", "store", "source"].forEach((k) => {
      if (p.links[k] && String(p.links[k]).trim()) links[k] = String(p.links[k]).trim();
    });
  }
  return {
    id: existingId, // set by caller
    title: String(p.title).trim(),
    tagline: String(p.tagline || "").trim(),
    category: String(p.category || "").trim(),
    categories: arr(p.categories),
    period: String(p.period || "").trim(),
    role: String(p.role || "").trim(),
    org: String(p.org || "").trim(),
    platforms: String(p.platforms || "").trim(),
    cardTools: arr(p.cardTools),
    image: String(p.image || "").trim(),
    coverImage: String(p.coverImage || "").trim(),
    summary: arr(p.summary),
    decisions: arr(p.decisions),
    architecture: String(p.architecture || "").trim(),
    screenshots: Array.isArray(p.screenshots)
      ? p.screenshots
          .filter((s) => s && String(s.label || "").trim())
          .map((s) => ({ label: String(s.label).trim(), src: String(s.src || "").trim() }))
      : [],
    stack: Array.isArray(p.stack)
      ? p.stack
          .filter((s) => s && String(s.label || "").trim())
          .map((s) => ({
            label: String(s.label).trim(),
            items: arr(s.items),
          }))
      : [],
    links,
  };
}

/* ---------- API ---------- */
async function handleApi(req, res, pathname) {
  const parts = pathname.split("/").filter(Boolean); // ["api","projects", maybe id, maybe "move"]

  // GET /api/projects
  if (req.method === "GET" && parts.length === 2) {
    return sendJson(res, 200, readProjects());
  }

  // POST /api/projects  — create
  if (req.method === "POST" && parts.length === 2) {
    try {
      const body = await readBody(req);
      const projects = readProjects();
      const id = uniqueId(body.title, projects);
      const project = cleanProject(body, id);
      projects.push(project);
      writeProjects(projects);
      return sendJson(res, 201, project);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // PUT /api/projects/:id/move  — reorder
  if (req.method === "PUT" && parts.length === 4 && parts[3] === "move") {
    const id = decodeURIComponent(parts[2]);
    try {
      const body = await readBody(req);
      const projects = readProjects();
      const i = projects.findIndex((p) => p.id === id);
      if (i === -1) return sendJson(res, 404, { error: "Not found" });
      const j = body.direction === "up" ? i - 1 : i + 1;
      if (j < 0 || j >= projects.length) return sendJson(res, 200, projects);
      [projects[i], projects[j]] = [projects[j], projects[i]];
      writeProjects(projects);
      return sendJson(res, 200, projects);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // PUT /api/projects/:id  — update
  if (req.method === "PUT" && parts.length === 3) {
    const id = decodeURIComponent(parts[2]);
    try {
      const body = await readBody(req);
      const projects = readProjects();
      const i = projects.findIndex((p) => p.id === id);
      if (i === -1) return sendJson(res, 404, { error: "Not found" });
      // Allow renaming the slug only if the title changed and the new slug is free.
      const newId =
        body.title && body.title.trim() !== projects[i].title
          ? uniqueId(body.title, projects, id)
          : id;
      const project = cleanProject(body, newId);
      projects[i] = project;
      writeProjects(projects);
      return sendJson(res, 200, project);
    } catch (err) {
      return sendJson(res, 400, { error: err.message });
    }
  }

  // DELETE /api/projects/:id
  if (req.method === "DELETE" && parts.length === 3) {
    const id = decodeURIComponent(parts[2]);
    const projects = readProjects();
    const next = projects.filter((p) => p.id !== id);
    if (next.length === projects.length) return sendJson(res, 404, { error: "Not found" });
    writeProjects(next);
    return sendJson(res, 200, { ok: true });
  }

  return sendJson(res, 404, { error: "Unknown API route" });
}

/* ---------- server ---------- */
const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname;

  if (pathname.startsWith("/api/")) {
    handleApi(req, res, pathname).catch((err) => {
      sendJson(res, 500, { error: err.message });
    });
    return;
  }

  if (req.method !== "GET") {
    res.writeHead(405);
    return res.end("Method not allowed");
  }

  serveStatic(req, res, pathname);
});

server.listen(PORT, () => {
  console.log(`\n  Portfolio admin running:`);
  console.log(`  → Site:  http://localhost:${PORT}/`);
  console.log(`  → Admin: http://localhost:${PORT}/admin\n`);
});
