#!/usr/bin/env node
// geo-skills · 이니 (iny) · https://iny-young.com · f20fb48b2423
/**
 * geo-site 설계 점검 (사용자 프로젝트 폴더에서 실행 · 짓기 전에)
 *
 *   node <skill>/scripts/plan.mjs
 *
 * geo/site-plan.json 을 점검하고 두 파일을 만든다. ✕ 가 있으면 짓기 전에 고친다.
 *   geo/site-plan.md   설계를 글로 정리한 것
 *   geo/design.md      분위기 · 색 · 글꼴 · 화면 규칙
 * 리포트는 따로 없다. 지은 뒤 check.mjs 가 사이트 리포트 하나를 만든다(설계 점검도 그 안에).
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GEO = path.join(process.cwd(), "geo");
const SRC = path.join(GEO, "site-plan.json");
const len = (s) => [...String(s || "")].length;
const BANNED = /최고|1위|넘버원|No\.?\s?1|#1|유일|업계 최다|국내 최초|완벽|보장|무조건|100%|\bbest\b|\bleading\b|最高|一番/gi;
const REGULATED = /치료|완치|효과 보장|부작용 없|통증 없|승소율|수익 보장|원금 보장|전후 사진|before\s*after/gi;
const SLUG = /^\/([a-z0-9]+(-[a-z0-9]+)*(\/[a-z0-9]+(-[a-z0-9]+)*)*)?$/;

function main() {
  if (!fs.existsSync(SRC)) throw new Error(`geo/site-plan.json 이 없어요: ${SRC}`);
  const p = JSON.parse(fs.readFileSync(SRC, "utf8"));
  const checks = lintPlan(p);
  fs.writeFileSync(path.join(GEO, "site-plan.md"), md(p));
  fs.writeFileSync(path.join(GEO, "design.md"), designMd(p.design || {}));
  const LV = { ok: "○", warn: "△", bad: "✕", info: "·" };
  for (const c of checks) console.log(`${LV[c.level]} ${c.label} · ${c.detail}`);
  const bad = checks.filter((x) => x.level === "bad");
  console.log(bad.length ? `✕ 고칠 것 ${bad.length}개 · 고친 뒤 다시 돌려요` : "짓기 전 점검 통과");
}
export const lintPlan = (p) => lint(p, readJson(path.join(GEO, "concept.json")), readJson(path.join(GEO, "site-copy.json")));
export const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, "utf8")); } catch { return null; } };
const pageText = (pg) => [pg.title, pg.description, pg.h1, pg.lead, ...(pg.sections || []).flatMap((s) => [s.heading, s.body, ...(s.items || []).flatMap((i) => (typeof i === "string" ? [i] : [i.title, i.body, i.q, i.a, i.k, i.v]))])].filter(Boolean).join(" ");

/* ── 점검 ─────────────────────────────────────────────── */
function lint(p, concept, copy) {
  const out = [];
  const add = (level, label, detail) => out.push({ level, label, detail });
  const pages = p.pages || [];
  if (!p.url) add("bad", "사이트 주소", "주소가 없어요. 무료 주소면 예정 이름으로 넣어요");
  else if (/-git-|localhost/.test(p.url)) add("bad", "사이트 주소", "미리보기 · 내 컴퓨터 주소예요. 진짜 주소로 넣어요");
  else add("ok", "사이트 주소", p.url);

  if (!pages.some((x) => x.slug === "/")) add("bad", "홈", "홈 페이지가 없어요");
  if (pages.length > 7) add("warn", "페이지 수", `${pages.length}개 · 처음엔 4~5개면 충분해요`);
  else add("ok", "페이지 수", `${pages.length}개`);

  const badSlug = pages.filter((x) => !SLUG.test(x.slug || ""));
  add(badSlug.length ? "bad" : "ok", "주소 모양", badSlug.length ? `영문 소문자 · 하이픈만: ${badSlug.map((x) => x.slug).join(", ")}` : "영문 소문자 · 하이픈 · 날짜 없음");
  const dupSlug = pages.map((x) => x.slug).filter((s, i, a) => a.indexOf(s) !== i);
  if (dupSlug.length) add("bad", "주소 겹침", dupSlug.join(", "));

  const longT = pages.filter((x) => len(x.title) > 30), longD = pages.filter((x) => len(x.description) > 80);
  const noT = pages.filter((x) => !x.title || !x.description);
  add(noT.length ? "bad" : longT.length || longD.length ? "warn" : "ok", "제목 · 설명 길이", noT.length ? `비었어요: ${noT.map((x) => x.menu).join(", ")}` : longT.length || longD.length ? [...longT.map((x) => `${x.menu} 제목 ${len(x.title)}자`), ...longD.map((x) => `${x.menu} 설명 ${len(x.description)}자`)].join(" · ") : "제목 30자 · 설명 80자 안");
  const dT = pages.map((x) => x.title).filter((s, i, a) => s && a.indexOf(s) !== i);
  const dD = pages.map((x) => x.description).filter((s, i, a) => s && a.indexOf(s) !== i);
  add(dT.length || dD.length ? "bad" : "ok", "페이지마다 다른 제목", dT.length || dD.length ? "제목이나 설명이 같은 페이지가 있어요" : "모두 달라요");
  const noH1 = pages.filter((x) => !x.h1);
  add(noH1.length ? "bad" : "ok", "가장 큰 제목 (H1)", noH1.length ? `없어요: ${noH1.map((x) => x.menu).join(", ")}` : "페이지마다 하나");

  const home = pages.find((x) => x.slug === "/");
  if (copy && home && copy.title && home.title !== copy.title) add("warn", "컨셉과 같은 제목", `홈 제목이 컨셉 리포트와 달라요 (컨셉: ${copy.title})`);
  if (home && !home.cta) add("warn", "다음 행동", "홈에 다음 행동(문의 · 예약 버튼)이 없어요");

  const all = pages.map(pageText).join(" ");
  const hype = [...new Set(all.match(BANNED) || [])];
  add(hype.length ? "bad" : "ok", "과장 낱말", hype.length ? hype.join(", ") : "없음");
  if (p.regulated) {
    const reg = [...new Set(all.match(REGULATED) || [])];
    add(reg.length ? "bad" : "ok", "규제 업종 표현", reg.length ? `${reg.join(", ")} · 광고 규정을 확인하기 전엔 빼요` : "쓰지 않는 말 없음");
  }
  const unsure = (concept?.evidence || []).filter((e) => e.status === "확인 필요");
  const hits = unsure.filter((e) => (String(e.item).match(/\d[\d,.]*/g) || []).some((n) => all.includes(n)));
  add(hits.length ? "bad" : "ok", "확인 안 된 숫자", hits.length ? hits.map((e) => e.item).join(" · ") : "없음");
  const live = pages.filter((x) => !x.hold);
  const empty = live.filter((x) => !["/", "/blog"].includes(x.slug) && (x.sections || []).length > 0 && (x.sections || []).every((s) => s.type === "todo"));
  if (empty.length) add("warn", "빈 페이지", `채울 것만 있어요: ${empty.map((x) => x.menu).join(", ")} · 사실을 받을 때까지 빼 둘 수 있어요 (hold)`);
  const held = pages.filter((x) => x.hold);
  if (held.length) add("info", "빼 둔 페이지", `${held.map((x) => x.menu).join(", ")} · 사실을 받으면 넣어요`);
  const slugs = new Set(live.map((x) => x.slug));
  const links = live.flatMap((x) => [x.cta?.href, ...(x.sections || []).flatMap((s) => [s.href, ...(s.items || []).map((i) => i?.href)])].filter((h) => h && h.startsWith("/")).map((h) => ({ from: x.menu, h })));
  const broken = links.filter((l) => !slugs.has(l.h.replace(/\/$/, "") || "/"));
  add(broken.length ? "bad" : "ok", "안쪽 링크", broken.length ? broken.map((l) => `${l.from} → ${l.h} (없는 페이지)`).join(" · ") : "버튼 · 링크가 모두 있는 페이지로 가요");
  const todos = pages.flatMap((x) => (x.sections || []).filter((s) => s.type === "todo"));
  if (todos.length) add("info", "채울 것", `${todos.length}개 · 사실을 받으면 채워요 (빈칸은 사이트에 안 나가요)`);
  return out;
}

