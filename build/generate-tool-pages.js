/*
 * Builds standalone /tools/*.html pages from index.html so each tool has a
 * unique crawlable URL on GitHub Pages, plus short usage/notes/guide copy.
 *
 *   node build/generate-tool-pages.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const INDEX = path.join(ROOT, "index.html");
const OUT_DIR = path.join(ROOT, "tools");
const BASE_URL = "https://webtoolbay.com/";

const TOOLS = [
  {
    id: "weather",
    viewId: "weatherView",
    backBtnId: "backHomeFromWeatherBtn",
    title: "날씨 정보 | WebToolBay",
    description:
      "내 위치 또는 도시 검색으로 현재 날씨, 24시간·7일 예보, 체감온도·강수 확률을 무료로 확인하세요.",
    guideTitle: "날씨 정보 이용 안내",
    usage: [
      "페이지를 열면 위치 권한을 요청합니다. 허용하면 현재 위치 기준으로 현재 날씨, 앞으로 24시간, 7일 예보를 불러옵니다.",
      "권한을 거부했거나 위치가 부정확하면 상단 검색창에 도시 이름을 입력해 직접 선택하세요. °C/°F 전환과 새로고침도 같은 화면에서 할 수 있습니다."
    ],
    notes: [
      "예보 데이터는 Open-Meteo를 사용하며, 기상청 공식 특보나 재난 문자를 대체하지 않습니다.",
      "강수 확률과 강수량은 다른 지표입니다. 확률만 보고 비의 세기를 단정하지 마세요.",
      "먼 날짜 예보일수록 변동이 크므로, 중요한 일정 전날에는 다시 확인하는 것이 좋습니다."
    ],
    guides: [
      { href: "guides/weather.html", label: "날씨 활용 가이드" },
      { href: "guides/ip.html", label: "내 아이피 찾기 가이드" },
      { href: "faq.html", label: "FAQ" }
    ]
  },
  {
    id: "calendar",
    viewId: "calendarView",
    backBtnId: "backHomeFromCalendarBtn",
    title: "양력/음력 변환기 | WebToolBay",
    description:
      "양력과 음력 날짜를 서로 변환하고 60갑자·12띠를 확인하는 무료 음력 변환기입니다.",
    guideTitle: "양력/음력 변환 이용 안내",
    usage: [
      "양력 연·월·일을 고른 뒤 변환하면 해당 음력과 윤달 여부, 60갑자·띠를 확인할 수 있습니다. 반대로 음력에서 양력으로도 변환됩니다.",
      "오늘 날짜 조회로 바로 시작할 수 있고, 값을 바꾸면 결과가 이어서 갱신됩니다."
    ],
    notes: [
      "음력은 윤달 여부에 따라 같은 날짜라도 양력이 달라질 수 있습니다. 제사·생일처럼 중요한 일정은 윤달을 함께 확인하세요.",
      "띠·갑자는 참고용 문화 정보이며, 법적·행정 서류의 공식 기준을 대체하지 않습니다."
    ],
    guides: [
      { href: "guides/calendar.html", label: "양력·음력 변환 가이드" },
      { href: "guides/dday.html", label: "디데이 계산 가이드" },
      { href: "guides/overview.html", label: "사이트 한눈에 보기" }
    ]
  },
  {
    id: "ip",
    viewId: "ipView",
    backBtnId: "backHomeFromIpBtn",
    title: "내 아이피 찾기 | WebToolBay",
    description:
      "공인 IPv4·IPv6, ISP, 국가·도시 정보를 확인하고 아이피를 복사할 수 있는 무료 조회 도구입니다.",
    guideTitle: "내 아이피 찾기 이용 안내",
    usage: [
      "페이지를 열면 현재 접속에 쓰인 공인 IPv4·IPv6와 ISP, 대략적인 국가·도시 정보를 표시합니다.",
      "아이피 복사 버튼으로 값을 클립보드에 넣을 수 있고, 새로고침으로 다시 조회할 수 있습니다."
    ],
    notes: [
      "표시되는 위치는 ISP·네트워크 기반 추정치라 실제 거주 주소와 다를 수 있습니다.",
      "VPN·회사 네트워크·모바일 테더링을 쓰면 IP와 지역 정보가 달라질 수 있습니다.",
      "개인 식별에 쓰이는 민감 정보는 아니지만, 타인에게 공유할 때는 필요 여부만 확인하세요."
    ],
    guides: [
      { href: "guides/ip.html", label: "내 아이피 찾기 가이드" },
      { href: "privacy.html", label: "개인정보처리방침" },
      { href: "faq.html", label: "FAQ" }
    ]
  },
  {
    id: "ocr",
    viewId: "ocrView",
    backBtnId: "backHomeFromOcrBtn",
    title: "이미지 텍스트 추출 (OCR) | WebToolBay",
    description:
      "이미지 속 글자를 브라우저에서 바로 텍스트로 추출합니다. 업로드 없이 기기 안에서만 처리됩니다.",
    guideTitle: "이미지 텍스트 추출 이용 안내",
    usage: [
      "이미지 파일을 올리거나 끌어다 놓은 뒤 인식 언어를 고르고 추출을 실행하세요. 결과는 아래에서 복사하거나 텍스트 파일로 저장할 수 있습니다.",
      "처음 쓰는 언어는 인식 데이터를 내려받아 시간이 조금 걸릴 수 있고, 이후에는 브라우저에 저장되어 더 빨라집니다."
    ],
    notes: [
      "이미지는 서버로 전송되지 않고 브라우저 안에서만 처리됩니다.",
      "흐리거나 기울어진 사진, 손글씨, 배경이 복잡한 이미지는 오인식이 날 수 있습니다. 선명하고 대비가 큰 이미지가 유리합니다.",
      "PDF는 지원하지 않습니다. 필요하면 먼저 이미지로 변환한 뒤 사용하세요."
    ],
    guides: [
      { href: "guides/ocr.html", label: "OCR 가이드" },
      { href: "guides/convert.html", label: "이미지 형식 변환 가이드" },
      { href: "guides/editor.html", label: "이미지 자르기·회전 가이드" }
    ]
  },
  {
    id: "convert",
    viewId: "convertView",
    backBtnId: "backHomeFromConvertBtn",
    title: "이미지 형식 변환 | WebToolBay",
    description:
      "PNG·JPG·WebP·BMP 이미지를 원하는 형식으로 변환하는 무료 브라우저 도구입니다.",
    guideTitle: "이미지 형식 변환 이용 안내",
    usage: [
      "변환할 이미지를 추가한 뒤 목표 형식(PNG·JPG·WebP·BMP)을 고르고 변환을 실행하세요. 여러 장이면 ZIP으로 받을 수도 있습니다.",
      "변환은 브라우저에서 바로 이루어지며, 결과를 개별 저장하거나 목록을 비울 수 있습니다."
    ],
    notes: [
      "JPG는 투명 배경을 지원하지 않아 PNG 투명 영역이 단색으로 바뀔 수 있습니다.",
      "반복 압축하면 화질이 떨어질 수 있으니, 원본을 남기고 변환본을 쓰는 편이 안전합니다.",
      "매우 큰 이미지는 기기 메모리에 따라 변환이 느리거나 실패할 수 있습니다."
    ],
    guides: [
      { href: "guides/convert.html", label: "이미지 형식 변환 가이드" },
      { href: "guides/editor.html", label: "이미지 자르기·회전 가이드" },
      { href: "guides/picker.html", label: "컬러 피커 가이드" }
    ]
  },
  {
    id: "editor",
    viewId: "editorView",
    backBtnId: "backHomeFromEditorBtn",
    title: "이미지 자르기·회전 | WebToolBay",
    description:
      "이미지를 원하는 비율로 자르고 회전·반전·크기 조절까지 한 화면에서 처리하세요.",
    guideTitle: "이미지 자르기·회전 이용 안내",
    usage: [
      "이미지를 올린 뒤 영역을 드래그해 자르거나, 회전·좌우/상하 반전, 픽셀 크기 조절을 적용할 수 있습니다.",
      "작업 중간에는 실행 취소와 초기화가 가능하고, 원하는 결과가 나오면 저장 버튼으로 내려받으세요."
    ],
    notes: [
      "자르기·리사이즈는 픽셀을 다시 그리므로, 과도하게 키우면 선명도가 떨어질 수 있습니다.",
      "편집은 브라우저에서 처리되며 원본 파일을 서버에 올리지 않습니다.",
      "SNS·썸네일용 비율(1:1, 16:9, 9:16 등)을 먼저 정하면 잘리는 부분을 줄일 수 있습니다."
    ],
    guides: [
      { href: "guides/editor.html", label: "이미지 자르기·회전 가이드" },
      { href: "guides/convert.html", label: "이미지 형식 변환 가이드" },
      { href: "guides/ocr.html", label: "OCR 가이드" }
    ]
  },
  {
    id: "picker",
    viewId: "pickerView",
    backBtnId: "backHomeFromPickerBtn",
    title: "이미지 컬러 피커 | WebToolBay",
    description:
      "이미지에서 HEX·RGB·HSL 색상 코드를 추출하는 무료 컬러 피커입니다.",
    guideTitle: "이미지 컬러 피커 이용 안내",
    usage: [
      "이미지를 올리거나 URL로 불러온 뒤, 화면을 클릭하거나 스포이드로 원하는 픽셀 색을 뽑으세요.",
      "HEX·RGB·HSL 형식으로 확인할 수 있고, 스와치에 모아 두었다가 한꺼번에 복사할 수도 있습니다."
    ],
    notes: [
      "확대·축소 후에도 클릭한 픽셀 기준으로 색을 읽습니다. 경계선·그라데이션은 주변색과 섞여 보일 수 있습니다.",
      "모니터 보정·브라우저 색 공간에 따라 체감 색과 코드가 조금 다를 수 있습니다.",
      "외부 이미지 URL은 서버 CORS 정책 때문에 불러오지 못하는 경우가 있습니다. 그때는 파일 업로드를 사용하세요."
    ],
    guides: [
      { href: "guides/picker.html", label: "컬러 피커 가이드" },
      { href: "guides/editor.html", label: "이미지 자르기·회전 가이드" },
      { href: "guides/convert.html", label: "이미지 형식 변환 가이드" }
    ]
  },
  {
    id: "speech",
    viewId: "speechView",
    backBtnId: "backHomeFromSpeechBtn",
    title: "발표 시간 계산 | WebToolBay",
    description:
      "발표 대본을 넣으면 예상 발표 시간과 분량을 계산해 주는 무료 도구입니다.",
    guideTitle: "발표 시간 계산 이용 안내",
    usage: [
      "발표 대본을 붙여 넣고 말하기 속도와 목표 시간을 맞추면, 예상 발표 시간과 분량 과부족을 바로 확인할 수 있습니다.",
      "프리셋으로 여유/보통/빠른 속도를 고르거나, 슬라이더로 세밀하게 조절한 뒤 요약 내용을 복사해 준비에 활용하세요."
    ],
    notes: [
      "계산값은 평균 속도 기준 추정치입니다. 실제 발표는 긴장, 질의응답, 자료 설명 때문에 더 길어질 수 있습니다.",
      "한국어는 글자, 영어는 단어 기준으로 섞어 계산하므로 한영 혼용 원고에도 비교적 안정적입니다.",
      "중요한 발표 전에는 소리 내어 읽어 보며 실제 시간을 한 번 더 재는 것이 좋습니다."
    ],
    guides: [
      { href: "guides/speech.html", label: "발표 시간 계산 가이드" },
      { href: "guides/dday.html", label: "디데이 계산 가이드" },
      { href: "guides/overview.html", label: "사이트 한눈에 보기" }
    ]
  },
  {
    id: "dday",
    viewId: "ddayView",
    backBtnId: "backHomeFromDdayBtn",
    title: "디데이 계산기 | WebToolBay",
    description:
      "시험·결혼식·여행 등 목표일까지 남은 일수(D−)와 지난 날수(D+)를 계산합니다.",
    guideTitle: "디데이 계산기 이용 안내",
    usage: [
      "기준일과 목표일을 고르면 남은 날(D−), 당일(D-Day), 지난 날(D+)을 구분해 보여 줍니다.",
      "시험·여행·행사처럼 제목을 적어 두면 결과 해석이 더 분명해지고, 초기화로 다시 시작할 수 있습니다."
    ],
    notes: [
      "날짜 계산 방식(초일불산입 등)은 기관·상황마다 다를 수 있습니다. 행정·계약 일정은 공식 안내를 우선하세요.",
      "시간대·자정 기준으로 하루가 바뀌면 결과가 달라질 수 있으니, 당일 일정은 여유를 두고 확인하세요."
    ],
    guides: [
      { href: "guides/dday.html", label: "디데이 계산 가이드" },
      { href: "guides/calendar.html", label: "양력·음력 변환 가이드" },
      { href: "faq.html", label: "FAQ" }
    ]
  },
  {
    id: "noise",
    viewId: "noiseView",
    backBtnId: "backHomeFromNoiseBtn",
    title: "백색소음 | WebToolBay",
    description:
      "화이트·핑크·브라운 노이즈와 비·폭포·파도 소리로 집중과 휴식을 돕는 무료 백색소음 플레이어입니다.",
    guideTitle: "백색소음 이용 안내",
    usage: [
      "소리 종류를 고른 뒤 재생을 누르면 브라우저에서 바로 재생됩니다. 볼륨과 타이머(연속 또는 분 단위)를 함께 조절할 수 있습니다.",
      "화이트·핑크·브라운 노이즈와 비·폭포·파도·시냇물·바람 같은 자연음을 상황에 맞게 선택하세요."
    ],
    notes: [
      "소리는 기기 안에서 생성·재생되며 별도 계정 없이 사용할 수 있습니다.",
      "장시간 큰 볼륨은 청력에 부담이 될 수 있으니 적절한 크기로 사용하세요.",
      "브라우저 탭을 절전하거나 잠금하면 재생이 끊길 수 있습니다."
    ],
    guides: [
      { href: "guides/noise.html", label: "백색소음 가이드" },
      { href: "guides/overview.html", label: "사이트 한눈에 보기" },
      { href: "faq.html", label: "FAQ" }
    ]
  },
  {
    id: "lotto",
    viewId: "lottoView",
    backBtnId: "backHomeBtn",
    title: "로또 번호 생성기 | WebToolBay",
    description:
      "6/45 로또 번호를 한 번에 최대 5게임까지 추천하는 참고용 무료 생성기입니다.",
    guideTitle: "로또 번호 생성기 이용 안내",
    usage: [
      "번호 생성하기를 누르면 6/45 규칙으로 한 번에 최대 5게임의 번호를 무작위로 뽑습니다.",
      "결과는 참고용 추천이며, 다시 누르면 새 조합이 만들어집니다."
    ],
    notes: [
      "이 도구는 오락·참고용이며 당첨을 보장하지 않습니다.",
      "과거 출현 빈도나 ‘핫넘버’ 해석은 통계적 착시에 가깝고, 매 회차는 독립적입니다.",
      "실제 구매·당첨 관련 안내는 복권 공식 채널을 확인하세요."
    ],
    guides: [
      { href: "guides/lotto.html", label: "로또 생성기 가이드" },
      { href: "guides/overview.html", label: "사이트 한눈에 보기" },
      { href: "terms.html", label: "이용약관" }
    ]
  },
  {
    id: "minesweeper",
    viewId: "minesweeperView",
    backBtnId: "backHomeFromMinesweeperBtn",
    title: "지뢰찾기 게임 | WebToolBay",
    description:
      "브라우저에서 바로 즐기는 클래식 지뢰찾기. 난이도를 고르고 지뢰를 피해 빈칸을 여세요.",
    guideTitle: "지뢰찾기 이용 안내",
    usage: [
      "난이도를 고른 뒤 칸을 열어 지뢰를 피하세요. 왼쪽 클릭으로 열고, 오른쪽 클릭(또는 깃발 모드)으로 깃발을 표시합니다.",
      "숫자는 주변 8칸의 지뢰 개수입니다. 첫 클릭은 항상 안전하게 처리됩니다."
    ],
    notes: [
      "현금 베팅·아이템 결제와 무관한 가벼운 퍼즐 게임입니다.",
      "막히는 구간에서는 추측이 필요할 수 있습니다. 초급에서 숫자 패턴을 익힌 뒤 난이도를 올리세요.",
      "다른 메뉴로 이동하면 진행 중 판이 초기화될 수 있습니다."
    ],
    guides: [
      { href: "guides/games.html", label: "브라우저 게임 가이드" },
      { href: "guides/chess.html", label: "체스 가이드" },
      { href: "tools/index.html", label: "도구 목록" }
    ]
  },
  {
    id: "tetris",
    viewId: "tetrisView",
    backBtnId: "backHomeFromTetrisBtn",
    title: "테트리스 게임 | WebToolBay",
    description:
      "브라우저에서 바로 즐기는 테트리스 게임입니다. 레벨 1부터 99까지 속도를 조절하며 줄을 지워 보세요.",
    guideTitle: "테트리스 이용 안내",
    usage: [
      "레벨을 정한 뒤 시작을 누르면 블록이 내려옵니다. 이동·회전으로 가로줄을 완성해 줄을 지우고 점수를 올리세요.",
      "키보드 조작이 편하므로 데스크톱에서 플레이하면 더 쾌적합니다. 일시정지와 음소거도 지원합니다."
    ],
    notes: [
      "레벨이 오를수록 낙하 속도가 빨라집니다. 빈 공간을 최소화하며 평탄하게 쌓는 것이 기본입니다.",
      "오락용 브라우저 게임이며 설치나 결제가 필요하지 않습니다.",
      "장시간 플레이 시 눈과 손목 휴식을 취하세요."
    ],
    guides: [
      { href: "guides/games.html", label: "브라우저 게임 가이드" },
      { href: "tools/minesweeper.html", label: "지뢰찾기" },
      { href: "tools/index.html", label: "도구 목록" }
    ]
  },
  {
    id: "gomoku",
    viewId: "gomokuView",
    backBtnId: "backHomeFromGomokuBtn",
    title: "오목 게임 | WebToolBay",
    description:
      "AI와 대국하는 19x19 오목 게임입니다. 흑·백 선택과 레벨 조절이 가능한 브라우저 게임입니다.",
    guideTitle: "오목 이용 안내",
    usage: [
      "흑·백과 AI 레벨을 고른 뒤 시작하면 19×19 판에서 대국할 수 있습니다. 가로·세로·대각선으로 같은 색 돌 5개를 먼저 만들면 승리합니다.",
      "내 차례에 빈 칸을 눌러 착수하고, 필요하면 재시작으로 새 판을 열 수 있습니다."
    ],
    notes: [
      "초보자는 상대의 열린 3·4를 막는 수를 우선하는 편이 안전합니다.",
      "AI 난이도가 높을수록 계산이 깊어져 응답이 조금 느려질 수 있습니다.",
      "규칙 설명과 초보 팁은 게임 가이드에서 이어서 확인할 수 있습니다."
    ],
    guides: [
      { href: "guides/games.html", label: "브라우저 게임 가이드" },
      { href: "guides/chess.html", label: "체스 가이드" },
      { href: "tools/index.html", label: "도구 목록" }
    ]
  },
  {
    id: "memory",
    viewId: "memoryView",
    backBtnId: "backHomeFromMemoryBtn",
    title: "기억력 테스트 | WebToolBay",
    description:
      "4x4부터 8x8까지 보드를 고를 수 있는 브라우저 기억력 테스트 게임입니다. 시간과 시도 횟수를 함께 확인하세요.",
    guideTitle: "기억력 테스트 이용 안내",
    usage: [
      "보드 크기(4×4·6×6·8×8)를 고른 뒤 시작해 같은 이모지 쌍을 찾아 맞추세요. 시간과 시도 횟수가 함께 기록됩니다.",
      "난이도를 바꾸면 진행 중이던 판은 초기화되므로, 기록을 남기려면 판을 끝낸 뒤 크기를 바꾸세요."
    ],
    notes: [
      "큰 보드는 구역을 나눠 위치를 기억하는 전략이 시도 횟수를 줄이는 데 도움이 됩니다.",
      "효과음이 나올 수 있으니 공공장소에서는 볼륨에 주의하세요.",
      "집중력을 가볍게 연습하는 오락용 게임이며 의학적 검사 목적이 아닙니다."
    ],
    guides: [
      { href: "guides/games.html", label: "브라우저 게임 가이드" },
      { href: "tools/flag.html", label: "나라 국기 맞추기" },
      { href: "tools/index.html", label: "도구 목록" }
    ]
  },
  {
    id: "chess",
    viewId: "chessView",
    backBtnId: "backHomeFromChessBtn",
    title: "체스 | WebToolBay",
    description:
      "브라우저에서 AI와 정식 규칙 체스를 둘 수 있습니다. 캐슬링, 앙파상, 승격까지 지원합니다.",
    guideTitle: "체스 이용 안내",
    usage: [
      "난이도와 내 기물(백/흑)을 고른 뒤 기물을 누르고 표시된 칸을 다시 눌러 이동하세요. 캐슬링·앙파상·승격을 포함한 정식 규칙을 따릅니다.",
      "한 수 무르기, 판 뒤집기, 새 게임으로 편하게 연습할 수 있고 기보도 함께 확인할 수 있습니다."
    ],
    notes: [
      "AI 계산은 브라우저 안에서만 이루어지며 대국 기록은 서버에 저장되지 않습니다.",
      "고급 난이도는 수를 더 깊이 읽어 응답이 느려질 수 있습니다.",
      "특수 규칙과 기보 읽는 법은 체스 가이드에서 자세히 설명합니다."
    ],
    guides: [
      { href: "guides/chess.html", label: "체스 가이드" },
      { href: "guides/games.html", label: "브라우저 게임 가이드" },
      { href: "tools/gomoku.html", label: "오목" }
    ]
  },
  {
    id: "flag",
    viewId: "flagView",
    backBtnId: "backHomeFromFlagBtn",
    title: "나라 국기 맞추기 | WebToolBay",
    description:
      "국기를 보고 4지선다로 나라를 맞히는 브라우저 퀴즈입니다. 정답과 수도를 함께 확인할 수 있습니다.",
    guideTitle: "나라 국기 맞추기 이용 안내",
    usage: [
      "시작을 누른 뒤 보이는 국기를 보고 네 보기 중 나라를 고르세요. 정답과 함께 수도 정보도 확인할 수 있습니다.",
      "다음 문제로 이어가며 가볍게 지리 상식을 점검할 수 있고, 처음부터 다시 시작할 수도 있습니다."
    ],
    notes: [
      "학습·오락용 퀴즈이며 시험이나 공식 평가를 대체하지 않습니다.",
      "비슷한 색 조합의 국기는 헷갈리기 쉬우니, 문양과 비율도 함께 보세요.",
      "수도까지 이어서 연습하려면 나라 수도 맞추기 도구를 함께 사용해 보세요."
    ],
    guides: [
      { href: "guides/games.html", label: "브라우저 게임 가이드" },
      { href: "tools/capital.html", label: "나라 수도 맞추기" },
      { href: "tools/index.html", label: "도구 목록" }
    ]
  },
  {
    id: "capital",
    viewId: "capitalView",
    backBtnId: "backHomeFromCapitalBtn",
    title: "나라 수도 맞추기 | WebToolBay",
    description:
      "나라 이름과 국기를 보고 수도를 맞히는 브라우저 퀴즈입니다. 가볍게 지리 상식을 점검해 보세요.",
    guideTitle: "나라 수도 맞추기 이용 안내",
    usage: [
      "나라 이름과 국기를 보고 네 도시 보기 중 수도를 고르세요. 정답을 확인한 뒤 다음 문제로 이어갈 수 있습니다.",
      "국기 퀴즈와 번갈아 풀면 나라·수도·국기를 함께 익히는 데 도움이 됩니다."
    ],
    notes: [
      "일부 나라는 행정 수도·법정 수도 표기가 자료마다 다를 수 있습니다. 이 퀴즈는 일반적인 학습용 표기를 따릅니다.",
      "오락·학습 목적이며 공식 지리 자료를 대체하지 않습니다."
    ],
    guides: [
      { href: "guides/games.html", label: "브라우저 게임 가이드" },
      { href: "tools/flag.html", label: "나라 국기 맞추기" },
      { href: "tools/index.html", label: "도구 목록" }
    ]
  }
];

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderGuide(tool) {
  const usage = tool.usage
    .map(function (p) {
      return "      <p>" + escapeHtml(p) + "</p>";
    })
    .join("\n");
  const notes = tool.notes
    .map(function (item) {
      return "        <li>" + escapeHtml(item) + "</li>";
    })
    .join("\n");
  const guides = tool.guides
    .map(function (g) {
      return (
        '        <li><a href="' +
        escapeAttr(g.href) +
        '">' +
        escapeHtml(g.label) +
        "</a></li>"
      );
    })
    .join("\n");

  return [
    '    <section class="tool-page-guide" aria-label="' + escapeAttr(tool.guideTitle) + '">',
    "      <h2>" + escapeHtml(tool.guideTitle) + "</h2>",
    "      <h3>사용법</h3>",
    usage,
    "      <h3>주의할 점</h3>",
    "      <ul>",
    notes,
    "      </ul>",
    "      <h3>관련 가이드</h3>",
    "      <ul>",
    guides,
    "      </ul>",
    "    </section>",
    ""
  ].join("\n");
}

function patchHead(html, tool) {
  const pageUrl = BASE_URL + "tools/" + tool.id + ".html";
  let out = html;

  out = out.replace(/<title>[^<]*<\/title>/, "<title>" + tool.title + "</title>");

  out = out.replace(
    /<meta name="description" content="[^"]*"\s*\/>/,
    '<meta name="description" content="' + escapeAttr(tool.description) + '" />'
  );

  out = out.replace(
    /<link rel="canonical" href="[^"]*"\s*\/>/,
    '<link rel="canonical" href="' + pageUrl + '" />'
  );

  out = out.replace(
    /<meta property="og:title" content="[^"]*"\s*\/>/,
    '<meta property="og:title" content="' + escapeAttr(tool.title) + '" />'
  );
  out = out.replace(
    /<meta property="og:description" content="[^"]*"\s*\/>/,
    '<meta property="og:description" content="' + escapeAttr(tool.description) + '" />'
  );
  out = out.replace(
    /<meta property="og:url" content="[^"]*"\s*\/>/,
    '<meta property="og:url" content="' + pageUrl + '" />'
  );
  out = out.replace(
    /<meta name="twitter:title" content="[^"]*"\s*\/>/,
    '<meta name="twitter:title" content="' + escapeAttr(tool.title) + '" />'
  );
  out = out.replace(
    /<meta name="twitter:description" content="[^"]*"\s*\/>/,
    '<meta name="twitter:description" content="' + escapeAttr(tool.description) + '" />'
  );

  const boot =
    '  <base href="../" />\n' +
    "  <script>window.__WTB_TOOL_PAGE__=true;window.__WTB_INITIAL_VIEW__=" +
    JSON.stringify(tool.id) +
    ";</script>\n";

  if (out.indexOf('<base href="../" />') === -1) {
    out = out.replace(/<head>\s*/, "<head>\n" + boot);
  }

  return out;
}

