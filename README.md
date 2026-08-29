# 미국 기조적 물가

헤드라인 물가에서 일시적 소음을 걷어낸 **기조적(underlying) 물가 지표**들을 한 곳에 모은
정적 사이트입니다. 댈러스 연준 **Trimmed Mean PCE**, 헤드라인·Core PCE, 주거비 제외 근원 CPI를
포함한 CPI 계열 4종, 애틀랜타 연준 **Sticky·Flexible** 4종을 1967년부터 비교합니다.

여기에 더해, 연준이 13개월치만 공개하는 **품목별 가격 변화 분포**와 **3% 초과 항목 비중**을
BEA 원자료에서 1977년까지 직접 복원해 함께 보여줍니다.

**한국어·일본어** 두 언어를 지원합니다. 우측 상단 버튼으로 전환하거나 `?lang=ja` / `?lang=ko`
로 직접 링크할 수 있고, 선택은 브라우저에 기억됩니다.

## 실행

```bash
npm run selftest       # 산술 검증 (BEA 키 불필요)
npm run distribution   # BEA 원데이터에서 품목별 분포를 복원 → data/distribution.json
npm run fetch          # FRED/BLS에서 시계열을 받아 public/data.js 생성
npm start              # http://localhost:5173
```

`npm run verify` 는 분포를 계산만 하고 검증 결과를 출력합니다(파일을 쓰지 않음).
`npm run build` 는 distribution → fetch 를 순서대로 돌립니다.

데이터를 한 번 받아두면 `public/index.html`을 브라우저로 직접 열어도 동작합니다
(데이터를 `.json`이 아니라 `data.js`로 굽는 이유가 이것입니다 — `file://`에서는 fetch가 막힙니다).

`npm run distribution` 을 먼저 돌려야 합니다. `fetch-data.mjs` 가 `data/distribution.json` 을
읽어 사이트 페이로드에 합치기 때문입니다. 없으면 분포 카드만 빠진 채로 빌드됩니다.

## API 키

