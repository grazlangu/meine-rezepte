/* Meine Rezepte – alles bleibt im Speicher dieses Geräts. */
"use strict";

/* =====================================================================
   Speicher (IndexedDB für Rezepte, localStorage für Kleinigkeiten)
   ===================================================================== */
let dbPromise;
function db() {
  return (dbPromise ||= new Promise((resolve, reject) => {
    const req = indexedDB.open("rezepte", 2);
    req.onupgradeneeded = () => {
      const d = req.result;
      if (!d.objectStoreNames.contains("recipes")) d.createObjectStore("recipes", { keyPath: "id" });
      if (!d.objectStoreNames.contains("media")) d.createObjectStore("media", { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}
async function tx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction("recipes", mode);
    const req = fn(t.objectStore("recipes"));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}
/* Videos liegen getrennt, damit Liste und Sicherung schnell bleiben */
async function mediaTx(mode, fn) {
  const d = await db();
  return new Promise((resolve, reject) => {
    const t = d.transaction("media", mode);
    const req = fn(t.objectStore("media"));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
  });
}
const media = {
  get: (id) => mediaTx("readonly", (s) => s.get(id)),
  put: (m) => mediaTx("readwrite", (s) => s.put(m)),
  del: (id) => mediaTx("readwrite", (s) => s.delete(id)),
};
const store = {
  all: () => tx("readonly", (s) => s.getAll()),
  get: (id) => tx("readonly", (s) => s.get(id)),
  put: (r) => tx("readwrite", (s) => s.put(r)),
  del: (id) => tx("readwrite", (s) => s.delete(id)),
};
navigator.storage?.persist?.().catch(() => {});

const local = {
  get(key, fallback) { try { const v = localStorage.getItem(key); return v == null ? fallback : JSON.parse(v); } catch { return fallback; } },
  set(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

/* =====================================================================
   Hilfen
   ===================================================================== */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];
const view = $("#view");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const cssUrl = (u) => `url('${String(u).replace(/'/g, "%27")}')`;
const CAT_EMOJI = {
  "Frühstück": "🥐", "Vorspeise": "🥟", "Suppe": "🍲", "Salat": "🥗", "Hauptspeise": "🍽️", "Beilage": "🥔",
  "Fleisch": "🥩", "Fisch": "🐟", "Nudeln": "🍝", "Vegetarisch": "🥦", "Nachspeise": "🍨", "Mehlspeise": "🥞",
  "Kuchen & Torten": "🎂", "Kekse": "🍪", "Brot & Gebäck": "🥖", "Getränke": "🍹", "Schnell": "⚡",
};
const DEFAULT_CATS = Object.keys(CAT_EMOJI);
const catLabel = (c) => (CAT_EMOJI[c] ? CAT_EMOJI[c] + " " : "") + c;
const catOrder = (a, b) => {
  const ia = DEFAULT_CATS.indexOf(a), ib = DEFAULT_CATS.indexOf(b);
  return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib) || a.localeCompare(b, "de");
};

const P = {
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v15H6.5A2.5 2.5 0 0 0 4 20.5zM4 20.5A2.5 2.5 0 0 0 6.5 23H20v-5"/><path d="M8 7h8M8 11h6"/>',
  heart: '<path d="M12 20s-7.5-4.6-9.3-9.3C1.5 7.4 3.6 4 7 4c2 0 3.4 1.1 5 3 1.6-1.9 3-3 5-3 3.4 0 5.5 3.4 4.3 6.7C19.5 15.4 12 20 12 20z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  cart: '<path d="M3 4h2l2.4 11.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L21 8H6.2"/><circle cx="10" cy="20.5" r="1.3"/><circle cx="17" cy="20.5" r="1.3"/>',
  more: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  people: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6"/><path d="M16 4.8a3.2 3.2 0 0 1 0 6.4M18 14.4c1.8.8 3 2.6 3 5.6"/>',
  euro: '<path d="M17 6.5A7 7 0 1 0 17 17.5"/><path d="M4 10h9M4 14h9"/>',
  pot: '<path d="M4 11h16v2a8 8 0 0 1-16 0zM2.5 11h19"/><path d="M9 7.5c-.8-1.2.8-2 0-3.5M12 7.5c-.8-1.2.8-2 0-3.5M15 7.5c-.8-1.2.8-2 0-3.5"/>',
  paste: '<rect x="6" y="4" width="12" height="17" rx="2"/><path d="M9 4V3h6v1M9 10h6M9 14h4"/>',
  camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  share: '<path d="M12 3v12M7 8l5-5 5 5"/><path d="M5 13v7h14v-7"/>',
  ext: '<path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v6H4V6h6"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  minus: '<path d="M5 12h14"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  dice: '<rect x="3.5" y="3.5" width="17" height="17" rx="4"/><circle cx="8.5" cy="8.5" r="1.2"/><circle cx="15.5" cy="15.5" r="1.2"/><circle cx="15.5" cy="8.5" r="1.2"/><circle cx="8.5" cy="15.5" r="1.2"/><circle cx="12" cy="12" r="1.2"/>',
  list: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
  download: '<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 20h14"/>',
  upload: '<path d="M12 15V3M7 8l5-5 5 5"/><path d="M5 20h14"/>',
  phone: '<rect x="6.5" y="2.5" width="11" height="19" rx="2.5"/><path d="M11 18.5h2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>',
  fridge: '<rect x="5" y="2.5" width="14" height="19" rx="2.5"/><path d="M5 10h14M8.5 6v1.5M8.5 13v3"/>',
  text: '<path d="M5 5h14M5 10h14M5 15h9M5 20h6"/>',
  video: '<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3z"/>',
  timer: '<circle cx="12" cy="13" r="8"/><path d="M12 9v4l2.5 2M9.5 2.5h5"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 9h10M7 12h10M7 15h6"/>',
  sparkle: '<path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z"/>',
};
function icon(name, size = 22, extra = "") {
  return `<svg class="ic ${extra}" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${P[name] || ""}</svg>`;
}
const heartFilled = (size = 16) => icon("heart", size).replace('fill="none"', 'fill="currentColor"');

function toast(msg, kind = "", ms = 2800) {
  const t = $("#toast");
  t.innerHTML = `<span class="${kind}">${esc(msg)}</span>`;
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (t.innerHTML = ""), ms);
}
function fmtMinutes(min) {
  if (!min) return "";
  const h = Math.floor(min / 60), m = min % 60;
  return h ? `${h} Std.${m ? " " + m + " Min." : ""}` : `${m} Min.`;
}
function fmtNumber(n) {
  if (!isFinite(n)) return "";
  const frac = { 0.25: "¼", 0.5: "½", 0.75: "¾", 0.33: "⅓", 0.67: "⅔" };
  const whole = Math.floor(n + 1e-9), rest = Math.round((n - whole) * 100) / 100;
  if (rest && frac[rest] && n < 10) return (whole ? whole + " " : "") + frac[rest];
  const digits = n >= 100 ? 0 : n >= 10 ? 1 : 2;
  return (Math.round(n * 10 ** digits) / 10 ** digits).toLocaleString("de-AT");
}
const fmtEuro = (n) => n.toLocaleString("de-AT", { style: "currency", currency: "EUR" });
function parseNum(s) {
  if (s == null || s === "") return null;
  const n = parseFloat(String(s).replace(/[^\d,.-]/g, "").replace(",", "."));
  return isFinite(n) ? n : null;
}
const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/* =====================================================================
   Portionen umrechnen
   ===================================================================== */
const UNI = { "½": 0.5, "¼": 0.25, "¾": 0.75, "⅓": 1 / 3, "⅔": 2 / 3, "⅛": 0.125 };
const QTY = "(\\d+\\s+\\d+\\/\\d+|\\d+\\/\\d+|\\d+(?:[.,]\\d+)?(?:\\s*[½¼¾⅓⅔⅛])?|[½¼¾⅓⅔⅛])";
const QTY_RE = new RegExp("^(\\s*)" + QTY + "(?:(\\s*[-–]\\s*)" + QTY + ")?");
const UNIT_RE = /^(g|kg|ml|l|cl|dl|EL|TL|Msp\.?|Pck\.?|Pkg\.?|Prisen?|Stk\.?|Stück|Becher|Dosen?|Bund|Zehen?|Tassen?|Scheiben?|Würfel|Blatt|Blätter|Glas|Gläser|Handvoll|Schuss|cm)(?=\s|$)/i;
function qtyValue(q) {
  q = q.trim();
  let m;
  if ((m = q.match(/^(\d+)\s+(\d+)\/(\d+)$/))) return +m[1] + m[2] / m[3];
  if ((m = q.match(/^(\d+)\/(\d+)$/))) return m[1] / m[2];
  if ((m = q.match(/^(\d+(?:[.,]\d+)?)\s*([½¼¾⅓⅔⅛])$/))) return parseNum(m[1]) + UNI[m[2]];
  if (UNI[q]) return UNI[q];
  return parseNum(q);
}
/* Gibt [Menge mit Einheit, Rest] zurück – Menge schon umgerechnet */
function splitLine(line, factor) {
  const m = line.match(QTY_RE);
  if (!m) return ["", line];
  let q = fmtNumber(qtyValue(m[2]) * factor);
  if (m[4]) q += "–" + fmtNumber(qtyValue(m[4]) * factor);
  const rest = line.slice(m[0].length).trim();
  const unit = rest.match(UNIT_RE);
  if (unit) return [q + " " + unit[0], rest.slice(unit[0].length).trim()];
  return [q, rest];
}
const scaleLine = (line, f) => { const [q, r] = splitLine(line, f); return (q ? q + " " : "") + r; };

/* =====================================================================
   Rezept aus einem Link holen
   ===================================================================== */
async function fetchWithTimeout(url, ms = 15000) {
  const ctl = new AbortController();
  const timer = setTimeout(() => ctl.abort(), ms);
  try { return await fetch(url, { signal: ctl.signal }); } finally { clearTimeout(timer); }
}
/* Bekannte Rezeptseiten: Netlify holt sie über eine Weiterleitung (siehe Datei _redirects) */
const SITES = {"ck": "www.chefkoch.de", "ckimg": "img.chefkoch-cdn.de", "ik": "www.ichkoche.at", "ikimg": "images.ichkoche.at", "ikas": "assets.ichkoche.at", "gk": "www.gutekueche.at", "gkde": "www.gutekueche.de", "gusto": "www.gusto.at", "servus": "www.servus.com", "billa": "www.billa.at", "oetkat": "www.oetker.at", "oetk": "www.oetker.de", "lecker": "www.lecker.de", "kochbar": "www.kochbar.de", "eut": "www.essen-und-trinken.de", "eats": "eatsmarter.de", "spring": "www.springlane.de", "backen": "www.einfachbacken.de", "ek": "www.einfachkochen.de", "dkr": "www.daskochrezept.de", "ks": "www.kitchenstories.com", "hfat": "www.hellofresh.at", "hfde": "www.hellofresh.de", "emmi": "emmikochteinfach.de", "sally": "sallys-blog.de", "kg": "www.kuechengoetter.de", "lidl": "www.lidl-kochen.de", "fooby": "fooby.ch", "betty": "www.bettybossi.ch", "zjw": "www.zuckerjagdwurst.com", "bbc": "www.bbcgoodfood.com", "allr": "www.allrecipes.com"};
function viaRedirect(target) {
  try {
    const u = new URL(target);
    const host = u.hostname.toLowerCase();
    const key = Object.keys(SITES).find((k) => SITES[k] === host || SITES[k] === "www." + host || "www." + SITES[k] === host);
    return key ? `/quelle/${key}${u.pathname}${u.search}` : null;
  } catch { return null; }
}
/* Der Hol-Helfer läuft bei Netlify. Die App selbst kann woanders liegen (z. B. GitHub). */
const HELPER = /netlify\.app$|^localhost$|^127\./.test(location.hostname) ? "" : "https://kochbuch-daheim.netlify.app";
function proxyUrls(target) {
  const e = encodeURIComponent(target);
  const r = viaRedirect(target);
  return [
    HELPER + "/.netlify/functions/rezept?url=" + e, // eigener Helfer (Netlify)
    r && !HELPER ? r : null,                        // Weiterleitung für bekannte Seiten
    "https://api.allorigins.win/raw?url=" + e,      // Ersatz-Dienste, falls der eigene fehlt
    "https://api.codetabs.com/v1/proxy?quest=" + e,
    "https://corsproxy.io/?url=" + e,
  ];
}
async function fetchVia(target, asBlob = false) {
  let lastErr;
  for (const u of proxyUrls(target).filter(Boolean)) {
    try {
      const res = await fetchWithTimeout(u);
      if (!res.ok) { lastErr = new Error("HTTP " + res.status); continue; }
      if (asBlob) {
        const b = await res.blob();
        if (b.type.startsWith("image/") && b.size > 500) return b;
        continue;
      }
      const text = await res.text();
      if (text.length > 500 && /<html|<head|<body|<script/i.test(text)) return text;
    } catch (e) { lastErr = e; }
  }
  throw lastErr || new Error("Nicht erreichbar");
}

function decode(s) {
  if (s == null) return "";
  const t = document.createElement("textarea");
  t.innerHTML = String(s).replace(/<br\s*\/?>/gi, "\n").replace(/<[^>]+>/g, " ");
  return t.value.replace(/[ \t ]+/g, " ").replace(/ *\n */g, "\n").trim();
}
function isoMinutes(d) {
  if (!d || typeof d !== "string") return null;
  const m = d.match(/P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/i);
  if (!m) return null;
  return (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0) || null;
}
let ID_INDEX = {};
function indexIds(node) {
  if (!node || typeof node !== "object") return;
  if (Array.isArray(node)) return node.forEach(indexIds);
  if (node["@id"] && Object.keys(node).length > 1) ID_INDEX[node["@id"]] = node;
  Object.values(node).forEach(indexIds);
}
function findRecipe(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const n of node) { const r = findRecipe(n); if (r) return r; } return null; }
  if ([].concat(node["@type"] || []).some((t) => /recipe$/i.test(String(t)))) return node;
  for (const k of ["@graph", "mainEntity", "mainEntityOfPage", "itemListElement", "item"]) {
    const r = findRecipe(node[k]); if (r) return r;
  }
  return null;
}
function imageUrl(img, base) {
  if (!img) return "";
  if (Array.isArray(img)) img = img[0];
  if (typeof img === "object") {
    const ref = ID_INDEX[img["@id"]];
    img = img.url || img.contentUrl || (ref && (ref.url || ref.contentUrl)) || "";
  }
  try { return img ? new URL(img, base).href : ""; } catch { return ""; }
}
function instructionsList(ins) {
  const out = [];
  const walk = (x) => {
    if (!x) return;
    if (typeof x === "string") { decode(x).split(/\n+/).forEach((l) => l.trim() && out.push(l.trim())); return; }
    if (Array.isArray(x)) { x.forEach(walk); return; }
    if (x.itemListElement) {
      if (x.name && /section/i.test(String(x["@type"]))) out.push("## " + decode(x.name));
      walk(x.itemListElement); return;
    }
    if (x.text) walk(x.text); else if (x.name) walk(x.name);
  };
  walk(ins);
  // Eine einzelne Überschrift ganz oben (z. B. "Zubereitung") bringt nichts
  if (out.filter((l) => l.startsWith("## ")).length === 1 && out[0]?.startsWith("## ")) out.shift();
  return out;
}
function yieldNumber(y) {
  for (const v of [].concat(y || [])) { const m = String(v).match(/\d+/); if (m) return +m[0]; }
  return null;
}
function parseRecipeHtml(html, url) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  const meta = (p) => doc.querySelector(`meta[property="${p}"], meta[name="${p}"]`)?.content || "";
  let r = null;
  for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const json = JSON.parse(s.textContent.replace(/^\s*<!--|-->\s*$/g, "").replace(/[\u0000-\u001f]+/g, " "));
      ID_INDEX = {};
      indexIds(json);
      r = findRecipe(json);
      if (r) break;
    } catch {}
  }
  const out = { url, title: "", image: "", ingredients: [], steps: [], servings: null, time: null, categories: [], description: "" };
  if (r) {
    out.title = decode(r.name || r.headline);
    out.image = imageUrl(r.image || r.thumbnailUrl, url);
    out.ingredients = [].concat(r.recipeIngredient || r.ingredients || []).map(decode).filter(Boolean);
    out.steps = instructionsList(r.recipeInstructions);
    out.servings = yieldNumber(r.recipeYield);
    out.time = isoMinutes(r.totalTime) || ((isoMinutes(r.prepTime) || 0) + (isoMinutes(r.cookTime) || 0)) || null;
    out.categories = [...[].concat(r.recipeCategory || []), ...String(r.keywords || "").split(",")].map(decode).filter(Boolean);
    out.description = decode(r.description).slice(0, 400);
  }
  // Ergänzen aus Mikrodaten (z. B. Ichkoche), falls etwas fehlt
  const md = (prop) => $$(`[itemprop="${prop}"]`, doc).map((e) => decode(e.getAttribute("content") ?? e.textContent)).filter(Boolean);
  if (!out.ingredients.length) out.ingredients = md("recipeIngredient").length ? md("recipeIngredient") : md("ingredients");
  if (!out.steps.length) {
    const box = doc.querySelector('[itemprop="recipeInstructions"]');
    const lis = box ? $$("li, p", box).map((e) => decode(e.textContent)).filter(Boolean) : [];
    out.steps = lis.length ? lis : md("recipeInstructions").flatMap((t) => t.split(/\n+/));
  }
  out.servings ||= yieldNumber(md("recipeYield"));
  out.time ||= isoMinutes(md("totalTime")[0]) || null;
  if (!out.categories.length) out.categories = [...md("recipeCategory"), ...md("keywords").flatMap((k) => k.split(","))].map((c) => c.trim()).filter(Boolean);
  if (!r) out.title = decode(doc.querySelector("h1")?.textContent || "");
  out.title ||= decode(meta("og:title") || doc.title);
  out.image ||= imageUrl(meta("og:image"), url);
  out.description ||= decode(meta("og:description")).slice(0, 400);
  out.title = out.title.replace(/\s+[-–|]\s+.*$/, "").replace(/\s+Rezept$/i, "");
  if (/chefkoch\./.test(url)) out.title = out.title.replace(/\s+von\s+\S+$/, "");
  out.categories = guessCategories(out);
  return out;
}
const isSocial = (url) => /(^|\.)(instagram\.com|tiktok\.com|facebook\.com|fb\.watch|pinterest\.[a-z.]+|pin\.it|youtube\.com|youtu\.be)$/i.test((() => { try { return new URL(url).hostname; } catch { return ""; } })());