function injectGuide(html, tool) {
  const guide = renderGuide(tool);
  const backRe = new RegExp(
    "(<button[^>]*\\bid=\"" +
      tool.backBtnId +
      "\"[\\s\\S]*?<\\/button>)([\\s\\S]*?<\\/main>)"
  );
  if (!backRe.test(html)) {
    throw new Error("back button not found for " + tool.id + " (" + tool.backBtnId + ")");
  }
  return html.replace(backRe, guide + "\n    $1$2");
}

function injectGuideStyles(html) {
  if (html.indexOf(".tool-page-guide") !== -1) return html;
  const css = [
    "    .tool-page-guide {",
    "      margin-top: 1.75rem;",
    "      padding: 1.15rem 0 0.25rem;",
    "      border-top: 1px solid color-mix(in srgb, var(--text) 12%, transparent);",
    "      text-align: left;",
    "      max-width: 42rem;",
    "    }",
    "    .tool-page-guide h2 {",
    "      margin: 0 0 0.75rem;",
    "      font-size: 1.12rem;",
    "      letter-spacing: -0.01em;",
    "    }",
    "    .tool-page-guide h3 {",
    "      margin: 1rem 0 0.4rem;",
    "      font-size: 0.95rem;",
    "    }",
    "    .tool-page-guide p,",
    "    .tool-page-guide li {",
    "      color: var(--muted);",
    "      font-size: 0.9rem;",
    "      line-height: 1.65;",
    "    }",
    "    .tool-page-guide p { margin: 0 0 0.55rem; }",
    "    .tool-page-guide ul { margin: 0 0 0.35rem; padding-left: 1.15rem; }",
    "    .tool-page-guide a { color: var(--accent); text-decoration: none; }",
    "    .tool-page-guide a:hover { text-decoration: underline; }",
    ""
  ].join("\n");
  return html.replace("</style>", css + "  </style>");
}

function main() {
  const source = fs.readFileSync(INDEX, "utf8");
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const tool of TOOLS) {
    let html = patchHead(source, tool);
    html = injectGuideStyles(html);
    html = injectGuide(html, tool);
    const outPath = path.join(OUT_DIR, tool.id + ".html");
    fs.writeFileSync(outPath, html, "utf8");
    console.log("wrote", path.relative(ROOT, outPath));
  }
}

main();
