// geo-skills · 이니 (iny) · https://iny-young.com · f20fb48b2423
// geo-site 리포트 두 장(설계안 · 점검표)이 같이 쓰는 모양. geo-concept 리포트와 같은 결.
export const CSS = `
:root{--bg:#f6f6f8;--paper:#fff;--ink:#1f1d26;--sub:#6b6878;--faint:#9a97a6;--line:#e8e6ee;--accent:#5b3fd1;--soft:#f1eefc;--warn:#8a5a0b;--warn-soft:#f8f1e2;--bad:#a1322c;--bad-soft:#f8e8e6;--ok:#1d7a4f;--ok-soft:#e6f4ec}
@media (prefers-color-scheme:dark){:root{--bg:#141319;--paper:#1c1b23;--ink:#e9e7f2;--sub:#a5a2b5;--faint:#77748a;--line:#2e2c39;--accent:#b3a1ff;--soft:#25213a;--warn:#e2b75c;--warn-soft:#2f2715;--bad:#ef8d85;--bad-soft:#351c1a;--ok:#7fd3a6;--ok-soft:#163025;color-scheme:dark}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:15px/1.75 -apple-system,"Apple SD Gothic Neo","Noto Sans KR",system-ui,sans-serif;word-break:keep-all;padding:0 16px}
.wrap{max-width:760px;margin:0 auto;padding:40px 0 80px}
.kicker{font-size:12.5px;color:var(--faint)}
h1{font-size:26px;line-height:1.35;margin:6px 0 14px;letter-spacing:-.01em;overflow-wrap:anywhere}
.lede{color:var(--sub);font-size:14.5px;margin:12px 0 0}
.score{display:flex;gap:8px;flex-wrap:wrap}.score .s{font-size:18px;font-weight:800;border-radius:12px;padding:6px 14px}.s.ok{background:var(--ok-soft);color:var(--ok)}.s.warn{background:var(--warn-soft);color:var(--warn)}.s.bad{background:var(--bad-soft);color:var(--bad)}.s.off{background:var(--paper);color:var(--faint);border:1px solid var(--line)}
.warnbox{background:var(--warn-soft);color:var(--warn);border-radius:12px;padding:12px 16px;font-size:13.5px;margin-top:16px}
section{margin-top:40px}
section > h2{font-size:19px;margin:0;display:flex;align-items:baseline;gap:10px}section > h2 .n{color:var(--accent);font-size:15px}
.what{font-size:13.5px;color:var(--sub);margin:4px 0 16px}
.box{background:var(--paper);border:1px solid var(--line);border-radius:16px;overflow:hidden}
.fix{padding:14px 18px;border-top:1px solid var(--line)}.box .fix:first-child{border-top:0}
.fix .h{display:flex;gap:8px;align-items:center}.fix .d{font-size:13.5px;color:var(--sub);margin-top:4px}.fix .how{font-size:14px;margin-top:6px;font-weight:600}.fix .pg{font-size:12px;color:var(--faint);margin-top:4px}
.row{display:grid;grid-template-columns:36px 1fr;gap:10px;align-items:start;padding:11px 18px;border-top:1px solid var(--line);font-size:14.5px}.box .row:first-child{border-top:0}.row .d{font-size:13px;color:var(--sub)}
.pill{display:inline-block;font-size:11.5px;font-weight:700;padding:1px 8px;border-radius:999px;white-space:nowrap;vertical-align:1px;text-align:center}.p-ok{background:var(--ok-soft);color:var(--ok)}.p-warn{background:var(--warn-soft);color:var(--warn)}.p-bad{background:var(--bad-soft);color:var(--bad)}.p-acc{background:var(--soft);color:var(--accent)}.p-off{background:var(--bg);color:var(--faint);border:1px solid var(--line)}
.steps{margin:0;padding:0;list-style:none;counter-reset:s;background:var(--paper);border:1px solid var(--line);border-radius:16px}
.steps li{counter-increment:s;display:flex;gap:12px;padding:12px 18px;border-top:1px solid var(--line);font-size:14.5px}.steps li:first-child{border-top:0}
.steps li::before{content:counter(s);flex:none;width:22px;height:22px;margin-top:2px;border-radius:50%;background:var(--soft);color:var(--accent);font-size:12px;font-weight:800;display:grid;place-items:center}
code{font-family:inherit;background:var(--soft);color:var(--accent);padding:1px 8px;border-radius:6px;font-weight:700}
.more{margin-top:40px;border-top:1px solid var(--line);padding-top:8px}
details{border-bottom:1px solid var(--line);padding:12px 2px}summary{cursor:pointer;font-weight:700;font-size:14.5px}summary span{font-weight:500;color:var(--faint);font-size:13px;margin-left:6px}
details table{width:100%;border-collapse:collapse;font-size:13px;margin-top:10px}details td,details th{text-align:left;padding:7px 8px;border-top:1px solid var(--line);vertical-align:top}details th{font-size:12px;color:var(--sub)}
@media (max-width:640px){h1{font-size:22px}}
`;
