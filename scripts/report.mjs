#!/usr/bin/env node
// geo-skills · 이니 (iny) · https://iny-young.com · f20fb48b2423
/**
 * geo-site 사이트 리포트 (사용자 프로젝트 폴더에서 실행 · 보통은 check.mjs 가 부른다)
 *
 *   node <skill>/scripts/report.mjs
 *
 * 리포트는 하나다. 있는 것만 담는다.
 *   geo/site-plan.json   페이지 · 디자인 · 채울 것 · 설계 점검 (짓기로 만든 경우)
 *   geo/site-check.json  점검 결과 (내 컴퓨터 주소 또는 올린 주소)
 * → geo/site-report.html. 열 파일 경로를 마지막 줄에 찍는다. 외부로 아무것도 보내지 않는다.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { CSS } from "./style.mjs";
import { lintPlan, readJson } from "./plan.mjs";

const GEO = path.join(process.cwd(), "geo");
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const len = (s) => [...String(s || "")].length;
const short = (u) => { try { const x = new URL(u); return x.pathname === "/" ? "홈" : x.pathname; } catch { return u; } };
const MARK = { ok: ["○", "p-ok", "통과"], warn: ["△", "p-warn", "고치면 좋아요"], bad: ["✕", "p-bad", "고쳐요"], later: ["–", "p-off", "등록 때"], info: ["·", "p-acc", ""] };

export function writeReport() {
  const plan = readJson(path.join(GEO, "site-plan.json"));
  const check = readJson(path.join(GEO, "site-check.json"));
  if (!plan && !check) throw new Error("geo/site-plan.json 도 geo/site-check.json 도 없어요");
  const out = path.join(GEO, "site-report.html");
  fs.writeFileSync(out, html(plan, check, plan ? lintPlan(plan) : []));
  return out;
}

function html(p, ck, lint) {
  const build = p && p.mode !== "check" && !ck?.builder;
  const local = ck ? ck.local : true;
  const live = ck && !ck.local && !ck.preview;
  const open = ck?.url || "";
  const pages = p?.pages || [];
  const todos = pages.filter((x) => !x.hold).flatMap((x) => (x.sections || []).filter((s) => s.type === "todo").map((s) => ({ page: x.menu, note: s.note })));
  const held = pages.filter((x) => x.hold);
  const bad = ck ? ck.results.filter((r) => r.level === "bad") : [];
  const fixes = ck ? ck.results.filter((r) => r.level === "bad").concat(ck.results.filter((r) => r.level === "warn")) : [];
  const planBad = lint.filter((c) => c.level === "bad");

  // 맨 위
  const name = p?.name || (ck ? ck.url.replace(/^https?:\/\//, "") : "");
  const state = !ck ? "지었어요 · 아직 점검 전" : live ? `올렸어요 · ${ck.url.replace(/^https?:\/\//, "")}` : ck.preview ? "미리보기 주소예요 · 진짜 주소로 다시 재요" : build ? "내 컴퓨터에서 지었어요 · 아직 안 올렸어요" : "내 컴퓨터 주소로 잰 결과예요";
  const top = `<div class="kicker">사이트 리포트 · ${esc(ck?.date || p?.date || "")}${ck?.builder ? " · 빌더 사이트" : ""}</div>
<h1>${esc(name)}</h1>
${p?.oneLine ? `<div class="me"><span class="k">컨셉에서 정한 한 줄</span><div class="one">${esc(p.oneLine)}</div>
<div class="who">${p.url ? `<span><b>올릴 주소</b>${esc(p.url.replace(/^https?:\/\//, ""))}</span>` : ""}<span><b>페이지</b>${pages.length - held.length}개${held.length ? ` (+ 빼 둔 ${held.length})` : ""}</span>${p.design?.mood ? `<span><b>디자인</b>${esc(p.design.mood)}</span>` : ""}</div></div>` : ""}
<div class="state"><span class="dot ${live ? "on" : ""}"></span><b>지금</b> ${esc(state)}${open && (local || live) ? `<a class="openbtn" href="${esc(open)}" target="_blank">${local ? "내 사이트 열기 ↗" : "사이트 열기 ↗"}</a>` : ""}${local && build ? `<div class="hint">안 열리면 내 컴퓨터의 사이트 서버가 꺼진 거예요. Claude Code 에 <code>내 사이트 열어 줘</code> 라고 하거나, site 폴더에서 <code>npm run dev</code></div>` : ""}</div>
${ck ? `<div class="score"><span class="s ok">○ ${ck.count.ok}</span><span class="s warn">△ ${ck.count.warn}</span><span class="s bad">✕ ${ck.count.bad}</span>${ck.count.later ? `<span class="s off">– ${ck.count.later}</span>` : ""}</div>` : ""}`;

  // ① 지금 할 일
  const steps = [];
  if (planBad.length) steps.push(`설계 점검 ✕ ${planBad.length}개를 먼저 고쳐요 → <code>고쳐 줘</code>`);
  if (bad.length) steps.push(ck.builder ? `✕ ${bad.length}개를 빌더 관리 화면에서 고쳐요 (아래 ③)` : `✕ ${bad.length}개를 고쳐요 → <code>고쳐 줘</code>`);
  if (build && !live) steps.push(`사이트를 열어 보고 바꿀 것을 말해요 · 예: <code>첫 문장 바꿔 줘</code> <code>색 더 밝게</code> · 새로고침하면 바로 보여요`);
  if (todos.length) steps.push(`채울 것 ${todos.length}개 · 사실을 알려 주시면 넣어요 (아래 ②)`);
  if (build && !live) steps.push(`다 됐으면 <code>올릴래요</code> → 올리는 법을 알려 드려요. 나중에 올려도 돼요`);
  if (ck?.builder) steps.push(`다 고치면 <code>내 사이트 점검해 줘</code> 로 다시 재요${bad.length ? "" : " · ✕ 가 없으면 <code>색인 등록 도와줘</code>"}`);
  if (live && !bad.length) steps.push(`검색엔진에 등록해요 → <code>색인 등록 도와줘</code>`);
  if (live) steps.push(`큰 수정을 한 뒤에는 <code>내 사이트 점검해 줘</code> 로 다시 재요`);
  const now = `<section><h2><span class="n">①</span>지금 할 일</h2><ol class="steps">${steps.map((s) => `<li><span>${s}</span></li>`).join("")}</ol></section>`;

  // ② 페이지
  const base = (live ? ck.url : open || p?.url || "").replace(/\/$/, "");
  const card = (x) => {
    const t = (x.sections || []).filter((s) => s.type === "todo");
    return `<div class="pg${x.hold ? " held" : ""}"><div class="pg-h"><b>${esc(x.menu)}</b><small>${esc(x.slug)}</small>${x.hold ? `<span class="pill p-warn">사실을 받을 때까지 빼 둠</span>` : base ? `<a href="${esc(base + (x.slug === "/" ? "/" : x.slug))}" target="_blank">열기 ↗</a>` : ""}</div>
<div class="serp"><div class="u">${esc((p.url || "").replace(/^https?:\/\//, ""))}${x.slug === "/" ? "" : esc(x.slug)}</div><div class="h">${esc(x.title)} <span class="pill ${len(x.title) > 30 ? "p-warn" : "p-off"}">${len(x.title)}자</span></div><div class="d">${esc(x.description)} <span class="pill ${len(x.description) > 80 ? "p-warn" : "p-off"}">${len(x.description)}자</span></div></div>
<div class="row"><span class="k">첫 화면 답<small>가장 큰 제목</small></span><span><b>${esc(x.h1)}</b>${x.keyword ? `<div class="sm">검색하는 말 · ${esc(x.keyword)}</div>` : ""}</span></div>
${t.length ? `<div class="row fill"><span class="k">채울 것</span><span>${t.map((s) => esc(s.note)).join("<br>")}</span></div>` : ""}</div>`;
  };
  const pageSec = pages.length ? `<section><h2><span class="n">②</span>페이지</h2><p class="what">회색 칸은 검색 결과에 이렇게 보인다는 미리보기예요. 「채울 것」은 사이트에 안 나가요. 사실을 알려 주시면 채워요.</p>${pages.map(card).join("")}</section>` : "";

  // ③ 점검
  const n3 = pages.length ? "③" : "②";
  const fixBox = fixes.length ? `<div class="box">${fixes.map((r) => `<div class="fix"><div class="h"><span class="pill ${MARK[r.level][1]}">${MARK[r.level][0]} ${MARK[r.level][2]}</span><b>${esc(r.name)}</b></div><div class="d">${esc(r.detail)}</div>${r.how ? `<div class="how">→ ${esc(r.how)}</div>` : ""}${r.pages?.length ? `<div class="pgs">${[...new Set(r.pages.map((u) => (/^https?:/.test(u) ? short(u) : u)))].slice(0, 6).map(esc).join(" · ")}</div>` : ""}</div>`).join("")}</div>` : `<div class="okbox">검색엔진과 AI 가 읽는 데 막힌 곳이 없어요.</div>`;
  const checkSec = ck ? `<section><h2><span class="n">${n3}</span>검색엔진 · AI 가 읽을 수 있나</h2><p class="what">${local ? (ck.builder ? "내 컴퓨터 주소로 받아 봤어요." : "내 컴퓨터 주소로 받아 봤어요. 올린 뒤 진짜 주소로 다시 재면 이 칸이 바뀌어요.") : ck.preview ? "미리보기 주소예요. 미리보기에는 검색 금지가 붙어 있어요." : "올린 주소를 실제로 받아 봤어요."}${ck.builder ? " 빌더 관리 화면에서 직접 바꿔요. 붙일 문구는 컨셉 리포트에 있어요." : fixes.length ? " 「고쳐 줘」라고 하면 위에서부터 고쳐요." : ""}</p>${fixBox}</section>` : "";

  // ④ 올리기
  const n4 = pages.length ? "④" : "③";
  const deploy = build && !live ? `<section><h2><span class="n">${n4}</span>올리기 <span class="opt">올릴 때만</span></h2><p class="what">이건 직접 해 주세요. 10분이면 돼요. 올린 주소를 이 창에 붙이면 진짜 주소로 다시 재요.</p><ol class="steps">
<li><span>github.com 가입 · vercel.com 에서 <b>Continue with GitHub</b></span></li>
<li><span>GitHub 에 저장소를 만들고 <code>site</code> 폴더를 올려요 · 준비는 <code>git 준비해 줘</code></span></li>
<li><span>Vercel <b>Add New → Project</b> → 그 저장소 <b>Import</b> → <b>Deploy</b></span></li>
<li><span>나온 주소(○○.vercel.app)를 이 창에 붙여요 · <b>-git-</b> 이 들어간 주소는 미리보기라 안 돼요</span></li></ol></section>` : "";

  // 접어 둔 것
  const LV = (l) => MARK[l] || MARK.info;
  const more = `<div class="more">
${ck ? `<details><summary>14가지 점검 + AI 봇 <span>○ ${ck.count.ok} · △ ${ck.count.warn} · ✕ ${ck.count.bad}</span></summary><table>${ck.results.map((r) => `<tr><td><span class="pill ${LV(r.level)[1]}">${LV(r.level)[0]}</span></td><td><b>${r.id >= 15 ? "+ " : ""}${esc(r.name)}</b></td><td>${esc(r.detail)}</td></tr>`).join("")}</table></details>` : ""}
${ck?.pages?.length ? `<details><summary>페이지별 점검 <span>${ck.pages.length}개</span></summary><table><tr><th>주소</th><th>제목</th><th>글자</th></tr>${ck.pages.map((x) => `<tr><td>${esc(short(x.url))}</td><td>${esc(x.title)} <span class="pill ${x.titleLen > 30 ? "p-warn" : "p-off"}">${x.titleLen}자</span></td><td>${x.textLen}</td></tr>`).join("")}</table></details>` : ""}
${lint.length ? `<details${planBad.length ? " open" : ""}><summary>짓기 전 점검 <span>${planBad.length ? `✕ ${planBad.length}` : "통과"}</span></summary><table>${lint.map((c) => `<tr><td><span class="pill ${LV(c.level)[1]}">${LV(c.level)[0]}</span></td><td><b>${esc(c.label)}</b></td><td>${esc(c.detail)}</td></tr>`).join("")}</table></details>` : ""}
${p?.design ? `<details><summary>디자인 <span>${esc(p.design.colorName || "")} · ${esc(p.design.fontName || "")}</span></summary><div class="sws">${["main", "accent", "bg", "ink"].map((k, i) => p.design.colors?.[k] ? `<span class="sw"><i style="background:${esc(p.design.colors[k])}"></i>${["대표", "강조", "바탕", "글자"][i]}<small>${esc(p.design.colors[k])}</small></span>` : "").join("")}</div><ol><li>색은 site/src/styles/site.css 맨 위에서 바꿔요</li><li>핵심 문구는 그림 말고 글자로 넣어요</li></ol></details>` : ""}
${build ? `<details><summary>자동으로 넣은 기본기 <span>8가지</span></summary><ol><li>페이지마다 다른 제목 · 설명</li><li>대표 주소(canonical) · 공유 카드(1200×630)</li><li>robots.txt (검색엔진 · AI 봇을 막지 않아요) · 사이트맵</li><li>누구인지 알려 주는 구조화 데이터 · 이동경로 · SNS 주소</li><li>파비콘 · 404 페이지 · 모바일 화면</li>${Object.keys(p.locales || {}).length ? "<li>다른 나라 말 첫 화면 + 언어 표시(hreflang)</li>" : ""}<li>글이 생기면 글마다 구조화 데이터 · 사이트맵에 자동으로</li><li>검색엔진 소유 확인 태그 자리 (등록 때 채워요)</li><li>분석 태그(GA4 · Clarity)는 넣지 않았어요. 사이트를 연 뒤 따로 심어요</li></ol></details>` : ""}
${pages.length ? `<details><summary>메뉴 · 주소 <span>${pages.length}개</span></summary><table>${pages.map((x) => `<tr><td>${esc(x.menu)}</td><td>${esc(x.slug)}${x.hold ? " · 빼 둠" : ""}</td></tr>`).join("")}</table><ol><li>영문 소문자 + 하이픈 · 날짜 없음 · 끝에 / 없음</li><li>한 번 정하면 바꾸지 않아요</li></ol></details>` : ""}
${p?.answers?.length ? `<details><summary>내가 답한 것 <span>${p.answers.length}개</span></summary><table>${p.answers.map((a) => `<tr><td>${esc(a.step)}</td><td>${esc(a.q)}</td><td><b>${esc(a.a)}</b></td></tr>`).join("")}</table></details>` : ""}
</div>`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="generator" content="geo-site · 이니 (iny-young.com) · f20fb48b2423"><title>사이트 리포트 · ${esc(name)}</title><style>${CSS}${EXTRA}</style></head><body><div class="wrap">${top}${now}${pageSec}${checkSec}${deploy}${more}</div></body></html>`;
}

const EXTRA = `
.me{background:var(--paper);border:1.5px solid var(--accent);border-radius:14px;padding:16px 18px;margin-bottom:14px}.me .k{display:block;font-size:12px;color:var(--accent);font-weight:700;margin-bottom:4px}.me .one{font-size:18px;font-weight:800;line-height:1.5}
.who{display:flex;flex-wrap:wrap;gap:6px 16px;margin-top:10px;font-size:13.5px;color:var(--sub)}.who b{color:var(--ink);font-weight:700;margin-right:4px}
.state{display:flex;flex-wrap:wrap;align-items:center;gap:6px 10px;background:var(--paper);border:1px solid var(--line);border-radius:12px;padding:10px 14px;font-size:14px;margin-bottom:12px}
.state .dot{width:9px;height:9px;border-radius:50%;background:var(--warn)}.state .dot.on{background:var(--ok)}
.openbtn{margin-left:auto;background:var(--accent);color:#fff;text-decoration:none;font-weight:700;font-size:13px;border-radius:8px;padding:6px 12px}
.state .hint{flex-basis:100%;font-size:12.5px;color:var(--sub)}
.opt{font-size:12px;font-weight:600;color:var(--faint)}
.okbox{background:var(--ok-soft);color:var(--ok);border-radius:12px;padding:12px 16px;font-weight:700}
.fix .pgs{font-size:12px;color:var(--faint);margin-top:4px}
.pg{background:var(--paper);border:1px solid var(--line);border-radius:16px;overflow:hidden;margin-bottom:12px}
.pg-h{display:flex;gap:10px;align-items:baseline;padding:11px 18px;border-bottom:1px solid var(--line)}.pg-h b{font-size:15.5px}.pg-h small{color:var(--faint)}.pg-h a,.pg-h .pill{margin-left:auto;font-size:12.5px;font-weight:700;color:var(--accent);text-decoration:none}
.serp{padding:12px 18px;background:var(--bg)}.serp .u{font-size:12px;color:var(--faint)}.serp .h{font-size:17px;color:#1a0dab;line-height:1.4;margin:2px 0}.serp .d{font-size:13px;color:var(--sub)}
@media (prefers-color-scheme:dark){.serp .h{color:#8ab4f8}}
.pg .row{display:grid;grid-template-columns:110px 1fr;gap:12px;padding:10px 18px;border-top:1px solid var(--line);font-size:14.5px}
.pg .row .k{font-size:12.5px;color:var(--sub);font-weight:700;padding-top:2px}.pg .row .k small{display:block;font-weight:500;color:var(--faint)}.pg .sm{font-size:12.5px;color:var(--sub);margin-top:2px}
.pg .row.fill{background:var(--warn-soft)}.pg .row.fill .k{color:var(--warn)}.pg.held{opacity:.6}
.sws{display:flex;flex-wrap:wrap;gap:10px;margin-top:10px}.sw{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700}.sw i{width:22px;height:22px;border-radius:6px;border:1px solid var(--line)}.sw small{font-weight:500;color:var(--faint)}
details ol{margin:10px 0 0;padding-left:20px;font-size:13.5px;color:var(--sub)}
@media (max-width:640px){.pg .row{grid-template-columns:1fr;gap:2px}.openbtn{margin-left:0}}
`;

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1]);
if (isMain) {
  try { console.log(writeReport()); } catch (e) { console.error("✕ " + e.message); process.exit(1); }
}
