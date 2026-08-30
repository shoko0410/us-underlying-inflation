/* Every user-visible string on the page, in both languages.
 *
 * `doc` and `html` fill the static shell — index.html carries the Korean inline so the
 * page still reads without JavaScript, and these overwrite it when another language is
 * selected. `ui` is everything app.js draws: series names, tile labels, table headers,
 * tooltip text. Nothing in app.js is hardcoded in one language.
 *
 * Values under `html` are authored here and inserted as innerHTML so the prose can keep
 * its <strong>/<code> emphasis. Nothing from the data files ever goes through them —
 * data-derived text is set with textContent everywhere in app.js.
 */
window.I18N = {

  // ──────────────────────────────────────────────────────────────── 한국어
  ko: {
    label: '한국어',
    htmlLang: 'ko',
    locale: 'ko-KR',
    month: (y, m) => `${y}년 ${Number(m)}월`,
    monthShort: (m) => m.replace('-', '.'),

    doc: {
      title: '미국 기조적 물가 — Trimmed Mean PCE · 근원 CPI · Sticky',
      desc: '일시적 소음을 걷어낸 미국 기조적 물가 지표 모음. Trimmed Mean PCE, 주거비 제외 근원 CPI, 애틀랜타 연준 Sticky·Flexible을 1967년부터 비교하고, 품목별 가격 변화 분포와 3% 초과 항목 비중까지 함께 봅니다.',
    },

    html: {
      h1: '미국 기조적 물가',
      subtitle:
        '헤드라인 물가에서 <strong>일시적 소음을 걷어내고 남는 추세</strong>를 보는 지표들을 모았습니다. ' +
        '무엇을 어떻게 걷어내느냐가 지표마다 다릅니다 — <strong>Trimmed Mean PCE</strong>는 그 달의 ' +
        '극단치를 잘라내고, <strong>Core</strong>는 식료품·에너지를 언제나 빼고, ' +
        '<strong>ex-주거비</strong>는 시차가 긴 주거비까지 덜어내며, ' +
        '<strong>Sticky</strong>는 가격이 잘 안 변하는 항목에 가중치를 몰아줍니다. ' +
        '맨 위 숫자는 그중 주거비까지 제외한 근원 CPI입니다.',
      heroLabel: 'Core CPI ex-주거비 · 전년 대비',
      filterLabel: '기간',

      yoyTitle: '전년 대비 상승률 (YoY)',
      yoySub:
        'PCE 3종, CPI 4종, 애틀랜타 연준 4종을 한 축에서 비교합니다. 앞의 일곱은 ' +
        '<strong>바구니에서 항목을 빼는</strong> 방식이고, 뒤의 넷은 가격이 ' +
        '<strong>바뀌는 빈도로 가중치를 다시 준</strong> 지표입니다 — 잘 안 변하는 ' +
        '가격(Sticky)은 기업의 향후 물가 전망을 반영한다고 보아 기조적 물가로, ' +
        '자주 변하는 가격(Flexible)은 에너지·식품 충격의 통로로 읽습니다. ' +
        '열한 개를 한꺼번에 켜면 빽빽하니 <strong>범례를 눌러</strong> 필요한 것만 보시기를 ' +
        '권합니다. 세로 회색 띠는 NBER 경기침체 구간으로 아래 차트들에도 똑같이 들어가 있고, ' +
        '가로 기준선은 연준 목표 2%입니다.',

      momTitle: '단기 모멘텀 — 연율화',
      momSub:
        '전년 대비보다 추세 전환을 몇 달 빠르게 보여주지만 그만큼 진폭이 큽니다. ' +
        'Trimmed Mean의 1개월·6개월 연율은 댈러스 연준이 직접 발표하는 값이고, ' +
        'Core PCE의 3·6개월 연율은 계절조정 지수에서 계산했습니다. ' +
        'Core Sticky ex-주거비 3개월 연율도 애틀랜타 연준 발표값입니다.',

      distTitle: '품목별 가격 변화 분포',
      distSub:
        '매달 PCE 구성품목의 연율화 가격 변화를 구간별로 나누고 <strong>지출 비중으로 가중</strong>한 ' +
        '분포입니다. <strong>파란색은 연준 목표 아래, 회색은 목표 언저리(2–3%), 붉은색은 위</strong>이고, ' +
        '목표에서 멀어질수록 색이 진해집니다. 굵은 선은 <strong>3% 초과 비중</strong>으로, ' +
        '물가 상승이 몇몇 품목에 몰려 있는지 아니면 전방위로 퍼져 있는지를 보여줍니다. ' +
        'Trimmed Mean이 낮아도 이 비중이 높으면 상승 압력이 넓게 남아 있다는 뜻입니다. ' +
        '가는 선이 월별 원값, 굵은 선이 <strong>6개월 후행평균</strong>입니다. 1개월 연율은 ' +
        '월별 진폭이 워낙 커서(표준편차 10%p대) 원값만으로는 추세가 안 보입니다. 후행이라 ' +
        '마지막 달까지 그려지고, 한번 그린 값이 나중에 바뀌지 않습니다.',

      breadthTitle: '물가 상승의 확산 정도 — 3% 초과 항목 비중',
      breadthSub:
        'PCE 구성품목 중 <strong>전년 대비 가격이 3% 넘게 오른 항목</strong>의 비중입니다. ' +
        '위 카드가 "이번 달 가격 변화가 어떻게 퍼져 있나"를 본다면, 여기는 ' +
        '<strong>"바구니의 얼마가 1년째 뜨거운가"</strong>를 봅니다. ' +
        '<strong>가중</strong>은 각 항목의 소비지출 비중으로 잰 것이고, ' +
        '<strong>비가중</strong>은 항목 수로만 센 것입니다. 가중이 비가중보다 높으면 ' +
        '<strong>지출이 큰 항목일수록 많이 오르고 있다</strong>는 뜻입니다.',

      tableTitle: '데이터 테이블',
      tableSub: '차트의 모든 값을 숫자로 확인할 수 있습니다. 최근 데이터가 위쪽입니다.',

      notesTitle: '읽을 때 주의할 점',
      distNoteLead: '분포 데이터의 출처와 한계.',
      noteTrim:
        '<strong>Trimmed Mean은 "빼는" 지표가 아니라 "잘라내는" 지표입니다.</strong> ' +
        'Core PCE는 식료품·에너지를 언제나 제외하지만, Trimmed Mean은 매달 품목들을 가격 변화 ' +
        '순으로 줄 세운 뒤 <strong>지출가중 기준 하위 24%·상위 31%</strong>를 잘라내고 남은 가운데를 ' +
        '평균합니다. 그래서 어느 달에는 휘발유가 잘려나가고 다른 달에는 살아남습니다. 이 비대칭 ' +
        '절사율(24/31)은 댈러스 연준이 1977~2009년 표본에서 전체 PCE 추세를 가장 잘 따라가도록 ' +
        '최적화해 고른 값입니다.',
      noteCoreLocal:
        '<strong>이 페이지의 "Core"는 미국 기준입니다.</strong> 나라마다 근원물가를 다르게 정의해서, ' +
        '같은 이름이 다른 걸 가리킵니다. 한국에서 근원물가라고 하면 보통 통계청의 ' +
        '<strong>농산물 및 석유류 제외</strong> 지수를 떠올리는데, 이건 가공식품과 전기·가스를 ' +
        '포함하므로 미국 Core와 범위가 다릅니다. 미국 Core에 대응하는 건 ' +
        '<strong>식료품 및 에너지 제외</strong> 지수 쪽입니다. 일본은 더 헷갈리는데, ' +
        '「코어CPI」가 <strong>생선식품만</strong> 제외한 지수라 에너지가 그대로 들어 있고, ' +
        '미국의 Core에 해당하는 건 한 겹 더 뺀 「<strong>코어코어</strong>」입니다. ' +
        '여기 숫자는 전부 미국 기준이고, Core는 언제나 식료품·에너지 제외를 뜻합니다.',
      noteTwoThree:
        '<strong>"3% 초과"가 두 번 나오는데 기준이 다릅니다.</strong> 분포 카드의 52.0%는 ' +
        '<strong>이번 달</strong> 가격 변화를 연율로 환산했을 때 3%를 넘은 항목의 비중이고, ' +
        '확산 카드의 63.7%는 <strong>전년 대비</strong> 3%를 넘은 항목의 비중입니다. 앞은 ' +
        '"이번 달이 어땠나", 뒤는 "1년째 뜨거운 게 얼마나 되나"를 봅니다. 1개월 기준이 훨씬 ' +
        '요동치므로 둘은 다른 값이 나오는 게 정상입니다.',
      noteSticky:
        '<strong>Sticky와 Flexible은 "빼는" 지표가 아니라 "가중치를 다시 주는" 지표입니다.</strong> ' +
        '애틀랜타 연준은 CPI 구성 항목을 가격이 얼마나 자주 바뀌는지로 나눠, 평균 4.3개월 이상 ' +
        '가격이 고정되는 항목만 모은 <strong>Sticky</strong>와 자주 바뀌는 항목만 모은 ' +
        '<strong>Flexible</strong>을 따로 계산합니다. 끈적한 가격은 기업이 <em>앞으로의</em> 물가를 ' +
        '어떻게 볼지를 반영해 정해진다고 보아 기조적 물가로 인용되고, 유연한 가격은 에너지·식품 ' +
        '충격이 들어오는 통로로 읽습니다. 그래서 Flexible이 4.7%로 튀는데 Sticky가 2.8%에 ' +
        '머물면, 지금 물가 상승은 대체로 <strong>일시적 충격 쪽</strong>이라는 해석이 가능합니다.',
      noteHero:
        '<strong>왜 맨 위 숫자가 Core CPI ex-주거비인가.</strong> 주거비는 시장 임대료를 1년 이상 ' +
        '시차를 두고 반영합니다. 그래서 주거비까지 덜어낸 이 지표가 물가의 방향 전환을 ' +
        '헤드라인이나 일반 Core보다 먼저 보여주는 경우가 많아 헤드라인 자리에 두었습니다. ' +
        'Trimmed Mean PCE는 바로 아래 첫 번째 타일에 있고, 연준의 2% 목표가 기준으로 삼는 것은 ' +
        '<strong>PCE</strong>라는 점은 따로 기억해 두시기 바랍니다.',
      noteNber:
        '<strong>경기침체 구간은 사후에 확정된 것입니다.</strong> NBER 경기순환일자결정위원회는 ' +
        '정점·저점을 <strong>한참 지난 뒤에</strong> 발표합니다 — 2007년 12월 정점은 2008년 12월에, ' +
        '2009년 6월 저점은 2010년 9월에야 공표됐습니다. 하락이 워낙 급격했던 2020년 2월 정점이 ' +
        '4개월 만에 나온 게 예외적으로 빠른 축이고, 그 저점(2020년 4월)조차 확정은 2021년 ' +
        '7월이었습니다. 위원회가 데이터 개정이 안정될 때까지 일부러 기다리기 때문입니다. ' +
        '그래서 <strong>차트 오른쪽 끝에는 침체 음영이 절대 나타날 수 없습니다</strong> — 지금 침체가 ' +
        '진행 중이더라도 아직 판정 전이라 표시되지 않습니다. 이 차트의 마지막 음영은 2020년 ' +
        '4월에 끝나고, 그 뒤 75개월은 모두 "침체 아님"으로 채워져 있습니다. ' +
        '음영이 정점 <em>다음 달</em>부터 시작하는 것도 <code>USREC</code>의 정의 때문입니다 ' +
        '(정점 다음 달 ~ 저점 달). 2008년 1월부터 칠해진 것은 정점이 2007년 12월이어서입니다.',
      notePceCpi:
        '<strong>PCE와 CPI는 같은 물가가 아닙니다.</strong> 가중치 산정 방식(PCE는 기업 매출 기준, ' +
        'CPI는 가계 조사 기준), 포괄 범위(PCE는 고용주가 대신 낸 의료비까지 포함), 주거비 비중 ' +
        '(CPI에서 약 3분의 1, PCE에서는 그 절반 수준)이 다릅니다. 그래서 두 지표는 구조적으로 ' +
        '벌어지며, 연준의 2% 목표는 <strong>PCE 기준</strong>입니다.',
      noteShutdown:
        '<strong>2025년 10월 CPI는 존재하지 않습니다.</strong> 연방정부 셧다운으로 해당 월 조사가 ' +
        '이루어지지 않았습니다. 없는 값을 보간하지 않고 선을 끊어 표시했으며, 3·6개월 연율화 ' +
        '계산에도 전파됩니다. <strong>단 Sticky 계열은 이 달에도 값이 있고</strong>, PCE 계열은 ' +
        'BEA가 별도로 집계하므로 영향을 받지 않습니다.',
      noteSa:
        '<strong>계절조정 기준.</strong> PCE 계열은 원자료가 계절조정(SA)뿐이라 전 항목 SA입니다. ' +
        'CPI 계열은 전년 대비를 계절조정 전(NSA)으로, 3·6개월 연율화를 SA로 계산했습니다 — ' +
        '전년 동월 대비는 계절 요인이 자연히 상쇄되지만, 3·6개월 변화는 SA를 써야 계절성을 ' +
        '추세로 오독하지 않습니다.',
      noteSources:
        '<strong>출처.</strong> Trimmed Mean은 댈러스 연준(<code>PCETRIM12M159SFRBDAL</code>, ' +
        '<code>PCETRIM1M158SFRBDAL</code>, <code>PCETRIM6M680SFRBDAL</code>), 헤드라인·Core PCE는 ' +
        'BEA 물가지수(<code>PCEPI</code>, <code>PCEPILFE</code>)를 FRED에서 받아 변화율로 계산했습니다. ' +
        'CPI 4종은 노동통계국 Public Data API(<code>CUUR0000SA0L12E</code> 외)에서 직접 받았고, ' +
        'FRED에는 "less food, shelter, and energy" 계열이 없어 BLS가 유일한 출처입니다. 애틀랜타 연준 ' +
        '계열은 <code>CORESTICKM159SFRBATL</code>(Core Sticky), <code>STICKCPIM159SFRBATL</code>(Sticky), ' +
        '<code>CRESTKCPIXSLTRM159SFRBATL</code>(Core Sticky ex-주거비 — 이름 그대로 ' +
        '식료품·에너지·주거비를 모두 제외한 것입니다), <code>FLEXCPIM159SFRBATL</code>(Flexible) ' +
        '이고, 경기침체 구간은 <code>USREC</code>입니다.',
    },

    aria: {
      tiles: '주요 지표 요약',
      filters: '기간 필터',
      legendToggle: '계열 표시 전환',
      legendStatic: '구간 색상 범례',
      chartYoy: 'Trimmed Mean PCE, Core·헤드라인 PCE, CPI 계열 4종, 애틀랜타 연준 Sticky·Flexible의 전년 대비 상승률 추이 선그래프',
      chartMom: 'Trimmed Mean과 Core PCE의 연율화 상승률 추이 선그래프',
      chartDist: 'PCE 구성품목의 연율화 가격 변화 구간별 지출가중 비중 누적 막대그래프',
      chartBreadth: '전년 대비 3%를 넘게 오른 PCE 항목의 가중 비중과 비가중 비중 추이 선그래프',
      themeToDark: '다크 모드로 전환',
      themeToLight: '라이트 모드로 전환',
      langSwitch: '일본어로 전환',
    },

    ui: {
      noData: '데이터를 불러오지 못했습니다. <code>npm run fetch</code> 를 먼저 실행하세요.',
      themeDark: '🌙 다크',
      themeLight: '☀ 라이트',
      langButton: '日本語',
      tableOpen: '표 열기',
      tableClose: '표 닫기',
      target: '연준 목표 2%',
      targetShort: '2%',
      sep: ' · ',
      deltaTitle: '직전 발표월 대비',
      heroMeta: '식료품·에너지·주거비 제외 · 출처 BLS',

      ranges: { all: '전체', '40y': '40년', '20y': '20년', '10y': '10년', '5y': '5년', '3y': '3년' },

      series: {
        trimmedMean: 'Trimmed Mean PCE',
        corePce: 'Core PCE',
        headlinePce: '헤드라인 PCE',
        coreExShelter: 'Core CPI ex-주거비',
        coreCpi: 'Core CPI',
        headlineCpi: '헤드라인 CPI',
        shelter: '주거비',
        coreSticky: 'Core Sticky CPI',
        stickyAll: 'Sticky CPI',
        stickyExShelter: 'Core Sticky ex-주거비',
        flexCpi: 'Flexible CPI',
      },
      mom: {
        tmAnn1m: 'Trimmed 1개월 연율',
        tmAnn6m: 'Trimmed 6개월 연율',
        coreAnn3m: 'Core PCE 3개월 연율',
        coreAnn6m: 'Core PCE 6개월 연율',
        stickyAnn3m: 'Core Sticky ex-주거비 3개월 연율',
      },
      bands: {
        fell: '하락', b0_2: '0–2%', b2_3: '2–3%',
        b3_5: '3–5%', b5_10: '5–10%', b10: '10% 초과',
      },
      breadth: { weighted: '가중 (소비지출 비중)', unweighted: '비가중 (항목 수)' },

      above3Raw: '3% 초과 비중 (월별)',
      above3Smooth: '3% 초과 비중 (6개월 평균)',
      above3Total: '3% 초과 합계',

      tiles: {
        trimmedMean: ['Trimmed Mean PCE', '전년 대비'],
        corePce: ['Core PCE', '식료품·에너지 제외'],
        headlinePce: ['헤드라인 PCE', '전년 대비'],
        coreSticky: ['Core Sticky CPI', '애틀랜타 연준'],
        above3m1: ['3% 초과 · 1개월 연율', '지출가중'],
        above3yoy: ['3% 초과 · 전년 대비', '지출가중'],
      },

      tipMissing: 'BLS 미발표 (셧다운)',
      tipNone: '해당 월 데이터 없음',
      tipNoDist: '해당 월 분포 없음',

      table: {
        month: '월',
        cols: {
          trimmedMean: 'Trimmed Mean', corePce: 'Core PCE', headlinePce: '헤드라인 PCE',
          coreExShelter: 'Core CPI ex-주거비', coreCpi: 'Core CPI', headlineCpi: '헤드라인 CPI',
          shelter: '주거비', stickyExShelter: 'Core Sticky ex-주거비', coreSticky: 'Core Sticky',
          stickyAll: 'Sticky', flexCpi: 'Flexible',
          tmAnn1m: 'TM 1m 연율', tmAnn6m: 'TM 6m 연율', coreAnn6m: 'Core PCE 6m',
          above3m1: '3% 초과 1m', bWeighted: '3% 초과 YoY 가중', bUnweighted: '3% 초과 YoY 비가중',
        },
        caption: (from, to, n) =>
          `${from} ~ ${to} · 단위 % · 앞 ${n}개 열은 전년 대비, 나머지는 연율화 또는 비중 · 미발표 월은 —`,
      },

      distNote: (m) =>
        `댈러스 연준은 이 분포를 최근 13개월치만 공개합니다. 그래서 여기 있는 ` +
        `${m.months[0]} 이후 전 구간은 BEA 표 2.4.4U·2.4.5U의 품목별 가격지수와 지출액에서 ` +
        `댈러스 연준 방법론을 그대로 적용해 다시 계산한 것입니다` +
        (m.validation
          ? ` — 공표된 13개월과 대조한 평균 오차는 ${m.validation.meanAbsDev}%p, ` +
            `절사평균을 역산해 공표 시계열과 비교한 평균 오차는 ${m.validation.trimMeanAbsDev}%p입니다.`
          : '.') +
        ' 구간 경계(0·2·3·5·10%)는 연율화 기준이며, 어느 구간에도 들지 않는 나머지가 "하락"입니다.',
      distNoteAbsent: '분포 데이터가 아직 빌드되지 않았습니다. scripts/build-distribution.mjs 를 실행하세요.',

      generated: (when, from, to) =>
        `데이터 최종 변경 ${when} · 수록 범위 ${from} ~ ${to} · ` +
        '매일 자동으로 출처를 확인해 값이 바뀔 때만 갱신합니다.',
    },
  },

  // ──────────────────────────────────────────────────────────────── 日本語
  ja: {
    label: '日本語',
    htmlLang: 'ja',
    locale: 'ja-JP',
    month: (y, m) => `${y}年${Number(m)}月`,
    monthShort: (m) => m.replace('-', '.'),

    doc: {
      title: '米国の基調的インフレ — Trimmed Mean PCE・Core CPI・Sticky',
      desc: '一時的なノイズを取り除いた米国の基調的インフレ指標をまとめたページ。Trimmed Mean PCE、住居費を除く Core CPI、アトランタ連銀の Sticky・Flexible を1967年から比較し、品目別の価格変化分布と3%超の品目割合まで併せて見られます。',
    },

    html: {
      h1: '米国の基調的インフレ',
      subtitle:
        '総合インフレから<strong>一時的なノイズを取り除いた後に残るトレンド</strong>を見る指標を集めました。' +
        '何をどう取り除くかが指標ごとに違います — <strong>Trimmed Mean PCE</strong> はその月の' +
        '極端値を切り落とし、<strong>Core</strong> は食料・エネルギーを常に除き、' +
        '<strong>ex-住居費</strong> はラグの長い住居費まで差し引き、' +
        '<strong>Sticky</strong> は値段が変わりにくい品目にウェイトを寄せます。' +
        '一番上の数字は、そのうち住居費まで除いた Core CPI です。',
      heroLabel: 'Core CPI ex-住居費・前年比',
      filterLabel: '期間',

      yoyTitle: '前年比上昇率（YoY）',
      yoySub:
        'PCE3種、CPI4種、アトランタ連銀4種を同じ軸で比較します。前の7つは' +
        '<strong>バスケットから品目を除く</strong>方式で、後ろの4つは価格が' +
        '<strong>変わる頻度でウェイトを付け替えた</strong>指標です — 変わりにくい' +
        '価格（Sticky）は企業の先行きの物価観を反映するとみて基調的インフレとして、' +
        'よく変わる価格（Flexible）はエネルギー・食料ショックの通り道として読みます。' +
        '11本を一度に表示すると密集するので、<strong>凡例をクリックして</strong>必要なものだけ' +
        '表示することをおすすめします。縦の灰色帯はNBERの景気後退期で、下のグラフにも同じく入っています。' +
        '横の基準線はFRBの目標2%です。',

      momTitle: '短期モメンタム — 年率換算',
      momSub:
        '前年比よりも数か月早くトレンドの転換を示しますが、その分だけ振れも大きくなります。' +
        'Trimmed Mean の1か月・6か月年率はダラス連銀が直接公表している値で、' +
        'Core PCE の3・6か月年率は季節調整済み指数から計算しました。' +
        'Core Sticky ex-住居費 の3か月年率もアトランタ連銀の公表値です。',

      distTitle: '品目別の価格変化の分布',
      distSub:
        '毎月のPCE構成品目の年率換算した価格変化を区間ごとに分け、<strong>支出ウェイトで加重した</strong>' +
        '分布です。<strong>青はFRB目標より下、灰色は目標近辺（2–3%）、赤は上</strong>で、' +
        '目標から離れるほど色が濃くなります。太い線は<strong>3%超の割合</strong>で、' +
        '物価上昇が一部の品目に偏っているのか、それとも全面的に広がっているのかを示します。' +
        'Trimmed Mean が低くてもこの割合が高ければ、上昇圧力が幅広く残っているということです。' +
        '細い線が月次の元の値、太い線が<strong>6か月後方移動平均</strong>です。1か月年率は' +
        '月ごとの振れが大きく（標準偏差で10%pt台）、元の値だけでは趨勢が見えません。後方平均' +
        'なので直近の月まで描かれ、一度描いた値が後から変わることもありません。',

      breadthTitle: 'インフレの広がり — 3%超の品目割合',
      breadthSub:
        'PCE構成品目のうち<strong>前年比で3%超上昇した品目</strong>の割合です。' +
        '上のカードが「今月の価格変化がどう散らばっているか」を見るのに対し、ここでは' +
        '<strong>「バスケットのどれだけが1年にわたって熱いままか」</strong>を見ます。' +
        '<strong>加重</strong>は各品目の消費支出ウェイトで測ったもの、' +
        '<strong>非加重</strong>は品目数だけで数えたものです。加重が非加重より高ければ' +
        '<strong>支出の大きい品目ほどよく上がっている</strong>ということになります。',

      tableTitle: 'データテーブル',
      tableSub: 'グラフのすべての値を数値で確認できます。新しいデータが上です。',

      notesTitle: '読むときの注意点',
      distNoteLead: '分布データの出典と限界。',
      noteTrim:
        '<strong>Trimmed Mean は「除く」指標ではなく「切り落とす」指標です。</strong>' +
        'Core PCE は食料・エネルギーを常に除きますが、Trimmed Mean は毎月、品目を価格変化の' +
        '順に並べたうえで<strong>支出ウェイト基準で下位24%・上位31%</strong>を切り落とし、残った中央を' +
        '平均します。ですからある月はガソリンが切り落とされ、別の月には残ります。この非対称な' +
        '刈り込み率（24/31）は、ダラス連銀が1977〜2009年の標本でPCE全体のトレンドを最もよく' +
        '追えるように最適化して選んだ値です。',
      noteCoreLocal:
        '<strong>このページの「Core」は米国基準です。</strong>基調的な物価の定義は国ごとに違うので、' +
        '同じ名前が別のものを指します。日本で「コアCPI」といえば<strong>生鮮食品だけ</strong>を' +
        '除いた指数（生鮮食品を除く総合）で、<strong>エネルギーは入ったまま</strong>です。' +
        '米国の Core にあたるのは、もう一段除いた「<strong>コアコア</strong>」' +
        '（生鮮食品及びエネルギーを除く総合）のほうです。つまり米国で Core と呼ぶものを、' +
        '日本ではコアコアと呼んでいることになります。韓国も事情は似ていて、あちらで通常' +
        '「コア」と呼ばれるのは「農産物及び石油類を除く」指数で、加工食品や電気・ガスは' +
        '含まれます。' +
        'ここの数字はすべて米国のもので、Core は常に食料・エネルギーを除くという意味です。',
      noteTwoThree:
        '<strong>「3%超」が2回出てきますが、基準が違います。</strong>分布カードの52.0%は' +
        '<strong>今月</strong>の価格変化を年率換算したときに3%を超えた品目の割合で、' +
        '広がりカードの63.7%は<strong>前年比</strong>で3%を超えた品目の割合です。前者は' +
        '「今月はどうだったか」、後者は「1年にわたって熱いものがどれだけあるか」を見ています。' +
        '1か月基準のほうがはるかに振れるので、両者の値が違うのは正常です。',
      noteSticky:
        '<strong>Sticky と Flexible は「除く」指標ではなく「ウェイトを付け替える」指標です。</strong>' +
        'アトランタ連銀はCPIの構成品目を価格がどれくらいの頻度で変わるかで分け、平均4.3か月以上' +
        '価格が据え置かれる品目だけを集めた <strong>Sticky</strong> と、よく変わる品目だけを集めた' +
        '<strong>Flexible</strong> を別に計算しています。粘着的な価格は企業が<em>先行きの</em>物価を' +
        'どう見るかを織り込んで決まるとみて基調的インフレとして引用され、伸縮的な価格はエネルギー・' +
        '食料ショックが入ってくる通り道として読まれます。ですから Flexible が4.7%に跳ねているのに' +
        'Sticky が2.8%にとどまっていれば、足元の物価上昇はおおむね' +
        '<strong>一時的なショック側</strong>だという解釈ができます。',
      noteHero:
        '<strong>なぜ一番上の数字が Core CPI ex-住居費 なのか。</strong>住居費は市場家賃を1年以上の' +
        'ラグを伴って反映します。そのため住居費まで差し引いたこの指標が、物価の方向転換を' +
        '総合や通常の Core より早く示すことが多く、見出しの位置に置きました。' +
        'Trimmed Mean PCE はすぐ下の最初のタイルにあります。なお、FRBの2%目標が基準としているのは' +
        '<strong>PCE</strong>である点は別途ご記憶ください。',
      noteNber:
        '<strong>景気後退期は事後的に確定されたものです。</strong>NBERの景気循環日付決定委員会は' +
        '山・谷を<strong>かなり経ってから</strong>公表します — 2007年12月の山は2008年12月に、' +
        '2009年6月の谷は2010年9月にようやく公表されました。下落があまりに急だった2020年2月の山が' +
        '4か月で出たのが例外的に早いほうで、その谷（2020年4月）ですら確定は2021年' +
        '7月でした。委員会がデータの改定が落ち着くまで意図的に待つためです。' +
        'ですから<strong>グラフの右端に後退期の陰影が現れることは決してありません</strong> — 今まさに' +
        '景気後退が進行中だとしても、まだ判定前なので表示されません。このグラフの最後の陰影は2020年' +
        '4月に終わり、その後の75か月はすべて「後退でない」で埋まっています。' +
        '陰影が山の<em>翌月</em>から始まるのも<code>USREC</code>の定義によるものです' +
        '（山の翌月〜谷の月）。2008年1月から塗られているのは、山が2007年12月だからです。',
      notePceCpi:
        '<strong>PCEとCPIは同じ物価ではありません。</strong>ウェイトの算定方法（PCEは企業の売上基準、' +
        'CPIは家計調査基準）、カバー範囲（PCEは雇用主が代わりに負担した医療費まで含む）、住居費の比重' +
        '（CPIでは約3分の1、PCEではその半分程度）が異なります。ですから両指標は構造的に' +
        '乖離しますし、FRBの2%目標は<strong>PCE基準</strong>です。',
      noteShutdown:
        '<strong>2025年10月のCPIは存在しません。</strong>連邦政府のシャットダウンにより、その月の調査が' +
        '行われませんでした。存在しない値を補間せず線を切って表示しており、3・6か月の年率換算の' +
        '計算にも波及します。<strong>ただし Sticky 系列にはこの月も値があり</strong>、PCE系列は' +
        'BEAが別途集計しているため影響を受けません。',
      noteSa:
        '<strong>季節調整の基準。</strong>PCE系列は原資料が季節調整済み（SA）のみのため全項目SAです。' +
        'CPI系列は前年比を季節調整前（NSA）で、3・6か月の年率換算をSAで計算しました — ' +
        '前年同月比では季節要因が自然に相殺されますが、3・6か月の変化はSAを使わないと季節性を' +
        'トレンドと読み違えてしまうためです。',
      noteSources:
        '<strong>出典。</strong>Trimmed Mean はダラス連銀（<code>PCETRIM12M159SFRBDAL</code>、' +
        '<code>PCETRIM1M158SFRBDAL</code>、<code>PCETRIM6M680SFRBDAL</code>）、Headline・Core PCE は' +
        'BEAの物価指数（<code>PCEPI</code>、<code>PCEPILFE</code>）をFREDから取得して変化率を計算しました。' +
        'CPI4種は労働統計局のPublic Data API（<code>CUUR0000SA0L12E</code>ほか）から直接取得しており、' +
        'FREDには「less food, shelter, and energy」系列がないためBLSが唯一の出典です。アトランタ連銀の' +
        '系列は<code>CORESTICKM159SFRBATL</code>（Core Sticky）、<code>STICKCPIM159SFRBATL</code>（Sticky）、' +
        '<code>CRESTKCPIXSLTRM159SFRBATL</code>（Core Sticky ex-住居費 — 名前のとおり' +
        '食料・エネルギー・住居費をすべて除いたものです）、<code>FLEXCPIM159SFRBATL</code>（Flexible）' +
        'で、景気後退期は<code>USREC</code>です。',
    },

    aria: {
      tiles: '主要指標の要約',
      filters: '期間フィルター',
      legendToggle: '系列の表示切り替え',
      legendStatic: '区間の色の凡例',
      chartYoy: 'Trimmed Mean PCE、Core・Headline PCE、CPI4種、アトランタ連銀の Sticky・Flexible の前年比上昇率の推移を示す折れ線グラフ',
      chartMom: 'Trimmed Mean と Core PCE の年率換算上昇率の推移を示す折れ線グラフ',
      chartDist: 'PCE構成品目の年率換算した価格変化の区間別支出加重割合を示す積み上げ棒グラフ',
      chartBreadth: '前年比で3%超上昇したPCE品目の加重割合と非加重割合の推移を示す折れ線グラフ',
      themeToDark: 'ダークモードに切り替え',
      themeToLight: 'ライトモードに切り替え',
      langSwitch: '韓国語に切り替え',
    },

    ui: {
      noData: 'データを読み込めませんでした。先に <code>npm run fetch</code> を実行してください。',
      themeDark: '🌙 ダーク',
      themeLight: '☀ ライト',
      langButton: '한국어',
      tableOpen: '表を開く',
      tableClose: '表を閉じる',
      target: 'FRB目標 2%',
      targetShort: '2%',
      sep: '・',
      deltaTitle: '前回公表月との比較',
      heroMeta: '食料・エネルギー・住居費を除く・出典 BLS',

      ranges: { all: '全期間', '40y': '40年', '20y': '20年', '10y': '10年', '5y': '5年', '3y': '3年' },

      series: {
        trimmedMean: 'Trimmed Mean PCE',
        corePce: 'Core PCE',
        headlinePce: 'Headline PCE',
        coreExShelter: 'Core CPI ex-住居費',
        coreCpi: 'Core CPI',
        headlineCpi: 'Headline CPI',
        shelter: '住居費',
        coreSticky: 'Core Sticky CPI',
        stickyAll: 'Sticky CPI',
        stickyExShelter: 'Core Sticky ex-住居費',
        flexCpi: 'Flexible CPI',
      },
      mom: {
        tmAnn1m: 'Trimmed 1か月年率',
        tmAnn6m: 'Trimmed 6か月年率',
        coreAnn3m: 'Core PCE 3か月年率',
        coreAnn6m: 'Core PCE 6か月年率',
        stickyAnn3m: 'Core Sticky ex-住居費 3か月年率',
      },
      bands: {
        fell: '下落', b0_2: '0–2%', b2_3: '2–3%',
        b3_5: '3–5%', b5_10: '5–10%', b10: '10%超',
      },
      breadth: { weighted: '加重（消費支出ウェイト）', unweighted: '非加重（品目数）' },

      above3Raw: '3%超の割合（月次）',
      above3Smooth: '3%超の割合（6か月平均）',
      above3Total: '3%超 合計',

      tiles: {
        trimmedMean: ['Trimmed Mean PCE', '前年比'],
        corePce: ['Core PCE', '食料・エネルギー除く'],
        headlinePce: ['Headline PCE', '前年比'],
        coreSticky: ['Core Sticky CPI', 'アトランタ連銀'],
        above3m1: ['3%超・1か月年率', '支出加重'],
        above3yoy: ['3%超・前年比', '支出加重'],
      },

      tipMissing: 'BLS未公表（シャットダウン）',
      tipNone: '当月のデータなし',
      tipNoDist: '当月の分布なし',

      table: {
        month: '月',
        cols: {
          trimmedMean: 'Trimmed Mean', corePce: 'Core PCE', headlinePce: 'Headline PCE',
          coreExShelter: 'Core CPI ex-住居費', coreCpi: 'Core CPI', headlineCpi: 'Headline CPI',
          shelter: '住居費', stickyExShelter: 'Core Sticky ex-住居費', coreSticky: 'Core Sticky',
          stickyAll: 'Sticky', flexCpi: 'Flexible',
          tmAnn1m: 'TM 1m年率', tmAnn6m: 'TM 6m年率', coreAnn6m: 'Core PCE 6m',
          above3m1: '3%超 1m', bWeighted: '3%超 YoY 加重', bUnweighted: '3%超 YoY 非加重',
        },
        caption: (from, to, n) =>
          `${from} 〜 ${to} ・単位 % ・左から${n}列は前年比、それ以降は年率換算または割合 ・未公表の月は —`,
      },

      distNote: (m) =>
        `ダラス連銀はこの分布を直近13か月分しか公表していません。そのためここにある` +
        `${m.months[0]}以降の全期間は、BEA表2.4.4U・2.4.5Uの品目別価格指数と支出額から` +
        `ダラス連銀の手法をそのまま適用して再計算したものです` +
        (m.validation
          ? ` — 公表された13か月と照合した平均誤差は${m.validation.meanAbsDev}%pt、` +
            `Trimmed Mean を逆算して公表系列と比較した平均誤差は${m.validation.trimMeanAbsDev}%ptです。`
          : '。') +
        ' 区間の境界（0・2・3・5・10%）は年率換算基準で、どの区間にも入らない残りが「下落」です。',
      distNoteAbsent: '分布データがまだビルドされていません。scripts/build-distribution.mjs を実行してください。',

      generated: (when, from, to) =>
        `データ最終更新 ${when} ・収録範囲 ${from} 〜 ${to} ・` +
        '毎日自動で出典を確認し、値が変わったときだけ更新します。',
    },
  },
};
