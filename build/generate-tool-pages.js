/*
 * Builds standalone /tools/*.html pages from index.app.html so each tool has a
 * unique crawlable URL on GitHub Pages, plus substantial usage/editorial copy.
 * Also writes a slim public index.html that keeps only the homepage hub (no tool
 * UIs), so Google does not treat /tools/* as duplicates of /.
 *
 *   node build/generate-tool-pages.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const APP_INDEX = path.join(ROOT, "index.app.html");
const PUBLIC_INDEX = path.join(ROOT, "index.html");
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
    intro:
      "외출·세탁·운동·여행처럼 “지금 당장 날씨가 궁금할 때” 쓰는 도구입니다. 위치 권한을 허용하면 현재 위치 기준으로 불러오고, 거부해도 도시 검색으로 같은 정보를 볼 수 있습니다. 기상청 특보·재난 문자를 대체하지 않으며, 일상 계획용 참고 예보입니다.",
    usage: [
      "페이지를 열면 위치 권한을 요청합니다. 허용하면 현재 날씨, 앞으로 24시간, 7일 예보를 한 화면에 표시합니다.",
      "권한을 거부했거나 위치가 부정확하면 상단 검색창에 도시 이름을 입력해 선택하세요. °C/°F 전환과 새로고침도 같은 화면에서 할 수 있습니다."
    ],
    scenarios: [
      "출근·등교 전 우산이 필요한지 24시간 강수 확률로 빠르게 판단할 때",
      "주말 나들이·캠핑 전 7일 예보로 날짜를 고를 때",
      "다른 도시 출장·여행지 날씨를 검색해 짐을 챙길 때"
    ],
    tips: [
      "강수 ‘확률’과 ‘강수량’은 다릅니다. 확률만 보고 비의 세기를 단정하지 마세요.",
      "먼 날짜 예보일수록 변동이 큽니다. 중요한 일정은 전날 다시 확인하세요.",
      "체감온도는 바람·습도를 반영한 참고값이라 실측 기온과 다를 수 있습니다."
    ],
    notes: [
      "예보 데이터는 Open-Meteo를 사용합니다. 공식 특보·경보가 필요할 때는 기상청·재난 안내를 우선하세요.",
      "위치 기반 조회는 브라우저 위치 권한과 기기 GPS/네트워크 정확도에 영향을 받습니다."
    ],
    faq: [
      {
        q: "위치가 잘못 나와요.",
        a: "도시 검색으로 직접 고르거나, 기기 위치 서비스를 켠 뒤 새로고침해 보세요. VPN을 쓰면 위치가 어긋날 수 있습니다."
      },
      {
        q: "광고·가입 없이 쓸 수 있나요?",
        a: "도구 자체는 회원 가입 없이 바로 사용할 수 있습니다. 자세한 데이터 처리 방식은 개인정보처리방침을 참고하세요."
      }
    ],
    guides: [
      { href: "guides/weather.html", label: "날씨 활용 가이드" },
      { href: "guides/precip-probability.html", label: "강수 확률 읽는 법" },
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
    intro:
      "음력 생일, 제사·기일, 전통 명절처럼 양력과 음력을 오가야 할 때 쓰는 변환기입니다. 윤달 여부와 60갑자·띠까지 한 화면에서 확인할 수 있어, 달력만으로 헷갈리기 쉬운 날짜를 정리하는 데 도움이 됩니다.",
    usage: [
      "양력 연·월·일을 고른 뒤 변환하면 해당 음력과 윤달 여부, 60갑자·띠를 확인할 수 있습니다. 반대로 음력에서 양력으로도 변환됩니다.",
      "오늘 날짜 조회로 바로 시작할 수 있고, 값을 바꾸면 결과가 이어서 갱신됩니다."
    ],
    scenarios: [
      "음력으로만 기억되는 부모님·조상 기일을 양력으로 옮길 때",
      "가족 음력 생일을 양력 달력에 표시할 때",
      "갑자·띠를 참고용 문화 정보로 확인할 때"
    ],
    tips: [
      "같은 음력 날짜라도 윤달이면 양력이 달라집니다. 제사·생일은 윤달 표시를 반드시 확인하세요.",
      "변환 후 결과를 캡처하거나 메모해 두면 매년 다시 찾을 때 빠릅니다.",
      "디데이 계산기와 함께 쓰면 ‘음력 기념일까지 남은 날’을 계획하기 쉽습니다."
    ],
    notes: [
      "띠·갑자는 참고용 문화 정보이며, 법적·행정 서류의 공식 기준을 대체하지 않습니다.",
      "지역·전통에 따라 기일 계산 관습이 다를 수 있으니, 중요한 가족 일정은 어르신·가족 합의를 우선하세요."
    ],
    faq: [
      {
        q: "윤달이 뭐인가요?",
        a: "음력은 달의 주기를 따르다 보니 해마다 길이가 어긋납니다. 그 차이를 맞추려고 넣는 여분의 달이 윤달입니다."
      },
      {
        q: "행정·호적 날짜도 이걸로 확정해도 되나요?",
        a: "아니요. 이 도구는 일상·문화용 참고 변환입니다. 공식 서류는 관공서·원본 기록을 기준으로 하세요."
      }
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
    intro:
      "서버 설정, 원격 접속 허용, VPN 동작 확인처럼 “지금 내 공인 IP가 무엇인지”가 필요할 때 씁니다. IPv4와 IPv6, ISP, 대략적인 국가·도시 정보를 한눈에 보고 복사할 수 있습니다.",
    usage: [
      "페이지를 열면 현재 접속에 쓰인 공인 IPv4·IPv6와 ISP, 대략적인 국가·도시 정보를 표시합니다.",
      "아이피 복사 버튼으로 값을 클립보드에 넣을 수 있고, 새로고침으로 다시 조회할 수 있습니다."
    ],
    scenarios: [
      "홈서버·NAS·게임 서버에 접속 허용 IP를 등록할 때",
      "VPN·프록시 연결 전후로 공인 IP가 바뀌는지 확인할 때",
      "고객지원·네트워크 문의에 현재 IP를 전달할 때"
    ],
    tips: [
      "표시 위치는 ISP·네트워크 기반 추정치라 실제 집 주소와 다를 수 있습니다.",
      "회사망·모바일 테더링·공용 Wi-Fi에서는 개인 회선과 다른 IP가 나옵니다.",
      "공유할 때는 필요한 사람에게만, 필요한 동안만 전달하세요."
    ],
    notes: [
      "이 값은 개인 식별에 쓰이는 민감 정보만큼은 아니지만, 네트워크 환경을 드러낼 수 있습니다.",
      "조회 원리와 주의점은 가이드와 개인정보처리방침에서 더 자세히 설명합니다."
    ],
    faq: [
      {
        q: "IPv6만 보이거나 비어 있어요.",
        a: "회선·기기·브라우저가 IPv6를 쓰지 않으면 비어 있을 수 있습니다. IPv4만으로도 많은 작업에 충분합니다."
      },
      {
        q: "도시가 틀려요.",
        a: "IP 위치는 GPS가 아니라 데이터베이스 추정입니다. 근처 도시나 ISP 거점으로 표시되는 경우가 흔합니다."
      }
    ],
    guides: [
      { href: "guides/ip.html", label: "내 아이피 찾기 가이드" },
      { href: "guides/ipv4-vs-ipv6.html", label: "IPv4와 IPv6의 차이" },
      { href: "privacy.html", label: "개인정보처리방침" }
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
    intro:
      "서류 사진, 스크린샷, 책·칠판 촬영본처럼 이미지만 있고 글자를 다시 칠 수 없을 때 쓰는 OCR입니다. 이미지는 서버로 보내지 않고 브라우저 안에서만 인식하므로, 민감한 메모를 다룰 때도 부담이 적습니다.",
    usage: [
      "이미지 파일을 올리거나 끌어다 놓은 뒤 인식 언어를 고르고 추출을 실행하세요. 결과는 아래에서 복사하거나 텍스트 파일로 저장할 수 있습니다.",
      "처음 쓰는 언어는 인식 데이터를 내려받아 시간이 조금 걸릴 수 있고, 이후에는 브라우저에 저장되어 더 빨라집니다."
    ],
    scenarios: [
      "영수증·명함·안내문을 타이핑 없이 텍스트로 옮길 때",
      "외국어 간판·메뉴 사진을 복사해 번역할 때",
      "강의 슬라이드·화이트보드 사진을 메모로 정리할 때"
    ],
    tips: [
      "선명하고 대비가 큰 사진이 유리합니다. 기울어졌다면 먼저 자르기·회전 도구로 바로잡으세요.",
      "한 화면에 글자가 너무 많으면 영역을 잘라 여러 번 인식하는 편이 정확합니다.",
      "추출 후 숫자·고유명사는 반드시 눈으로 한 번 더 확인하세요."
    ],
    notes: [
      "흐리거나 손글씨, 배경이 복잡한 이미지는 오인식이 날 수 있습니다.",
      "PDF는 지원하지 않습니다. 필요하면 페이지를 이미지로 만든 뒤 사용하세요.",
      "의료·법률·계약처럼 오타가 치명적인 문서는 원본과 대조하세요."
    ],
    faq: [
      {
        q: "이미지가 외부로 전송되나요?",
        a: "아니요. 인식은 이 기기 브라우저 안에서만 이뤄집니다."
      },
      {
        q: "인식이 느려요.",
        a: "첫 언어 모델 다운로드와 큰 이미지 처리에 시간이 걸립니다. 해상도를 적당히 줄이거나 영역을 잘라 보세요."
      }
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
    intro:
      "업로드 폼이 JPG만 받거나, 투명 배경 PNG가 필요할 때처럼 형식만 바꿔야 하는 작업을 위한 도구입니다. 변환은 브라우저에서 바로 이뤄지며, 여러 장이면 ZIP으로도 받을 수 있습니다.",
    usage: [
      "변환할 이미지를 추가한 뒤 목표 형식(PNG·JPG·WebP·BMP)을 고르고 변환을 실행하세요.",
      "결과는 개별 저장하거나 ZIP으로 받고, 목록을 비운 뒤 다음 작업을 이어갈 수 있습니다."
    ],
    scenarios: [
      "웹·메일 첨부용으로 용량을 줄이기 위해 JPG·WebP로 바꿀 때",
      "로고·아이콘의 투명 배경을 유지하려고 PNG로 저장할 때",
      "구형 프로그램이 요구하는 BMP로 맞춰야 할 때"
    ],
    tips: [
      "JPG는 투명 배경을 지원하지 않아 PNG 투명 영역이 단색으로 바뀔 수 있습니다.",
      "반복 압축하면 화질이 떨어지므로 원본을 남기고 변환본을 쓰세요.",
      "먼저 자르기·회전으로 구도를 맞춘 뒤 변환하면 재작업이 줄어듭니다."
    ],
    notes: [
      "매우 큰 이미지는 기기 메모리에 따라 느리거나 실패할 수 있습니다.",
      "인쇄용 CMYK 변환이나 고급 색 관리는 지원하지 않습니다."
    ],
    faq: [
      {
        q: "WebP는 언제 쓰나요?",
        a: "웹에서 비슷한 화질로 용량을 줄일 때 유리합니다. 다만 일부 구형 소프트웨어는 열지 못할 수 있습니다."
      },
      {
        q: "파일이 서버에 남나요?",
        a: "아니요. 변환은 브라우저 안에서 처리됩니다."
      }
    ],
    guides: [
      { href: "guides/convert.html", label: "이미지 형식 변환 가이드" },
      { href: "guides/image-formats-compare.html", label: "WebP vs PNG vs JPG 비교" },
      { href: "guides/editor.html", label: "이미지 자르기·회전 가이드" }
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
    intro:
      "SNS 썸네일, 증명 사진 비율, 기울어진 촬영본처럼 “조금만 다듬으면 되는” 이미지를 위한 편집기입니다. 자르기·회전·반전·리사이즈를 한 화면에서 끝낼 수 있고, 원본은 서버에 올라가지 않습니다.",
    usage: [
      "이미지를 올린 뒤 영역을 드래그해 자르거나, 회전·좌우/상하 반전, 픽셀 크기 조절을 적용하세요.",
      "작업 중간에는 실행 취소와 초기화가 가능하고, 원하는 결과가 나오면 저장 버튼으로 내려받으세요."
    ],
    scenarios: [
      "1:1·16:9·9:16 비율로 SNS·유튜브 썸네일을 맞출 때",
      "문서·OCR 전에 기울어진 사진을 바로잡을 때",
      "용량·해상도 제한에 맞게 가로·세로 픽셀을 줄일 때"
    ],
    tips: [
      "먼저 비율을 정한 뒤 자르면 중요한 피사체가 잘리는 실수를 줄일 수 있습니다.",
      "과도하게 키우면 선명도가 떨어집니다. 키우기보다 원본에 가깝게 쓰는 편이 낫습니다.",
      "편집 후 형식이 필요하면 이미지 형식 변환 도구로 이어가세요."
    ],
    notes: [
      "편집은 브라우저에서 처리되며 원본 파일을 서버에 올리지 않습니다.",
      "레이어·브러시 같은 전문 포토샵 기능은 제공하지 않습니다."
    ],
    faq: [
      {
        q: "원본이 덮어쓰이나요?",
        a: "아니요. 내려받는 파일이 새로 만들어지며, 기기 속 원본은 그대로입니다."
      },
      {
        q: "투명 배경을 유지할 수 있나요?",
        a: "원본이 투명 PNG라면 작업 후 PNG로 저장하는 흐름이 안전합니다. JPG로 저장하면 투명이 사라집니다."
      }
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
    intro:
      "참고 이미지·로고·스크린샷에서 정확한 색 코드가 필요할 때 씁니다. 클릭한 픽셀의 HEX·RGB·HSL 등을 바로 확인하고 스와치로 모아 복사할 수 있으며, 이미지는 기기 밖으로 나가지 않습니다.",
    usage: [
      "이미지를 올리거나 URL로 불러온 뒤, 화면을 클릭하거나 스포이드로 원하는 픽셀 색을 뽑으세요.",
      "HEX·RGB·HSL 형식으로 확인할 수 있고, 스와치에 모아 두었다가 한꺼번에 복사할 수도 있습니다."
    ],
    scenarios: [
      "브랜드 로고에서 대표색을 CSS·디자인 툴에 옮길 때",
      "참고 사진의 배색을 견본으로 모아 팔레트를 만들 때",
      "화면 캡처 후 버튼·배경색 코드를 바로 확인할 때"
    ],
    tips: [
      "가는 선·작은 아이콘은 확대한 뒤 픽셀 단위로 찍으면 정확합니다.",
      "사진 압축·그림자 때문에 같은 물체라도 지점마다 값이 달라질 수 있으니 여러 점을 비교하세요.",
      "외부 URL이 CORS로 막히면 파일을 내려받아 업로드하세요."
    ],
    notes: [
      "모니터 보정·브라우저 색 공간에 따라 체감 색과 코드가 조금 다를 수 있습니다.",
      "CMYK 값은 참고용 변환이며, 인쇄 최종본은 전용 프로그램에서 프로파일을 적용하세요."
    ],
    faq: [
      {
        q: "어떤 코드를 쓰면 되나요?",
        a: "웹·CSS는 HEX 또는 RGB가 일반적입니다. 밝기만 살짝 바꿀 때는 HSL이 다루기 쉽습니다."
      },
      {
        q: "견본이 사라졌어요.",
        a: "스와치는 페이지를 새로고침하면 초기화됩니다. 필요한 코드는 복사해 따로 저장하세요."
      }
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
    intro:
      "수업 발표, 면접, 회의 브리핑처럼 “이 원고를 읽으면 몇 분이나 걸릴지”가 궁금할 때 쓰는 계산기입니다. 말하기 속도와 목표 시간을 맞추면 분량 과부족을 바로 가늠할 수 있습니다.",
    usage: [
      "발표 대본을 붙여 넣고 말하기 속도와 목표 시간을 맞추면, 예상 발표 시간과 분량 과부족을 바로 확인할 수 있습니다.",
      "프리셋으로 여유/보통/빠른 속도를 고르거나, 슬라이더로 세밀하게 조절한 뒤 요약 내용을 복사해 준비에 활용하세요."
    ],
    scenarios: [
      "5분·10분 제한 발표에 맞춰 원고를 줄이거나 늘릴 때",
      "한영 혼용 대본의 대략 소요 시간을 가늠할 때",
      "리허설 전에 “너무 긴지”를 숫자로 먼저 확인할 때"
    ],
    tips: [
      "실제 발표는 긴장·질의응답·자료 설명 때문에 더 길어질 수 있으니 여유를 두세요.",
      "중요한 발표 전에는 소리 내어 읽어 실제 시간을 한 번 더 재는 것이 좋습니다.",
      "디데이 계산기로 발표일까지 남은 날을 함께 보면 연습 일정을 잡기 쉽습니다."
    ],
    notes: [
      "계산값은 평균 속도 기준 추정치입니다. 사람·상황마다 말하기 속도가 다릅니다.",
      "한국어는 글자, 영어는 단어 기준으로 섞어 계산합니다."
    ],
    faq: [
      {
        q: "슬라이드 설명 시간도 포함되나요?",
        a: "대본에 적힌 말만 기준으로 합니다. 침묵·데모·질의응답은 별도로 시간을 남겨 두세요."
      },
      {
        q: "결과가 실제와 달랐어요.",
        a: "평소 말하기 속도에 맞게 슬라이더를 조정한 뒤, 한 번 소리 내어 읽어 보정하세요."
      }
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
    intro:
      "수능, 자격증, 결혼식, 프로젝트 마감처럼 “그날까지 며칠인지”를 숫자로 보고 싶을 때 씁니다. 미래 일정은 D−, 당일은 D-Day, 지난 일정은 D+로 구분해 보여 주며, 브라우저에서만 계산합니다.",
    usage: [
      "기준일과 목표일을 고르면 남은 날(D−), 당일(D-Day), 지난 날(D+)을 구분해 보여 줍니다.",
      "시험·여행·행사처럼 제목을 적어 두면 결과 해석이 더 분명해지고, 초기화로 다시 시작할 수 있습니다."
    ],
    scenarios: [
      "시험·마감까지 남은 날을 매일 확인하며 계획을 세울 때",
      "여행·행사 D-Day를 가족과 공유할 숫자를 만들 때",
      "기준일을 바꿔 “다음 주 월요일 기준이면 며칠인가”를 시뮬레이션할 때"
    ],
    tips: [
      "이 도구는 초일불산입(날짜 차이) 방식입니다. 만난 날을 1일로 세는 100일 기념일과는 다를 수 있습니다.",
      "여러 일정을 비교할 때는 기준일을 고정하고 목표일만 바꿔 보세요.",
      "음력 기념일이면 먼저 양력·음력 변환으로 양력 날짜를 구한 뒤 입력하세요."
    ],
    notes: [
      "영업일·공휴일만 세는 계산과는 다릅니다. 법정 마감은 공식 달력을 확인하세요.",
      "시차가 다른 지역 일정은 현지 날짜 기준으로 목표일을 입력하는 것이 정확합니다."
    ],
    faq: [
      {
        q: "D − 0 대신 D-Day로 나오나요?",
        a: "같은 날이면 행사 당일임을 강조하기 위해 D-Day로 표시합니다."
      },
      {
        q: "100일 기념일과 숫자가 달라요.",
        a: "기념일 계산은 시작일을 1일째로 세는 경우가 많습니다. 이 도구는 며칠 차이만 셉니다."
      }
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
    intro:
      "공부·업무·짧은 휴식에 일정한 배경음이 필요할 때 쓰는 플레이어입니다. 파일을 받지 않고 브라우저에서 노이즈·자연음 질감을 만들어 재생하며, 볼륨과 타이머로 세션 길이를 조절할 수 있습니다.",
    usage: [
      "소리 종류를 고른 뒤 재생을 누르면 브라우저에서 바로 재생됩니다. 볼륨과 타이머(연속 또는 분 단위)를 함께 조절할 수 있습니다.",
      "화이트·핑크·브라운 노이즈와 비·폭포·파도·시냇물·바람 같은 자연음을 상황에 맞게 선택하세요."
    ],
    scenarios: [
      "카페·집 소음을 가리며 집중 타이머를 돌릴 때",
      "잠들기 전 짧은 시간만 부드러운 배경음을 틀 때",
      "헤드폰으로 약한 일정한 소리를 배경에 깔 때"
    ],
    tips: [
      "집중용으로는 화이트·핑크, 부드러운 느낌은 브라운·비·파도를 많이 고릅니다.",
      "첫 재생은 브라우저 정책상 클릭(또는 탭) 뒤에만 소리가 납니다.",
      "다른 메뉴로 이동하면 재생이 멈출 수 있으니, 긴 수면용 전용 앱과는 다르게 생각하세요."
    ],
    notes: [
      "의료·수면 장애 치료가 아니며 취향용 배경음 도구입니다.",
      "장시간 큰 볼륨은 청력에 부담이 될 수 있습니다.",
      "탭 절전·화면 잠금 시 재생이 끊길 수 있습니다."
    ],
    faq: [
      {
        q: "MP3로 저장되나요?",
        a: "아니요. 실시간 합성 재생만 제공하며 파일 다운로드는 없습니다."
      },
      {
        q: "소리가 안 나요.",
        a: "재생 버튼·기기 음소거·탭 음소거를 확인하고, 페이지를 클릭한 뒤 다시 재생해 보세요."
      }
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
    intro:
      "직접 고르기 귀찮을 때 무작위로 6/45 조합을 뽑아 보는 참고용 도구입니다. 당첨을 예측하거나 보장하지 않으며, 오락·편의 목적의 번호 제안만 제공합니다.",
    usage: [
      "번호 생성하기를 누르면 6/45 규칙으로 한 번에 최대 5게임의 번호를 무작위로 뽑습니다.",
      "결과는 참고용 추천이며, 다시 누르면 새 조합이 만들어집니다."
    ],
    scenarios: [
      "즉석에서 여러 게임을 빠르게 채워 보고 싶을 때",
      "직접 고른 번호와 비교할 무작위 조합이 필요할 때"
    ],
    tips: [
      "매 회차는 독립적입니다. ‘핫넘버’·출현 빈도만으로 유리해지지 않습니다.",
      "구매 한도와 일정은 본인 예산 안에서 결정하세요.",
      "실제 구매·당첨 안내는 복권 공식 채널을 확인하세요."
    ],
    notes: [
      "이 도구는 오락·참고용이며 당첨을 보장하지 않습니다.",
      "미성년자 구매 제한 등 관련 법령·판매처 규칙을 지키세요."
    ],
    faq: [
      {
        q: "이 번호가 더 잘 나오나요?",
        a: "아니요. 균등한 무작위 조합에 가깝고, 특정 조합의 당첨 확률을 높이지 않습니다."
      },
      {
        q: "과거 당첨 번호를 분석하나요?",
        a: "아니요. 과거 데이터 기반 예측 기능은 없습니다."
      }
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
    intro:
      "짧은 휴식에 머리만 환기하고 싶을 때 좋은 클래식 퍼즐입니다. 설치·회원 가입 없이 난이도를 고르고 바로 시작할 수 있으며, 현금 베팅이나 결제와는 무관합니다.",
    usage: [
      "난이도를 고른 뒤 칸을 열어 지뢰를 피하세요. 왼쪽 클릭으로 열고, 오른쪽 클릭(또는 깃발 모드)으로 깃발을 표시합니다.",
      "숫자는 주변 8칸의 지뢰 개수입니다. 첫 클릭은 항상 안전하게 처리됩니다."
    ],
    scenarios: [
      "회의·공부 사이 5~10분 두뇌 휴식용",
      "숫자 논리 퍼즐로 집중력을 짧게 연습할 때"
    ],
    tips: [
      "초급에서 숫자 패턴을 익힌 뒤 난이도를 올리세요.",
      "막히는 구간에서는 추측이 필요할 수 있습니다. 깃발로 후보를 표시해 두세요.",
      "확실한 안전 칸부터 열고, 모호한 칸은 나중에 두는 습관이 도움이 됩니다."
    ],
    notes: [
      "다른 메뉴로 이동하면 진행 중 판이 초기화될 수 있습니다.",
      "장시간 플레이 시 눈과 손목을 쉬게 하세요."
    ],
    faq: [
      {
        q: "모바일에서도 되나요?",
        a: "됩니다. 깃발 모드를 사용하면 길게 누르기 대신 표시하기 쉽습니다."
      },
      {
        q: "기록이 저장되나요?",
        a: "서버에 계정을 만들어 저장하지 않습니다. 페이지를 나가면 판이 사라질 수 있습니다."
      }
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
    intro:
      "떨어지는 블록을 맞춰 줄을 지우는 클래식 액션 퍼즐입니다. 레벨로 낙하 속도를 조절할 수 있어, 가벼운 연습부터 빠른 판까지 브라우저만으로 즐길 수 있습니다.",
    usage: [
      "레벨을 정한 뒤 시작을 누르면 블록이 내려옵니다. 이동·회전으로 가로줄을 완성해 줄을 지우고 점수를 올리세요.",
      "키보드 조작이 편하므로 데스크톱에서 플레이하면 더 쾌적합니다. 일시정지와 음소거도 지원합니다."
    ],
    scenarios: [
      "짧은 휴식에 손과 눈을 가볍게 움직일 때",
      "레벨을 낮춰 천천히 배치 연습을 할 때"
    ],
    tips: [
      "빈 공간을 최소화하며 평탄하게 쌓는 것이 기본입니다.",
      "한 줄보다 여러 줄을 한 번에 지우는 쪽이 점수에 유리한 경우가 많습니다.",
      "속도가 부담되면 낮은 레벨에서 회전·배치 감각부터 익히세요."
    ],
    notes: [
      "오락용 브라우저 게임이며 설치나 결제가 필요하지 않습니다.",
      "장시간 플레이 시 눈과 손목 휴식을 취하세요."
    ],
    faq: [
      {
        q: "모바일 조작이 불편해요.",
        a: "가능하면 키보드가 있는 환경에서 플레이하는 것을 권합니다."
      },
      {
        q: "최고 점수가 클라우드에 남나요?",
        a: "계정 연동 저장 기능은 없습니다."
      }
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
    intro:
      "가로·세로·대각선 다섯 목을 먼저 만드는 사람이 이기는 대국 게임입니다. AI 난이도와 흑·백을 고를 수 있어, 혼자 연습하거나 가볍게 승부를 즐기기에 적합합니다.",
    usage: [
      "흑·백과 AI 레벨을 고른 뒤 시작하면 19×19 판에서 대국할 수 있습니다.",
      "내 차례에 빈 칸을 눌러 착수하고, 필요하면 재시작으로 새 판을 열 수 있습니다."
    ],
    scenarios: [
      "점심시간처럼 짧은 두뇌 대결이 필요할 때",
      "열린 3·4를 막는 기본기를 혼자 연습할 때"
    ],
    tips: [
      "초보자는 상대의 열린 3·4를 막는 수를 우선하세요.",
      "중앙 부근에서 동시에 두 곳을 위협하는 수가 유리한 경우가 많습니다.",
      "AI 난이도가 높을수록 응답이 조금 느려질 수 있습니다."
    ],
    notes: [
      "규칙 세부(렌주 등)는 일반 오목 규칙 중심으로 동작합니다.",
      "대국 기록은 서버에 저장되지 않습니다."
    ],
    faq: [
      {
        q: "무르기가 있나요?",
        a: "재시작으로 새 판을 열 수 있습니다. 체스처럼 한 수 무르기가 필요하면 체스 도구를 이용해 보세요."
      },
      {
        q: "온라인 대인은 되나요?",
        a: "아니요. 브라우저 AI와의 로컬 대국입니다."
      }
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
    intro:
      "뒤집힌 카드에서 같은 이모지 쌍을 찾는 기억 게임입니다. 보드 크기와 시도 횟수·시간을 함께 볼 수 있어, 가볍게 위치 기억을 연습하는 용도로 쓰기 좋습니다.",
    usage: [
      "보드 크기(4×4·6×6·8×8)를 고른 뒤 시작해 같은 이모지 쌍을 찾아 맞추세요.",
      "난이도를 바꾸면 진행 중이던 판은 초기화되므로, 기록을 남기려면 판을 끝낸 뒤 크기를 바꾸세요."
    ],
    scenarios: [
      "짧은 집중 훈련·두뇌 휴식이 필요할 때",
      "아이와 함께 쉬운 4×4부터 맞춰 볼 때"
    ],
    tips: [
      "가장자리부터 규칙적으로 열어 패턴을 만들면 찾기 쉽습니다.",
      "큰 보드는 구역을 나눠 위치를 기억하는 전략이 시도 횟수를 줄입니다.",
      "이미 본 이모지가 다시 나오면 그 자리에서 짝을 맞추는 편이 효율적입니다."
    ],
    notes: [
      "의학적 인지 검사나 진단을 대체하지 않습니다.",
      "효과음이 날 수 있으니 공공장소에서는 볼륨에 주의하세요."
    ],
    faq: [
      {
        q: "몇 쌍인가요?",
        a: "4×4는 8쌍, 6×6은 18쌍, 8×8은 32쌍입니다."
      },
      {
        q: "최고 기록이 저장되나요?",
        a: "서버 계정 저장은 없습니다. 필요하면 결과 화면을 메모하세요."
      }
    ],
    guides: [
      { href: "guides/games.html", label: "브라우저 게임 가이드" },
      { href: "guides/flag.html", label: "나라 국기 맞추기 가이드" },
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
    intro:
      "정식 규칙으로 AI와 대국하는 브라우저 체스입니다. 캐슬링·앙파상·승격은 물론 스테일메이트 등 기본 판정을 지원해, 규칙 연습과 가벼운 대국에 적합합니다.",
    usage: [
      "난이도와 내 기물(백/흑)을 고른 뒤 기물을 누르고 표시된 칸을 다시 눌러 이동하세요.",
      "한 수 무르기, 판 뒤집기, 새 게임으로 편하게 연습할 수 있고 기보도 함께 확인할 수 있습니다."
    ],
    scenarios: [
      "오프라인처럼 혼자 규칙·오프닝을 연습할 때",
      "출퇴근 전후 짧은 한 판이 필요할 때"
    ],
    tips: [
      "초급 난이도에서 기물 가치와 기본 전개를 익힌 뒤 올리세요.",
      "캐슬링으로 왕을 빨리 안전하게 두는 습관이 초보에게 도움이 됩니다.",
      "특수 규칙 설명은 체스 가이드를 함께 읽으면 이해에 도움이 됩니다."
    ],
    notes: [
      "AI 계산은 브라우저 안에서만 이루어지며 대국 기록은 서버에 저장되지 않습니다.",
      "고급 난이도는 수를 더 깊이 읽어 응답이 느려질 수 있습니다."
    ],
    faq: [
      {
        q: "온라인 랭킹전이 있나요?",
        a: "없습니다. 로컬 AI 대국 전용입니다."
      },
      {
        q: "기보를 저장할 수 있나요?",
        a: "화면에 표시되는 기보를 복사·메모하는 방식이며, 계정 클라우드 저장은 없습니다."
      }
    ],
    guides: [
      { href: "guides/chess.html", label: "체스 가이드" },
      { href: "guides/chess-openings-beginner.html", label: "체스 오프닝 초보 가이드" },
      { href: "guides/games.html", label: "브라우저 게임 가이드" }
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
    intro:
      "국기 이미지를 보고 나라를 고르는 4지선다 퀴즈입니다. 정답을 확인하면서 수도 정보도 볼 수 있어, 지리 상식을 가볍게 점검하거나 아이와 함께 배우기 좋습니다.",
    usage: [
      "시작을 누른 뒤 보이는 국기를 보고 네 보기 중 나라를 고르세요. 정답과 함께 수도 정보도 확인할 수 있습니다.",
      "다음 문제로 이어가며 연습하고, 처음부터 다시 시작할 수도 있습니다."
    ],
    scenarios: [
      "세계지리·시사 상식을 짧은 퀴즈로 복습할 때",
      "여행·뉴스에서 본 국기를 다시 외울 때",
      "수도 퀴즈와 번갈아 나라·수도·국기를 함께 익힐 때"
    ],
    tips: [
      "비슷한 색 조합은 문양·별·초승달·십자가 위치와 비율을 함께 보세요.",
      "틀린 문제는 수도까지 읽고 넘어가면 기억에 더 잘 남습니다.",
      "연속으로 맞힌 뒤에도 한 번씩 비슷한 국기를 다시 보면 혼동이 줄어듭니다."
    ],
    notes: [
      "학습·오락용 퀴즈이며 시험이나 공식 평가를 대체하지 않습니다.",
      "국기 디자인 변경·비공식 표기가 있는 경우 자료와 다를 수 있습니다."
    ],
    faq: [
      {
        q: "몇 개국이 나오나요?",
        a: "문제 은행에서 무작위로 출제됩니다. 매번 같은 순서·같은 보기만 나오지는 않습니다."
      },
      {
        q: "점수 랭킹이 있나요?",
        a: "서버 랭킹은 없습니다. 개인 연습용으로 풀어 보세요."
      }
    ],
    guides: [
      { href: "guides/flag.html", label: "나라 국기 맞추기 가이드" },
      { href: "guides/capital.html", label: "나라 수도 맞추기 가이드" },
      { href: "guides/games.html", label: "브라우저 게임 가이드" }
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
    intro:
      "나라 이름과 국기를 힌트로 수도를 고르는 퀴즈입니다. 국기 맞추기와 함께 쓰면 나라·수도·국기 세 정보를 한 세트로 익히기 쉽습니다.",
    usage: [
      "나라 이름과 국기를 보고 네 도시 보기 중 수도를 고르세요. 정답을 확인한 뒤 다음 문제로 이어갈 수 있습니다.",
      "국기 퀴즈와 번갈아 풀면 나라·수도·국기를 함께 익히는 데 도움이 됩니다."
    ],
    scenarios: [
      "시험·상식 퀴즈용으로 수도를 빠르게 복습할 때",
      "뉴스에 나온 국가의 수도를 다시 확인할 때",
      "가족과 함께 틀리고 맞히며 가볍게 배울 때"
    ],
    tips: [
      "수도 이름이 국가명과 비슷한 경우와 전혀 다른 경우를 구분해 기억하세요.",
      "오답 보기도 읽어 두면 비슷한 도시 이름을 덜 헷갈립니다.",
      "일부 나라는 행정 수도·법정 수도 표기가 자료마다 다를 수 있습니다."
    ],
    notes: [
      "이 퀴즈는 일반적인 학습용 표기를 따릅니다. 공식 지리 자료를 대체하지 않습니다.",
      "오락·학습 목적이며 순위전·상금과 무관합니다."
    ],
    faq: [
      {
        q: "수도가 여러 개인 나라는요?",
        a: "학습용으로 널리 쓰이는 표기를 따릅니다. 자세한 행정 구분은 공식 자료를 확인하세요."
      },
      {
        q: "국기 없이 이름만으로도 풀 수 있나요?",
        a: "화면에 국기가 함께 보이므로, 시각 힌트와 이름을 같이 활용하는 구성입니다."
      }
    ],
    guides: [
      { href: "guides/capital.html", label: "나라 수도 맞추기 가이드" },
      { href: "guides/flag.html", label: "나라 국기 맞추기 가이드" },
      { href: "guides/games.html", label: "브라우저 게임 가이드" }
    ]
  }
];

const DETAILS = {
  weather: [
    "현재 기온만 보지 말고, 체감온도와 시간별 강수 확률을 함께 보면 ‘지금 나가도 되는지’와 ‘몇 시간 뒤 우산이 필요한지’를 나눠 판단할 수 있습니다. 주말 계획은 7일 예보로 후보 날짜를 고른 뒤, 전날 24시간 예보로 최종 확인하는 흐름이 실용적입니다.",
    "도시 검색은 출장·여행지처럼 내 위치가 아닌 곳을 볼 때 특히 유용합니다. 같은 도시명이 여러 나라·지역에 있으면 목록에서 국가·지역을 구분해 선택하세요."
  ],
  calendar: [
    "음력 날짜를 양력으로 옮길 때는 결과만 복사하지 말고 윤달 표시까지 메모해 두세요. 해마다 같은 음력 기념일이라도 양력 날짜가 바뀌고, 윤달이 끼면 한 달 가까이 어긋날 수 있습니다.",
    "갑자와 띠는 대화·문화 맥락의 참고 정보로 쓰기 좋습니다. 다만 사주·운세 해석을 위한 전문 도구는 아니며, 행정·계약 일정에는 쓰지 않는 것이 안전합니다."
  ],
  ip: [
    "공인 IP는 집 공유기 안의 사설 주소(192.168.x.x 등)와 다릅니다. 외부 서버가 ‘당신을 보는’ 주소가 바로 이 값입니다. 방화벽 허용 목록에 넣을 때는 IPv4와 IPv6를 구분해 등록하세요.",
    "VPN을 켠 상태와 끈 상태를 번갈아 조회하면 터널이 실제로 적용됐는지 바로 확인할 수 있습니다. 위치가 예상과 다르면 먼저 VPN·회사망·테더링 여부를 의심하세요."
  ],
  ocr: [
    "인식 전에는 글자가 화면을 최대한 크게, 그림자·손 가림이 없게 찍힌 사진을 고르는 것이 핵심입니다. 표나 영수증처럼 구조가 있는 문서는 영역을 나눠 여러 번 추출한 뒤 붙여 넣는 편이 한 번에 전체를 돌리는 것보다 정확할 때가 많습니다.",
    "추출 결과는 복사 전 숫자·날짜·고유명사만 빠르게 훑어도 실수를 크게 줄일 수 있습니다. 필요하면 텍스트 파일로 저장해 두고 원본 이미지와 나란히 대조하세요."
  ],
  convert: [
    "형식 선택은 ‘어디에 올릴지’로 정하면 단순합니다. 웹·메일은 JPG·WebP, 투명 로고는 PNG, 구형 프로그램은 BMP를 먼저 고려하세요. 용량이 문제면 WebP를 시험해 보고, 호환성이 문제면 JPG로 되돌리면 됩니다.",
    "여러 장을 한 번에 바꿀 때는 ZIP으로 묶어 받으면 정리하기 쉽습니다. 변환 전 원본 폴더를 따로 복사해 두면 잘못된 형식·화질로 덮어쓰는 실수를 막을 수 있습니다."
  ],
  editor: [
    "자르기는 ‘무엇을 남길지’를 먼저 정한 뒤에 하는 편이 덜 헤맵니다. 인물이면 얼굴 여백, 문서면 글자 가장자리, 썸네일이면 핵심 피사체가 중앙에 오도록 비율을 고르세요.",
    "회전·반전은 OCR이나 업로드 전에 하면 인식률과 미리보기 품질이 좋아지는 경우가 많습니다. 작업이 끝나면 바로 형식 변환으로 이어가 최종 확장자를 맞추면 됩니다."
  ],
  picker: [
    "브랜드 색을 뽑을 때는 로고의 ‘가장 평평한 단색 영역’을 클릭하세요. 그라데이션·그림자·안티앨리어싱 경계는 대표색이 아닌 중간값이 나오기 쉽습니다.",
    "스와치에 3~6개만 모아도 배색 방향을 잡기 충분합니다. HEX를 복사해 CSS 변수나 디자인 툴 팔레트에 바로 붙여 넣고, 밝기만 조절할 일이 있으면 HSL 값도 함께 메모하세요."
  ],
  speech: [
    "목표 시간보다 30초~1분 짧게 나오는 분량으로 맞추면, 실제 발표에서 숨 고르기·슬라이드 전환 여유가 생깁니다. 반대로 계산이 목표보다 길면 예시·부연을 먼저 줄이는 편이 속도만 올리는 것보다 자연스럽습니다.",
    "한영이 섞인 원고는 구간별로 나눠 계산해 보면 어느 부분이 시간을 잡아먹는지 보이기 쉽습니다. 리허설 후 슬라이더를 본인 속도에 맞게 저장해 두면(메모) 다음 발표 준비가 빨라집니다."
  ],
  dday: [
    "디데이는 ‘압박용 숫자’보다 ‘계획 단위를 나누는 기준’으로 쓸 때 효과가 큽니다. 예를 들어 D−30에 초안, D−7에 최종본처럼 마일스톤을 정하면 막판 몰아치기를 줄일 수 있습니다.",
    "기준일을 오늘이 아닌 날짜로 바꾸면, 휴가·출장 전에 미리 남은 날을 시뮬레이션할 수 있습니다. 음력 기념일은 양력으로 변환한 값을 목표일에 넣어야 달력과 맞습니다."
  ],
  noise: [
    "집중 세션에는 타이머를 25~50분으로 두고, 끝나면 소리를 끄고 짧게 쉬는 방식이 부담이 적습니다. 잠들기 전에는 볼륨을 낮추고 짧은 타이머를 쓰는 편이, 밤새 재생보다 기기 발열·알림 변수에 안전합니다.",
    "소리 종류는 취향 차입니다. 날카로우면 브라운·비, 너무 둔탁하면 핑크·시냇물로 바꿔 보세요. 공공장소에서는 이어폰 소리 샘과 탭 음소거 상태를 함께 확인하세요."
  ],
  lotto: [
    "번호 생성은 ‘선택 피로’를 줄이는 편의 기능일 뿐입니다. 같은 번호를 반복 생성하는 것과 당첨 가능성은 관련이 없으며, 구매 여부와 금액은 본인 예산 한도 안에서만 결정하세요.",
    "결과를 스크린샷으로 남기더라도 공식 구매·당첨 확인은 복권 판매 채널과 공식 사이트에서 하세요. 이 페이지의 숫자는 추천일 뿐 접수 번호가 아닙니다.",
    "한 번에 최대 5게임까지 뽑을 수 있으니, 필요한 만큼만 생성하고 불필요하게 반복 클릭하지 않아도 됩니다. 오락 목적을 넘는 기대를 두지 않는 것이 가장 중요합니다."
  ],
  minesweeper: [
    "초급에서는 숫자 2·3 주변의 깃발 패턴을 익히는 것이 핵심입니다. 중급 이상에서는 열려 있는 정보만으로 결정되지 않는 ‘추측 칸’이 생길 수 있으니, 한 번에 여러 칸을 열기보다 확실한 칸부터 처리하세요.",
    "짧게 한 판 클리어하고 멈추는 용도로 쓰기 좋습니다. 연속으로 오래 하면 집중 피로가 쌓일 수 있으니, 타이머를 두지 않더라도 스스로 횟수 제한을 두는 편이 낫습니다."
  ],
  tetris: [
    "초반은 구멍을 만들지 않는 평탄한 스택이 우선입니다. 레벨이 낮을 때 회전 감각과 ‘다음 블록을 어디에 둘지’만 연습해도 이후 속도전에서 실수가 줄어듭니다.",
    "일시정지를 활용해 배치를 생각해도 됩니다. 점수보다 줄 지우기 연습이 목적이면 낮은 레벨을 유지한 채 여러 판을 반복하는 편이 학습에 유리합니다.",
    "키보드가 있는 환경에서는 이동·회전이 더 정확합니다. 실수로 쌓아 올린 탑이 높아지면 과감히 새 게임을 눌러 템포를 다시 잡는 것도 방법입니다."
  ],
  gomoku: [
    "열린 3을 두 개 동시에 만드는 수가 승기를 잡는 전형적인 패턴입니다. 반대로 상대가 그 형태를 노리면 공격 한 수보다 방어가 급합니다. 초보 단계에서는 ‘내 수’보다 ‘상대가 다음 수에 이길 수 있는가’를 먼저 보세요.",
    "AI 레벨은 연습용 상대입니다. 너무 자주 지면 한 단계 낮춰 기본 형태를 익히고, 여유가 생기면 다시 올리세요. 온라인 다인 대국·랭킹전 기능은 없습니다.",
    "판이 커 보여도 초반은 중앙 부근에서 형태를 만드는 싸움이 많습니다. 가장자리에만 두면 연결이 끊기기 쉬우니, 한두 수는 중앙 영향력을 의식해 보세요."
  ],
  memory: [
    "처음 몇 장은 정보를 모으는 단계입니다. 무작정 맞추려 하기보다, 본 이모지의 위치를 대략적인 구역(좌상·우하 등)으로 기억하는 편이 시도 횟수를 줄입니다.",
    "4×4로 기록을 낸 뒤 6×6으로 올리는 식이 부담이 적습니다. 효과음이 거슬리면 기기 볼륨을 낮추고, 완료 후에는 눈을 잠시 쉬게 하세요.",
    "이미 맞춘 쌍은 다시 볼 필요가 없으니, 남은 카드만 시야에 두는 습관이 도움이 됩니다. 한 판이 길어지면 짧게 쉬었다가 새 보드로 시작하는 편이 낫습니다."
  ],
  chess: [
    "초보자는 매 수마다 ‘이 기물이 공격받는가’, ‘상대 왕 주변이 헐거워졌는가’만 점검해도 큰 실수를 줄일 수 있습니다. 캐슬링 전 폰 구조를 무너뜨리지 않는 선에서 전개를 마치는 것을 목표로 하세요.",
    "한 수 무르기는 학습용입니다. 같은 실수를 반복한다면 무르기 대신 새 게임으로 오프닝부터 다시 두는 편이 장기적으로 도움이 됩니다. 자세한 특수 규칙은 체스 가이드를 참고하세요."
  ],
  flag: [
    "틀렸을 때 수도까지 함께 읽으면 ‘국기–나라–수도’가 한 세트로 남습니다. 비슷해 보이는 국기가 나왔을 때는 색 순서보다 문양(별, 초승달, 십자가, 문장)부터 보세요.",
    "하루 10문항처럼 짧게 반복하는 편이 한 번에 몰아서 풀기보다 기억에 유리합니다. 수도까지 이어서 연습하려면 나라 수도 맞추기 퀴즈를 같은 날 이어서 풀어 보세요."
  ],
  capital: [
    "수도 이름이 생소하면 오답 보기 도시가 더 유명해 보일 수 있습니다. ‘유명한 도시’가 아니라 ‘수도’를 고르는 문제임을 매 문항 떠올리세요.",
    "국기 힌트가 보이므로, 나라를 시각적으로 확인한 뒤 수도를 고르면 혼동이 줄어듭니다. 표기가 자료마다 다른 나라는 학습용 답으로 이해하고, 공적 용도에서는 공식 출처를 확인하세요."
  ]
};

for (const tool of TOOLS) {
  if (DETAILS[tool.id]) tool.detail = DETAILS[tool.id];
}

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function renderList(items) {
  return items
    .map(function (item) {
      return "        <li>" + escapeHtml(item) + "</li>";
    })
    .join("\n");
}

function renderParagraphs(items) {
  return items
    .map(function (p) {
      return "      <p>" + escapeHtml(p) + "</p>";
    })
    .join("\n");
}

function renderGuide(tool) {
  const parts = [
    '    <section class="tool-page-guide" aria-label="' +
      escapeAttr(tool.guideTitle) +
      '">',
    "      <h2>" + escapeHtml(tool.guideTitle) + "</h2>",
    "      <p>" + escapeHtml(tool.intro) + "</p>"
  ];

  if (tool.detail && tool.detail.length) {
    parts.push(renderParagraphs(tool.detail));
  }

  parts.push(
    "      <h3>사용법</h3>",
    renderParagraphs(tool.usage),
    "      <h3>이런 때 쓰면 좋습니다</h3>",
    "      <ul>",
    renderList(tool.scenarios),
    "      </ul>",
    "      <h3>활용 팁</h3>",
    "      <ul>",
    renderList(tool.tips),
    "      </ul>",
    "      <h3>주의할 점</h3>",
    "      <ul>",
    renderList(tool.notes),
    "      </ul>"
  );

  if (tool.faq && tool.faq.length) {
    parts.push("      <h3>자주 묻는 질문</h3>");
    tool.faq.forEach(function (item) {
      parts.push(
        "      <p><strong>" +
          escapeHtml(item.q) +
          "</strong> " +
          escapeHtml(item.a) +
          "</p>"
      );
    });
  }

  parts.push(
    "      <h3>관련 가이드</h3>",
    "      <ul>",
    tool.guides
      .map(function (g) {
        return (
          '        <li><a href="' +
          escapeAttr(g.href) +
          '">' +
          escapeHtml(g.label) +
          "</a></li>"
        );
      })
      .join("\n"),
    "      </ul>",
    "    </section>",
    ""
  );

  return parts.join("\n");
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
    ';document.documentElement.classList.add("wtb-tool-page");</script>\n';

  if (out.indexOf('<base href="../" />') === -1) {
    out = out.replace(/<head>\s*/, "<head>\n" + boot);
  }

  return out;
}

