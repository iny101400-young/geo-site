#!/usr/bin/env node
// geo-skills · 이니 (iny) · https://iny-young.com · f20fb48b2423
/**
 * geo-site 짓기 (사용자 프로젝트 폴더에서 실행)
 *
 *   node <skill>/scripts/build.mjs            site/ 를 새로 만든다 (있으면 멈춤)
 *   node <skill>/scripts/build.mjs --update   site/ 의 문구 · 설정 파일만 다시 쓴다 (글 · 사진은 그대로)
 *
 * geo/site-plan.json 을 읽어 site/ 에 Astro 사이트를 만든다.
 * 기본기(제목 · 설명 · 대표 주소 · 공유 카드 · 구조화 데이터 · robots · 사이트맵 · 파비콘 · 404)는 여기서 넣는다.
 * 설치(npm install)와 아이콘 그리기(npm run icons)는 그다음에 따로 한다. 외부로 아무것도 보내지 않는다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = process.cwd();
const PLAN = path.join(ROOT, "geo", "site-plan.json");
const OUT = path.join(ROOT, "site");
const UPDATE = process.argv.includes("--update");

function main() {
  if (!fs.existsSync(PLAN)) throw new Error(`geo/site-plan.json 이 없어요: ${PLAN}`);
  const p = JSON.parse(fs.readFileSync(PLAN, "utf8"));
  if (!p.url) throw new Error("site-plan.json 에 url(사이트 주소)이 없어요. 무료 주소면 예정 이름으로 넣어요 (예: https://gyeol-wood.vercel.app)");
  if (fs.existsSync(path.join(OUT, "package.json")) && !UPDATE) throw new Error("site/ 가 이미 있어요. 문구만 바꾸려면 --update 를 붙여요");

  const site = siteData(p);
  const files = {
    "src/site.json": JSON.stringify(site, null, 2) + "\n",
    "astro.config.mjs": ASTRO_CONFIG(site.url),
    "vercel.json": JSON.stringify({ cleanUrls: true, trailingSlash: false }, null, 2) + "\n",
    "src/layouts/Base.astro": BASE.replace(JSON.stringify("__FONTS__"), JSON.stringify(fontLinks(site.design))),
    "src/components/Blocks.astro": BLOCKS,
    "src/components/Page.astro": PAGE,
    "src/pages/404.astro": NOT_FOUND,
    "src/pages/robots.txt.ts": ROBOTS,
    "src/pages/sitemap.xml.ts": SITEMAP,
    "src/styles/site.css": css(site.design),
    "scripts/icons.mjs": ICONS,
  };
  // 페이지 파일: 홈은 index, 나머지는 주소 그대로
  for (const pg of site.pages) {
    if (pg.id === "blog") continue;
    const file = pg.slug === "/" ? "src/pages/index.astro" : `src/pages${pg.slug}.astro`;
    files[file] = `---\nimport Page from "${rel(file, "src/components/Page.astro")}";\n---\n<Page id="${pg.id}" />\n`;
  }
  if (site.pages.some((x) => x.id === "blog")) {
    files["src/content.config.ts"] = CONTENT_CONFIG;
    files["src/pages/blog.astro"] = BLOG_INDEX;
    files["src/pages/blog/[slug].astro"] = BLOG_POST;
  }
  for (const code of Object.keys(site.locales)) {
    files[`src/pages/${code}.astro`] = `---\nimport Page from "../components/Page.astro";\n---\n<Page id="home" locale="${code}" />\n`;
  }

  const once = {
    "package.json": JSON.stringify(PKG(site), null, 2) + "\n",
    ".gitignore": "node_modules/\ndist/\n.astro/\n.vercel/\n.DS_Store\n",
    "public/.gitkeep": "",
    "src/content/blog/.gitkeep": "",
    "README.md": SITE_README(site),
  };

  // 설계안에서 빠진(또는 빼 둔) 페이지 파일은 지운다. 스킬이 만든 틀(<Page id=…>)만 지우고 직접 만든 페이지는 둔다.
  if (UPDATE) {
    for (const f of walk(path.join(OUT, "src/pages"))) {
      const r = path.relative(OUT, f).split(path.sep).join("/");
      if (!files[r] && /\.astro$/.test(r) && /^---\nimport Page from .*\n---\n<Page id="[^"]+"( locale="[^"]+")? \/>\n$/.test(fs.readFileSync(f, "utf8"))) { fs.rmSync(f); console.log(`지움: ${r}`); }
    }
  }
  for (const [f, body] of Object.entries(files)) write(f, body);
  for (const [f, body] of Object.entries(once)) if (!fs.existsSync(path.join(OUT, f))) write(f, body);

  console.log(`페이지 ${site.pages.length}개${Object.keys(site.locales).length ? ` · 다른 나라 말 ${Object.keys(site.locales).join(", ")}` : ""}`);
  console.log("다음: cd site && npm install && npm run icons && npm run build");
  console.log(OUT);
}

const rel = (from, to) => {
  const r = path.relative(path.dirname(from), to).split(path.sep).join("/");
  return r.startsWith(".") ? r : "./" + r;
};
function walk(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
}
function write(f, body) {
  const full = path.join(OUT, f);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, body);
}

/* ── 설계안 → 사이트 데이터 ──────────────────────────────── */
function siteData(p) {
  const url = String(p.url).replace(/\/+$/, "");
  // hold: 사실을 받을 때까지 빼 둔 페이지 (짓지 않음 · 메뉴 · 사이트맵에도 없음)
  const pages = (p.pages || []).filter((pg) => !pg.hold).map((pg) => ({
    id: pg.id,
    slug: pg.slug,
    menu: pg.menu || "",
    inMenu: pg.inMenu !== false && pg.slug !== "/",
    title: pg.title,
    description: pg.description,
    h1: pg.h1 || pg.answer || pg.title,
    lead: pg.lead || "",
    sections: (pg.sections || []).filter((s) => s.type !== "todo"),
    cta: pg.cta || null,
  }));
  return {
    url,
    lang: "ko",
    name: p.name,
    nameEn: p.nameEn || "",
    type: p.type === "person" ? "person" : "brand",
    schemaType: p.schemaType || (p.type === "person" ? "Person" : "Organization"),
    oneLine: p.oneLine || "",
    introShort: p.introShort || "",
    keyword: p.keyword || "",
    area: p.area || "",
    regulated: !!p.regulated,
    sameAs: (p.sameAs || []).filter(Boolean),
    contact: p.contact || {},
    verify: { google: "", naver: "", bing: "", ...(p.verify || {}) },
    ogImage: "/og.png",
    design: p.design || {},
    pages,
    locales: Object.fromEntries(Object.entries(p.locales || {}).map(([code, l]) => [code, {
      title: l.title, description: l.description, h1: l.h1 || l.oneLine, lead: l.lead || l.introShort || "",
      sections: l.sections || [], cta: l.cta || null, menu: l.menu || "English",
    }])),
  };
}

