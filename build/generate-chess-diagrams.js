/**
 * Renders static chess diagrams between <!-- chess-diagram:ID --> and
 * <!-- /chess-diagram --> markers. Move targets are computed from the position
 * so the dots always match the rules.
 *
 * chess-openings-beginner.html is produced by generate-info-articles.js, which
 * calls renderDiagrams() itself; running this file re-renders both guides.
 */
const fs = require("fs");
const path = require("path");

const GUIDES = ["chess.html", "chess-openings-beginner.html"].map(function (f) {
  return path.resolve(__dirname, "..", "guides", f);
});

// Text presentation selector keeps iOS from drawing the pawn as an emoji.
const VS15 = "&#xFE0E;";
const GLYPH = { P: "&#x265F;", N: "&#x265E;", B: "&#x265D;", R: "&#x265C;", Q: "&#x265B;", K: "&#x265A;" };
const FILES = "abcdefgh";

const DIAGRAMS = {
  start: {
    caption: "시작 배치. 오른쪽 아래(h1)가 밝은 칸이 되도록 판을 놓고, 퀸은 자기 색 칸(백 퀸은 d1의 밝은 칸)에 섭니다.",
    alt: "체스 시작 배치: 1·2줄에 백 기물, 7·8줄에 흑 기물",
    fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR"
  },
  king: {
    caption: "킹(e4)은 사방 한 칸씩, 최대 8칸으로 움직입니다.",
    alt: "e4의 킹과 주변 8칸 이동 표시",
    fen: "8/8/8/8/4K3/8/8/8",
    moves: "e4"
  },
  queen: {
    caption: "퀸(d4)은 가로·세로·대각선으로 막히지 않는 한 끝까지 갑니다. 빈 판 가운데에서는 27칸까지 닿습니다.",
    alt: "d4의 퀸과 가로·세로·대각선 이동 표시",
    fen: "8/8/8/8/3Q4/8/8/8",
    moves: "d4"
  },
  rook: {
    caption: "룩(d4)은 가로·세로로 움직입니다. d6의 흑 폰은 잡을 수 있지만(테두리 원) 그 너머로는 못 가고, f4의 백 폰 앞에서 멈춥니다.",
    alt: "d4의 룩, d6의 흑 폰과 f4의 백 폰이 있는 이동 표시",
    fen: "8/8/3p4/8/3R1P2/8/8/8",
    moves: "d4"
  },
  bishop: {
    caption: "비숍(d4)은 대각선으로만 움직여 처음 선 칸 색을 끝까지 벗어나지 못합니다.",
    alt: "d4의 비숍과 대각선 이동 표시",
    fen: "8/8/8/8/3B4/8/8/8",
    moves: "d4"
  },
  knight: {
    caption: "나이트(d4)는 L자로 8칸까지 갑니다. 주변이 기물로 둘러싸여 있어도 뛰어넘을 수 있고, f5의 흑 폰은 잡을 수 있습니다.",
    alt: "d4의 나이트가 주변 폰을 뛰어넘어 L자 칸으로 가는 이동 표시",
    fen: "8/8/8/2PPPp2/2PNP3/2PPP3/8/8",
    moves: "d4"
  },
  pawn: {
    caption: "폰은 앞으로만 갑니다. e2의 폰은 처음이라 두 칸까지, c5의 폰은 앞이 막혀 전진할 수 없지만 대각선의 흑 기물(b6, d6)은 잡을 수 있습니다.",
    alt: "e2 폰의 한 칸·두 칸 전진과 c5 폰의 대각선 잡기 표시",
    fen: "8/8/1npb4/2P5/8/8/4P3/8",
    moves: ["e2", "c5"]
  },
  castling: {
    caption: "킹 쪽 캐슬링(O-O) 직후. 킹이 e1에서 g1로 두 칸 가고, 룩이 h1에서 f1로 넘어옵니다(노란 테두리는 출발 칸).",
    alt: "킹 쪽 캐슬링 후 g1의 킹과 f1의 룩",
    fen: "8/8/8/8/8/8/5PPP/R4RK1",
    from: ["e1", "h1"]
  },
  enpassant: {
    caption: "앙파상. 흑 폰이 d7에서 d5로 두 칸 나와 e5의 백 폰 옆에 섰습니다. 백은 바로 다음 수에 한해 d6으로 가며 d5의 폰을 잡을 수 있습니다.",
    alt: "e5의 백 폰이 d6으로 가며 d5의 흑 폰을 잡는 앙파상 표시",
    fen: "8/8/8/3pP3/8/8/8/8",
    from: ["d7", "d5"],
    dots: ["d6"]
  },
  promotion: {
    caption: "승격. e7의 폰이 e8에 닿으면 퀸·룩·비숍·나이트 중 하나로 바뀝니다.",
    alt: "e7의 백 폰이 e8로 전진해 승격하는 표시",
    fen: "8/4P3/8/8/8/8/8/8",
    moves: "e7"
  },
  mate: {
    caption: "체크메이트(백 승). e8의 룩이 g8의 킹을 공격하는데, 킹 앞을 자기 폰이 막고 있어 피할 칸이 없습니다.",
    alt: "e8의 백 룩에게 공격받는 g8의 흑 킹, 백 랭크 체크메이트",
    fen: "4R1k1/5ppp/8/8/8/8/5PPP/6K1",
    check: ["g8"]
  },
  stalemate: {
    caption: "스테일메이트(무승부). 흑 차례인데 h8의 킹은 공격받지 않지만 g8·g7·h7이 모두 막혀 둘 수 있는 수가 없습니다.",
    alt: "h8의 흑 킹, g6의 백 퀸, f7의 백 킹으로 이루어진 스테일메이트",
    fen: "7k/5K2/6Q1/8/8/8/8/8"
  },

  "open-e4e5": {
    caption: "① 1.e4 e5 — 양쪽이 킹 앞 폰을 두 칸 밀어 가운데를 차지합니다. 비숍과 퀸이 나올 길도 함께 열립니다.",
    alt: "1.e4 e5 이후 국면: 백 폰 e4, 흑 폰 e5",
    fen: "rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR",
    from: ["e7", "e5"]
  },
  "open-nf3": {
    caption: "② 2.Nf3 Nc6 — 백 나이트가 e5 폰을 노리고(테두리 원), 흑은 나이트로 그 폰을 지킵니다. 공격과 수비가 동시에 전개가 되는 좋은 수입니다.",
    alt: "2.Nf3 Nc6 이후 국면과 f3 나이트가 갈 수 있는 칸",
    fen: "r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R",
    moves: "f3"
  },
  "open-bc4": {
    caption: "③ 3.Bc4 Bc5 (이탈리안 게임) — 백 비숍이 f7을 겨눕니다. f7은 킹 혼자 지키는 약한 칸이라 초반 공격의 단골 목표입니다.",
    alt: "3.Bc4 Bc5 이후 국면과 c4 비숍이 f7을 겨누는 표시",
    fen: "r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R",
    moves: "c4"
  },
  "open-castle": {
    caption: "④ 4.O-O Nf6 — 백은 네 수 만에 캐슬링을 마쳐 킹이 g1으로 피하고 룩이 f1로 나왔습니다. 초보 오프닝의 목표 지점이 바로 이 모습입니다.",
    alt: "4.O-O Nf6 이후 국면: 백 킹 g1, 백 룩 f1",
    fen: "r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQ1RK1",
    from: ["e1", "h1"]
  },
  "open-sicilian": {
    caption: "1.e4 c5 (시실리안 디펜스) — 흑이 대칭 대신 옆에서 d4 칸을 견제합니다.",
    alt: "1.e4 c5 이후 국면: 흑 폰 c5",
    fen: "rnbqkbnr/pp1ppppp/8/2p5/4P3/8/PPPP1PPP/RNBQKBNR",
    from: ["c7", "c5"]
  },
  "open-french": {
    caption: "1.e4 e6 (프렌치 디펜스) — 흑이 한 칸만 올려 다음 수 d5를 준비합니다. 단단하지만 c8 비숍이 갇히기 쉽습니다.",
    alt: "1.e4 e6 이후 국면: 흑 폰 e6",
    fen: "rnbqkbnr/pppp1ppp/4p3/8/4P3/8/PPPP1PPP/RNBQKBNR",
    from: ["e7", "e6"]
  },
  "open-scholar": {
    caption: "4수 체크메이트(스콜라스 메이트). 1.e4 e5 2.Qh5 Nc6 3.Bc4 Nf6?? 4.Qxf7#. 비숍이 받치는 퀸이 f7을 잡아 킹이 피할 곳이 없습니다.",
    alt: "백 퀸이 f7에서 e8의 흑 킹을 체크메이트한 국면",
    fen: "r1bqkb1r/pppp1Qpp/2n2n2/4p3/2B1P3/8/PPPP1PPP/RNB1K1NR",
    from: ["h5", "f7"],
    check: ["e8"]
  }
};

