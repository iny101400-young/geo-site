#!/usr/bin/env node
// geo-skills · 이니 (iny) · https://iny-young.com · f20fb48b2423
/**
 * geo-site 점검 (사용자 프로젝트 폴더에서 실행)
 *
 *   node <skill>/scripts/check.mjs https://내주소            직접 지은 사이트
 *   node <skill>/scripts/check.mjs https://내주소 --builder  빌더(아임웹 · 카페24 등)로 만든 사이트
 *
 * 파일이 아니라 실제 주소를 받아 보며 14가지를 잰다. 페이지는 사이트맵에서 최대 30개.
 *   geo/site-check.json     점검 결과 (geo-index 가 등록 전에 읽음)
 *   geo/site-report.html    사이트 리포트 (report.mjs · 설계안이 있으면 페이지 · 채울 것도 같이)
 * 열 파일 경로를 마지막 줄에 찍는다. 그 사이트 말고는 아무 데도 보내지 않는다.
 */
import fs from "node:fs";
import path from "node:path";
import { writeReport } from "./report.mjs";

const args = process.argv.slice(2);
const START = args.find((a) => /^https?:\/\//.test(a));
const BUILDER = args.includes("--builder");
const GEO = path.join(process.cwd(), "geo");
const MAX_PAGES = 30;
const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130 Safari/537.36 geo-site-check";
const BOTS = [
  ["GPTBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot"],
  ["OAI-SearchBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot"],
  ["ClaudeBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; ClaudeBot/1.0; +claudebot@anthropic.com)"],
  ["PerplexityBot", "Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)"],
  ["Googlebot", "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)"],
  ["Yeti", "Mozilla/5.0 (compatible; Yeti/1.1; +https://naver.me/spd)"],
  ["bingbot", "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)"],
];
const ROBOT_NAMES = ["GPTBot", "OAI-SearchBot", "ChatGPT-User", "ClaudeBot", "Claude-SearchBot", "PerplexityBot", "Google-Extended", "Googlebot", "Yeti", "bingbot"];

const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const len = (s) => [...String(s || "")].length;
const decode = (s) => String(s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&nbsp;/g, " ").replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n));

/* ── 받기 ───────────────────────────────────────────────── */
async function get(url, { ua = UA, follow = true, method = "GET" } = {}) {
  let cur = url, hops = [];
  for (let i = 0; i < 6; i++) {
    let res;
    try {
      res = await fetch(cur, { method, redirect: "manual", headers: { "user-agent": ua, accept: "text/html,application/xhtml+xml,*/*" }, signal: AbortSignal.timeout(15000) });
    } catch (e) {
      return { url: cur, status: 0, error: e.cause?.code || e.name, hops, headers: new Headers(), text: "" };
    }
    if (follow && res.status >= 300 && res.status < 400 && res.headers.get("location")) {
      hops.push({ from: cur, status: res.status });
      cur = new URL(res.headers.get("location"), cur).href;
      continue;
    }
    const ct = res.headers.get("content-type") || "";
    const buf = method === "HEAD" ? Buffer.alloc(0) : Buffer.from(await res.arrayBuffer());
    return { url: cur, status: res.status, hops, headers: res.headers, ct, buf, text: /text|xml|json|javascript/.test(ct) || !ct ? buf.toString("utf8") : "" };
  }
  return { url: cur, status: 0, error: "리다이렉트가 너무 많아요", hops, headers: new Headers(), text: "" };
}