| 키 | 필수 | 발급처 | 용도 |
|---|---|---|---|
| `FRED_API_KEY` | 예 | [fred.stlouisfed.org](https://fred.stlouisfed.org/docs/api/api_key.html) | PCE 계열 전체, Sticky, `USREC` |
| `BEA_API_KEY` | 예 | [apps.bea.gov/API/signup](https://apps.bea.gov/API/signup/) | 품목별 분포 복원 |
| `BLS_API_KEY` | 아니오 | [bls.gov/developers](https://www.bls.gov/developers/) | 있으면 BLS API v2 사용 |

`.env` 에 넣으면 됩니다(gitignore 대상). **BEA 키는 발급 메일의 활성화 링크를 눌러야 동작합니다** —
누르기 전에는 `This UserId is not active` 오류가 납니다.

`BLS_API_KEY`는 없어도 동작합니다(키 없는 v1로 폴백). 다만 v1은 **IP당** 하루 25회 제한이라
공유 IP를 쓰는 CI 러너에서는 남의 워크플로우와 한도를 나눠 쓰게 됩니다.

## 3% 초과 비중은 왜 직접 계산하나

댈러스 연준은 이 분포(0–2 / 2–3 / 3–5 / 5–10 / 10% 초과 구간별 지출가중 비중)를
[PCE 페이지](https://www.dallasfed.org/research/pce)의 `pcedata.xlsx` 한 파일로만 공개하는데,
그 파일에는 **최근 13개월치만** 들어 있습니다. 과거 이력 파일은 없고, 웹아카이브에도 이 파일의
스냅샷이 한 건도 없어 예전 창을 되살릴 수 없습니다.

그래서 `scripts/build-distribution.mjs` 가 같은 원자료에서 같은 방법론으로 전체 기간을 다시
계산합니다.

- **원자료**: BEA 표 2.4.4U(품목별 가격지수, `U20404`)와 2.4.5U(품목별 명목지출, `U20405`),
  1977년부터.
- **품목 목록**: 댈러스 연준이 매달 새로 올리는 `detail` 워크북에서 **실시간으로** 읽습니다.
  tech.pdf(2009년 개정판)의 178개 목록은 이제 낡았습니다 — 현재는 **177개**이고, 임차주택 2개
  항목이 하나로 합쳐졌으며 17개 이름이 바뀌었습니다(`Fresh Fruit`→`Fruit (fresh)`,
  `Taxicabs`→`Taxicabs and ride sharing services`, `Intercity`→`Intracity mass transit` 등).
  `lib/dallasfed-components.json` 은 그 워크북을 못 받을 때를 위한 폴백으로만 남겨뒀습니다.
- **방법론**: 댈러스 연준 Working Paper 0506, 그리고 연준이 직접 공개한 Matlab 함수
  [`tmrates.txt`](https://www.dallasfed.org/~/media/documents/research/pce/tmrates.txt).
  월별 가격변화 `dP = (P_t − P_{t−1}) / P_{t−1}`, 가중치는
  `w = ½·(Q_t·P_{t−1} / Σ) + ½·(Q_{t−1}·P_{t−1} / Σ)` 를 정규화한 값이고 `Q = N / P` 입니다.
  절사는 하위 24%·상위 31%이며, 절사점에 걸친 품목의 **부분 가중치**까지 원본대로 반영합니다.
- **구간**: `dP` 를 연율화(`(1+dP)^12 − 1`)해 반열린구간 `[lo, hi)` 로 나눕니다. 어느 구간에도
  들지 않는 나머지가 **하락** 품목이며, 연준 차트의 5개 막대 합이 100%가 아니라 70% 안팎인
  이유가 이것입니다.

### 검증

산술과 매핑을 분리해서 검증합니다. **`npm run selftest` 은 BEA 없이** 연준이 공개한 당월
품목별 값만으로 산술을 검증하므로, 이게 통과하는데 복원값이 안 맞으면 원인은 매핑 하나로
좁혀집니다.

```
$ npm run selftest
1. bucket shares for 2026-07, recomputed from the component detail
   above 3%  computed  52.17   published  52.17   dev  0.00   -> PASS
2. trimmed mean for 2026-07, 24% off the bottom / 31% off the top
   computed   2.21   published   2.20 (2026-07)   dev  0.01   -> PASS
3. trim points
   bottom 24% ends at  Air transportation (-0.45%, cum 24.01%)
   top 31% starts at  Other purchased meals (3.53%, cum 69.48%)   -> PASS
```

`npm run verify` 는 여기에 BEA 매핑까지 얹어 3단계로 확인합니다.

1. **품목별 대조** — 복원한 가중치와 월간 가격변화를 연준 `detail` 파일의 당월 값과 품목마다
   비교합니다. 1%p 넘게 어긋난 품목은 이름과 BEA 라인까지 찍어주므로 잘못 붙은 매핑이 바로
   드러납니다.
2. **공표 13개월 대조** — `pcedata.xlsx` 의 3% 초과 비중과 월별 비교.
3. **절사평균 역산** — 같은 가중치로 절사평균을 다시 만들어 FRED `PCETRIM12M159SFRBDAL`
   전 구간과 비교.

`--strict` 를 붙이면 매핑 실패나 허용오차 초과 시 파일을 쓰지 않고 실패합니다.

`--if-changed` 는 연준의 13개월 창(20KB)만 먼저 읽고, 커밋된 분포가 그 창을 기준으로 만들어진
것과 **정확히 일치하면 BEA를 아예 호출하지 않고 종료**합니다. BEA 하위상세 표는 10번 호출에
약 109MB인데 할당량이 **100MB/분**이라, 매일 전부 받으면 마지막 요청이 걸립니다. 그래서 새 달이
나왔거나 개정이 있을 때만 BEA로 갑니다(요청 간격도 8초씩 띄웁니다). CI는 `--fresh --strict
--if-changed` 로 돕니다.

### "3% 초과 비중"이 두 개인 이유

사이트에 3% 초과 비중이 두 번 나오는데, **기준 기간이 다릅니다.**

| | 분포 카드 | 확산 카드 |
|---|---|---|
| 변화율 | 연율화 **1개월** | **전년 대비(12개월)** |
| 선 | 지출가중 1개 (+6구간 밴드) | 지출가중 · 비가중 **2개** |
| 2026-07 | 52.0% | 63.7% / 54.2% |

앞은 댈러스 연준이 자기 사이트에 올리는 분포 차트를 그대로 복원한 것이라 연준이 쓰는
1개월 연율 기준을 따릅니다. 뒤는 "바구니의 얼마가 1년째 뜨거운가"를 보는 지표라 전년 대비
기준이고, 항목 수로만 센 비가중 선을 같이 그립니다 — **가중이 비가중보다 높으면 지출이 큰
항목일수록 많이 오르고 있다**는 뜻입니다. 두 지표 모두 같은 BEA 원자료·같은 177개 품목에서
나옵니다.

매핑이 틀린 품목이 있으면 `lib/bea-mapping.json` 에 이름→BEA 라인번호로 덮어쓸 수 있습니다.

```json
{ "byName": { "Fruit (fresh)": 54 } }
```

## 자동 갱신

`.github/workflows/update.yml` 이 **매일 14:20 UTC**(미 동부 오전 9:20 / 겨울 10:20)에 실행됩니다.
BEA 개인소득·지출과 BLS CPI 모두 미 동부 오전 8:30에 발표되므로 그 뒤입니다.

발표일에만 맞추지 않고 매일 도는 이유는, 발표일이 매달 바뀌고 수정발표가 비정기적으로 나오며
BEA 개정이 있을 때마다 댈러스 연준이 절사평균을 다시 내기 때문입니다. 대신 **값이 실제로 바뀌었을
때만 커밋**합니다 — `generatedAt` 타임스탬프는 데이터가 변했을 때만 갱신되므로, 변화가 없는 날은
출력 파일이 바이트 단위로 동일해 아무 기록도 남지 않습니다.

### 저장소 준비

이 폴더는 아직 git 저장소가 아닙니다. 배포하려면:

```bash
git init && git add -A && git commit -m "Trimmed Mean PCE viewer"
gh repo create us-underlying-inflation --public --source=. --push
gh secret set FRED_API_KEY --body '<키>'
gh secret set BEA_API_KEY  --body '<키>'
gh secret set BLS_API_KEY  --body '<키>'   # 선택
```

그 다음 저장소 Settings → Pages → Source 를 **GitHub Actions** 로 바꾸면 됩니다.

> GitHub은 저장소가 60일간 활동이 없으면 예약 워크플로우를 자동으로 비활성화합니다.
> PCE가 매달 나오니 보통은 커밋이 계속 생겨 문제없습니다.

## 데이터 출처

| 계열 | ID | 출처 |
|---|---|---|
| Trimmed Mean PCE (12개월) | `PCETRIM12M159SFRBDAL` | 댈러스 연준 |
| Trimmed Mean PCE (1·6개월 연율) | `PCETRIM1M158SFRBDAL`, `PCETRIM6M680SFRBDAL` | 댈러스 연준 |
| 헤드라인 PCE | `PCEPI` | BEA |
| Core PCE | `PCEPILFE` | BEA |
| CPI less food, shelter, and energy | `CUUR0000SA0L12E` / `CUSR0000SA0L12E` | BLS |
| Core CPI | `CUUR0000SA0L1E` / `CUSR0000SA0L1E` | BLS |
| 헤드라인 CPI | `CUUR0000SA0` / `CUSR0000SA0` | BLS |
| 주거비 | `CUUR0000SAH1` / `CUSR0000SAH1` | BLS |
| Core Sticky CPI | `CORESTICKM159SFRBATL` | 애틀랜타 연준 |
| Sticky CPI (전체) | `STICKCPIM159SFRBATL` | 애틀랜타 연준 |
| Core Sticky CPI ex shelter | `CRESTKCPIXSLTRM159SFRBATL`, `...679...` | 애틀랜타 연준 |
| Flexible CPI | `FLEXCPIM159SFRBATL` | 애틀랜타 연준 |
| 품목별 가격·지출 | `U20404`, `U20405` | BEA |
| 경기침체 구간 | `USREC` | NBER / FRED |

PCE 계열은 원자료가 계절조정(SA)뿐입니다. 지수에서 계산한 변화율이 공표치와 일치하는지
확인했습니다 — 2026년 7월 기준 헤드라인 12개월 3.70 vs 발표 3.7, Core 3.34 vs 3.3,
6개월 연율 4.13 vs 4.1 및 3.46 vs 3.5.

CPI 계열은 전년 대비를 계절조정 전(NSA)으로, 3·6개월 연율화를 SA로 계산합니다.
FRED에는 "less food, shelter, and energy" 계열이 없어서 그 지표는 BLS가 유일한 출처입니다.

## 구조

```
scripts/fetch-data.mjs          FRED + BLS  → data/pce.json, public/data.js
scripts/build-distribution.mjs  BEA         → data/distribution.json  (+ 3단계 검증)
scripts/selftest.mjs            산술 검증 (BEA 불필요)
scripts/serve.mjs               정적 서버
lib/trimmed-mean.mjs            절사·버킷 산술 (WP 0506 / tmrates.txt 이식)
lib/dallasfed.mjs               연준 워크북 2종 + 캐시 + 이름 정규화
lib/xlsx.mjs                    무의존성 xlsx 리더 (node:zlib 만 사용)
lib/dallasfed-components.json   tech.pdf 178개 목록 (폴백 전용)
lib/bea-mapping.json            (선택) 매핑 수동 보정
public/                         index.html · app.js · styles.css · i18n.js · data.js
```

의존성은 없습니다. `npm install` 을 돌릴 필요가 없고, `node_modules` 도 생기지 않습니다.

### 다국어

화면에 나오는 모든 문자열은 `public/i18n.js` 한 파일에 있습니다. `app.js` 에는 어느 언어의
문자열도 하드코딩되어 있지 않고, `index.html` 은 `data-i18n` / `data-aria` 키로 표시된 자리에
한국어를 인라인으로 담고 있습니다 — 자바스크립트가 없어도 한국어로는 읽히고, 다른 언어를
고르면 그 자리만 교체됩니다.

언어 결정 순서는 `?lang=` → 브라우저 저장값 → 한국어이고, 전환은 URL을 바꿔 새로고침합니다.
각 언어가 공유 가능한 주소를 갖게 하면서, 모든 문자열을 시작 시점에 한 번만 만들면 되도록
한 선택입니다. 언어를 추가하려면 `i18n.js` 에 같은 모양의 객체를 하나 더 넣고 `LANGS` 에
코드를 추가하면 됩니다.

## 차트 구성

카드 4장입니다.

1. **전년 대비 (YoY)** — 계열 11종을 한 축에서 비교. PCE 3종(Trimmed Mean · Core · 헤드라인),
   CPI 4종(Core ex-주거비 · Core · 헤드라인 · 주거비), 애틀랜타 연준 4종(Core Sticky ·
   Sticky · Core Sticky ex-주거비 · Flexible). 기본은 5개만 켜져 있고 범례로 토글합니다.
2. **단기 모멘텀** — Trimmed 1·6개월 연율, Core PCE 3·6개월 연율, Sticky 3개월 연율
3. **품목별 가격 변화 분포** — 6구간 누적 + 3% 초과 비중(월별·12개월 평균)
4. **물가 상승의 확산 정도** — 전년 대비 3% 초과 항목의 가중·비가중 비중

### 11색 팔레트

dataviz 팔레트는 카테고리 슬롯이 **8개**인데 이 차트는 11계열입니다. 그래서 쓰지 않던 색상
계열에서 **cyan · indigo · rose** 셋을 골라 밝기 밴드와 채도 하한에 맞게 단계를 조정하고,
**순서 자체를 탐색**해 인접 게이트를 양쪽 모드에서 통과시켰습니다.

```
라이트   CVD ΔE 15.3   일반시야 ΔE 19.6
다크     CVD ΔE 13.0   일반시야 ΔE 18.3      (목표 >= 8 / 하한 >= 15)
```

색상 순서는 고정이며 절대 돌려쓰지 않습니다 — 계열을 끄더라도 남은 계열의 색이 바뀌지
않습니다. 라이트 모드의 aqua·magenta·yellow는 대비가 3:1 미만이라 완화 규칙이 적용되는데,
끝 라벨과 표 뷰가 이미 그 역할을 합니다.

분포 밴드는 2–3% 구간을 중심으로 한 발산형(파랑↔빨강) 램프이고, 모든 램프는 라이트·다크
양쪽에서 검증기를 통과했습니다.

11개를 한꺼번에 켜면 빽빽합니다. 색은 서로 구분되지만 선이 겹치는 구간에서는 끝 라벨과
표 뷰로 읽는 편이 낫습니다.

맨 위 큰 숫자는 Trimmed Mean이 아니라 **Core CPI ex-주거비**입니다 — 주거비가 시장 임대료를
1년 이상 시차로 반영해서 방향 전환을 먼저 보여주는 경우가 많기 때문입니다. Trimmed Mean은
첫 번째 타일에 있습니다.