function parseFen(fen) {
  const board = {};
  fen.split("/").forEach(function (row, r) {
    let f = 0;
    for (const ch of row) {
      if (/\d/.test(ch)) f += Number(ch);
      else {
        board[FILES[f] + (8 - r)] = ch;
        f++;
      }
    }
  });
  return board;
}

function sq(f, r) {
  return f >= 0 && f < 8 && r >= 0 && r < 8 ? FILES[f] + (r + 1) : null;
}

function isWhite(ch) {
  return ch === ch.toUpperCase();
}

function targetsFor(board, from) {
  const piece = board[from];
  const white = isWhite(piece);
  const type = piece.toUpperCase();
  const f0 = FILES.indexOf(from[0]);
  const r0 = Number(from[1]) - 1;
  const dots = [];
  const rings = [];

  function visit(s) {
    const other = board[s];
    if (!other) {
      dots.push(s);
      return true;
    }
    if (isWhite(other) !== white) rings.push(s);
    return false;
  }

  const rays = {
    R: [[1, 0], [-1, 0], [0, 1], [0, -1]],
    B: [[1, 1], [1, -1], [-1, 1], [-1, -1]]
  };
  rays.Q = rays.R.concat(rays.B);

  if (rays[type]) {
    for (const [df, dr] of rays[type]) {
      let f = f0 + df;
      let r = r0 + dr;
      let s;
      while ((s = sq(f, r)) && visit(s)) {
        f += df;
        r += dr;
      }
    }
  } else if (type === "N" || type === "K") {
    const steps =
      type === "N"
        ? [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]]
        : [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    for (const [df, dr] of steps) {
      const s = sq(f0 + df, r0 + dr);
      if (s) visit(s);
    }
  } else if (type === "P") {
    const dir = white ? 1 : -1;
    const one = sq(f0, r0 + dir);
    if (one && !board[one]) {
      dots.push(one);
      const startRank = white ? 1 : 6;
      const two = sq(f0, r0 + 2 * dir);
      if (r0 === startRank && two && !board[two]) dots.push(two);
    }
    for (const df of [-1, 1]) {
      const s = sq(f0 + df, r0 + dir);
      if (s && board[s] && isWhite(board[s]) !== white) rings.push(s);
    }
  }
  return { dots, rings };
}