/* ── 글 ───────────────────────────────────────────────── */
function md(p) {
  const L = [];
  L.push(`# 설계 · ${p.name}`, "", `${p.date || ""} · ${p.url} · ${p.method || ""}`, "", `> ${p.oneLine || ""}`, "");
  L.push("## 페이지", "", "| 페이지 | 주소 | 누가 보나 | 검색하는 말 | 첫 화면 답 | 다음 행동 |", "|---|---|---|---|---|---|");
  for (const x of p.pages || []) L.push(`| ${x.menu} | ${x.slug} | ${x.who || ""} | ${x.keyword || ""} | ${x.answer || ""} | ${x.next || ""} |`);
  L.push("", "## 제목 · 설명", "");
  for (const x of p.pages || []) L.push(`- **${x.menu}** (${x.slug})`, `  - 제목: ${x.title}`, `  - 설명: ${x.description}`, `  - H1: ${x.h1}`);
  const todos = (p.pages || []).flatMap((x) => (x.sections || []).filter((s) => s.type === "todo").map((s) => `- ${x.menu}: ${s.note}`));
  if (todos.length) L.push("", "## 채울 것", "", ...todos);
  if (Object.keys(p.locales || {}).length) L.push("", "## 다른 나라 말", "", ...Object.entries(p.locales).map(([c, l]) => `- /${c} · ${l.title}`));
  L.push("", "## 주소 규칙", "", "- 영문 소문자 + 하이픈 · 날짜 없음 · 끝에 / 없음", "- 한 번 정하면 바꾸지 않는다 (바꾸면 검색에 쌓인 게 처음부터)", "");
  return L.join("\n");
}
function designMd(d) {
  return `# 디자인 · ${d.mood || ""}

| 칸 | 값 |
|---|---|
| 분위기 | ${d.mood || ""} |
| 색 | ${d.colorName || ""} · 대표 ${d.colors?.main || ""} · 강조 ${d.colors?.accent || ""} · 바탕 ${d.colors?.bg || ""} · 글자 ${d.colors?.ink || ""} |
| 글꼴 | ${d.fontName || ""} · 제목 ${d.fonts?.heading || ""} · 본문 ${d.fonts?.body || ""} |
| 모서리 | ${d.shape === "square" ? "각지게" : "둥글게"} |

## 지킬 것
- 핵심 문구는 이미지가 아니라 글자로 넣는다
- 페이지마다 가장 큰 제목(H1)은 하나
- 메뉴 · 버튼은 실제 링크(<a href>)로
- 색을 바꿀 땐 src/styles/site.css 맨 위 네 줄만 바꾼다
`;
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  try { main(); } catch (e) { console.error("✕ " + e.message); process.exit(1); }
}