function injectGuide(html, tool) {
  const guide = "\n" + renderGuide(tool);
  const mainRe = new RegExp(
    "<main[^>]*\\bid=\"" + tool.viewId + "\"[^>]*>",
    "i"
  );
  const mainMatch = mainRe.exec(html);
  if (!mainMatch) {
    throw new Error("view main not found for " + tool.id + " (" + tool.viewId + ")");
  }
  const afterOpen = mainMatch.index + mainMatch[0].length;
  const mainEnd = html.indexOf("</main>", afterOpen);
  if (mainEnd === -1) {
    throw new Error("view main close not found for " + tool.id);
  }
  const inner = html.slice(afterOpen, mainEnd);

  let insertAt = -1;
  const lead = /<p\s+class="[^"]*(?:subtitle|lead)[^"]*"[\s\S]*?<\/p>/i.exec(
    inner
  );
  if (lead) {
    insertAt = lead.index + lead[0].length;
  } else {
    const header =
      /<div\s+class="(?:card-head|weather-topbar)"[\s\S]*?<\/div>/i.exec(inner);
    if (header) {
      insertAt = header.index + header[0].length;
    } else {
      const h2 = /<h2[\s\S]*?<\/h2>/i.exec(inner);
      if (h2) insertAt = h2.index + h2[0].length;
    }
  }
  if (insertAt < 0) {
    throw new Error("insert point not found for " + tool.id);
  }

  const next = inner.slice(0, insertAt) + guide + inner.slice(insertAt);
  return html.slice(0, afterOpen) + next + html.slice(mainEnd);
}