/* ── 디자인 → CSS ────────────────────────────────────────── */
const FONT_STACK = {
  Pretendard: `"Pretendard Variable",Pretendard,-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif`,
  "Noto Sans KR": `"Noto Sans KR",-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif`,
  "IBM Plex Sans KR": `"IBM Plex Sans KR",-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif`,
  "Gowun Dodum": `"Gowun Dodum",-apple-system,"Apple SD Gothic Neo","Malgun Gothic",sans-serif`,
  "Noto Serif KR": `"Noto Serif KR","AppleMyungjo","Batang",serif`,
  "Gowun Batang": `"Gowun Batang","AppleMyungjo","Batang",serif`,
  "Nanum Myeongjo": `"Nanum Myeongjo","AppleMyungjo","Batang",serif`,
};
export const fontLinks = (d = {}) => {
  const fams = [...new Set([d.fonts?.heading, d.fonts?.body].filter(Boolean))];
  const out = [];
  if (fams.includes("Pretendard")) out.push("https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css");
  const g = fams.filter((f) => f !== "Pretendard" && FONT_STACK[f]);
  if (g.length) out.push(`https://fonts.googleapis.com/css2?${g.map((f) => `family=${f.replace(/ /g, "+")}:wght@400;700`).join("&")}&display=swap`);
  return out;
};
export function css(d = {}) {
  const c = { main: "#2f4a6d", accent: "#c9733a", bg: "#fbfaf8", ink: "#1f1f24", ...(d.colors || {}) };
  const head = FONT_STACK[d.fonts?.heading] || FONT_STACK.Pretendard;
  const body = FONT_STACK[d.fonts?.body] || FONT_STACK.Pretendard;
  const r = d.shape === "square" ? "4px" : "14px";
  return `:root{--main:${c.main};--accent:${c.accent};--bg:${c.bg};--ink:${c.ink};--sub:color-mix(in srgb,var(--ink) 66%,var(--bg));--line:color-mix(in srgb,var(--ink) 12%,var(--bg));--soft:color-mix(in srgb,var(--main) 8%,var(--bg));--r:${r};--head:${head};--body:${body}}
*{box-sizing:border-box}html{-webkit-text-size-adjust:100%}
body{margin:0;background:var(--bg);color:var(--ink);font:16px/1.8 var(--body);word-break:keep-all;overflow-wrap:anywhere}
a{color:var(--main)}img{max-width:100%;height:auto}
.in{max-width:960px;margin:0 auto;padding:0 20px}
header{border-bottom:1px solid var(--line)}header .in{display:flex;align-items:center;justify-content:space-between;gap:16px;min-height:64px;flex-wrap:wrap}
.brand{font-family:var(--head);font-weight:700;font-size:18px;color:var(--ink);text-decoration:none}
nav ul{display:flex;flex-wrap:wrap;gap:4px 18px;list-style:none;margin:0;padding:0}nav a{color:var(--sub);text-decoration:none;font-size:15px}nav a[aria-current]{color:var(--ink);font-weight:700}
main{padding:0 0 72px}
.hero{padding:72px 0 56px}.hero h1{font-family:var(--head);font-size:clamp(28px,5vw,42px);line-height:1.35;margin:0 0 18px;letter-spacing:-.01em;max-width:22em}
.hero .lead{font-size:18px;color:var(--sub);max-width:36em;margin:0 0 28px}
.page-h{padding:56px 0 24px}.page-h h1{font-family:var(--head);font-size:clamp(26px,4vw,34px);line-height:1.4;margin:0 0 12px}.page-h .lead{color:var(--sub);font-size:17px;margin:0;max-width:38em}
.btn{display:inline-block;background:var(--main);color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:var(--r)}
section.b{padding:32px 0;border-top:1px solid var(--line)}section.b h2{font-family:var(--head);font-size:22px;line-height:1.45;margin:0 0 14px}
section.b p{margin:0 0 12px;max-width:40em}
.cards{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:14px;list-style:none;margin:0;padding:0}
.cards li{background:var(--soft);border-radius:var(--r);padding:18px 20px}.cards h3{font-size:17px;margin:0 0 6px}.cards p{margin:0;color:var(--sub);font-size:15px}
ul.list,ol.steps{margin:0;padding-left:22px;max-width:40em}ul.list li,ol.steps li{margin:6px 0}
.faq h3{font-size:17px;margin:18px 0 6px}.faq p{color:var(--sub)}
dl.info{display:grid;grid-template-columns:7em 1fr;gap:8px 16px;margin:0}dl.info dt{color:var(--sub)}dl.info dd{margin:0}
.crumb{font-size:13px;color:var(--sub);padding-top:20px}.crumb a{color:var(--sub)}
.posts{list-style:none;margin:0;padding:0}.posts li{padding:16px 0;border-top:1px solid var(--line)}.posts a{font-weight:700;text-decoration:none;font-size:18px}.posts p{margin:4px 0 0;color:var(--sub);font-size:15px}.posts time{font-size:13px;color:var(--sub)}
article.post{max-width:42em}article.post h2{font-family:var(--head);margin:36px 0 10px}
footer{border-top:1px solid var(--line);padding:28px 0 40px;font-size:14px;color:var(--sub)}footer .in{display:flex;flex-wrap:wrap;gap:8px 24px;justify-content:space-between}footer ul{display:flex;flex-wrap:wrap;gap:4px 14px;list-style:none;margin:0;padding:0}footer a{color:var(--sub)}
@media (max-width:640px){.hero{padding:48px 0 40px}dl.info{grid-template-columns:1fr}}
`;
}