/* Freien Text (z. B. aus Instagram) in Zutaten und Schritte sortieren */
function parseRecipeText(raw) {
  const clean = (l) => l
    .replace(/#[\p{L}\d_]+/gu, "")
    .replace(/^[\s\p{Extended_Pictographic}\u{FE0F}\u{200D}•·▪◦‣⁃*\-–—>✓✔]+/u, "")
    .replace(/[\p{Extended_Pictographic}\u{FE0F}\u{200D}]+/gu, " ")
    .replace(/\s+/g, " ").trim();
  const lines = raw.split(/\r?\n/).map(clean).filter((l) => l && !/^(@|link in bio|werbung|anzeige)/i.test(l));
  const ING_HEAD = /^(zutaten|ingredients|du brauchst|was du brauchst|einkaufsliste)\b[^a-z]*$/i;
  const ING_HEAD_INLINE = /^(zutaten|ingredients)\b.*:/i;
  const STEP_HEAD = /^(zubereitung|anleitung|so geht'?s|so wird'?s gemacht|schritte|instructions|method|und so geht'?s)\b/i;
  const looksIng = (l) => l.length < 70 && (QTY_RE.test(l) && /^\s*[\d½¼¾⅓⅔⅛]/.test(l) || /^(etwas|eine? prise|prise|salz|pfeffer|öl zum|butter zum|n\. ?b\.)/i.test(l));
  let mode = "", title = "", servings = null;
  const ingredients = [], steps = [];
  for (const l of lines) {
    const srv = l.match(/(?:für|for)\s+(\d+)\s*(?:portion|person|stück|pers)/i) || l.match(/(\d+)\s*(?:portionen|personen)/i);
    if (srv && !servings) servings = +srv[1];
    if (ING_HEAD.test(l) || (ING_HEAD_INLINE.test(l) && l.length < 40)) { mode = "ing"; continue; }
    if (STEP_HEAD.test(l) && l.length < 50) { mode = "step"; continue; }
    if (!title && !mode && !looksIng(l) && l.length < 80 && !ingredients.length) { title = l.replace(/[:!.]+$/, ""); continue; }
    const step = l.replace(/^(schritt\s*)?\d{1,2}\s*[.):]\s*/i, "");
    if (mode === "ing" && (looksIng(l) || l.length < 45)) ingredients.push(l);
    else if (mode === "step") steps.push(step);
    else if (looksIng(l)) ingredients.push(l);
    else if (ingredients.length || steps.length || l.length > 40) steps.push(step);
  }
  return { title, servings, ingredients, steps };
}

/* Passende Kategorien aus den Angaben der Seite und dem Namen erraten */
const CAT_HINTS = {
  "Frühstück": /frühstück|müsli|porridge|pancake|omelett/,
  "Vorspeise": /vorspeise/,
  "Suppe": /suppe|eintopf|brühe/,
  "Hauptspeise": /hauptspeise|hauptgericht|hauptgang/,
  "Beilage": /beilage/,
  "Salat": /salat/,
  "Nachspeise": /nachspeise|dessert|nachtisch|mousse|pudding|tiramisu|parfait|creme|eis\b/,
  "Mehlspeise": /mehlspeise|schmarrn|palatschink|pfannkuchen|strudel|buchtel|krapfen|nockerl|germknödel|marillenknödel|topfenknödel|zwetschkenknödel|dalken|scheiterhaufen|waffel|gugelhupf|reindling/,
  "Fleisch": /fleisch|schnitzel|braten|gulasch|faschiert|hack|huhn|hähnchen|hendl|rind|schwein|speck|wurst|steak/,
  "Fisch": /fisch|lachs|forelle|thunfisch|garnele|shrimps|zander|saibling|kabeljau/,
  "Nudeln": /nudel|pasta|spaghetti|lasagne|penne|tagliatelle|spätzle|fleckerl/,
  "Kuchen & Torten": /kuchen|torte|strudel|gugelhupf|muffin/,
  "Kekse": /kekse|plätzchen|kipferl|cookie|weihnachtsbäckerei/,
  "Brot & Gebäck": /brot|semmel|weckerl|kleingebäck|zopf|pizza/,
  "Getränke": /getränk|cocktail|smoothie|punsch/,
  "Vegetarisch": /vegetarisch|vegan/,
  "Schnell": /schnell/,
};
function guessCategories(d) {
  const page = d.categories.join(" | ").toLowerCase();
  const title = d.title.toLowerCase();
  const found = Object.entries(CAT_HINTS)
    .filter(([name, re]) => re.test(page) || (!["Schnell", "Vegetarisch", "Hauptspeise"].includes(name) && re.test(title)))
    .map(([name]) => name);
  if (d.time && d.time <= 20 && !found.includes("Schnell")) found.push("Schnell");
  return found;
}
async function compressImage(blob, max = 1100) {
  const bmp = await createImageBitmap(blob);
  const scale = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas");
  c.width = Math.round(bmp.width * scale);
  c.height = Math.round(bmp.height * scale);
  c.getContext("2d").drawImage(bmp, 0, 0, c.width, c.height);
  return c.toDataURL("image/jpeg", 0.82);
}

/* =====================================================================
   Einkaufsliste (Daten)
   ===================================================================== */
const shop = {
  items: () => local.get("einkauf", []),
  save: (items) => { local.set("einkauf", items); drawTabbar(); },
  open: () => shop.items().filter((i) => !i.done).length,
};

/* =====================================================================
   Rahmen: Kopfzeile, Reiterleiste, Navigation
   ===================================================================== */
const TABS = [
  ["#/", "book", "Rezepte"],
  ["#/daheim", "fridge", "Daheim"],
  ["#/neu", "plus", "Neu"],
  ["#/einkauf", "cart", "Einkauf"],
  ["#/mehr", "more", "Mehr"],
];
function currentTab() {
  const h = location.hash || "#/";
  if (h === "#/" || h === "#") return "#/";
  return TABS.find(([href]) => href !== "#/" && h.startsWith(href))?.[0] || "";
}
function drawTabbar() {
  const cur = currentTab(), n = shop.open();
  const wide = matchMedia("(min-width: 960px)").matches;
  $("#tabbar").innerHTML = TABS.map(([href, ic, label]) => href === "#/neu"
    ? `<a href="${href}" class="plus ${cur === href ? "on" : ""}" aria-label="Neues Rezept"><span class="bubble">${icon(ic, 24)}</span>${wide ? "<span>Neues Rezept</span>" : ""}</a>`
    : `<a href="${href}" class="${cur === href ? "on" : ""}">${icon(ic, 23)}<span>${label}</span>${href === "#/einkauf" && n ? `<i class="nb">${n}</i>` : ""}</a>`).join("");
}
function setTop({ title = "", back = false, actions = "" } = {}) {
  document.title = title ? `${title} · Rezepte` : "Meine Rezepte";
  $("#topbar").innerHTML = back
    ? `<button class="icon-btn" id="topBack" aria-label="Zurück">${icon("back", 24)}</button>
       <div class="top-title">${esc(title)}</div>
       <div class="top-actions">${actions}</div>`
    : `<a class="brand" href="#/"><img src="icon-192.png" alt=""><b>Meine Rezepte</b></a>
       <div class="top-actions">${actions}</div>`;
  $("#topBack")?.addEventListener("click", goBack);
}
let navDepth = 0;
let pendingPrefill = null;
function goBack() { if (navDepth > 0) history.back(); else go("#/", true); }
function go(hash, replace = false) {
  if (replace) { history.replaceState(null, "", hash); route(); }
  else location.hash = hash;
}
window.addEventListener("hashchange", () => { navDepth++; route(); });
window.addEventListener("popstate", () => { navDepth = Math.max(0, navDepth - 2); });
matchMedia("(min-width: 960px)").addEventListener?.("change", drawTabbar);

async function route() {
  const [, page = "", rawId] = (location.hash || "#/").split("/");
  const id = rawId && decodeURIComponent(rawId);
  releaseWakeLock();
  $(".cook")?.remove();
  window.scrollTo(0, 0);
  drawTabbar();
  if (!page) return renderHome();
  if (page === "favoriten") return renderFavorites();
  if (page === "daheim") return renderDaheim();
  if (page === "rezept") return renderDetail(id);
  if (page === "kochen") return renderCook(id);
  if (page === "neu") { const pre = pendingPrefill; pendingPrefill = null; return renderForm(null, pre); }
  if (page === "bearbeiten") return renderForm(id);
  if (page === "einkauf") return renderShop();
  if (page === "mehr") return renderMore();
  go("#/", true);
}

/* =====================================================================
   Rezept-Karten
   ===================================================================== */
function cardHtml(r) {
  return `<a class="rc" href="#/rezept/${encodeURIComponent(r.id)}">
    <div class="ph" ${r.image ? `style="background-image:${esc(cssUrl(r.image))}"` : ""}>${r.image ? "" : icon("pot", 40)}</div>
    ${r.fav ? `<span class="heart">${heartFilled(15)}</span>` : ""}
    <div class="tx">
      <h3>${esc(r.title)}</h3>
      <div class="meta">
        ${r.time ? `<span>${icon("clock", 13)}${esc(fmtMinutes(r.time))}</span>` : ""}
        ${r.servings ? `<span>${icon("people", 13)}${r.servings}</span>` : ""}
        ${!r.time && !r.servings && (r.categories || [])[0] ? `<span>${esc(r.categories[0])}</span>` : ""}
      </div>
    </div>
  </a>`;
}
const byTitle = (a, b) => a.title.localeCompare(b.title, "de");

/* =====================================================================
   Startseite
   ===================================================================== */
const state = { q: "", cat: "" };
function greeting() {
  const h = new Date().getHours();
  return h < 11 ? "Guten Morgen" : h < 17 ? "Mahlzeit" : "Guten Abend";
}
async function renderHome() {
  setTop();
  const all = (await store.all()).sort(byTitle);
  if (!all.length) {
    view.innerHTML = `
      <div class="page">
        <div class="hello"><div class="sub">${greeting()}</div><h1>Willkommen in deinem Kochbuch</h1></div>
        <div class="welcome">
          <div class="art">${icon("book", 40)}</div>
          <div class="stack" style="gap:6px">
            <h2>Noch keine Rezepte</h2>
            <p class="muted">Sammle deine Lieblingsrezepte aus dem Internet – an einem Ort und auch ohne Internet griffbereit.</p>
          </div>
          <div class="how">
            <div>Auf einer Rezeptseite den Link kopieren</div>
            <div><span>Hier auf <b>Neu</b> tippen und einfügen</span></div>
            <div><span><b>Rezept holen</b> drücken – fertig!</span></div>
          </div>
          <a class="btn big" href="#/neu">${icon("plus", 20)} Erstes Rezept hinzufügen</a>
          <a class="link-btn" href="#/daheim">${icon("fridge", 18)} Oder: Was kann ich mit meinen Zutaten kochen?</a>
        </div>
      </div>`;
    return;
  }
  const counts = {};
  all.forEach((r) => (r.categories || []).forEach((c) => (counts[c] = (counts[c] || 0) + 1)));
  const cats = Object.keys(counts).sort(catOrder);
  if (state.cat && !cats.includes(state.cat)) state.cat = "";
  const favs = all.filter((r) => r.fav);

  view.innerHTML = `
    <div class="page">
      <div class="hello"><div class="sub">${greeting()}</div><h1>Was kochen wir heute?</h1></div>
      <div class="search">
        ${icon("search", 20)}
        <input type="search" id="q" placeholder="Rezept oder Zutat suchen …" value="${esc(state.q)}" enterkeyhint="search" autocomplete="off" aria-label="Suchen">
        <button class="icon-btn clear" id="clearQ" aria-label="Suche löschen" ${state.q ? "" : "hidden"}>${icon("x", 18)}</button>
      </div>
      ${cats.length ? `<div class="seg" id="seg">
        <button class="${state.cat ? "" : "on"}" data-cat="">Alle <i class="count">${all.length}</i></button>
        ${cats.map((c) => `<button class="${c === state.cat ? "on" : ""}" data-cat="${esc(c)}">${esc(catLabel(c))} <i class="count">${counts[c]}</i></button>`).join("")}
      </div>` : ""}
      <a class="card daheim-teaser" id="teaser" href="#/daheim">
        <span class="art">${icon("fridge", 26)}</span>
        <span class="grow"><b>Was hab ich daheim?</b><br><span class="small muted">Zutaten eintippen – passende Rezepte finden</span></span>
        ${icon("next", 20)}
      </a>
      <section id="favSec" class="stack" style="gap:10px" ${favs.length ? "" : "hidden"}>
        <div class="section-head"><h2>Favoriten</h2><a class="link-btn" href="#/favoriten">Alle ansehen</a></div>
        <div class="scroller">${favs.map(cardHtml).join("")}</div>
      </section>
      <section class="stack" style="gap:10px">
        <div class="section-head"><h2 id="listTitle">Alle Rezepte</h2>
          <button class="link-btn" id="random">${icon("dice", 18)} Überrasch mich</button></div>
        <div class="grid" id="grid"></div>
      </section>
    </div>`;

  const draw = () => {
    const words = state.q.toLowerCase().split(/\s+/).filter(Boolean);
    const list = all.filter((r) => {
      if (state.cat && !(r.categories || []).includes(state.cat)) return false;
      const hay = [r.title, ...(r.ingredients || []), ...(r.categories || []), r.notes].join(" ").toLowerCase();
      return words.every((w) => hay.includes(w));
    });
    const filtering = state.q || state.cat;
    $("#favSec").hidden = !favs.length || !!filtering;
    $("#teaser").hidden = !!filtering;
    $("#listTitle").textContent = filtering ? plural(list.length, "Treffer", "Treffer") : `Alle Rezepte · ${all.length}`;
    $("#grid").innerHTML = list.length ? list.map(cardHtml).join("")
      : `<div class="empty" style="grid-column:1/-1">${icon("search", 34)}<b>Nichts gefunden</b><span class="small">Versuch es mit einem anderen Wort.</span></div>`;
    $("#clearQ").hidden = !state.q;
  };
  draw();
  $("#q").addEventListener("input", (e) => { state.q = e.target.value; draw(); });
  $("#clearQ").addEventListener("click", () => { state.q = ""; $("#q").value = ""; draw(); $("#q").focus(); });
  $("#seg")?.addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    state.cat = b.dataset.cat;
    $$("#seg button").forEach((x) => x.classList.toggle("on", x === b));
    draw();
  });
  $("#random").addEventListener("click", () => {
    const pool = all.filter((r) => !state.cat || (r.categories || []).includes(state.cat));
    const pick = pool[Math.floor(Math.random() * pool.length)];
    if (pick) go("#/rezept/" + encodeURIComponent(pick.id));
  });
}

