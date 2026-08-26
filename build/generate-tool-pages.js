/*
 * Builds standalone /tools/*.html pages from index.html so each tool has a
 * unique crawlable URL on GitHub Pages.
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
    title: "날씨 정보 | WebToolBay",
    description:
      "내 위치 또는 도시 검색으로 현재 날씨, 24시간·7일 예보, 체감온도·강수 확률을 무료로 확인하세요."
  },
  {
    id: "calendar",
    title: "양력/음력 변환기 | WebToolBay",
    description:
      "양력과 음력 날짜를 서로 변환하고 60갑자·12띠를 확인하는 무료 음력 변환기입니다."
  },
  {
    id: "ip",
    title: "내 아이피 찾기 | WebToolBay",
    description:
      "공인 IPv4·IPv6, ISP, 국가·도시 정보를 확인하고 아이피를 복사할 수 있는 무료 조회 도구입니다."
  },
  {
    id: "ocr",
    title: "이미지 텍스트 추출 (OCR) | WebToolBay",
    description:
      "이미지 속 글자를 브라우저에서 바로 텍스트로 추출합니다. 업로드 없이 기기 안에서만 처리됩니다."
  },
  {
    id: "convert",
    title: "이미지 형식 변환 | WebToolBay",
    description:
      "PNG·JPG·WebP·BMP 이미지를 원하는 형식으로 변환하는 무료 브라우저 도구입니다."
  },
  {
    id: "editor",
    title: "이미지 자르기·회전 | WebToolBay",
    description:
      "이미지를 원하는 비율로 자르고 회전·반전·크기 조절까지 한 화면에서 처리하세요."
  },
  {
    id: "picker",
    title: "이미지 컬러 피커 | WebToolBay",
    description:
      "이미지에서 HEX·RGB·HSL 색상 코드를 추출하는 무료 컬러 피커입니다."
  },
  {
    id: "speech",
    title: "발표 시간 계산 | WebToolBay",
    description:
      "발표 대본을 넣으면 예상 발표 시간과 분량을 계산해 주는 무료 도구입니다."
  },
  {
    id: "dday",
    title: "디데이 계산기 | WebToolBay",
    description:
      "시험·결혼식·여행 등 목표일까지 남은 일수(D−)와 지난 날수(D+)를 계산합니다."
  },
  {
    id: "noise",
    title: "백색소음 | WebToolBay",
    description:
      "화이트·핑크·브라운 노이즈와 비·폭포·파도 소리로 집중과 휴식을 돕는 무료 백색소음 플레이어입니다."
  },
  {
    id: "lotto",
    title: "로또 번호 생성기 | WebToolBay",
    description:
      "6/45 로또 번호를 한 번에 최대 5게임까지 추천하는 참고용 무료 생성기입니다."
  },
  {
    id: "minesweeper",
    title: "지뢰찾기 게임 | WebToolBay",
    description:
      "브라우저에서 바로 즐기는 클래식 지뢰찾기. 난이도를 고르고 지뢰를 피해 빈칸을 여세요."
  },
  {
    id: "tetris",
    title: "테트리스 게임 | WebToolBay",
    description:
      "브라우저에서 바로 즐기는 테트리스 게임입니다. 레벨 1부터 99까지 속도를 조절하며 줄을 지워 보세요."
  },
  {
    id: "gomoku",
    title: "오목 게임 | WebToolBay",
    description:
      "AI와 대국하는 19x19 오목 게임입니다. 흑·백 선택과 레벨 조절이 가능한 브라우저 게임입니다."
  },
  {
    id: "memory",
    title: "기억력 테스트 | WebToolBay",
    description:
      "4x4부터 8x8까지 보드를 고를 수 있는 브라우저 기억력 테스트 게임입니다. 시간과 시도 횟수를 함께 확인하세요."
  },
  {
    id: "chess",
    title: "체스 | WebToolBay",
    description:
      "브라우저에서 AI와 정식 규칙 체스를 둘 수 있습니다. 캐슬링, 앙파상, 승격까지 지원합니다."
  },
  {
    id: "flag",
    title: "나라 국기 맞추기 | WebToolBay",
    description:
      "국기를 보고 4지선다로 나라를 맞히는 브라우저 퀴즈입니다. 정답과 수도를 함께 확인할 수 있습니다."
  },
  {
    id: "capital",
    title: "나라 수도 맞추기 | WebToolBay",
    description:
      "나라 이름과 국기를 보고 수도를 맞히는 브라우저 퀴즈입니다. 가볍게 지리 상식을 점검해 보세요."
  }
];

function escapeAttr(s) {
  return String(s).replace(/&/g, "&amp;").replace(/"/g, "&quot;");
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

function main() {
  const source = fs.readFileSync(INDEX, "utf8");
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  for (const tool of TOOLS) {
    const html = patchHead(source, tool);
    const outPath = path.join(OUT_DIR, tool.id + ".html");
    fs.writeFileSync(outPath, html, "utf8");
    console.log("wrote", path.relative(ROOT, outPath));
  }
}

main();
