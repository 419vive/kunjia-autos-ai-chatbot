#!/usr/bin/env node
/**
 * Pixel Agents Standalone — works with both local CLI and remote Desktop sessions
 *
 * Mode 1 (local): Watches ~/.claude/projects/ for JSONL transcripts
 * Mode 2 (remote): Connects to Railway SSE relay for Desktop sessions
 *
 * Usage:
 *   node server.mjs                          # local mode
 *   node server.mjs --remote https://your-app.up.railway.app  # remote mode
 */
import { createServer } from "http";
import { readFileSync, existsSync, statSync, readdirSync } from "fs";
import { join, extname, basename, dirname } from "path";
import { homedir } from "os";
import { WebSocketServer } from "ws";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const PORT = 3333;

// Resolve pixel-agents directory: try sibling first, then home directory fallback
function resolvePixelAgentsDir() {
  const candidates = [
    join(__dirname, "..", "pixel-agents"),           // sibling: ~/kunjia-repo/pixel-agents/
    join(homedir(), "pixel-agents"),                  // home fallback: ~/pixel-agents/
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  console.error("[ERROR] Could not find pixel-agents directory. Tried:");
  candidates.forEach(c => console.error("  -", c));
  console.error("Set PIXEL_AGENTS_DIR env var to override, or clone pixel-agents to one of the above paths.");
  return candidates[0]; // return first candidate so paths resolve (will 404 gracefully)
}

const PIXEL_AGENTS_DIR = process.env.PIXEL_AGENTS_DIR || resolvePixelAgentsDir();
const WEBVIEW_DIR = join(PIXEL_AGENTS_DIR, "dist", "webview");
const PUBLIC_DIR = join(PIXEL_AGENTS_DIR, "webview-ui", "public");
const MIME = {".html":"text/html",".js":"text/javascript",".css":"text/css",".json":"application/json",".png":"image/png",".jpg":"image/jpeg",".gif":"image/gif",".svg":"image/svg+xml"};

// Parse args
const remoteIdx = process.argv.indexOf("--remote");
const REMOTE_URL = remoteIdx !== -1 ? process.argv[remoteIdx + 1] : null;

// ============ HTTP SERVER ============
const httpServer = createServer((req, res) => {
  let p = req.url.split("?")[0];
  if (p === "/") p = "/index.html";
  const f1 = join(WEBVIEW_DIR, p), f2 = join(PUBLIC_DIR, p);
  const f = existsSync(f1) ? f1 : existsSync(f2) ? f2 : null;
  if (!f) {
    const idx = join(WEBVIEW_DIR, "index.html");
    if (existsSync(idx)) { res.writeHead(200,{"Content-Type":"text/html"}); res.end(readFileSync(idx)); return; }
    res.writeHead(404).end("Not Found"); return;
  }
  res.writeHead(200,{"Content-Type": MIME[extname(f)]||"application/octet-stream"});
  res.end(readFileSync(f));
});

// ============ WEBSOCKET ============
const wss = new WebSocketServer({ server: httpServer });
const clients = new Set();

wss.on("connection", ws => {
  clients.add(ws);
  ws.send(JSON.stringify({type:"existingAgents",agents:[1],agentMeta:{},folderNames:{1:"claude-desktop"}}));
  ws.send(JSON.stringify({type:"agentCreated",id:1,folderName:"claude-desktop"}));
  ws.send(JSON.stringify({type:"settingsLoaded",soundEnabled:false,externalAssetDirectories:[]}));
  ws.on("close", () => clients.delete(ws));
});

function broadcast(msg) {
  const d = typeof msg === "string" ? msg : JSON.stringify(msg);
  for (const ws of clients) if (ws.readyState === 1) ws.send(d);
}

// ============ REMOTE MODE: SSE from Railway ============
function connectSSE(url) {
  const sseUrl = url.replace(/\/$/, "") + "/api/pixel-events/stream";
  console.log("[Remote] Connecting to", sseUrl);

  fetch(sseUrl).then(res => {
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    function read() {
      reader.read().then(({ done, value }) => {
        if (done) { console.log("[Remote] SSE closed, reconnecting..."); setTimeout(() => connectSSE(url), 3000); return; }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try {
              const event = JSON.parse(line.slice(6));
              broadcast(event);
            } catch {}
          }
        }
        read();
      }).catch(() => { console.log("[Remote] SSE error, reconnecting..."); setTimeout(() => connectSSE(url), 3000); });
    }
    read();
  }).catch(() => { console.log("[Remote] Can't reach server, retrying..."); setTimeout(() => connectSSE(url), 5000); });
}