async function renderFavorites() {
  setTop();
  const favs = (await store.all()).filter((r) => r.fav).sort(byTitle);
  view.innerHTML = `
    <div class="page">
      <div class="hello"><div class="sub">${plural(favs.length, "Rezept", "Rezepte")}</div><h1>Favoriten</h1></div>
      ${favs.length ? `<div class="grid">${favs.map(cardHtml).join("")}</div>`
        : `<div class="empty">${icon("heart", 40)}<h2>Noch keine Favoriten</h2><p>Tipp bei einem Rezept oben auf das Herz – dann landet es hier.</p></div>`}
    </div>`;
}

/* =====================================================================
   Rezept ansehen
   ===================================================================== */
let wakeLock = null;
async function releaseWakeLock() { try { await wakeLock?.release(); } catch {} wakeLock = null; }
async function keepAwake() { try { wakeLock = await navigator.wakeLock?.request("screen"); } catch {} }
const servingsMemory = {};

async function renderDetail(id) {
  const r = await store.get(id);
  if (!r) return go("#/", true);
  const base = r.servings || null;
  let servings = servingsMemory[id] || base || 1;
  const done = new Set();
  const favHtml = () => `<button class="icon-btn ${r.fav ? "on" : ""}" id="fav" aria-label="${r.fav ? "Aus Favoriten entfernen" : "Zu Favoriten"}">${r.fav ? heartFilled(23) : icon("heart", 23)}</button>`;
  setTop({ title: r.title, back: true, actions: `<span id="favWrap">${favHtml()}</span>` + (navigator.share ? `<button class="icon-btn" id="share" aria-label="Teilen">${icon("share", 22)}</button>` : "") });

  view.innerHTML = `
    <div class="page">
      ${r.image ? `<div class="hero"><img src="${esc(r.image)}" alt=""></div>` : ""}
      <div class="r-title">
        ${(r.categories || []).length ? `<div class="chips">${[...r.categories].sort(catOrder).map((c) => `<span class="pill">${esc(catLabel(c))}</span>`).join("")}</div>` : ""}
        <h1>${esc(r.title)}</h1>
        ${r.description ? `<p class="desc">${esc(r.description)}</p>` : ""}
      </div>
      <div class="facts" id="facts"></div>
      <div id="videoSlot"></div>
      ${(r.steps || []).length ? `<a class="btn big" href="#/kochen/${encodeURIComponent(r.id)}">${icon("play", 18)} Kochmodus starten</a>` : ""}

      ${(r.ingredients || []).length ? `<section class="card">
        <div class="card-head">
          <h2>${icon("list", 20)} Zutaten</h2>
          ${base ? `<div class="stepper">
            <button type="button" id="minus" aria-label="Weniger Portionen">${icon("minus", 16)}</button>
            <output id="srv"></output>
            <button type="button" id="plus" aria-label="Mehr Portionen">${icon("plus", 16)}</button>
          </div>` : ""}
        </div>
        <ul class="ing" id="ing"></ul>
        <button class="btn ghost" id="toShop">${icon("cart", 19)} Auf die Einkaufsliste</button>
      </section>` : ""}

      ${(r.steps || []).length ? `<section class="card">
        <div class="card-head"><h2>${icon("pot", 20)} Zubereitung</h2></div>
        <ol class="steps">${r.steps.map((s) => s.startsWith("## ") ? `<li class="sec">${esc(s.slice(3))}</li>` : `<li>${esc(s)}</li>`).join("")}</ol>
      </section>` : ""}

      ${r.notes ? `<section class="card"><div class="card-head"><h2>${icon("edit", 20)} Meine Notizen</h2></div><div class="notes">${esc(r.notes)}</div></section>` : ""}

      <div class="actions">
        ${r.url ? `<a class="btn ghost" href="${esc(r.url)}" target="_blank" rel="noopener">${icon("ext", 18)} Original</a>` : ""}
        <a class="btn ghost" href="#/bearbeiten/${encodeURIComponent(r.id)}">${icon("edit", 18)} Bearbeiten</a>
        <button class="btn ghost danger" id="del" ${r.url ? 'style="grid-column:1/-1"' : ""}>${icon("trash", 18)} Löschen</button>
      </div>
    </div>`;

  const factor = () => (base ? servings / base : 1);
  const draw = () => {
    const f = factor();
    const facts = [
      ["clock", r.time ? fmtMinutes(r.time) : "–", "Zeit"],
      ["people", base ? String(servings) : "–", servings === 1 ? "Portion" : "Portionen"],
      ["euro", r.cost != null ? fmtEuro(r.cost * f) : "–", r.cost != null && base && servings > 1 ? `${fmtEuro((r.cost * f) / servings)} / Portion` : "Kosten"],
    ];
    $("#facts").innerHTML = facts.map(([ic, v, l]) => `<div class="fact">${icon(ic, 20)}<b>${esc(v)}</b><small>${esc(l)}</small></div>`).join("");
    if ($("#srv")) { $("#srv").textContent = plural(servings, "Portion", "Portionen"); $("#minus").disabled = servings <= 1; }
    if ($("#ing")) {
      $("#ing").innerHTML = r.ingredients.map((line, i) => {
        if (line.startsWith("## ")) return `<li class="head">${esc(line.slice(3))}</li>`;
        const [q, rest] = splitLine(line, f);
        return `<li data-i="${i}" class="${done.has(i) ? "done" : ""}"><span class="box">${icon("check", 14)}</span><span class="t">${q ? `<span class="q">${esc(q)}</span> ` : ""}${esc(rest)}</span></li>`;
      }).join("");
    }
  };
  draw();
  media.get(r.id).then((m) => {
    if (!m || !$("#videoSlot")) return;
    const url = URL.createObjectURL(m.blob);
    $("#videoSlot").innerHTML = `<section class="card video-card"><video controls playsinline preload="metadata" src="${url}"></video></section>`;
  }).catch(() => {});
  const setServings = (n) => { servings = n; servingsMemory[id] = n; draw(); };
  $("#minus")?.addEventListener("click", () => servings > 1 && setServings(servings - 1));
  $("#plus")?.addEventListener("click", () => setServings(servings + 1));
  $("#ing")?.addEventListener("click", (e) => {
    const li = e.target.closest("li[data-i]"); if (!li) return;
    const i = +li.dataset.i;
    done.has(i) ? done.delete(i) : done.add(i);
    li.classList.toggle("done");
  });
  $("#toShop")?.addEventListener("click", () => {
    const f = factor();
    const items = shop.items().filter((x) => x.rid !== r.id);
    r.ingredients.forEach((line, i) => {
      if (!line.startsWith("## ") && !done.has(i)) items.push({ id: uid(), text: scaleLine(line, f), done: false, rid: r.id, from: r.title });
    });
    shop.save(items);
    toast(done.size ? "Auf der Einkaufsliste ✓ (Abgehaktes ausgelassen)" : "Auf der Einkaufsliste ✓", "ok");
  });
  $("#favWrap").addEventListener("click", async () => {
    r.fav = !r.fav;
    await store.put(r);
    $("#favWrap").innerHTML = favHtml();
    toast(r.fav ? "Zu den Favoriten hinzugefügt ♥" : "Aus den Favoriten entfernt");
  });
  $("#share")?.addEventListener("click", () => {
    const f = factor();
    const text = [r.title, "", "Zutaten" + (base ? ` (${plural(servings, "Portion", "Portionen")})` : "") + ":", ...(r.ingredients || []).map((l) => "• " + scaleLine(l, f)), "", "Zubereitung:",
      ...(r.steps || []).filter((s) => !s.startsWith("## ")).map((s, i) => `${i + 1}. ${s}`), r.url ? "\n" + r.url : ""].join("\n");
    navigator.share({ title: r.title, text }).catch(() => {});
  });
  $("#del").addEventListener("click", async () => {
    if (!confirm(`„${r.title}“ wirklich löschen? Das kann man nicht rückgängig machen.`)) return;
    await store.del(r.id);
    media.del(r.id).catch(() => {});
    toast("Rezept gelöscht");
    go("#/", true);
  });
}