function injectGuideStyles(html) {
  if (html.indexOf(".tool-page-guide") !== -1) return html;
  const css = [
    "    .tool-page-guide {",
    "      margin: 0.85rem 0 1.35rem;",
    "      padding: 0 0 1.1rem;",
    "      border-bottom: 1px solid color-mix(in srgb, var(--text) 12%, transparent);",
    "      text-align: left;",
    "      max-width: 42rem;",
    "    }",
    "    .tool-page-guide h2 {",
    "      margin: 0 0 0.65rem;",
    "      font-size: 1.12rem;",
    "      letter-spacing: -0.01em;",
    "    }",
    "    .tool-page-guide h3 {",
    "      margin: 0.9rem 0 0.35rem;",
    "      font-size: 0.95rem;",
    "    }",
    "    .tool-page-guide p,",
    "    .tool-page-guide li {",
    "      color: var(--muted);",
    "      font-size: 0.9rem;",
    "      line-height: 1.65;",
    "    }",
    "    .tool-page-guide p { margin: 0 0 0.5rem; }",
    "    .tool-page-guide ul { margin: 0 0 0.3rem; padding-left: 1.15rem; }",
    "    .tool-page-guide a { color: var(--accent); text-decoration: none; }",
    "    .tool-page-guide a:hover { text-decoration: underline; }",
    "    html.wtb-tool-page #homeView { display: none !important; }",
    "    html.adsense-review .lang-select,",
    "    html.adsense-review .page-lang-select,",
    "    html.adsense-review label[for=\"langSelect\"] {",
    "      display: none !important;",
    "    }",
    ""
  ].join("\n");
  return html.replace("</style>", css + "  </style>");
}