/* ── 사이트 파일 틀 ──────────────────────────────────────── */
const PKG = (s) => ({
  name: (s.nameEn || "my-site").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "my-site",
  type: "module",
  private: true,
  scripts: { dev: "astro dev", build: "astro build", preview: "astro preview", icons: "node scripts/icons.mjs" },
  dependencies: { astro: "^5.18.2" },
  devDependencies: { sharp: "^0.34.0" },
});

const ASTRO_CONFIG = (url) => `// geo-site 가 만든 설정 · 주소(site)를 바꾸면 대표 주소 · 사이트맵이 같이 바뀐다
import { defineConfig } from "astro/config";

export default defineConfig({
  site: "${url}",
  trailingSlash: "never",
  build: { format: "file" },
  devToolbar: { enabled: false },
});
`;

const BASE = `---
// 모든 페이지의 머리(head). 제목 · 설명 · 대표 주소 · 공유 카드 · 구조화 데이터를 여기서 넣는다.
import site from "../site.json";
import "../styles/site.css";

interface Props { title: string; description: string; path: string; lang?: string; noindex?: boolean; schema?: object[]; alternates?: { lang: string; path: string }[]; ogType?: string }
const { title, description, path, lang = "ko", noindex = false, schema = [], alternates = [], ogType = "website" } = Astro.props;
const abs = (p: string) => site.url + (p === "/" ? "/" : p);
const canonical = abs(path);
const og = site.url + site.ogImage;
const fonts: string[] = ${JSON.stringify("__FONTS__")};
const menu = site.pages.filter((p) => p.inMenu);
const here = Astro.url.pathname.replace(/\\.html$/, "").replace(/\\/index$/, "/") || "/";
---
<!doctype html>
<html lang={lang}>
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>{title}</title>
<meta name="description" content={description} />
<link rel="canonical" href={canonical} />
{noindex && <meta name="robots" content="noindex" />}
{alternates.map((a) => <link rel="alternate" hreflang={a.lang} href={abs(a.path)} />)}
{alternates.length > 0 && <link rel="alternate" hreflang="x-default" href={abs("/")} />}
<meta property="og:type" content={ogType} />
<meta property="og:site_name" content={site.name} />
<meta property="og:title" content={title} />
<meta property="og:description" content={description} />
<meta property="og:url" content={canonical} />
<meta property="og:image" content={og} />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
<link rel="icon" href="/favicon.ico" sizes="48x48" />
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="apple-touch-icon" href="/apple-touch-icon.png" />
{site.verify.google && <meta name="google-site-verification" content={site.verify.google} />}
{site.verify.naver && <meta name="naver-site-verification" content={site.verify.naver} />}
{site.verify.bing && <meta name="msvalidate.01" content={site.verify.bing} />}
{fonts.map((f) => <link rel="stylesheet" href={f} />)}
{schema.map((s) => <script type="application/ld+json" set:html={JSON.stringify(s)} />)}
</head>
<body>
<header><div class="in">
  <a class="brand" href="/">{site.name}</a>
  <nav aria-label="메뉴"><ul>
    {menu.map((p) => <li><a href={p.slug} aria-current={here === p.slug || here.startsWith(p.slug + "/") ? "page" : undefined}>{p.menu}</a></li>)}
    {Object.entries(site.locales).map(([code, l]) => <li><a href={"/" + code} hreflang={code}>{l.menu}</a></li>)}
  </ul></nav>
</div></header>
<main><div class="in"><slot /></div></main>
<footer><div class="in">
  <span>© {new Date().getFullYear()} {site.name}</span>
  {site.sameAs.length > 0 && <ul>{site.sameAs.map((u) => <li><a href={u} rel="me">{new URL(u).hostname.replace(/^www\\./, "")}</a></li>)}</ul>}
</div></footer>
</body>
</html>
`;