function render(d) {
  const board = parseFen(d.fen);
  const dots = new Set(d.dots || []);
  const rings = new Set();
  const selected = new Set();
  const moveSources = d.moves ? [].concat(d.moves) : [];
  for (const from of moveSources) {
    selected.add(from);
    const t = targetsFor(board, from);
    t.dots.forEach((s) => dots.add(s));
    t.rings.forEach((s) => rings.add(s));
  }
  const from = new Set(d.from || []);
  const check = new Set(d.check || []);

  const cells = [];
  for (let r = 7; r >= 0; r--) {
    for (let f = 0; f < 8; f++) {
      const s = FILES[f] + (r + 1);
      const cls = ["cd-sq", (f + r) % 2 === 1 ? "cd-light" : "cd-dark"];
      if (from.has(s)) cls.push("cd-from");
      if (selected.has(s)) cls.push("cd-selected");
      if (check.has(s)) cls.push("cd-check");
      if (dots.has(s)) cls.push("cd-dot");
      if (rings.has(s)) cls.push("cd-ring");
      let inner = "";
      if (f === 0) inner += '<span class="cd-rank">' + (r + 1) + "</span>";
      if (r === 0) inner += '<span class="cd-file">' + FILES[f] + "</span>";
      const p = board[s];
      if (p) {
        inner += '<span class="cd-piece cd-' + (isWhite(p) ? "w" : "b") + '">' + GLYPH[p.toUpperCase()] + VS15 + "</span>";
      }
      cells.push('<div class="' + cls.join(" ") + '">' + inner + "</div>");
    }
  }

  return (
    '\n      <figure class="chess-diagram">\n' +
    '        <div class="cd-board" role="img" aria-label="' + d.alt + '">' + cells.join("") + "</div>\n" +
    "        <figcaption>" + d.caption + "</figcaption>\n" +
    "      </figure>\n      "
  );
}

function renderDiagrams(html) {
  return html.replace(
    /<!-- chess-diagram:([\w-]+) -->[\s\S]*?<!-- \/chess-diagram -->/g,
    function (_, id) {
      const d = DIAGRAMS[id];
      if (!d) throw new Error("Unknown chess diagram: " + id);
      return "<!-- chess-diagram:" + id + " -->" + render(d) + "<!-- /chess-diagram -->";
    }
  );
}

function main() {
  for (const file of GUIDES) {
    const before = fs.readFileSync(file, "utf8");
    const after = renderDiagrams(before);
    fs.writeFileSync(file, after, "utf8");
    const count = (after.match(/<!-- chess-diagram:/g) || []).length;
    console.log("rendered", count, "diagrams in", path.basename(file));
  }
}

module.exports = { renderDiagrams };

if (require.main === module) main();
