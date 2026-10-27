# 디자인 묶음

업종에 맞는 세 개를 골라 Q7 · Q8 · Q9 선택지로 쓴다. preview 에 값을 보여 준다.

## Q7 분위기 (→ shape)
| 분위기 | 어울리는 곳 | shape |
|---|---|---|
| 따뜻한 · 손으로 만든 · 차분한 | 공방 · 카페 · 베이커리 · 수업 | round |
| 깔끔한 · 믿음직한 · 전문적인 | 병원 · 법률 · 회사 · 컨설팅 | square |
| 밝은 · 경쾌한 · 친근한 | 여행 · 키즈 · 반려동물 · 행사 | round |
| 조용한 · 단정한 · 글 중심 | 개인 · 강사 · 작가 · 연구 | square |

## Q8 색 (main · accent · bg · ink)
| 이름 | main | accent | bg | ink | 분위기 |
|---|---|---|---|---|---|
| 원목 갈색 + 크림 | #6b4f36 | #b7834d | #faf7f2 | #2a2420 | 따뜻한 |
| 숲 초록 + 미색 | #2f5d4a | #c48a3f | #f8f7f2 | #1f2622 | 따뜻한 · 조용한 |
| 남색 + 흰색 | #1f3a5f | #3b82c4 | #ffffff | #1b2330 | 믿음직한 |
| 청록 + 연회색 | #13675f | #2e9c8f | #f7f9f9 | #1a2524 | 깔끔한 · 병원 |
| 단청 빨강 + 한지 | #a63a2b | #d9a441 | #fbf8f2 | #2a211d | 한국적 · 여행 |
| 귤색 + 흰색 | #b8501f | #2c7da0 | #fffdf9 | #262321 | 경쾌한 |
| 먹색 + 종이 | #2b2b2b | #8a6d3b | #faf9f6 | #1d1d1d | 글 중심 |

- 위 표는 글자 · 바탕, 버튼 흰 글자 · 대표색 모두 대비 4.5:1 이상이에요. 로고 색처럼 받은 색이 밝으면 버튼 글자가 안 읽힐 수 있다고 한 줄 말하고 조금 진하게 바꿔요.
- 「로고 색이 있어요」면 그 색을 main 으로, 나머지는 가까운 묶음에서.

## Q9 글꼴 (heading + body · 모두 무료 · 한글)
| 이름 | heading | body | 느낌 |
|---|---|---|---|
| 고운바탕 + 프리텐다드 | Gowun Batang | Pretendard | 따뜻한 손글씨 느낌 제목 |
| 프리텐다드 하나로 | Pretendard | Pretendard | 깔끔 · 무난 |
| 본명조 + 프리텐다드 | Noto Serif KR | Pretendard | 단정 · 글 중심 |
| IBM Plex Sans KR | IBM Plex Sans KR | IBM Plex Sans KR | 반듯 · 전문적 |
| 고운돋움 하나로 | Gowun Dodum | Gowun Dodum | 둥글 · 친근 |
| 나눔명조 + 본고딕 | Nanum Myeongjo | Noto Sans KR | 차분 · 고전적 |

build.mjs 가 아는 이름은 위 일곱 개(Pretendard · Noto Sans KR · IBM Plex Sans KR · Gowun Dodum · Noto Serif KR · Gowun Batang · Nanum Myeongjo). 다른 글꼴을 원하면 짓고 나서 site.css 에서 바꾼다.

## 이미지
- 공유 카드(og.png 1200×630)와 파비콘은 `npm run icons` 가 이름 · 짧은 소개로 그린다.
- 직접 만들고 싶으면 이미지 AI 프롬프트를 준다:
  「1200×630 가로 이미지. (이름)의 공유 카드. 바탕 (bg), 가운데 (이름)을 크게, 아래 (짧은 소개) 한 줄. 글자는 적게, 사진 없이.」
  → `site/public/og.png` 로 넣기.
- 사진은 사람이 넣는다. 핵심 문구를 사진 안에 넣지 않는다.