const BLOCKS = `---
// 페이지 본문 칸. site.json 의 sections 를 순서대로 그린다.
interface Props { sections: any[] }
const { sections } = Astro.props;
---
{sections.map((s) => (
  <section class="b">
    {s.heading && <h2>{s.heading}</h2>}
    {s.type === "text" && String(s.body || "").split(/\\n\\n+/).map((p) => <p>{p}</p>)}
    {s.type === "list" && <ul class="list">{(s.items || []).map((i) => <li>{i}</li>)}</ul>}
    {s.type === "steps" && <ol class="steps">{(s.items || []).map((i) => <li>{i}</li>)}</ol>}
    {s.type === "cards" && <ul class="cards">{(s.items || []).map((i) => <li><h3>{i.title}</h3>{i.body && <p>{i.body}</p>}</li>)}</ul>}
    {s.type === "faq" && <div class="faq">{(s.items || []).map((i) => <><h3>{i.q}</h3><p>{i.a}</p></>)}</div>}
    {s.type === "info" && <dl class="info">{(s.items || []).map((i) => <><dt>{i.k}</dt><dd>{i.href ? <a href={i.href}>{i.v}</a> : i.v}</dd></>)}</dl>}
    {s.type === "cta" && <p><a class="btn" href={s.href}>{s.label}</a></p>}
  </section>
))}
`;