/* =====================================================================
   Kochmodus – Schritt für Schritt, Bildschirm bleibt an
   ===================================================================== */
async function renderCook(id) {
  const r = await store.get(id);
  if (!r || !(r.steps || []).length) return go("#/", true);
  await renderDetail(id);
  const steps = r.steps.filter((s) => !s.startsWith("## "));
  const f = r.servings && servingsMemory[id] ? servingsMemory[id] / r.servings : 1;
  const ings = (r.ingredients || []).filter((l) => !l.startsWith("## "));
  let i = 0;
  const el = document.createElement("div");
  el.className = "cook";
  document.body.appendChild(el);
  keepAwake();

  // Zutaten, die im Schritt vorkommen, als Erinnerung zeigen
  const ingFor = (text) => {
    const t = text.toLowerCase();
    return ings.filter((l) => {
      const word = splitLine(l, 1)[1].split(/[ ,(]/)[0].toLowerCase();
      return word.length > 3 && t.includes(word.slice(0, Math.max(4, word.length - 2)));
    }).map((l) => scaleLine(l, f));
  };
  const exit = () => (navDepth > 0 ? history.back() : go("#/rezept/" + encodeURIComponent(id), true));
  const draw = () => {
    const hint = ingFor(steps[i]);
    el.innerHTML = `
      <div class="cook-top">
        <button class="icon-btn" id="cx" aria-label="Kochmodus beenden">${icon("x", 24)}</button>
        <div class="tt">${esc(r.title)}</div>
        ${ings.length ? `<button class="btn ghost sm" id="ci">${icon("list", 17)} Zutaten</button>` : ""}
      </div>
      <div class="cook-bar"><i style="width:${((i + 1) / steps.length) * 100}%"></i></div>
      <div class="cook-body">
        <div class="sub">Schritt ${i + 1} von ${steps.length}</div>
        <p>${esc(steps[i])}</p>
        ${findTimers(steps[i]).length ? `<div class="timer-btns">${findTimers(steps[i]).map((t) => `<button class="btn gold" data-min="${t.min}" data-label="${esc(t.label)}">${icon("timer", 19)} Timer ${esc(t.label)}</button>`).join("")}</div>` : ""}
        ${hint.length ? `<div class="ing-hint">${hint.map((x) => `<span class="pill gold">${esc(x)}</span>`).join("")}</div>` : ""}
      </div>
      <div class="cook-nav">
        <button class="btn ghost" id="cp" ${i === 0 ? "disabled" : ""}>${icon("back", 20)}</button>
        ${i < steps.length - 1
          ? `<button class="btn" id="cn">Weiter ${icon("next", 20)}</button>`
          : `<button class="btn gold" id="cd">${icon("check", 20)} Fertig – Mahlzeit!</button>`}
      </div>`;
    $("#cx", el).onclick = exit;
    $$(".timer-btns button", el).forEach((b) => (b.onclick = () => startTimer(+b.dataset.min, `${r.title.slice(0, 30)} · Schritt ${i + 1}`)));
    $("#cp", el).onclick = () => { if (i > 0) { i--; draw(); } };
    if ($("#cn", el)) $("#cn", el).onclick = () => { i++; draw(); };
    if ($("#cd", el)) $("#cd", el).onclick = () => { toast("Guten Appetit! 🍽", "ok"); exit(); };
    if ($("#ci", el)) $("#ci", el).onclick = () => {
      const sh = document.createElement("div");
      sh.className = "sheet-bg";
      sh.innerHTML = `<div class="sheet"><div class="card-head"><h2>Zutaten</h2><button class="icon-btn" aria-label="Schließen">${icon("x", 22)}</button></div>
        <ul class="ing">${(r.ingredients || []).map((l) => l.startsWith("## ") ? `<li class="head">${esc(l.slice(3))}</li>` : `<li><span class="box">${icon("check", 14)}</span><span class="t">${esc(scaleLine(l, f))}</span></li>`).join("")}</ul></div>`;
      sh.addEventListener("click", (e) => {
        if (e.target === sh || e.target.closest(".icon-btn")) return sh.remove();
        e.target.closest(".ing li:not(.head)")?.classList.toggle("done");
      });
      el.appendChild(sh);
    };
  };
  draw();
  // Wischen nach links/rechts blättert
  let x0 = null;
  el.addEventListener("touchstart", (e) => (x0 = e.touches[0].clientX), { passive: true });
  el.addEventListener("touchend", (e) => {
    if (x0 == null || $(".sheet-bg", el)) return;
    const dx = e.changedTouches[0].clientX - x0; x0 = null;
    if (dx < -60 && i < steps.length - 1) { i++; draw(); }
    if (dx > 60 && i > 0) { i--; draw(); }
  });
}
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && $(".cook")) keepAwake(); });

