# 올리기 (사람이 해요)

## 채팅 문구 (그대로)
```
이제 올려요. 이건 직접 해 주세요. (10분)

1. github.com 에 가입해요 (이미 있으면 넘어가요)
2. vercel.com 에서 「Sign Up」 → 「Continue with GitHub」
3. GitHub 에 새 저장소를 만들고 site 폴더를 올려요
   (원하면 올리기 직전까지는 제가 준비해요 · 「git 준비해 줘」)
4. Vercel 에서 「Add New → Project」 → 그 저장소 「Import」 → 「Deploy」
   설정은 건드리지 않아도 돼요 (Astro 로 알아서 잡혀요)
5. 끝나면 나오는 주소(○○.vercel.app)를 이 창에 붙여 주세요 → 바로 점검할게요

주의: 「-git-」 이 들어간 주소는 미리보기예요. 검색 금지가 붙어 있어요.
점검과 등록은 진짜 주소(○○.vercel.app 또는 내 도메인)로 해요.
```

## 「git 준비해 줘」 (스킬이 하는 것)
- `site/` 에서 `git init` · `git add -A` · 첫 커밋.
- GitHub 저장소 만들기 · 푸시 · 로그인은 사람이. 명령 두 줄만 준다:
  `git remote add origin https://github.com/(아이디)/(저장소).git` · `git push -u origin main`

## 주소 이름이 다를 때
Vercel 이 정한 주소가 설계 때 이름과 다르면(이미 누가 씀) 받은 주소로 site-plan.json 의 url 을 바꾸고 `build.mjs --update` → 다시 올린다(GitHub 에 올리면 Vercel 이 다시 짓는다). 대표 주소 · 사이트맵이 그 주소로 바뀐다.

## 도메인 붙이기 (5단계)
```
1. 도메인을 사요 (가비아 · 호스팅케이알 · Cloudflare · Namecheap 등 어디든)
2. Vercel 프로젝트 → Settings → Domains → 도메인 입력 → Add
3. Vercel 이 알려 주는 두 줄(A 또는 CNAME)을 도메인 산 곳의 DNS 설정에 넣어요
4. 기다려요 (몇 분 ~ 하루)
5. https:// 로 열리는지 보고, 이 창에 새 주소를 붙여 주세요
```
- www 있는 주소와 없는 주소 중 하나를 대표로(Vercel 이 다른 쪽을 넘겨 줌).
- 도메인을 붙이면 site-plan.json url 을 바꾸고 `build.mjs --update` → 다시 올리기 → 점검.

## 꼭 확인
- Cloudflare 를 앞에 두었다면 「AI 봇 차단(Block AI bots)」 스위치가 꺼져 있는지.
- Vercel 프로젝트의 「Deployment Protection」이 진짜 주소에 켜져 있지 않은지(켜져 있으면 로그인 화면이 나와요).