const PAGE = `---
// 페이지 하나. 홈은 첫 화면(한 줄 + 답 + 다음 행동), 나머지는 제목 + 이동경로.
import Base from "../layouts/Base.astro";
import Blocks from "./Blocks.astro";
import site from "../site.json";

interface Props { id: string; locale?: string }
const { id, locale } = Astro.props;
const base = site.pages.find((p) => p.id === id)!;
const l = locale ? (site.locales as any)[locale] : null;
const pg = l ? { ...base, slug: "/" + locale, title: l.title, description: l.description, h1: l.h1, lead: l.lead, sections: l.sections, cta: l.cta } : base;
const isHome = id === "home";
const abs = (p: string) => site.url + (p === "/" ? "/" : p);
const orgId = site.url + "/#" + (site.type === "person" ? "person" : "org");

const who: any = {
  "@context": "https://schema.org",
  "@type": site.schemaType,
  "@id": orgId,
  name: site.name,
  url: site.url + "/",
  description: site.oneLine,
  image: site.url + site.ogImage,
};
if (site.nameEn) who.alternateName = site.nameEn;
if (site.sameAs.length) who.sameAs = site.sameAs;
if (site.type !== "person") who.logo = site.url + "/icon-512.png";
if (site.contact.phone) who.telephone = site.contact.phone;
if (site.contact.email) who.email = site.contact.email;
if (site.contact.address) who.address = { "@type": "PostalAddress", streetAddress: site.contact.address, addressCountry: "KR" };
if (site.area && site.schemaType !== "Person" && site.schemaType !== "Organization") who.areaServed = site.area;

const schema: object[] = [];
if (isHome) {
  schema.push(who, { "@context": "https://schema.org", "@type": "WebSite", name: site.name, url: site.url + "/", inLanguage: locale || "ko", publisher: { "@id": orgId } });
} else {
  schema.push({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "홈", item: abs("/") },
    { "@type": "ListItem", position: 2, name: pg.menu || pg.title, item: abs(pg.slug) },
  ] });
}
const codes = Object.keys(site.locales);
const alternates = isHome && codes.length ? [{ lang: "ko", path: "/" }, ...codes.map((c) => ({ lang: c, path: "/" + c }))] : [];
---
<Base title={pg.title} description={pg.description} path={pg.slug} lang={locale || "ko"} schema={schema} alternates={alternates}>
  {isHome ? (
    <div class="hero">
      <h1>{pg.h1}</h1>
      {pg.lead && <p class="lead">{pg.lead}</p>}
      {pg.cta && <a class="btn" href={pg.cta.href}>{pg.cta.label}</a>}
    </div>
  ) : (
    <>
      <p class="crumb"><a href="/">홈</a> › {pg.menu || pg.title}</p>
      <div class="page-h"><h1>{pg.h1}</h1>{pg.lead && <p class="lead">{pg.lead}</p>}</div>
    </>
  )}
  <Blocks sections={pg.sections} />
  {!isHome && pg.cta && <section class="b"><a class="btn" href={pg.cta.href}>{pg.cta.label}</a></section>}
</Base>
`;