/* ---------- Küchen-Timer ---------- */
function findTimers(text) {
  const out = [];
  const re = /(\d+(?:[.,]\d+)?)(?:\s*(?:-|–|bis)\s*(\d+(?:[.,]\d+)?))?\s*(Minuten|Minute|Min\.?|Stunden|Stunde|Std\.?|Sekunden|Sek\.?)(?![a-zäöü])/gi;
  let m;
  while ((m = re.exec(text))) {
    const val = parseNum(m[2] || m[1]);
    const unit = m[3].toLowerCase();
    const min = unit.startsWith("st") ? val * 60 : unit.startsWith("se") ? val / 60 : val;
    if (min > 0 && min <= 600 && !out.some((t) => t.min === min)) out.push({ min, label: m[0].replace(/\s+/g, " ") });
  }
  return out.slice(0, 3);
}
const timers = [];
let timerTick = null;
function startTimer(min, label) {
  timers.push({ id: uid(), end: Date.now() + min * 60000, label, total: min });
  if ("Notification" in window && Notification.permission === "default") Notification.requestPermission().catch(() => {});
  toast(`Timer läuft: ${fmtMinutes(Math.round(min)) || Math.round(min * 60) + " Sek."}`, "ok");
  drawTimers();
  timerTick ||= setInterval(drawTimers, 1000);
}
function beep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    [0, 0.35, 0.7, 1.05].forEach((t) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.value = 880; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, ctx.currentTime + t);
      g.gain.exponentialRampToValueAtTime(0.4, ctx.currentTime + t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + t + 0.3);
      o.start(ctx.currentTime + t); o.stop(ctx.currentTime + t + 0.32);
    });
  } catch {}
}
function drawTimers() {
  let bar = $("#timerBar");
  if (!timers.length) { bar?.remove(); clearInterval(timerTick); timerTick = null; return; }
  if (!bar) { bar = document.createElement("div"); bar.id = "timerBar"; document.body.appendChild(bar); }
  const now = Date.now();
  bar.innerHTML = timers.map((t) => {
    const left = Math.max(0, Math.round((t.end - now) / 1000));
    const done = left === 0;
    const mm = String(Math.floor(left / 60)).padStart(2, "0"), ss = String(left % 60).padStart(2, "0");
    return `<div class="tm ${done ? "done" : ""}">${icon("timer", 18)}<b class="num">${done ? "Fertig!" : mm + ":" + ss}</b><span>${esc(t.label)}</span><button class="icon-btn" data-id="${t.id}" aria-label="Timer beenden">${icon("x", 16)}</button></div>`;
  }).join("");
  bar.onclick = (e) => {
    const b = e.target.closest("[data-id]"); if (!b) return;
    timers.splice(timers.findIndex((t) => t.id === b.dataset.id), 1);
    drawTimers();
  };
  timers.forEach((t) => {
    if (t.end <= now && !t.rang) {
      t.rang = true;
      beep();
      navigator.vibrate?.([400, 200, 400, 200, 400]);
      toast("⏰ Timer fertig: " + t.label, "ok", 8000);
      try { if (Notification.permission === "granted") new Notification("Timer fertig", { body: t.label, icon: "icon-192.png" }); } catch {}
    }
  });
}

/* =====================================================================
   Rezept anlegen / bearbeiten
   ===================================================================== */