// ============ LOCAL MODE: Watch JSONL ============
const activeAgents = new Map();
let nextId = 1;

function fmt(name, input) {
  if (!name) return "Working...";
  if (name === "Read") return "Reading " + (input?.file_path?.split("/").pop() || "file");
  if (name === "Write") return "Writing " + (input?.file_path?.split("/").pop() || "file");
  if (name === "Edit") return "Editing " + (input?.file_path?.split("/").pop() || "file");
  if (name === "Bash") return "Running: " + (input?.command || "").substring(0, 40);
  if (name === "Grep") return "Searching: " + (input?.pattern || "").substring(0, 30);
  if (name === "Agent" || name === "Task") return "Subtask: " + (input?.description || "").substring(0, 40);
  return name;
}

function proc(id, agent, rec) {
  if (rec.type === "assistant") {
    const tools = (rec.message?.content || []).filter(b => b.type === "tool_use");
    if (tools.length > 0) tools.forEach(t => {
      const tid = t.id || "t-" + Date.now();
      agent.tools.set(tid, t.name);
      broadcast({ type: "agentToolStart", id, toolId: tid, status: fmt(t.name, t.input) });
      broadcast({ type: "agentStatus", id, status: "active" });
    }); else broadcast({ type: "agentStatus", id, status: "active" });
  }
  if (rec.type === "user") {
    const results = Array.isArray(rec.message?.content) ? rec.message.content.filter(b => b.type === "tool_result") : [];
    if (results.length > 0) results.forEach(r => { if (r.tool_use_id) { agent.tools.delete(r.tool_use_id); setTimeout(() => broadcast({ type: "agentToolDone", id, toolId: r.tool_use_id }), 300); } });
    else { agent.tools.clear(); broadcast({ type: "agentToolsClear", id }); }
  }
  if (rec.type === "system" && rec.subtype === "turn_duration") { agent.tools.clear(); broadcast({ type: "agentStatus", id, status: "waiting" }); broadcast({ type: "agentToolsClear", id }); }
}

function poll() {
  const dir = join(homedir(), ".claude", "projects");
  if (!existsSync(dir)) return;
  try {
    for (const h of readdirSync(dir)) {
      const pd = join(dir, h); if (!statSync(pd).isDirectory()) continue;
      for (const f of readdirSync(pd)) {
        if (!f.endsWith(".jsonl")) continue;
        const fp = join(pd, f), st = statSync(fp);
        if (Date.now() - st.mtimeMs > 5 * 60 * 1000) continue;
        if ([...activeAgents.values()].find(a => a.file === fp)) continue;
        const id = nextId++;
        activeAgents.set(id, { file: fp, offset: Math.max(0, st.size - 4096), buf: "", tools: new Map() });
        broadcast({ type: "agentCreated", id, folderName: h });
        console.log("[Agent " + id + "] " + basename(f));
      }
    }
  } catch {}
  for (const [id, a] of activeAgents) {
    if (!existsSync(a.file)) { activeAgents.delete(id); broadcast({ type: "agentClosed", id }); continue; }
    const st = statSync(a.file); if (st.size <= a.offset) continue;
    const buf = readFileSync(a.file).subarray(a.offset, Math.min(a.offset + 65536, st.size));
    a.offset = Math.min(a.offset + 65536, st.size);
    const lines = (a.buf + buf.toString("utf-8")).split("\n"); a.buf = lines.pop() || "";
    for (const l of lines) { if (!l.trim()) continue; try { proc(id, a, JSON.parse(l)); } catch {} }
  }
}

// ============ START ============
httpServer.listen(PORT, () => {
  console.log("\n🎮 Pixel Agents → http://localhost:" + PORT);
  if (REMOTE_URL) {
    console.log("   Mode: REMOTE (Desktop) → " + REMOTE_URL);
    connectSSE(REMOTE_URL);
  } else {
    console.log("   Mode: LOCAL (CLI) → watching ~/.claude/projects/");
    setInterval(poll, 500);
  }
  console.log("");
});