const NOT_FOUND = `---
import Base from "../layouts/Base.astro";
---
<Base title="페이지를 찾을 수 없어요" description="주소가 바뀌었거나 없는 페이지예요." path="/404" noindex>
  <div class="page-h"><h1>페이지를 찾을 수 없어요</h1><p class="lead">주소가 바뀌었거나 없는 페이지예요.</p></div>
  <p><a class="btn" href="/">홈으로</a></p>
</Base>
`;

const ROBOTS = `// 검색엔진과 AI 봇을 막지 않는다. 사이트맵 주소를 알려 준다.
import site from "../site.json";
export const GET = () => new Response(\`User-agent: *\\nAllow: /\\n\\nSitemap: \${site.url}/sitemap.xml\\n\`, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
`;

const SITEMAP = `// 공개 주소만 담는다. 글이 0편이면 글 모음은 빼 둔다(빈 페이지).
import site from "../site.json";
import { getCollection } from "astro:content";

export async function GET() {
  const hasBlog = site.pages.some((p) => p.id === "blog");
  const posts = hasBlog ? (await getCollection("blog")).filter((p) => !p.data.draft) : [];
  const abs = (p: string) => site.url + (p === "/" ? "/" : p);
  const urls = site.pages.filter((p) => p.id !== "blog" || posts.length > 0).map((p) => ({ loc: abs(p.slug) }));
  for (const code of Object.keys(site.locales)) urls.push({ loc: abs("/" + code) });
  for (const p of posts) urls.push({ loc: abs("/blog/" + p.id), lastmod: (p.data.updated || p.data.date).toISOString().slice(0, 10) });
  const body = \`<?xml version="1.0" encoding="UTF-8"?>\\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\\n\${urls.map((u: any) => \`  <url><loc>\${u.loc}</loc>\${u.lastmod ? \`<lastmod>\${u.lastmod}</lastmod>\` : ""}</url>\`).join("\\n")}\\n</urlset>\\n\`;
  return new Response(body, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
}
`;

const CONTENT_CONFIG = `// 글은 src/content/blog/ 에 .md 로 둔다. 파일 이름이 주소가 된다 (영문 소문자 · 하이픈).
import { defineCollection, z } from "astro:content";
import { glob } from "astro/loaders";

const blog = defineCollection({
  loader: glob({ pattern: "**/*.md", base: "./src/content/blog" }),
  schema: z.object({
    title: z.string(),
    description: z.string(),
    date: z.coerce.date(),
    updated: z.coerce.date().optional(),
    draft: z.boolean().default(false),
  }),
});

export const collections = { blog };
`;