async function renderForm(id, prefill = null) {
  const existing = id ? await store.get(id) : null;
  if (id && !existing) return go("#/", true);
  const r = existing || { id: uid(), title: "", url: "", image: "", categories: [], servings: null, time: null, cost: null, ingredients: [], steps: [], notes: "", description: "" };
  setTop({ title: existing ? "Rezept bearbeiten" : "Neues Rezept", back: true });
  const allCats = [...new Set([...DEFAULT_CATS, ...(await store.all()).flatMap((x) => x.categories || [])])].sort(catOrder);
  let image = r.image;
  let videoFile = null, videoRemoved = false;
  const canPaste = !!navigator.clipboard?.readText;

  view.innerHTML = `
    <form class="page" id="f" autocomplete="off" style="padding-bottom:70px">
      <section class="card import">
        <div class="stack" style="gap:4px">
          <h2>${icon("sparkle", 20)} Aus dem Internet holen</h2>
          <p class="small muted">Link von Chefkoch, Ichkoche, GuteKüche & Co. einfügen – den Rest macht die App.</p>
        </div>
        <div class="lr">
          <input type="url" id="url" inputmode="url" placeholder="https://…" value="${esc(r.url)}" aria-label="Link zum Rezept">
          ${canPaste ? `<button type="button" class="btn ghost" id="paste" aria-label="Link einfügen">${icon("paste", 19)}</button>` : ""}
        </div>
        <button type="button" class="btn" id="fetch">${icon("download", 19)} Rezept holen</button>
      </section>

      <details class="card paste-box" id="pasteBox">
        <summary><h2>${icon("text", 20)} Text einfügen <span class="pill gold">Instagram, TikTok …</span></h2></summary>
        <p class="small muted">Beitragstext kopieren und hier einfügen – die App sortiert ihn in Zutaten und Schritte. Als Foto einfach einen Screenshot nehmen.</p>
        <textarea id="rawText" rows="6" placeholder="Rezepttext hier einfügen …"></textarea>
        <label class="btn ghost" id="ocrBtn">${icon("scan", 18)} <span id="ocrLbl">Text aus Foto lesen</span><input type="file" id="ocrFile" accept="image/*" hidden></label>
        <button type="button" class="btn ghost" id="parseText">${icon("sparkle", 18)} Text sortieren</button>
      </details>

      <section class="card">
        <label class="photo ${image ? "has" : ""}" id="pv">
          <span class="lbl">${icon("camera", 30)}Foto hinzufügen</span>
          <input type="file" id="file" accept="image/*" hidden>
          <button type="button" class="icon-btn rm" id="rmImg" aria-label="Foto entfernen">${icon("trash", 18)}</button>
        </label>
        <div class="video-pick" id="vp">
          <label class="btn ghost" style="flex:1">${icon("video", 19)} <span id="vpLbl">Video anhängen</span><input type="file" id="vfile" accept="video/*" hidden></label>
          <button type="button" class="icon-btn" id="vrm" aria-label="Video entfernen" hidden>${icon("trash", 18)}</button>
        </div>
        <label>Name des Rezepts<input type="text" id="t" value="${esc(r.title)}" placeholder="z. B. Omas Kaiserschmarrn"></label>
        <div class="field-grid">
          <label>Portionen<input type="number" id="srv" min="1" inputmode="numeric" value="${r.servings ?? ""}" placeholder="4"></label>
          <label>Zeit (Min.)<input type="number" id="time" min="0" inputmode="numeric" value="${r.time ?? ""}" placeholder="30"></label>
          <label>Kosten (€)<input type="text" id="cost" inputmode="decimal" placeholder="8,50" value="${r.cost != null ? String(r.cost).replace(".", ",") : ""}"></label>
        </div>
        <div class="stack" style="gap:8px">
          <span style="font-size:12.5px;font-weight:500;color:var(--ink-2)">Kategorien <span class="hint">– antippen zum Auswählen</span></span>
          <div class="chips" id="cats">
            ${allCats.map((c) => `<button type="button" class="chip ${r.categories.includes(c) ? "on" : ""}" data-cat="${esc(c)}">${esc(catLabel(c))}</button>`).join("")}
            <button type="button" class="chip add" id="newCat">${icon("plus", 15)} Neue</button>
          </div>
        </div>
      </section>

      <section class="card">
        <label>Zutaten <span class="hint">– eine pro Zeile, z. B. „200 g Mehl“</span>
          <textarea id="ing" rows="8" placeholder="250 g Mehl&#10;3 Eier&#10;1 Prise Salz">${esc((r.ingredients || []).join("\n"))}</textarea></label>
        <label>Zubereitung <span class="hint">– ein Schritt pro Zeile</span>
          <textarea id="steps" rows="9" placeholder="Mehl und Eier verrühren …">${esc((r.steps || []).join("\n"))}</textarea></label>
        <label>Meine Notizen <span class="hint">– z. B. „weniger Zucker nehmen“</span>
          <textarea id="notes" rows="3">${esc(r.notes || "")}</textarea></label>
      </section>

      <div class="save-bar"><div class="in">
        <button type="button" class="btn ghost" id="cancel">Abbrechen</button>
        <button type="submit" class="btn grow">${icon("check", 19)} Speichern</button>
      </div></div>
    </form>`;

  const drawImg = () => {
    $("#pv").style.backgroundImage = image ? cssUrl(image) : "";
    $("#pv").classList.toggle("has", !!image);
    $("#rmImg").hidden = !image;
  };
  drawImg();
  $("#file").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try { image = await compressImage(f); drawImg(); } catch { toast("Dieses Foto konnte nicht gelesen werden.", "bad"); }
  });
  if (existing) media.get(r.id).then((m) => { if (m) { $("#vpLbl").textContent = "Video tauschen"; $("#vrm").hidden = false; } }).catch(() => {});
  $("#vfile").addEventListener("change", (e) => {
    const f = e.target.files[0]; if (!f) return;
    if (f.size > 300 * 1024 * 1024) { toast("Das Video ist sehr groß (über 300 MB). Bitte ein kürzeres nehmen.", "bad", 5000); return; }
    videoFile = f; videoRemoved = false;
    $("#vpLbl").textContent = "Video: " + Math.round(f.size / 1024 / 1024) + " MB ✓";
    $("#vrm").hidden = false;
  });
  $("#vrm").addEventListener("click", () => { videoFile = null; videoRemoved = true; $("#vpLbl").textContent = "Video anhängen"; $("#vrm").hidden = true; $("#vfile").value = ""; });
  $("#rmImg").addEventListener("click", (e) => { e.preventDefault(); e.stopPropagation(); image = ""; drawImg(); });
  $("#cats").addEventListener("click", (e) => {
    const b = e.target.closest(".chip"); if (!b) return;
    if (b.id === "newCat") {
      const name = (prompt("Name der neuen Kategorie:") || "").trim();
      if (!name) return;
      const found = $$("#cats .chip[data-cat]").find((c) => c.dataset.cat.toLowerCase() === name.toLowerCase());
      if (found) { found.classList.add("on"); return; }
      b.insertAdjacentHTML("beforebegin", `<button type="button" class="chip on" data-cat="${esc(name)}">${esc(name)}</button>`);
      return;
    }
    b.classList.toggle("on");
  });
  $("#cancel").addEventListener("click", goBack);
  $("#paste")?.addEventListener("click", async () => {
    try {
      const m = (await navigator.clipboard.readText()).match(/https?:\/\/\S+/);
      if (!m) return toast("In der Zwischenablage ist kein Link.");
      $("#url").value = m[0];
      doFetch();
    } catch { toast("Einfügen ging nicht – lange ins Feld drücken und „Einsetzen“ wählen."); }
  });

  const fillFrom = (d) => {
    const set = (sel, val) => { if (val != null && val !== "" && !$(sel).value.trim()) $(sel).value = val; };
    set("#t", d.title); set("#srv", d.servings); set("#time", d.time);
    set("#ing", d.ingredients.join("\n")); set("#steps", d.steps.join("\n"));
    if (d.description) r.description = d.description;
    const wanted = d.categories.map((c) => c.toLowerCase());
    $$("#cats .chip[data-cat]").forEach((c) => { if (wanted.includes(c.dataset.cat.toLowerCase())) c.classList.add("on"); });
  };
  async function doFetch() {
    const found = $("#url").value.trim().match(/https?:\/\/\S+/);
    if (!found) { toast("Bitte zuerst einen Link einfügen."); $("#url").focus(); return; }
    const url = found[0];
    $("#url").value = url;
    if (isSocial(url)) {
      $("#pasteBox").open = true;
      $("#rawText").focus();
      toast("Instagram & Co. lassen kein automatisches Holen zu. Kopiere den Beitragstext unten in „Text einfügen“ – der Link bleibt gespeichert.", "", 7000);
      return;
    }
    const btn = $("#fetch");
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner"></span> Wird geholt …';
    try {
      const d = parseRecipeHtml(await fetchVia(url), url);
      fillFrom(d);
      if (!d.ingredients.length && !d.steps.length) toast("Auf dieser Seite wurde kein Rezept erkannt. Bitte Zutaten und Schritte selbst eintragen.", "", 5500);
      else toast("Rezept geholt ✓ Kurz prüfen und speichern.", "ok");
      if (d.image && !image) {
        image = d.image; drawImg();
        fetchVia(d.image, true).then(compressImage).then((small) => { if (image === d.image) { image = small; drawImg(); } }).catch(() => {});
      }
    } catch {
      toast("Die Seite konnte gerade nicht geladen werden. Später nochmal probieren oder selbst eintragen.", "bad", 5500);
    } finally {
      btn.disabled = false;
      btn.innerHTML = `${icon("download", 19)} Rezept holen`;
    }
  }
  $("#ocrFile").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    const lbl = $("#ocrLbl");
    lbl.textContent = "Lese Text … (beim ersten Mal ca. 20 Sek.)";
    try {
      if (!window.Tesseract) await new Promise((ok, bad) => {
        const sc = document.createElement("script");
        sc.src = "https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js";
        sc.onload = ok; sc.onerror = bad; document.head.appendChild(sc);
      });
      const res = await Tesseract.recognize(f, "deu", { logger: (m) => { if (m.status === "recognizing text") lbl.textContent = `Lese Text … ${Math.round(m.progress * 100)} %`; } });
      const text = (res.data.text || "").trim();
      if (!text) { toast("Auf dem Foto wurde kein Text erkannt."); return; }
      $("#rawText").value = ($("#rawText").value ? $("#rawText").value + "\n" : "") + text;
      if (!image) { try { image = await compressImage(f); drawImg(); } catch {} }
      $("#parseText").click();
    } catch {
      toast("Das Lesen hat nicht geklappt – braucht beim ersten Mal Internet.", "bad", 5000);
    } finally {
      lbl.textContent = "Text aus Foto lesen";
      e.target.value = "";
    }
  });
  $("#parseText").addEventListener("click", () => {
    const raw = $("#rawText").value.trim();
    if (!raw) { toast("Bitte zuerst den Text einfügen."); $("#rawText").focus(); return; }
    const d = parseRecipeText(raw);
    const set = (sel, val) => { if (val != null && val !== "" && !$(sel).value.trim()) $(sel).value = val; };
    set("#t", d.title); set("#srv", d.servings); set("#ing", d.ingredients.join("\n")); set("#steps", d.steps.join("\n"));
    const wanted = guessCategories({ categories: [], title: d.title + " " + d.ingredients.join(" "), time: null });
    $$("#cats .chip[data-cat]").forEach((c) => { if (wanted.includes(c.dataset.cat)) c.classList.add("on"); });
    toast(`Sortiert ✓ ${plural(d.ingredients.length, "Zutat", "Zutaten")}, ${plural(d.steps.length, "Schritt", "Schritte")} – bitte kurz prüfen.`, "ok", 4000);
    $("#t").scrollIntoView({ behavior: "smooth", block: "center" });
  });
  $("#fetch").addEventListener("click", doFetch);
  $("#url").addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); doFetch(); } });

  $("#f").addEventListener("submit", async (e) => {
    e.preventDefault();
    const lines = (s) => s.split("\n").map((l) => l.trim()).filter(Boolean);
    const rec = {
      ...r,
      title: $("#t").value.trim() || "Ohne Namen",
      url: $("#url").value.trim(),
      image,
      categories: $$("#cats .chip.on").map((c) => c.dataset.cat),
      servings: parseInt($("#srv").value, 10) || null,
      time: parseInt($("#time").value, 10) || null,
      cost: parseNum($("#cost").value),
      ingredients: lines($("#ing").value),
      steps: lines($("#steps").value),
      notes: $("#notes").value.trim(),
      updated: Date.now(),
      created: r.created || Date.now(),
    };
    if (!rec.ingredients.length && !rec.steps.length && !rec.url && rec.title === "Ohne Namen") return toast("Bitte zuerst etwas eintragen.");
    try {
      await store.put(rec);
      if (videoFile) await media.put({ id: rec.id, blob: videoFile, type: videoFile.type, size: videoFile.size });
      else if (videoRemoved) await media.del(rec.id);
    } catch { return toast("Speichern hat nicht geklappt – ist der Speicher voll?", "bad", 5000); }
    toast("Gespeichert ✓", "ok");
    go("#/rezept/" + encodeURIComponent(rec.id), true);
  });

  if (prefill) { $("#url").value = prefill; doFetch(); }
}

