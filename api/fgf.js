// FGF JSONBin Read Proxy — Vercel Serverless Function (manifest-aware, read-only)
//
// Usage:
//   GET /api/fgf?manifest=<BIN_ID>
//   GET /api/fgf?manifest=<BIN_ID>&raw=1
//   GET /api/fgf?manifest=<BIN_ID>&tab=<TAB_NAME>&seq=<0-based>
//   GET /api/fgf?manifest=<BIN_ID>&bin=<PAGE_BIN_ID>
//
// Notes:
// - Reads with X-Master-Key from env: JSONBIN_MASTER_KEY
// - Only allows pages listed in the given manifest (allowlist)

const JSONBIN_BASE = "https://api.jsonbin.io/v3";

export default async function handler(req, res) {
  try {
    if (req.method !== "GET" && req.method !== "OPTIONS") {
      return send(res, { ok: false, error: "method not allowed" }, 405);
    }

    // CORS
    if (req.method === "OPTIONS") {
      res.setHeader("access-control-allow-origin", "*");
      res.setHeader("access-control-allow-methods", "GET,OPTIONS");
      res.setHeader("access-control-allow-headers", "content-type");
      return res.status(204).end();
    }

    const { manifest, raw, tab, seq, bin } = req.query || {};
    if (!manifest) return send(res, bad("missing manifest"));

    // 1) fetch manifest
    const rawResp = await api(`/b/${encodeURIComponent(manifest)}/latest`);
    const record = rawResp.record || rawResp;

    if (raw === "1" || raw === "true") return send(res, { ok: true, type: "raw", record });

    // 2) normalize manifest
    const m = coerceManifest(record);
    if (!m || !m.tabs) return send(res, bad("bad manifest structure"));

    // 3) manifest-only path
    if (!bin && !tab) return send(res, { ok: true, type: "manifest", manifest: m });

    // 4) build allowlist of page bins
    const allowed = new Set([manifest]);
    Object.values(m.tabs).forEach(t =>
      (t.pages || []).forEach(pg => allowed.add(pg.bin_id))
    );

    // 5) resolve page bin id
    let pageId = bin || null;
    if (!pageId && tab != null) {
      const t = m.tabs[tab];
      const n = Number(seq);
      if (!t || !Array.isArray(t.pages) || Number.isNaN(n) || !t.pages[n]) {
        return send(res, bad("tab/seq not found"));
      }
      pageId = t.pages[n].bin_id;
    }
    if (!pageId) return send(res, bad("missing bin or tab+seq"));
    if (!allowed.has(pageId)) return send(res, bad("bin not allowed by manifest"));

    // 6) fetch page
    const page = await api(`/b/${encodeURIComponent(pageId)}/latest`);
    return send(res, { ok: true, type: "page", page: page.record || page });

  } catch (e) {
    return send(res, bad(String(e?.message || e)));
  }
}

// ----- helpers -----
async function api(path) {
  const r = await fetch(`${JSONBIN_BASE}${path}`, {
    headers: { "X-Master-Key": process.env.JSONBIN_MASTER_KEY }
  });
  if (!r.ok) throw new Error(`JSONBin ${r.status} ${await r.text()}`);
  return r.json();
}

function coerceManifest(raw) {
  if (!raw || typeof raw !== "object") return null;
  const tabs = raw.tabs || (raw.manifest && raw.manifest.tabs) || raw.Tabs;
  if (!tabs || typeof tabs !== "object") return null;
  const normTabs = {};
  for (const key of Object.keys(tabs)) {
    const t = tabs[key] || {};
    const arr = Array.isArray(t.pages) ? t.pages : [];
    const pages = arr
      .map((p, i) => (typeof p === "string" ? { bin_id: p, seq: i } : p))
      .filter(p => p && p.bin_id);
    normTabs[key] = {
      title: t.title || key,
      total_rows: t.total_rows ?? null,
      total_pages: t.total_pages ?? pages.length,
      pages
    };
  }
  return { type: raw.type || "sheet_manifest", updated: raw.updated || null, tabs: normTabs };
}

function send(res, obj, status = 200) {
  res.status(status);
  res.setHeader("content-type", "application/json");
  res.setHeader("access-control-allow-origin", "*");
  res.setHeader("cache-control", "no-store");
  return res.send(JSON.stringify(obj || {}));
}

function bad(msg) { return { ok: false, error: msg }; }