const BLOG_INDEX = `---
import Base from "../layouts/Base.astro";
import Blocks from "../components/Blocks.astro";
import site from "../site.json";
import { getCollection } from "astro:content";

const pg = site.pages.find((p) => p.id === "blog")!;
const posts = (await getCollection("blog")).filter((p) => !p.data.draft).sort((a, b) => +b.data.date - +a.data.date);
const schema = [{ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
  { "@type": "ListItem", position: 1, name: "홈", item: site.url + "/" },
  { "@type": "ListItem", position: 2, name: pg.menu, item: site.url + pg.slug },
] }];
---
<Base title={pg.title} description={pg.description} path={pg.slug} schema={schema} noindex={posts.length === 0}>
  <p class="crumb"><a href="/">홈</a> › {pg.menu}</p>
  <div class="page-h"><h1>{pg.h1}</h1>{pg.lead && <p class="lead">{pg.lead}</p>}</div>
  {posts.length === 0 ? <p>아직 글이 없어요.</p> : (
    <ul class="posts">{posts.map((p) => (
      <li><a href={"/blog/" + p.id}>{p.data.title}</a><p>{p.data.description}</p><time datetime={p.data.date.toISOString().slice(0, 10)}>{p.data.date.toISOString().slice(0, 10)}</time></li>
    ))}</ul>
  )}
  <Blocks sections={pg.sections} />
</Base>
`;

const BLOG_POST = `---
import Base from "../../layouts/Base.astro";
import site from "../../site.json";
import { getCollection, render } from "astro:content";

export async function getStaticPaths() {
  const posts = (await getCollection("blog")).filter((p) => !p.data.draft);
  return posts.map((post) => ({ params: { slug: post.id }, props: { post } }));
}
const { post } = Astro.props;
const { Content } = await render(post);
const path = "/blog/" + post.id;
const blog = site.pages.find((p) => p.id === "blog")!;
const orgId = site.url + "/#" + (site.type === "person" ? "person" : "org");
const schema = [
  { "@context": "https://schema.org", "@type": "BlogPosting", headline: post.data.title, description: post.data.description,
    datePublished: post.data.date.toISOString().slice(0, 10), dateModified: (post.data.updated || post.data.date).toISOString().slice(0, 10),
    mainEntityOfPage: site.url + path, author: { "@id": orgId }, publisher: { "@id": orgId }, image: site.url + site.ogImage, inLanguage: "ko" },
  { "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: [
    { "@type": "ListItem", position: 1, name: "홈", item: site.url + "/" },
    { "@type": "ListItem", position: 2, name: blog.menu, item: site.url + blog.slug },
    { "@type": "ListItem", position: 3, name: post.data.title, item: site.url + path },
  ] },
];
---
<Base title={post.data.title + " | " + site.name} description={post.data.description} path={path} schema={schema} ogType="article">
  <p class="crumb"><a href="/">홈</a> › <a href={blog.slug}>{blog.menu}</a></p>
  <article class="post">
    <div class="page-h"><h1>{post.data.title}</h1><p class="lead"><time datetime={post.data.date.toISOString().slice(0, 10)}>{post.data.date.toISOString().slice(0, 10)}</time></p></div>
    <Content />
  </article>
</Base>
`;