const ALL_VIEW_IDS = [
  "homeView",
  "lottoView",
  "minesweeperView",
  "tetrisView",
  "gomokuView",
  "memoryView",
  "flagView",
  "capitalView",
  "noiseView",
  "chessView",
  "weatherView",
  "calendarView",
  "ddayView",
  "ipView",
  "ocrView",
  "convertView",
  "editorView",
  "speechView",
  "pickerView"
];

function slimToolPage(html, tool) {
  // Drop other tool/home mains so each /tools URL is unique text, not a full SPA clone.
  for (const id of ALL_VIEW_IDS) {
    if (id === tool.viewId) continue;
    const re = new RegExp(
      "<main\\b[^>]*\\bid=\"" + id + "\"[^>]*>[\\s\\S]*?<\\/main>",
      "i"
    );
    html = html.replace(re, "");
  }

  // Show the kept tool view immediately (no hidden attribute).
  html = html.replace(
    new RegExp(
      "(<main\\b[^>]*\\bid=\"" + tool.viewId + "\"[^>]*)\\s+hidden\\b",
      "i"
    ),
    "$1"
  );

  // Slim header controls: hide language switcher on tool pages during review.
  html = html.replace(
    /<html\b([^>]*)>/i,
    function (m, attrs) {
      if (/\bclass=/.test(attrs)) {
        return (
          "<html" +
          attrs.replace(
            /class=(["'])([^"']*)\1/,
            function (_, q, cls) {
              const next = (cls + " wtb-tool-page adsense-review")
                .replace(/\s+/g, " ")
                .trim();
              return "class=" + q + next + q;
            }
          ) +
          ">"
        );
      }
      return '<html' + attrs + ' class="wtb-tool-page adsense-review">';
    }
  );

  return html;
}

const HOME_DROP_SCRIPTS = [
  "weather.js",
  "calendar.js",
  "dday.js",
  "ip.js",
  "ocr.js",
  "convert.js",
  "editor.js",
  "speech.js",
  "picker.js",
  "chess.js",
  "flag-countries.js",
  "flag-cities.js",
  "flag-coords.js",
  "flag.js",
  "capital.js",
  "noise.js"
];

function slimHomePage(html) {
  for (const id of ALL_VIEW_IDS) {
    if (id === "homeView") continue;
    const re = new RegExp(
      "<main\\b[^>]*\\bid=\"" + id + "\"[^>]*>[\\s\\S]*?<\\/main>",
      "i"
    );
    html = html.replace(re, "");
  }

  // Ensure home is visible.
  html = html.replace(
    /(<main\b[^>]*\bid="homeView"[^>]*)\s+hidden\b/i,
    "$1"
  );

  for (const src of HOME_DROP_SCRIPTS) {
    const re = new RegExp(
      "\\s*<script\\b[^>]*\\bsrc=[\"']" +
        src.replace(/\./g, "\\.") +
        "[^\"']*[\"'][^>]*>\\s*</script>",
      "gi"
    );
    html = html.replace(re, "");
  }

  // Mark hub mode before other scripts run.
  if (!html.includes("window.__WTB_HOME_ONLY__=true")) {
    html = html.replace(
      /<head([^>]*)>/i,
      '<head$1>\n  <script>window.__WTB_HOME_ONLY__=true;</script>'
    );
  }

  html = html.replace(
    /<html\b([^>]*)>/i,
    function (m, attrs) {
      if (/\bclass=/.test(attrs)) {
        return (
          "<html" +
          attrs.replace(
            /class=(["'])([^"']*)\1/,
            function (_, q, cls) {
              const next = (cls + " wtb-home-only adsense-review")
                .replace(/\s+/g, " ")
                .trim();
              return "class=" + q + next + q;
            }
          ) +
          ">"
        );
      }
      return '<html' + attrs + ' class="wtb-home-only adsense-review">';
    }
  );

  // Keep public home canonical/title as the site root.
  html = html.replace(
    /<link rel="canonical" href="[^"]*"\s*\/>/,
    '<link rel="canonical" href="' + BASE_URL + '" />'
  );
  html = html.replace(
    /<meta property="og:url" content="[^"]*"\s*\/>/,
    '<meta property="og:url" content="' + BASE_URL + '" />'
  );

  return html;
}

function main() {
  if (!fs.existsSync(APP_INDEX)) {
    throw new Error("Missing index.app.html (SPA source).");
  }
  const source = fs.readFileSync(APP_INDEX, "utf8");
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const tool of TOOLS) {
    let html = patchHead(source, tool);
    html = injectGuideStyles(html);
    html = injectGuide(html, tool);
    html = slimToolPage(html, tool);
    const outPath = path.join(OUT_DIR, tool.id + ".html");
    fs.writeFileSync(outPath, html, "utf8");
    console.log("wrote", path.relative(ROOT, outPath));
  }

  const homeHtml = slimHomePage(source);
  fs.writeFileSync(PUBLIC_INDEX, homeHtml, "utf8");
  console.log("wrote", path.relative(ROOT, PUBLIC_INDEX), "(home hub only)");
}

main();