/* =====================================================================
   Was hab ich daheim? – Rezepte nach Zutaten finden
   ===================================================================== */
const PANTRY = ["Eier", "Kartoffeln", "Nudeln", "Reis", "Zwiebeln", "Tomaten", "Käse", "Mehl", "Milch", "Topfen", "Faschiertes", "Hühnerfleisch", "Zucchini", "Paprika", "Spinat", "Karotten", "Äpfel", "Schlagobers", "Speck", "Brokkoli"];
const stem = (w) => { w = w.toLowerCase().trim(); return w.length > 5 ? w.slice(0, w.length - 2) : w; };

async function renderDaheim() {
  setTop();
  let have = local.get("daheim", []);
  view.innerHTML = `
    <div class="page">
      <div class="hello"><div class="sub">Resteküche</div><h1>Was hab ich daheim?</h1></div>
      <section class="card">
        <p class="muted">Tipp ein, was du im Kühlschrank und in der Speis hast – die App sucht passende Rezepte in deinem Kochbuch und im Internet.</p>
        <form class="shop-add" id="haveForm">
          <input type="text" id="haveIn" placeholder="z. B. Kartoffeln, Eier" aria-label="Zutat hinzufügen" enterkeyhint="done" autocomplete="off">
          <button class="btn" aria-label="Hinzufügen">${icon("plus", 20)}</button>
        </form>
        <div class="chips" id="haveChips"></div>
        <div class="stack" style="gap:8px">
          <span class="sub">Schnell dazu</span>
          <div class="chips" id="quick"></div>
        </div>
        <button class="btn big" id="find">${icon("search", 19)} Rezepte finden</button>
      </section>
      <div id="results" class="page"></div>
    </div>`;

  const save = () => { local.set("daheim", have); draw(); };
  const draw = () => {
    $("#haveChips").innerHTML = have.length
      ? have.map((h, i) => `<button class="chip on" data-i="${i}" aria-label="${esc(h)} entfernen">${esc(h)} ${icon("x", 14)}</button>`).join("")
      : `<span class="small muted">Noch nichts eingetragen.</span>`;
    const lower = have.map((h) => h.toLowerCase());
    $("#quick").innerHTML = PANTRY.filter((p) => !lower.includes(p.toLowerCase())).slice(0, 10).map((p) => `<button class="chip add" data-p="${esc(p)}">${icon("plus", 14)} ${esc(p)}</button>`).join("");
    $("#find").disabled = !have.length;
  };
  draw();
  $("#haveForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const add = $("#haveIn").value.split(/[,;]+/).map((x) => x.trim()).filter(Boolean);
    add.forEach((a) => { if (!have.some((h) => h.toLowerCase() === a.toLowerCase())) have.push(a); });
    $("#haveIn").value = "";
    save();
  });
  $("#haveChips").addEventListener("click", (e) => { const b = e.target.closest("[data-i]"); if (b) { have.splice(+b.dataset.i, 1); save(); } });
  $("#quick").addEventListener("click", (e) => { const b = e.target.closest("[data-p]"); if (b) { have.push(b.dataset.p); save(); } });
  $("#find").addEventListener("click", () => findRecipes(have));
  if (have.length && local.get("daheimAuto", false)) findRecipes(have);
}

async function findRecipes(have) {
  local.set("daheimAuto", true);
  const res = $("#results");
  const stems = have.map(stem);
  const own = (await store.all()).map((r) => {
    const text = (r.ingredients || []).join(" ").toLowerCase() + " " + r.title.toLowerCase();
    const hits = have.filter((h, i) => text.includes(stems[i]));
    return { r, hits };
  }).filter((x) => x.hits.length).sort((a, b) => b.hits.length - a.hits.length || byTitle(a.r, b.r));

  res.innerHTML = `
    <section class="stack" style="gap:10px">
      <div class="section-head"><h2>Aus deinem Kochbuch</h2><span class="small muted">${own.length || "keine"} Treffer</span></div>
      ${own.length ? `<div class="grid">${own.map(({ r, hits }) => cardHtml(r).replace('<div class="meta">', `<div class="meta"><span class="pill">${hits.length} von ${have.length} da</span>`)).join("")}</div>`
        : `<div class="empty small" style="border:1px dashed var(--line-2);border-radius:var(--r)">In deinen gespeicherten Rezepten passt noch nichts.</div>`}
    </section>
    <section class="stack" style="gap:10px">
      <div class="section-head"><h2>Vorschläge aus dem Internet</h2><span class="pill outline">Chefkoch</span></div>
      <div class="grid" id="web"><div class="empty" style="grid-column:1/-1"><span class="spinner"></span>Suche läuft …</div></div>
    </section>`;
  res.scrollIntoView({ behavior: "smooth", block: "start" });

  try {
    const q = have.slice(0, 5).map((h) => encodeURIComponent(h.toLowerCase())).join("+");
    const html = await fetchVia(`https://www.chefkoch.de/rs/s0/${q}/Rezepte.html`);
    const doc = new DOMParser().parseFromString(html, "text/html");
    let items = [];
    for (const s of doc.querySelectorAll('script[type="application/ld+json"]')) {
      try { const j = JSON.parse(s.textContent); if (j["@type"] === "ItemList") items = j.itemListElement || []; } catch {}
    }
    items = items.filter((it) => it.url && it.name).slice(0, 24).map((it) => {
      const id = (it.url.match(/rezepte\/(\d+)\//) || [])[1];
      const img = id && (html.match(new RegExp(`img\\.chefkoch-cdn\\.de/rezepte/${id}/bilder/[^"\\\\\\s,]+?\\.jpg`)) || [])[0];
      return { url: it.url, name: decode(it.name), desc: decode(it.description || ""), img: img ? "https://" + img : "" };
    });
    $("#web").innerHTML = items.length ? items.map((it) => `
      <button class="rc web" data-url="${esc(it.url)}" style="text-align:start;font:inherit;cursor:pointer;padding:0">
        <div class="ph" ${it.img ? `style="background-image:${esc(cssUrl(it.img))}"` : ""}>${it.img ? "" : icon("pot", 40)}</div>
        <div class="tx"><h3>${esc(it.name)}</h3><div class="meta">${it.desc ? `<span>${esc(it.desc.slice(0, 40))}</span>` : `<span>${icon("plus", 13)} Antippen zum Speichern</span>`}</div></div>
      </button>`).join("")
      : `<div class="empty" style="grid-column:1/-1">${icon("search", 30)}<b>Nichts gefunden</b><span class="small">Probier es mit weniger Zutaten.</span></div>`;
    $("#web").addEventListener("click", (e) => {
      const b = e.target.closest("[data-url]"); if (!b) return;
      pendingPrefill = b.dataset.url;
      go("#/neu");
    });
  } catch {
    $("#web").innerHTML = `<div class="empty" style="grid-column:1/-1">${icon("search", 30)}<b>Gerade keine Verbindung</b><span class="small">Die Vorschläge aus dem Internet brauchen Internet. Später nochmal probieren.</span></div>`;
  }
}

/* =====================================================================
   Einkaufsliste
   ===================================================================== */
function renderShop() {
  setTop();
  const items = shop.items();
  const groups = {};
  items.forEach((it) => (groups[it.from || "Eigene Einträge"] ||= []).push(it));
  const open = items.filter((i) => !i.done).length;
  view.innerHTML = `
    <div class="page">
      <div class="hello"><div class="sub" id="shopSub">${items.length ? `${open} von ${items.length} offen` : "Alles erledigt"}</div><h1>Einkaufsliste</h1></div>
      <form class="shop-add" id="add">
        <input type="text" id="newItem" placeholder="Etwas hinzufügen, z. B. Milch" aria-label="Neuer Eintrag" enterkeyhint="done">
        <button class="btn" aria-label="Hinzufügen">${icon("plus", 20)}</button>
      </form>
      ${items.length ? `<section class="card">
        ${Object.entries(groups).map(([from, list]) => `<div class="shop-group">
          <div class="sub">${esc(from)}</div>
          <ul class="ing">${list.map((it) => `<li data-id="${esc(it.id)}" class="${it.done ? "done" : ""}"><span class="box">${icon("check", 14)}</span><span class="t">${esc(it.text)}</span></li>`).join("")}</ul>
        </div>`).join("")}
      </section>
      <div class="actions">
        ${navigator.share ? `<button class="btn ghost" id="shareShop">${icon("share", 18)} Teilen</button>` : ""}
        <button class="btn ghost" id="clearDone" ${items.some((i) => i.done) ? "" : "disabled"}>${icon("check", 18)} Erledigte weg</button>
        <button class="btn ghost danger" id="clearAll" style="grid-column:1/-1">${icon("trash", 18)} Liste leeren</button>
      </div>`
      : `<div class="empty">${icon("cart", 40)}<h2>Nichts zu besorgen</h2><p>Bei einem Rezept auf „Auf die Einkaufsliste“ tippen – oder oben selbst etwas eintragen.</p></div>`}
    </div>`;
  $("#add").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = $("#newItem").value.trim(); if (!text) return;
    shop.save([...shop.items(), { id: uid(), text, done: false, from: "" }]);
    renderShop();
    $("#newItem").focus();
  });
  $$(".ing li[data-id]").forEach((li) => li.addEventListener("click", () => {
    const list = shop.items();
    const it = list.find((x) => x.id === li.dataset.id); if (!it) return;
    it.done = !it.done;
    shop.save(list);
    li.classList.toggle("done", it.done);
    $("#shopSub").textContent = `${list.filter((i) => !i.done).length} von ${list.length} offen`;
    $("#clearDone").disabled = !list.some((i) => i.done);
  }));
  $("#clearDone")?.addEventListener("click", () => { shop.save(shop.items().filter((i) => !i.done)); renderShop(); });
  $("#clearAll")?.addEventListener("click", () => { if (confirm("Ganze Einkaufsliste leeren?")) { shop.save([]); renderShop(); } });
  $("#shareShop")?.addEventListener("click", () => {
    const text = "Einkaufsliste:\n" + shop.items().filter((i) => !i.done).map((i) => "• " + i.text).join("\n");
    navigator.share({ title: "Einkaufsliste", text }).catch(() => {});
  });
}