const ICONS = `// 파비콘 · 공유 카드(og.png) 그리기. 한 번 그린 뒤엔 public/ 의 파일을 쓴다 (다시 그리려면 지우고 실행).
// 로고나 공유 카드 이미지가 따로 있으면 public/ 에 같은 이름으로 넣으면 된다.
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import site from "../src/site.json" with { type: "json" };

const pub = new URL("../public/", import.meta.url);
const at = (f) => fileURLToPath(new URL(f, pub)); // 한글 폴더에서도 깨지지 않게
const has = (f) => fs.existsSync(at(f));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const c = { main: "#2f4a6d", bg: "#fbfaf8", ink: "#1f1f24", ...(site.design.colors || {}) };
const FONT = "Pretendard, Apple SD Gothic Neo, Malgun Gothic, Noto Sans KR, sans-serif";
const letter = [...(site.name || "?")][0];

const icon = \`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" rx="104" fill="\${c.main}"/><text x="256" y="345" text-anchor="middle" font-family="\${FONT}" font-size="290" font-weight="700" fill="#fff">\${esc(letter)}</text></svg>\`;
if (!has("favicon.svg")) fs.writeFileSync(at("favicon.svg"), icon);
const src = fs.readFileSync(at("favicon.svg"));
for (const [f, n] of [["icon-512.png", 512], ["apple-touch-icon.png", 180], ["icon-48.png", 48]]) {
  if (!has(f)) await sharp(src, { density: 300 }).resize(n, n).png().toFile(at(f));
}
// favicon.ico = 48px PNG 한 장을 담은 ICO
if (!has("favicon.ico")) {
  const png = fs.readFileSync(at("icon-48.png"));
  const h = Buffer.alloc(22);
  h.writeUInt16LE(0, 0); h.writeUInt16LE(1, 2); h.writeUInt16LE(1, 4);
  h.writeUInt8(48, 6); h.writeUInt8(48, 7); h.writeUInt16LE(1, 10); h.writeUInt16LE(32, 12);
  h.writeUInt32LE(png.length, 14); h.writeUInt32LE(22, 18);
  fs.writeFileSync(at("favicon.ico"), Buffer.concat([h, png]));
}
// 공유 카드 1200×630 · 이름 + 짧은 소개
if (!has("og.png")) {
  const wrap = (s, n) => { const w = String(s).split(" "); const out = [""]; for (const x of w) { if ((out.at(-1) + " " + x).trim().length > n) out.push(x); else out[out.length - 1] = (out.at(-1) + " " + x).trim(); } return out.slice(0, 2); };
  const lines = wrap(site.introShort || site.oneLine, 26);
  const og = \`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="\${c.bg}"/><rect x="0" y="0" width="16" height="630" fill="\${c.main}"/><text x="96" y="\${lines.length > 1 ? 260 : 290}" font-family="\${FONT}" font-size="76" font-weight="700" fill="\${c.ink}">\${esc(site.name)}</text>\${lines.map((l, i) => \`<text x="96" y="\${(lines.length > 1 ? 350 : 380) + i * 54}" font-family="\${FONT}" font-size="38" fill="\${c.ink}" fill-opacity=".7">\${esc(l)}</text>\`).join("")}</svg>\`;
  await sharp(Buffer.from(og)).png().toFile(at("og.png"));
}
console.log("public/ 에 favicon.svg · favicon.ico · apple-touch-icon.png · icon-512.png · og.png");
`;

const SITE_README = (s) => `# ${s.name} 사이트

geo-site 로 지은 사이트예요. Astro 로 만들어져 있어요.

| 하고 싶은 것 | 명령 |
|---|---|
| 내 컴퓨터에서 보기 | \`npm run dev\` → 화면에 나온 주소를 열어요 |
| 올리기 전 만들어 보기 | \`npm run build\` |
| 파비콘 · 공유 카드 다시 그리기 | \`public/\` 의 그림을 지우고 \`npm run icons\` |

- 문구는 \`src/site.json\` 에 모여 있어요. 바꾼 뒤 Claude Code 에서 「내 사이트 점검해 줘」로 다시 재요.
- 글은 \`src/content/blog/\` 에 \`.md\` 로 넣어요. 파일 이름이 주소가 돼요 (영문 소문자 · 하이픈).
- 로고 · 공유 카드가 따로 있으면 \`public/\` 에 같은 이름(favicon.svg · og.png)으로 넣어요.
`;

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  try { main(); } catch (e) { console.error("✕ " + e.message); process.exit(1); }
}