/* ── HTML 읽기 ──────────────────────────────────────────── */
const attr = (tag, name) => (tag.match(new RegExp(`\\b${name}\\s*=\\s*("([^"]*)"|'([^']*)'|([^\\s>]+))`, "i")) || []).slice(2).find((x) => x != null);
function meta(html, key) {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const t = m[0];
    if ((attr(t, "name") || attr(t, "property") || "").toLowerCase() === key) return decode(attr(t, "content") || "");
  }
  return null;
}
function readPage(html, url) {
  const head = html.split(/<\/head>/i)[0];
  const title = decode((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1] || "").trim();
  const canon = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).find((t) => /rel\s*=\s*["']?canonical/i.test(t));
  const h1s = [...html.matchAll(/<h1\b[^>]*>([\s\S]*?)<\/h1>/gi)].map((m) => decode(m[1].replace(/<[^>]+>/g, "")).replace(/\s+/g, " ").trim());
  const body = (html.match(/<body[^>]*>([\s\S]*)<\/body>/i) || [, html])[1];
  const text = decode(body.replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  const ld = [...html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)].map((m) => { try { return JSON.parse(m[1]); } catch { return { _bad: true }; } });
  const types = [];
  const walk = (o) => { if (Array.isArray(o)) return o.forEach(walk); if (o && typeof o === "object") { if (o["@type"]) types.push(...[].concat(o["@type"])); if (o["@graph"]) walk(o["@graph"]); } };
  ld.forEach(walk);
  const sameAs = ld.flatMap((o) => [].concat(o?.["@graph"] || o)).flatMap((o) => [].concat(o?.sameAs || []));
  const nav = (html.match(/<nav\b[\s\S]*?<\/nav>/i) || [""])[0];
  const navLinks = [...(nav || body).matchAll(/<a\b[^>]*>/gi)].map((m) => attr(m[0], "href")).filter((h) => h && !/^(#|mailto:|tel:|javascript:)/i.test(h) && (/^\//.test(h) || h.startsWith(new URL(url).origin)));
  const hreflang = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).filter((t) => /hreflang/i.test(t)).map((t) => attr(t, "hreflang"));
  const icons = [...head.matchAll(/<link\b[^>]*>/gi)].map((m) => m[0]).filter((t) => /rel\s*=\s*["'][^"']*icon/i.test(t)).map((t) => ({ href: attr(t, "href"), sizes: attr(t, "sizes") || "" }));
  return {
    url, title, lang: attr((html.match(/<html\b[^>]*>/i) || [""])[0], "lang") || "",
    description: meta(head, "description"), robots: meta(head, "robots") || "", viewport: meta(head, "viewport"),
    canonical: canon ? new URL(attr(canon, "href") || "", url).href : null,
    og: { title: meta(head, "og:title"), description: meta(head, "og:description"), image: meta(head, "og:image") },
    verify: { google: !!meta(head, "google-site-verification"), naver: !!meta(head, "naver-site-verification"), bing: !!meta(head, "msvalidate.01") },
    h1s, textLen: len(text), ld, types, badLd: ld.some((x) => x._bad), sameAs, hasNav: !!nav, navLinks,
    fakeLinks: [...html.matchAll(/<(button|div|span)\b[^>]*onclick\s*=\s*["'][^"']*(location|href)/gi)].length,
    icons, hreflang,
  };
}

/* ── robots.txt ─────────────────────────────────────────── */
function parseRobots(txt) {
  const groups = []; let cur = null; const sitemaps = [];
  for (const raw of txt.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, "").trim(); if (!line) continue;
    const [k, ...v] = line.split(":"); const key = k.trim().toLowerCase(); const val = v.join(":").trim();
    if (key === "sitemap") { sitemaps.push(val); continue; }
    if (key === "user-agent") { if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(val.toLowerCase()); continue; }
    if (cur && (key === "disallow" || key === "allow")) cur.rules.push({ type: key, path: val });
  }
  const blocks = (bot) => {
    const g = groups.find((x) => x.agents.includes(bot.toLowerCase())) || groups.find((x) => x.agents.includes("*"));
    if (!g) return false;
    const dis = g.rules.filter((r) => r.type === "disallow" && r.path === "/").length;
    const allowRoot = g.rules.some((r) => r.type === "allow" && (r.path === "/" || r.path === "/$"));
    return dis > 0 && !allowRoot;
  };
  return { sitemaps, blocks };
}

/* ── 사이트맵 ───────────────────────────────────────────── */
async function readSitemap(url, depth = 0) {
  const r = await get(url);
  if (r.status !== 200) return { ok: false, status: r.status, urls: [] };
  const locs = [...r.text.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)].map((m) => decode(m[1]).trim());
  if (/<sitemapindex/i.test(r.text) && depth < 1) {
    const urls = [];
    for (const sm of locs.slice(0, 5)) urls.push(...(await readSitemap(sm, depth + 1)).urls);
    return { ok: true, status: 200, urls, index: true };
  }
  return { ok: true, status: 200, urls: locs };
}

/* ── 점검 ───────────────────────────────────────────────── */
async function main() {
  if (!START) throw new Error("주소를 붙여 주세요: node check.mjs https://내주소");
  const origin = new URL(START).origin;
  const home = await get(origin + "/");
  const R = [];
  const add = (id, name, level, detail, extra = {}) => R.push({ id, name, level, detail, ...extra });
  const host = new URL(origin).hostname;
  const local = /^(localhost|127\.|192\.168\.|\[::1\])/.test(host);
  // 내 컴퓨터(localhost)로 잴 때는 사이트맵 · 대표 주소 · 공유 이미지에 적힌 진짜 주소를 내 컴퓨터 주소로 바꿔 받는다
  const toLocal = (u) => { if (!local) return u; try { const x = new URL(u, origin); return origin + x.pathname + x.search; } catch { return u; } };
  LOCAL_MAP = toLocal;
  const preview = /-git-|-[a-z0-9]{9}-[a-z0-9-]+\.vercel\.app$/.test(host) || /noindex/i.test(home.headers.get("x-robots-tag") || "");

  // 1 · 정상 열림
  if (home.status === 200 && home.hops.length <= 1) add(1, "정상 열림", "ok", `200${home.hops.length ? ` · 한 번 넘어가요 (${home.hops[0].status})` : ""}`);
  else if (home.status === 200) add(1, "정상 열림", "warn", `열리지만 ${home.hops.length}번 넘어가요`, { fix: "fix_hops" });
  else { add(1, "정상 열림", "bad", home.status ? `상태 ${home.status}` : `열리지 않아요 (${home.error})`, { fix: "fix_open" }); return finish(R, [], { origin, local, preview, stop: true }); }

  // 2 · robots.txt
  const rb = await get(origin + "/robots.txt");
  let robots = { sitemaps: [], blocks: () => false };
  if (rb.status === 200 && !/<html/i.test(rb.text)) {
    robots = parseRobots(rb.text);
    const blocked = ROBOT_NAMES.filter((b) => robots.blocks(b));
    if (blocked.length) add(2, "robots.txt", "bad", `막힌 봇: ${blocked.join(", ")}`, { fix: "fix_robots_block" });
    else if (!robots.sitemaps.length) add(2, "robots.txt", "warn", "봇은 막지 않아요 · 사이트맵 주소가 없어요", { fix: "fix_robots_sitemap" });
    else add(2, "robots.txt", "ok", "검색엔진 · AI 봇을 막지 않아요 · 사이트맵 주소 있음");
  } else add(2, "robots.txt", "warn", "robots.txt 가 없어요 (막지는 않지만 사이트맵을 알려 주지 못해요)", { fix: "fix_robots_none" });

  // 3 · 사이트맵
  const smUrl = toLocal(robots.sitemaps[0] || origin + "/sitemap.xml");
  const sm = await readSitemap(smUrl);
  let pageUrls = [];
  if (sm.ok && sm.urls.length) {
    if (local) sm.urls = sm.urls.map(toLocal);
    const foreign = sm.urls.filter((u) => { try { return new URL(u).origin !== origin; } catch { return true; } });
    pageUrls = sm.urls.filter((u) => !foreign.includes(u)).slice(0, MAX_PAGES);
    if (foreign.length) add(3, "사이트맵", "bad", `다른 주소가 섞여 있어요: ${foreign.slice(0, 2).join(", ")}`, { fix: "fix_sitemap_foreign" });
    else add(3, "사이트맵", "ok", `주소 ${sm.urls.length}개${sm.urls.length > MAX_PAGES ? ` · 앞의 ${MAX_PAGES}개만 쟀어요` : ""}`);
  } else {
    add(3, "사이트맵", "bad", sm.ok ? "사이트맵이 비어 있어요" : `사이트맵이 안 열려요 (${smUrl})`, { fix: "fix_sitemap_none" });
    pageUrls = [home.url];
  }

  // 페이지 받기
  const pages = [];
  for (const u of pageUrls) {
    const r = await get(u);
    const pg = r.status === 200 ? readPage(r.text, r.url) : { url: u };
    pg.asked = u; pg.status = r.status; pg.hops = r.hops.length; pg.xrobots = r.headers.get("x-robots-tag") || "";
    pages.push(pg);
  }
  const seen = new Set();
  const okPages = pages.filter((p) => p.status === 200 && !p.hops && !seen.has(stripSlash(p.url)) && seen.add(stripSlash(p.url)));
  const bad3 = pages.filter((p) => p.status !== 200 || p.hops);
  if (bad3.length && R.find((x) => x.id === 3).level === "ok") Object.assign(R.find((x) => x.id === 3), { level: "warn", detail: `사이트맵 주소 중 ${bad3.length}개가 바로 안 열려요 (넘어가거나 오류)`, fix: "fix_sitemap_redirect", pages: bad3.map((p) => `${short(p.asked)} (${p.status}${p.hops ? " · 넘어감" : ""})`) });

  // 4 · 제목 · 설명
  const limits = (p) => (/^(ko|ja|zh)/i.test(p.lang || "ko") ? [30, 80] : [60, 150]);
  const dupT = dupes(okPages.map((p) => p.title)), dupD = dupes(okPages.map((p) => p.description || ""));
  const noDesc = okPages.filter((p) => !p.description);
  const longT = okPages.filter((p) => len(p.title) > limits(p)[0]), longD = okPages.filter((p) => p.description && len(p.description) > limits(p)[1]);
  if (dupT.length || noDesc.length || okPages.some((p) => !p.title)) add(4, "페이지별 제목 · 설명", "bad", [dupT.length && dupT.map((g) => `${g.length}개 페이지가 같은 제목 「${g[0]}」`).join(" · "), dupD.length && `설명이 같은 페이지 ${dupD.length}묶음`, noDesc.length && `설명 없음 ${noDesc.length}개`].filter(Boolean).join(" · "), { fix: "fix_title_dup", pages: okPages.filter((p) => dupT.some((g) => g.includes(p.title)) || !p.description).map((p) => p.url) });
  else if (dupD.length || longT.length || longD.length) add(4, "페이지별 제목 · 설명", "warn", [dupD.length && `설명이 같은 페이지 ${dupD.length}묶음`, longT.length && `제목이 긴 페이지 ${longT.length}개`, longD.length && `설명이 긴 페이지 ${longD.length}개`].filter(Boolean).join(" · "), { fix: "fix_title_long", pages: [...longT, ...longD].map((p) => p.url) });
  else add(4, "페이지별 제목 · 설명", "ok", `${okPages.length}개 모두 다르고 길이도 맞아요`);

  // 5 · H1
  const h1bad = okPages.filter((p) => p.h1s.length !== 1);
  add(5, "H1 하나", h1bad.length ? (h1bad.some((p) => !p.h1s.length) ? "bad" : "warn") : "ok", h1bad.length ? h1bad.map((p) => `${short(p.url)} ${p.h1s.length}개`).join(" · ") : "페이지마다 하나", h1bad.length ? { fix: "fix_h1" } : {});

  // 6 · 대표 주소
  const canBad = okPages.filter((p) => !p.canonical || stripSlash(p.canonical) !== stripSlash(p.url));
  add(6, "대표 주소 (canonical)", canBad.length ? (canBad.some((p) => p.canonical && stripSlash(p.canonical) !== stripSlash(p.url)) ? "bad" : "warn") : "ok", canBad.length ? canBad.map((p) => `${short(p.url)} → ${p.canonical ? short(p.canonical) : "없음"}`).slice(0, 4).join(" · ") : "모두 자기 주소를 가리켜요", canBad.length ? { fix: "fix_canonical" } : {});

  // 7 · 공유 카드
  const ogMiss = okPages.filter((p) => !p.og.title || !p.og.description || !p.og.image);
  let ogImg = null;
  const img = okPages[0]?.og.image;
  if (img) { ogImg = /^https?:\/\//.test(img) ? await get(toLocal(img)) : { status: -1 }; }
  if (!img) add(7, "공유 카드 (OG)", "bad", "공유 이미지가 없어요", { fix: "fix_og" });
  else if (ogImg.status === -1) add(7, "공유 카드 (OG)", "bad", `이미지 주소가 상대 주소예요 (${img})`, { fix: "fix_og_abs" });
  else if (ogImg.status !== 200 || !/^image\//.test(ogImg.ct || "")) add(7, "공유 카드 (OG)", "bad", `이미지가 안 열려요 (${ogImg.status})`, { fix: "fix_og" });
  else if (ogMiss.length) add(7, "공유 카드 (OG)", "warn", `제목 · 설명이 빠진 페이지 ${ogMiss.length}개`, { fix: "fix_og", pages: ogMiss.map((p) => p.url) });
  else add(7, "공유 카드 (OG)", "ok", "제목 · 설명 · 이미지 (열림)");

  // 8 · 구조화 데이터
  const homeP = okPages.find((p) => stripSlash(p.url) === stripSlash(origin)) || readPage(home.text, home.url);
  const WHO = /^(Person|Organization|LocalBusiness|Corporation|.*Store|.*Clinic|MedicalBusiness|Dentist|Physician|ProfessionalService|.*Business|Restaurant|CafeOrCoffeeShop|EducationalOrganization)$/;
  const hasWho = homeP.types.some((t) => WHO.test(t));
  const subs = okPages.filter((p) => p !== homeP);
  const noCrumb = subs.filter((p) => !p.types.includes("BreadcrumbList"));
  const sd = [];
  if (!hasWho) sd.push("홈에 누구인지(사람 · 단체 · 가게) 표시가 없어요");
  if (!homeP.sameAs.length && hasWho) sd.push("SNS 주소(sameAs)가 없어요");
  if (noCrumb.length) sd.push(`이동경로가 없는 하위 페이지 ${noCrumb.length}개`);
  if (okPages.some((p) => p.badLd)) sd.push("읽히지 않는 구조화 데이터가 있어요");
  add(8, "구조화 데이터", (!hasWho || okPages.some((p) => p.badLd)) && !BUILDER ? "bad" : sd.length ? "warn" : "ok", sd.join(" · ") || `${[...new Set(homeP.types)].join(" · ")} · 이동경로 · sameAs`, sd.length ? { fix: !hasWho ? "fix_schema_who" : "fix_schema_more" } : {});

  // 9 · 소유 확인 태그 (자리)
  const v = homeP.verify; const vs = Object.entries(v).filter(([, x]) => x).map(([k]) => k);
  add(9, "소유 확인 태그", vs.length === 3 ? "ok" : "later", vs.length ? `처음 HTML 에 있음: ${vs.join(", ")}${vs.length < 3 ? ` · 나머지는 등록 때 (DNS 로 확인했으면 없어도 돼요)` : ""}` : "아직 없어요 · 검색엔진 등록 때 넣어요", vs.length === 3 ? {} : { fix: "fix_verify" });

  // 10 · 자바스크립트 없이 글자
  // 문의 · 오시는 길은 원래 짧아서 300자 기준에서 뺀다 (글자가 아예 없는 건 그대로 잡는다)
  const SHORT_OK = /\/(contact|inquiry|location|map|directions|reservation|booking)$/i;
  const thin = okPages.filter((p) => p.textLen < 300 && !SHORT_OK.test(new URL(p.url).pathname));
  const exempt = okPages.filter((p) => p.textLen < 300 && SHORT_OK.test(new URL(p.url).pathname));
  const empty = okPages.filter((p) => p.textLen < 80);
  add(10, "자바스크립트 없이도 글자", empty.length ? "bad" : thin.length ? "warn" : "ok", empty.length ? `글자가 거의 없는 페이지 ${empty.length}개 (그림이나 자바스크립트로만 보여요)` : thin.length ? `300자 안 되는 페이지 ${thin.length}개 · ${thin.map((p) => `${short(p.url)} ${p.textLen}자`).slice(0, 4).join(" · ")}` : `모든 페이지 300자 이상 (홈 ${homeP.textLen}자)${exempt.length ? ` · 문의 · 오시는 길은 짧아도 괜찮아서 뺐어요` : ""}`, empty.length ? { fix: "fix_text_js" } : thin.length ? { fix: "fix_text_thin" } : {});

  // 11 · 메뉴가 실제 링크
  const fake = okPages.reduce((n, p) => n + p.fakeLinks, 0);
  if (fake) add(11, "메뉴가 실제 링크", "warn", `눌러야 넘어가는 버튼이 있어요 (모든 페이지 합쳐 ${fake}개) · 링크가 아니라서 봇이 따라가지 못해요`, { fix: "fix_nav" });
  else if (homeP.navLinks.length === 0) add(11, "메뉴가 실제 링크", "warn", "홈에서 다른 페이지로 가는 링크를 못 찾았어요", { fix: "fix_nav" });
  else add(11, "메뉴가 실제 링크", "ok", `${homeP.hasNav ? "메뉴" : "홈"} 링크 ${new Set(homeP.navLinks).size}개`);

  // 12 · 검색 금지 없음
  const noidx = pages.filter((p) => /noindex/i.test(p.robots || "") || /noindex/i.test(p.xrobots || ""));
  add(12, "검색 금지 표시 없음", noidx.length ? "bad" : "ok", noidx.length ? `검색 금지가 붙은 페이지 ${noidx.length}개 · ${noidx.map((p) => short(p.url || p.asked)).slice(0, 4).join(" · ")}` : "사이트맵 주소에 검색 금지가 없어요", noidx.length ? { fix: preview ? "fix_noindex_preview" : "fix_noindex" } : {});

  // 13 · 모바일 · 404
  const nf = await get(origin + "/geo-site-check-" + Date.now());
  const m13 = [];
  if (!homeP.viewport) m13.push("모바일 화면 설정(viewport)이 없어요");
  if (nf.status === 200) m13.push("없는 주소도 200 으로 열려요 (가짜 404)");
  add(13, "모바일 · 404", m13.length ? "warn" : "ok", m13.join(" · ") || `모바일 설정 있음 · 없는 주소는 ${nf.status}`, m13.length ? { fix: nf.status === 200 ? "fix_404" : "fix_viewport" } : {});

  // 14 · 파비콘
  const ic = await favicon(homeP, origin);
  add(14, "파비콘", ic.level, ic.detail, ic.level === "ok" ? {} : { fix: "fix_favicon" });

  // 다른 나라 말 (컨셉에서 해외를 골랐거나 다른 말 페이지가 있을 때만)
  const copy = (() => { try { return JSON.parse(fs.readFileSync(path.join(GEO, "site-copy.json"), "utf8")); } catch { return null; } })();
  const wantLangs = Object.keys(copy?.locales || {});
  const otherLang = okPages.filter((p) => p.lang && !/^ko/i.test(p.lang));
  if (wantLangs.length || otherLang.length) {
    const has = homeP.hreflang;
    const missing = wantLangs.filter((c) => !has.some((h) => h.toLowerCase().startsWith(c.toLowerCase().slice(0, 2))));
    if (!has.length) add(16, "다른 나라 말 표시 (hreflang)", "warn", `${wantLangs.length ? `컨셉에서 고른 말(${wantLangs.join(", ")})` : "다른 말 페이지"}이 있는데 홈에 언어 표시가 없어요`, { fix: "fix_hreflang" });
    else if (missing.length) add(16, "다른 나라 말 표시 (hreflang)", "warn", `빠진 말: ${missing.join(", ")}`, { fix: "fix_hreflang" });
    else add(16, "다른 나라 말 표시 (hreflang)", "ok", `홈에 ${has.join(" · ")}`);
  }

  // + AI 봇으로 받아 보기
  const bots = [];
  for (const [name, ua] of BOTS) { const r = await get(origin + "/", { ua }); bots.push({ name, status: r.status }); }
  const blockedBots = bots.filter((b) => b.status !== 200);
  add(15, "AI 봇으로 받아 보기", blockedBots.length ? "bad" : "ok", blockedBots.length ? `막힘: ${blockedBots.map((b) => `${b.name} ${b.status || "응답 없음"}`).join(" · ")}` : `${bots.map((b) => b.name).join(" · ")} 모두 200`, blockedBots.length ? { fix: "fix_bot_block", bots } : { bots });

  return finish(R, okPages, { origin, local, preview });
}

async function favicon(p, origin) {
  const cands = [...p.icons.map((i) => ({ href: new URL(i.href, p.url).href, sizes: i.sizes })), { href: origin + "/favicon.ico", sizes: "" }];
  for (const c of cands) {
    const r = await get(c.href);
    if (r.status !== 200 || !r.buf?.length) continue;
    const ct = r.ct || "";
    if (/svg/.test(ct) || /<svg/i.test(r.buf.slice(0, 300).toString())) return { level: "ok", detail: `SVG 파비콘 열림 (${short(c.href)})` };
    const px = imgSize(r.buf);
    if (px >= 48) return { level: "ok", detail: `${px}px 파비콘 열림 (${short(c.href)})` };
    if (px >= 32) return { level: "warn", detail: `${px}px 파비콘 · 48px 이상이면 더 좋아요`, };
  }
  return { level: "bad", detail: "파비콘이 없거나 안 열려요" };
}
function imgSize(b) {
  if (b[0] === 0x89 && b[1] === 0x50) return b.readUInt32BE(16);
  if (b[0] === 0 && b[1] === 0 && b[2] === 1) { let max = 0; for (let i = 0; i < b.readUInt16LE(4); i++) max = Math.max(max, b[6 + i * 16] || 256); return max; }
  if (b[0] === 0xff && b[1] === 0xd8) return 48;
  return 0;
}
const dupes = (arr) => { const m = {}; arr.forEach((x, i) => { if (x) (m[x] ||= []).push(i); }); return Object.values(m).filter((v) => v.length > 1).map((v) => v.map((i) => arr[i])); };
let LOCAL_MAP = (u) => u;
const stripSlash = (u) => String(LOCAL_MAP(u) || "").replace(/\/+$/, "").replace(/\.html$/, "");
const short = (u) => { try { const x = new URL(u); return x.pathname === "/" ? "홈" : x.pathname; } catch { return u; } };

/* ── 고치는 법 (직접 지은 사이트 / 빌더) ─────────────────── */
const FIX = {
  fix_open: ["주소가 맞는지, 배포가 끝났는지 확인해요", "주소가 맞는지, 빌더에서 사이트를 「공개」로 켰는지 확인해요"],
  fix_hops: ["주소가 여러 번 넘어가요. 대표 주소 하나로 바로 가게 설정해요 (www 있는 쪽 · 없는 쪽 하나로)", "빌더 도메인 설정에서 대표 도메인을 하나로 정해요"],
  fix_robots_block: ["robots.txt 에서 그 봇을 막는 줄을 지워요 → 「고쳐 줘」", "빌더 SEO 설정의 「검색 로봇 차단」 · 「AI 크롤러 차단」 스위치를 꺼요"],
  fix_robots_sitemap: ["robots.txt 끝에 「Sitemap: 주소/sitemap.xml」 한 줄을 더해요 → 「고쳐 줘」", "빌더 SEO 설정에서 robots.txt 편집이 되면 사이트맵 줄을 더해요. 안 되면 서치콘솔에 사이트맵을 직접 내요"],
  fix_robots_none: ["robots.txt 를 만들어요 → 「고쳐 줘」", "빌더 SEO 설정에 robots.txt 칸이 있는지 확인해요. 없으면 그대로 둬도 돼요"],
  fix_sitemap_foreign: ["사이트맵에서 다른 주소를 빼요 → 「고쳐 줘」", "빌더가 만든 사이트맵이면 도메인 설정(대표 도메인)을 확인해요"],
  fix_sitemap_none: ["사이트맵을 만들어요 → 「고쳐 줘」", "빌더 SEO 설정에서 사이트맵을 켜요. 주소는 보통 /sitemap.xml 이에요"],
  fix_sitemap_redirect: ["사이트맵에는 바로 열리는 최종 주소만 넣어요 → 「고쳐 줘」", "빌더에서 지운 페이지 · 옮긴 페이지가 사이트맵에 남았는지 봐요"],
  fix_title_dup: ["페이지마다 제목 · 설명을 다르게 써요 → 「고쳐 줘」", "빌더 페이지 설정 → SEO(검색) 칸에서 페이지마다 제목 · 설명을 따로 넣어요"],
  fix_title_long: ["제목은 30자, 설명은 80자 안으로 줄여요 → 「고쳐 줘」", "빌더 페이지 SEO 칸에서 줄여요. 문구는 컨셉 리포트에 있어요"],
  fix_h1: ["페이지마다 가장 큰 제목(H1)을 하나만 둬요 → 「고쳐 줘」", "빌더에서 첫 화면 큰 글씨를 「제목 1」로, 나머지 큰 글씨는 「제목 2」로 바꿔요"],
  fix_canonical: ["대표 주소가 자기 주소를 가리키게 해요 → 「고쳐 줘」", "빌더 SEO 설정의 「대표 URL(canonical)」 칸을 비우거나 그 페이지 주소로 둬요"],
  fix_og: ["공유 카드 이미지(1200×630)와 제목 · 설명을 넣어요 → 「고쳐 줘」", "빌더 SEO 설정의 「대표 이미지 · 공유 이미지」 칸에 1200×630 이미지를 넣어요"],
  fix_og_abs: ["공유 이미지 주소를 https:// 로 시작하는 전체 주소로 바꿔요 → 「고쳐 줘」", "빌더에 이미지를 다시 올려 보고, 안 되면 빌더 고객센터에 물어요"],
  fix_schema_who: ["홈에 누구인지 알려 주는 구조화 데이터(사람 · 단체 · 가게)를 넣어요 → 「고쳐 줘」", "빌더에 「구조화 데이터 · 헤더 코드 넣기」 칸이 있으면 붙일 코드를 드릴게요. 없으면 넘어가도 돼요"],
  fix_schema_more: ["이동경로 · SNS 주소(sameAs)를 더해요 → 「고쳐 줘」", "빌더에서 안 되면 넘어가도 돼요. 대신 SNS 프로필 링크를 사이트로 맞춰요"],
  fix_verify: ["검색엔진 등록 때 넣어요 → 「색인 등록 도와줘」", "검색엔진 등록 때 빌더의 「사이트 소유 확인」 칸에 넣어요 → 「색인 등록 도와줘」"],
  fix_text_js: ["핵심 문구를 글자로 넣고, 자바스크립트 없이도 보이게 미리 만드는 방식으로 지어요 → 「고쳐 줘」", "그림 안에 있는 문구를 「글자 칸」으로 다시 넣어요. 첫 화면 큰 문장부터요"],
  fix_text_thin: ["짧은 페이지에 그 페이지가 답하는 내용을 두세 문단 더해요 (말해 주신 사실만)", "짧은 페이지에 글 칸을 더해요. 그림 속 글씨는 글자 칸으로 옮겨요"],
  fix_nav: ["메뉴를 <a href> 링크로 바꿔요 → 「고쳐 줘」", "빌더 메뉴에 페이지를 「링크」로 연결해요 (버튼 동작 말고)"],
  fix_noindex: ["검색 금지(noindex)를 지워요 → 「고쳐 줘」", "빌더 페이지 설정에서 「검색 노출 안 함」을 꺼요"],
  fix_noindex_preview: ["미리보기 주소라 검색 금지가 붙어 있어요. 진짜 주소(배포 주소 · 도메인)로 다시 재요", "미리보기 · 임시 주소예요. 공개한 진짜 주소로 다시 재요"],
  fix_404: ["없는 주소는 404 로 답하게 해요 → 「고쳐 줘」", "빌더 설정에 404 페이지가 있는지 봐요. 없으면 넘어가도 돼요"],
  fix_viewport: ["모바일 화면 설정(viewport)을 넣어요 → 「고쳐 줘」", "빌더의 모바일 보기를 켜요"],
  fix_favicon: ["파비콘을 넣어요 (npm run icons) → 「고쳐 줘」", "빌더 설정의 「파비콘」 칸에 48px 이상 정사각 이미지를 넣어요"],
  fix_hreflang: ["다른 나라 말 첫 화면을 /en 처럼 따로 두고 언어 표시(hreflang)를 서로 걸어요 → 「고쳐 줘」", "빌더의 「다국어 · 언어 추가」 기능을 쓰면 보통 같이 붙어요. 기능이 없으면 영어 첫 화면 페이지를 하나 따로 만들어요"],
  fix_bot_block: ["방화벽 · CDN(예: Cloudflare)의 「AI 봇 차단」 스위치를 꺼요. 그 화면 조작은 직접 해요", "빌더 보안 설정이나 도메인 쪽(Cloudflare 등)의 「봇 차단」을 꺼요. 안 보이면 빌더 고객센터에 「AI 크롤러 허용」을 물어요"],
};
const fixText = (k) => (FIX[k] || ["", ""])[BUILDER ? 1 : 0];

/* ── 저장 · 리포트 ──────────────────────────────────────── */
function finish(R, pages, ctx) {
  R.sort((a, b) => a.id - b.id);
  for (const r of R) if (r.fix) r.how = fixText(r.fix);
  const count = { ok: 0, warn: 0, bad: 0, later: 0 };
  R.forEach((r) => count[r.level]++);
  const out = {
    date: new Date().toLocaleDateString("sv-SE"), url: ctx.origin, builder: BUILDER, local: ctx.local, preview: ctx.preview,
    count, ready: count.bad === 0 && !ctx.local && !ctx.preview,
    results: R,
    pages: pages.map((p) => ({ url: p.url, title: p.title, titleLen: len(p.title), description: p.description, descLen: len(p.description), h1: p.h1s, canonical: p.canonical, textLen: p.textLen, types: [...new Set(p.types)] })),
  };
  fs.mkdirSync(GEO, { recursive: true });
  fs.writeFileSync(path.join(GEO, "site-check.json"), JSON.stringify(out, null, 2) + "\n");
  const file = writeReport();
  console.log(`○ ${count.ok} · △ ${count.warn} · ✕ ${count.bad}${count.later ? ` · 나중에 ${count.later}` : ""}`);
  console.log(path.join(GEO, "site-check.json"));
  console.log(file);
}

main().catch((e) => { console.error("✕ " + e.message); process.exit(1); });