/* =====================================================================
   Mehr: Darstellung, installieren, Sicherung
   ===================================================================== */
let installEvent = null;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvent = e; });

async function renderMore() {
  setTop();
  const all = await store.all();
  const theme = document.documentElement.dataset.theme || "auto";
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const standalone = matchMedia("(display-mode: standalone)").matches || navigator.standalone;
  const lastBackup = local.get("lastBackup", null);
  view.innerHTML = `
    <div class="page">
      <div class="hello"><div class="sub">Einstellungen</div><h1>Mehr</h1></div>
      <div class="stats">
        <div><b>${all.length}</b><small>Rezepte</small></div>
        <div><b>${all.filter((r) => r.fav).length}</b><small>Favoriten</small></div>
        <div><b>${new Set(all.flatMap((r) => r.categories || [])).size}</b><small>Kategorien</small></div>
      </div>

      ${standalone ? "" : `<section class="card">
        <div class="card-head"><h2>${icon("phone", 20)} Auf den Startbildschirm</h2></div>
        ${isIOS ? `<ol class="howto">
            <li>Unten in Safari auf <b>Teilen</b> tippen (Quadrat mit Pfeil).</li>
            <li><b>„Zum Home-Bildschirm“</b> wählen.</li>
            <li>Rechts oben auf <b>Hinzufügen</b> tippen.</li>
          </ol>`
        : `<p class="muted">Dann öffnet sich die App wie eine richtige App – auch ohne Internet.</p>
          <button class="btn" id="install">${icon("download", 19)} App installieren</button>
          <p class="small muted" id="installHint" hidden>Im Browser-Menü (⋮ rechts oben) auf <b>„App installieren“</b> oder <b>„Zum Startbildschirm hinzufügen“</b> tippen.</p>`}
      </section>`}

      <section class="card">
        <div class="card-head"><h2>${icon("sun", 20)} Darstellung</h2></div>
        <div class="theme-switch" id="theme">
          ${[["light", "Hell"], ["dark", "Dunkel"], ["auto", "Automatisch"]].map(([k, l]) => `<button class="${theme === k ? "on" : ""}" data-t="${k}"><span class="sw ${k}"></span>${l}</button>`).join("")}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><h2>${icon("download", 20)} Sicherung</h2></div>
        <p class="muted">Deine Rezepte sind nur auf diesem Gerät gespeichert. Mach ab und zu eine Sicherung und heb die Datei gut auf – z. B. per E-Mail an dich selbst.</p>
        <p class="small">${lastBackup ? `Letzte Sicherung: <b>${new Date(lastBackup).toLocaleDateString("de-AT")}</b>` : `<span class="pill tomato">Noch keine Sicherung gemacht</span>`}</p>
        <button class="btn" id="export">${icon("download", 19)} Sicherung speichern</button>
        <label class="btn ghost" style="display:inline-flex">${icon("upload", 19)} Sicherung einspielen<input type="file" id="import" accept=".json,application/json" hidden></label>
        <p class="small muted">Mit „Einspielen“ kann man auch Rezepte von einem anderen Handy übernehmen.</p>
      </section>

      <section class="card">
        <div class="card-head"><h2>${icon("sparkle", 20)} Tipps</h2></div>
        <ol class="howto">
          <li>Auf Android: bei einer Rezeptseite auf <b>Teilen</b> tippen und <b>„Rezepte“</b> wählen – das Rezept wird direkt übernommen.</li>
          <li>Im <b>Kochmodus</b> bleibt der Bildschirm an. Zum Weiterblättern einfach wischen. Steht eine Zeit im Schritt, gibt es einen <b>Timer</b>-Knopf.</li>
          <li><b>Foto statt tippen:</b> Bei „Text einfügen“ auf <b>„Text aus Foto lesen“</b> – klappt mit Instagram-Screenshots und Kochbuchseiten.</li>
          <li><b>Videos</b> (z. B. eine Bildschirmaufnahme vom Instagram-Reel) beim Bearbeiten anhängen – sie bleiben am Handy. Videos kommen nicht in die Sicherungsdatei.</li>
          <li>Beim Rezept die Portionen ändern – Mengen und Kosten rechnen sich mit.</li>
          <li>Von Instagram: Link einfügen und den Beitragstext bei <b>„Text einfügen“</b> hineinkopieren. Das Rezept bleibt in der App, auch wenn der Beitrag gelöscht wird.</li>
        </ol>
      </section>
    </div>`;

  $("#theme").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    try { localStorage.setItem("theme", b.dataset.t); } catch {}
    document.documentElement.dataset.theme = b.dataset.t;
    $$("#theme button").forEach((x) => x.classList.toggle("on", x === b));
  });
  $("#install")?.addEventListener("click", () => {
    if (installEvent) { installEvent.prompt(); installEvent = null; } else $("#installHint").hidden = false;
  });
  $("#export").addEventListener("click", async () => {
    const data = JSON.stringify({ app: "meine-rezepte", version: 1, exported: new Date().toISOString(), recipes: await store.all(), einkauf: shop.items() });
    const name = `rezepte-sicherung-${new Date().toISOString().slice(0, 10)}.json`;
    const blob = new Blob([data], { type: "application/json" });
    const file = new File([blob], name, { type: "application/json" });
    const done = () => { local.set("lastBackup", Date.now()); toast("Sicherung gespeichert ✓", "ok"); renderMore(); };
    if (/android|iphone|ipad/i.test(navigator.userAgent) && navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], title: "Rezepte-Sicherung" }); return done(); } catch (e) { if (e.name === "AbortError") return; }
    }
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = name; a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    done();
  });
  $("#import").addEventListener("change", async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const recs = Array.isArray(data) ? data : data.recipes;
      if (!Array.isArray(recs)) throw new Error();
      let n = 0;
      for (const rec of recs) if (rec && rec.id && rec.title) { await store.put(rec); n++; }
      toast(`${plural(n, "Rezept", "Rezepte")} übernommen ✓`, "ok");
      renderMore();
    } catch { toast("Das ist keine gültige Sicherungsdatei.", "bad"); }
  });
}

/* =====================================================================
   Start
   ===================================================================== */
(function start() {
  // Link, der über "Teilen" (Android) hereinkommt
  const p = new URLSearchParams(location.search);
  const shared = [p.get("url"), p.get("text"), p.get("title")].join(" ").match(/https?:\/\/\S+/);
  if (shared) {
    history.replaceState(null, "", location.pathname + "#/neu");
    drawTabbar();
    renderForm(null, shared[0]);
  } else {
    route();
  }
  if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
  // Netlify blendet unten ein Schild ein – dann rückt die Reiterleiste darüber
  const badge = () => document.body.classList.toggle("nl-badge", !!document.getElementById("nl-badge-frame"));
  new MutationObserver(badge).observe(document.body, { childList: true });
  badge();
})();
