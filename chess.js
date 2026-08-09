/* Chess with a built-in engine, running entirely in the browser */
(function () {
  /* ------------------------------------------------------------------ *
   * Engine
   *
   * Squares use the 0x88 layout: a1 is 0, h1 is 7, a8 is 112, h8 is 119.
   * Any square with a bit set in 0x88 is off the board, which makes the
   * sliding and knight loops cheap to bound.
   * ------------------------------------------------------------------ */

  var PAWN = 1, KNIGHT = 2, BISHOP = 3, ROOK = 4, QUEEN = 5, KING = 6;
  var WHITE = 1, BLACK = -1;

  // Castling rights bitmask.
  var WK = 1, WQ = 2, BK = 4, BQ = 8;

  // Move flags.
  var F_CAPTURE = 1, F_EP = 2, F_CASTLE = 4, F_DOUBLE = 8, F_PROMO = 16;

  var KNIGHT_DIRS = [33, 31, 18, 14, -33, -31, -18, -14];
  var BISHOP_DIRS = [17, 15, -17, -15];
  var ROOK_DIRS = [16, 1, -16, -1];
  var KING_DIRS = [17, 16, 15, 1, -17, -16, -15, -1];

  var PIECE_FROM_CHAR = { p: PAWN, n: KNIGHT, b: BISHOP, r: ROOK, q: QUEEN, k: KING };
  var CHAR_FROM_PIECE = ["", "p", "n", "b", "r", "q", "k"];
  var SAN_LETTER = ["", "", "N", "B", "R", "Q", "K"];

  var START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

  function makeMoveInt(from, to, promo, flags) {
    return from | (to << 8) | (promo << 16) | (flags << 20);
  }
  function moveFrom(m) { return m & 0xff; }
  function moveTo(m) { return (m >> 8) & 0xff; }
  function movePromo(m) { return (m >> 16) & 0xf; }
  function moveFlags(m) { return (m >> 20) & 0x1f; }

  function fileOf(sq) { return sq & 7; }
  function rankOf(sq) { return sq >> 4; }
  function onBoard(sq) { return (sq & 0x88) === 0; }

  function squareName(sq) {
    return "abcdefgh".charAt(fileOf(sq)) + (rankOf(sq) + 1);
  }

  function createPosition() {
    return {
      board: new Int8Array(128),
      turn: WHITE,
      castling: 0,
      ep: -1,
      halfmove: 0,
      fullmove: 1,
      kingW: -1,
      kingB: -1,
      ply: 0,
      undo: []
    };
  }

  function loadFen(pos, fen) {
    var parts = String(fen).trim().split(/\s+/);
    pos.board.fill(0);
    pos.kingW = -1;
    pos.kingB = -1;

    var rank = 7;
    var file = 0;
    var rows = parts[0];
    for (var i = 0; i < rows.length; i++) {
      var c = rows.charAt(i);
      if (c === "/") {
        rank--;
        file = 0;
      } else if (/[1-8]/.test(c)) {
        file += parseInt(c, 10);
      } else {
        var type = PIECE_FROM_CHAR[c.toLowerCase()];
        if (!type) throw new Error("bad FEN piece: " + c);
        var color = c === c.toUpperCase() ? WHITE : BLACK;
        var sq = rank * 16 + file;
        pos.board[sq] = type * color;
        if (type === KING) {
          if (color === WHITE) pos.kingW = sq;
          else pos.kingB = sq;
        }
        file++;
      }
    }

    pos.turn = parts[1] === "b" ? BLACK : WHITE;

    pos.castling = 0;
    var rights = parts[2] || "-";
    if (rights.indexOf("K") !== -1) pos.castling |= WK;
    if (rights.indexOf("Q") !== -1) pos.castling |= WQ;
    if (rights.indexOf("k") !== -1) pos.castling |= BK;
    if (rights.indexOf("q") !== -1) pos.castling |= BQ;

    var ep = parts[3] || "-";
    pos.ep = ep === "-" ? -1 : "abcdefgh".indexOf(ep.charAt(0)) + (parseInt(ep.charAt(1), 10) - 1) * 16;

    pos.halfmove = parts[4] ? parseInt(parts[4], 10) : 0;
    pos.fullmove = parts[5] ? parseInt(parts[5], 10) : 1;
    pos.ply = 0;
    return pos;
  }

  function toFen(pos) {
    var rows = [];
    for (var rank = 7; rank >= 0; rank--) {
      var row = "";
      var empty = 0;
      for (var file = 0; file < 8; file++) {
        var piece = pos.board[rank * 16 + file];
        if (!piece) {
          empty++;
          continue;
        }
        if (empty) {
          row += empty;
          empty = 0;
        }
        var ch = CHAR_FROM_PIECE[Math.abs(piece)];
        row += piece > 0 ? ch.toUpperCase() : ch;
      }
      if (empty) row += empty;
      rows.push(row);
    }

    var rights = "";
    if (pos.castling & WK) rights += "K";
    if (pos.castling & WQ) rights += "Q";
    if (pos.castling & BK) rights += "k";
    if (pos.castling & BQ) rights += "q";

    return (
      rows.join("/") +
      " " + (pos.turn === WHITE ? "w" : "b") +
      " " + (rights || "-") +
      " " + (pos.ep >= 0 ? squareName(pos.ep) : "-") +
      " " + pos.halfmove +
      " " + pos.fullmove
    );
  }

  /* Ignores the move counters, so it can key repetition detection. */
  function positionKey(pos) {
    var f = toFen(pos).split(" ");
    return f[0] + " " + f[1] + " " + f[2] + " " + f[3];
  }

  function kingSquare(pos, color) {
    return color === WHITE ? pos.kingW : pos.kingB;
  }

  function isAttacked(pos, sq, bySide) {
    var board = pos.board;
    var i, dir, to, piece;

    // Pawns. A white pawn on sq-17 or sq-15 attacks sq.
    if (bySide === WHITE) {
      if (onBoard(sq - 17) && board[sq - 17] === PAWN) return true;
      if (onBoard(sq - 15) && board[sq - 15] === PAWN) return true;
    } else {
      if (onBoard(sq + 17) && board[sq + 17] === -PAWN) return true;
      if (onBoard(sq + 15) && board[sq + 15] === -PAWN) return true;
    }

    for (i = 0; i < 8; i++) {
      to = sq + KNIGHT_DIRS[i];
      if (onBoard(to) && board[to] === KNIGHT * bySide) return true;
    }

    for (i = 0; i < 8; i++) {
      to = sq + KING_DIRS[i];
      if (onBoard(to) && board[to] === KING * bySide) return true;
    }

    for (i = 0; i < 4; i++) {
      dir = BISHOP_DIRS[i];
      to = sq + dir;
      while (onBoard(to)) {
        piece = board[to];
        if (piece) {
          if (piece === BISHOP * bySide || piece === QUEEN * bySide) return true;
          break;
        }
        to += dir;
      }
    }

    for (i = 0; i < 4; i++) {
      dir = ROOK_DIRS[i];
      to = sq + dir;
      while (onBoard(to)) {
        piece = board[to];
        if (piece) {
          if (piece === ROOK * bySide || piece === QUEEN * bySide) return true;
          break;
        }
        to += dir;
      }
    }

    return false;
  }

  function inCheck(pos, color) {
    var king = kingSquare(pos, color);
    if (king < 0) return false;
    return isAttacked(pos, king, -color);
  }

  function addPawnMoves(list, from, to, flags) {
    var rank = rankOf(to);
    if (rank === 0 || rank === 7) {
      list.push(makeMoveInt(from, to, QUEEN, flags | F_PROMO));
      list.push(makeMoveInt(from, to, ROOK, flags | F_PROMO));
      list.push(makeMoveInt(from, to, BISHOP, flags | F_PROMO));
      list.push(makeMoveInt(from, to, KNIGHT, flags | F_PROMO));
    } else {
      list.push(makeMoveInt(from, to, 0, flags));
    }
  }

  function generatePseudoMoves(pos, capturesOnly) {
    var board = pos.board;
    var us = pos.turn;
    var list = [];
    var from, piece, type, i, dir, to, target;

    for (from = 0; from < 128; from++) {
      if (from & 0x88) {
        from += 7;
        continue;
      }
      piece = board[from];
      if (!piece || (piece > 0 ? WHITE : BLACK) !== us) continue;
      type = Math.abs(piece);

      if (type === PAWN) {
        var step = us === WHITE ? 16 : -16;
        var startRank = us === WHITE ? 1 : 6;

        if (!capturesOnly) {
          to = from + step;
          if (onBoard(to) && !board[to]) {
            addPawnMoves(list, from, to, 0);
            if (rankOf(from) === startRank) {
              var jump = from + step * 2;
              if (!board[jump]) list.push(makeMoveInt(from, jump, 0, F_DOUBLE));
            }
          }
        }

        var caps = us === WHITE ? [15, 17] : [-15, -17];
        for (i = 0; i < 2; i++) {
          to = from + caps[i];
          if (!onBoard(to)) continue;
          target = board[to];
          if (target && (target > 0 ? WHITE : BLACK) !== us) {
            addPawnMoves(list, from, to, F_CAPTURE);
          } else if (!target && to === pos.ep) {
            list.push(makeMoveInt(from, to, 0, F_CAPTURE | F_EP));
          }
        }
        continue;
      }

      if (type === KNIGHT || type === KING) {
        var dirs = type === KNIGHT ? KNIGHT_DIRS : KING_DIRS;
        for (i = 0; i < 8; i++) {
          to = from + dirs[i];
          if (!onBoard(to)) continue;
          target = board[to];
          if (!target) {
            if (!capturesOnly) list.push(makeMoveInt(from, to, 0, 0));
          } else if ((target > 0 ? WHITE : BLACK) !== us) {
            list.push(makeMoveInt(from, to, 0, F_CAPTURE));
          }
        }
        continue;
      }

      var slides =
        type === BISHOP ? BISHOP_DIRS : type === ROOK ? ROOK_DIRS : KING_DIRS;
      var count = type === QUEEN ? 8 : 4;
      for (i = 0; i < count; i++) {
        dir = slides[i];
        to = from + dir;
        while (onBoard(to)) {
          target = board[to];
          if (!target) {
            if (!capturesOnly) list.push(makeMoveInt(from, to, 0, 0));
          } else {
            if ((target > 0 ? WHITE : BLACK) !== us) {
              list.push(makeMoveInt(from, to, 0, F_CAPTURE));
            }
            break;
          }
          to += dir;
        }
      }
    }

    if (!capturesOnly) addCastlingMoves(pos, list);
    return list;
  }

  function addCastlingMoves(pos, list) {
    var board = pos.board;
    var us = pos.turn;
    var them = -us;

    if (us === WHITE) {
      if (
        pos.castling & WK &&
        !board[5] && !board[6] &&
        board[4] === KING && board[7] === ROOK &&
        !isAttacked(pos, 4, them) && !isAttacked(pos, 5, them) && !isAttacked(pos, 6, them)
      ) {
        list.push(makeMoveInt(4, 6, 0, F_CASTLE));
      }
      if (
        pos.castling & WQ &&
        !board[1] && !board[2] && !board[3] &&
        board[4] === KING && board[0] === ROOK &&
        !isAttacked(pos, 4, them) && !isAttacked(pos, 3, them) && !isAttacked(pos, 2, them)
      ) {
        list.push(makeMoveInt(4, 2, 0, F_CASTLE));
      }
    } else {
      if (
        pos.castling & BK &&
        !board[117] && !board[118] &&
        board[116] === -KING && board[119] === -ROOK &&
        !isAttacked(pos, 116, them) && !isAttacked(pos, 117, them) && !isAttacked(pos, 118, them)
      ) {
        list.push(makeMoveInt(116, 118, 0, F_CASTLE));
      }
      if (
        pos.castling & BQ &&
        !board[113] && !board[114] && !board[115] &&
        board[116] === -KING && board[112] === -ROOK &&
        !isAttacked(pos, 116, them) && !isAttacked(pos, 115, them) && !isAttacked(pos, 114, them)
      ) {
        list.push(makeMoveInt(116, 114, 0, F_CASTLE));
      }
    }
  }

  // Castling rights are dropped whenever a king or rook leaves, or a rook is taken.
  function updateCastling(pos, from, to) {
    if (from === 4 || to === 4) pos.castling &= ~(WK | WQ);
    if (from === 116 || to === 116) pos.castling &= ~(BK | BQ);
    if (from === 0 || to === 0) pos.castling &= ~WQ;
    if (from === 7 || to === 7) pos.castling &= ~WK;
    if (from === 112 || to === 112) pos.castling &= ~BQ;
    if (from === 119 || to === 119) pos.castling &= ~BK;
  }

  function undoSlot(pos) {
    var slot = pos.undo[pos.ply];
    if (!slot) {
      slot = {};
      pos.undo[pos.ply] = slot;
    }
    return slot;
  }

  function makeMove(pos, move) {
    var board = pos.board;
    var from = moveFrom(move);
    var to = moveTo(move);
    var flags = moveFlags(move);
    var promo = movePromo(move);
    var piece = board[from];
    var us = pos.turn;

    var slot = undoSlot(pos);
    slot.move = move;
    slot.castling = pos.castling;
    slot.ep = pos.ep;
    slot.halfmove = pos.halfmove;
    slot.kingW = pos.kingW;
    slot.kingB = pos.kingB;
    slot.captured = 0;
    slot.capturedSq = -1;

    if (flags & F_EP) {
      var victim = to + (us === WHITE ? -16 : 16);
      slot.captured = board[victim];
      slot.capturedSq = victim;
      board[victim] = 0;
    } else if (board[to]) {
      slot.captured = board[to];
      slot.capturedSq = to;
    }

    board[to] = flags & F_PROMO ? promo * us : piece;
    board[from] = 0;

    if (flags & F_CASTLE) {
      // The king has already moved; slide the matching rook across it.
      if (to === 6) { board[5] = board[7]; board[7] = 0; }
      else if (to === 2) { board[3] = board[0]; board[0] = 0; }
      else if (to === 118) { board[117] = board[119]; board[119] = 0; }
      else if (to === 114) { board[115] = board[112]; board[112] = 0; }
    }

    if (Math.abs(piece) === KING) {
      if (us === WHITE) pos.kingW = to;
      else pos.kingB = to;
    }

    updateCastling(pos, from, to);
    pos.ep = flags & F_DOUBLE ? from + (us === WHITE ? 16 : -16) : -1;

    if (Math.abs(piece) === PAWN || slot.captured) pos.halfmove = 0;
    else pos.halfmove++;

    if (us === BLACK) pos.fullmove++;
    pos.turn = -us;
    pos.ply++;
  }

  function unmakeMove(pos) {
    pos.ply--;
    var slot = pos.undo[pos.ply];
    var move = slot.move;
    var board = pos.board;
    var from = moveFrom(move);
    var to = moveTo(move);
    var flags = moveFlags(move);

    pos.turn = -pos.turn;
    var us = pos.turn;

    var piece = board[to];
    board[from] = flags & F_PROMO ? PAWN * us : piece;
    board[to] = 0;

    if (slot.captured) board[slot.capturedSq] = slot.captured;

    if (flags & F_CASTLE) {
      if (to === 6) { board[7] = board[5]; board[5] = 0; }
      else if (to === 2) { board[0] = board[3]; board[3] = 0; }
      else if (to === 118) { board[119] = board[117]; board[117] = 0; }
      else if (to === 114) { board[112] = board[115]; board[115] = 0; }
    }

    pos.castling = slot.castling;
    pos.ep = slot.ep;
    pos.halfmove = slot.halfmove;
    pos.kingW = slot.kingW;
    pos.kingB = slot.kingB;
    if (us === BLACK) pos.fullmove--;
  }

  function generateLegalMoves(pos, capturesOnly) {
    var pseudo = generatePseudoMoves(pos, capturesOnly);
    var us = pos.turn;
    var legal = [];
    for (var i = 0; i < pseudo.length; i++) {
      makeMove(pos, pseudo[i]);
      if (!inCheck(pos, us)) legal.push(pseudo[i]);
      unmakeMove(pos);
    }
    return legal;
  }

  function perft(pos, depth) {
    if (depth === 0) return 1;
    var moves = generatePseudoMoves(pos, false);
    var us = pos.turn;
    var total = 0;
    for (var i = 0; i < moves.length; i++) {
      makeMove(pos, moves[i]);
      if (!inCheck(pos, us)) {
        total += depth === 1 ? 1 : perft(pos, depth - 1);
      }
      unmakeMove(pos);
    }
    return total;
  }

  /* ---------------- notation ---------------- */

  function moveToSan(pos, move, legalMoves) {
    var from = moveFrom(move);
    var to = moveTo(move);
    var flags = moveFlags(move);
    var piece = Math.abs(pos.board[from]);
    var san;

    if (flags & F_CASTLE) {
      san = fileOf(to) === 6 ? "O-O" : "O-O-O";
    } else if (piece === PAWN) {
      san = flags & F_CAPTURE ? "abcdefgh".charAt(fileOf(from)) + "x" : "";
      san += squareName(to);
      if (flags & F_PROMO) san += "=" + SAN_LETTER[movePromo(move)];
    } else {
      // Only spell out rank or file when another identical piece could also go there.
      var sameFile = false;
      var sameRank = false;
      var ambiguous = false;
      for (var i = 0; i < legalMoves.length; i++) {
        var other = legalMoves[i];
        if (other === move) continue;
        if (moveTo(other) !== to) continue;
        if (Math.abs(pos.board[moveFrom(other)]) !== piece) continue;
        ambiguous = true;
        if (fileOf(moveFrom(other)) === fileOf(from)) sameFile = true;
        if (rankOf(moveFrom(other)) === rankOf(from)) sameRank = true;
      }

      san = SAN_LETTER[piece];
      if (ambiguous) {
        if (!sameFile) san += "abcdefgh".charAt(fileOf(from));
        else if (!sameRank) san += String(rankOf(from) + 1);
        else san += squareName(from);
      }
      if (flags & F_CAPTURE) san += "x";
      san += squareName(to);
    }

    makeMove(pos, move);
    var them = pos.turn;
    if (inCheck(pos, them)) {
      san += generateLegalMoves(pos, false).length ? "+" : "#";
    }
    unmakeMove(pos);

    return san;
  }

  /* ---------------- evaluation ---------------- */

  var VALUES = [0, 100, 320, 330, 500, 900, 0];

  // Tables read a8 first, so a white piece looks up (7 - rank) * 8 + file.
  var PST = {};
  PST[PAWN] = [
    0, 0, 0, 0, 0, 0, 0, 0,
    50, 50, 50, 50, 50, 50, 50, 50,
    10, 10, 20, 30, 30, 20, 10, 10,
    5, 5, 10, 25, 25, 10, 5, 5,
    0, 0, 0, 20, 20, 0, 0, 0,
    5, -5, -10, 0, 0, -10, -5, 5,
    5, 10, 10, -20, -20, 10, 10, 5,
    0, 0, 0, 0, 0, 0, 0, 0
  ];
  PST[KNIGHT] = [
    -50, -40, -30, -30, -30, -30, -40, -50,
    -40, -20, 0, 0, 0, 0, -20, -40,
    -30, 0, 10, 15, 15, 10, 0, -30,
    -30, 5, 15, 20, 20, 15, 5, -30,
    -30, 0, 15, 20, 20, 15, 0, -30,
    -30, 5, 10, 15, 15, 10, 5, -30,
    -40, -20, 0, 5, 5, 0, -20, -40,
    -50, -40, -30, -30, -30, -30, -40, -50
  ];
  PST[BISHOP] = [
    -20, -10, -10, -10, -10, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 10, 10, 5, 0, -10,
    -10, 5, 5, 10, 10, 5, 5, -10,
    -10, 0, 10, 10, 10, 10, 0, -10,
    -10, 10, 10, 10, 10, 10, 10, -10,
    -10, 5, 0, 0, 0, 0, 5, -10,
    -20, -10, -10, -10, -10, -10, -10, -20
  ];
  PST[ROOK] = [
    0, 0, 0, 0, 0, 0, 0, 0,
    5, 10, 10, 10, 10, 10, 10, 5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    -5, 0, 0, 0, 0, 0, 0, -5,
    0, 0, 0, 5, 5, 0, 0, 0
  ];
  PST[QUEEN] = [
    -20, -10, -10, -5, -5, -10, -10, -20,
    -10, 0, 0, 0, 0, 0, 0, -10,
    -10, 0, 5, 5, 5, 5, 0, -10,
    -5, 0, 5, 5, 5, 5, 0, -5,
    0, 0, 5, 5, 5, 5, 0, -5,
    -10, 5, 5, 5, 5, 5, 0, -10,
    -10, 0, 5, 0, 0, 0, 0, -10,
    -20, -10, -10, -5, -5, -10, -10, -20
  ];
  var KING_MID = [
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -30, -40, -40, -50, -50, -40, -40, -30,
    -20, -30, -30, -40, -40, -30, -30, -20,
    -10, -20, -20, -20, -20, -20, -20, -10,
    20, 20, 0, 0, 0, 0, 20, 20,
    20, 30, 10, 0, 0, 10, 30, 20
  ];
  var KING_END = [
    -50, -40, -30, -20, -20, -30, -40, -50,
    -30, -20, -10, 0, 0, -10, -20, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 30, 40, 40, 30, -10, -30,
    -30, -10, 20, 30, 30, 20, -10, -30,
    -30, -30, 0, 0, 0, 0, -30, -30,
    -50, -30, -30, -30, -30, -30, -30, -50
  ];

  function pstIndex(sq, color) {
    var rank = rankOf(sq);
    var file = fileOf(sq);
    return color === WHITE ? (7 - rank) * 8 + file : rank * 8 + file;
  }

  function evaluate(pos) {
    var board = pos.board;
    var score = 0;
    var majors = 0;
    var sq, piece, type;

    for (sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      piece = board[sq];
      if (!piece) continue;
      type = Math.abs(piece);
      if (type !== PAWN && type !== KING) majors += VALUES[type];
    }
    var endgame = majors <= 1300;

    for (sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      piece = board[sq];
      if (!piece) continue;
      type = Math.abs(piece);
      var color = piece > 0 ? WHITE : BLACK;
      var table = type === KING ? (endgame ? KING_END : KING_MID) : PST[type];
      var value = VALUES[type] + table[pstIndex(sq, color)];
      score += color === WHITE ? value : -value;
    }

    return pos.turn === WHITE ? score : -score;
  }

  /* ---------------- search ---------------- */

  var MATE = 100000;

  function scoreMove(pos, move) {
    var flags = moveFlags(move);
    var score = 0;
    if (flags & F_CAPTURE) {
      var victim = flags & F_EP ? PAWN : Math.abs(pos.board[moveTo(move)]);
      var attacker = Math.abs(pos.board[moveFrom(move)]);
      score += 10000 + VALUES[victim] * 10 - VALUES[attacker];
    }
    if (flags & F_PROMO) score += 9000 + VALUES[movePromo(move)];
    return score;
  }

  function orderMoves(pos, moves) {
    var scored = moves.map(function (m) {
      return { move: m, score: scoreMove(pos, m) };
    });
    scored.sort(function (a, b) { return b.score - a.score; });
    return scored.map(function (s) { return s.move; });
  }

  function createSearch(limits) {
    return {
      nodes: 0,
      deadline: Date.now() + (limits.time || 1200),
      nodeBudget: limits.nodes || 300000,
      aborted: false
    };
  }

  function outOfBudget(ctx) {
    if (ctx.aborted) return true;
    if (ctx.nodes >= ctx.nodeBudget) { ctx.aborted = true; return true; }
    // Checking the clock on every node is wasteful, so sample it.
    if ((ctx.nodes & 1023) === 0 && Date.now() > ctx.deadline) {
      ctx.aborted = true;
      return true;
    }
    return false;
  }

  function quiesce(pos, ctx, alpha, beta) {
    ctx.nodes++;
    var stand = evaluate(pos);
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (outOfBudget(ctx)) return alpha;

    var us = pos.turn;
    var moves = orderMoves(pos, generatePseudoMoves(pos, true));
    for (var i = 0; i < moves.length; i++) {
      makeMove(pos, moves[i]);
      if (inCheck(pos, us)) { unmakeMove(pos); continue; }
      var score = -quiesce(pos, ctx, -beta, -alpha);
      unmakeMove(pos);
      if (ctx.aborted) return alpha;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  function alphaBeta(pos, ctx, depth, alpha, beta, ply, useQuiesce) {
    if (outOfBudget(ctx)) return alpha;
    if (depth <= 0) {
      if (useQuiesce) return quiesce(pos, ctx, alpha, beta);
      ctx.nodes++;
      return evaluate(pos);
    }

    ctx.nodes++;
    if (pos.halfmove >= 100) return 0;

    var moves = orderMoves(pos, generateLegalMoves(pos, false));
    if (!moves.length) {
      return inCheck(pos, pos.turn) ? -MATE + ply : 0;
    }

    for (var i = 0; i < moves.length; i++) {
      makeMove(pos, moves[i]);
      var score = -alphaBeta(pos, ctx, depth - 1, -beta, -alpha, ply + 1, useQuiesce);
      unmakeMove(pos);
      if (ctx.aborted) return alpha;
      if (score >= beta) return beta;
      if (score > alpha) alpha = score;
    }
    return alpha;
  }

  // Iterative deepening means a level that runs out of budget simply falls back
  // to the last depth it finished, so slower devices degrade instead of hanging.
  var LEVELS = {
    easy: { depth: 1, quiesce: false, blunder: 0.35, time: 400, nodes: 40000 },
    normal: { depth: 3, quiesce: true, blunder: 0.08, time: 900, nodes: 150000 },
    hard: { depth: 5, quiesce: true, blunder: 0, time: 1600, nodes: 600000 }
  };

  function chooseMove(pos, levelName) {
    var level = LEVELS[levelName] || LEVELS.normal;
    var moves = generateLegalMoves(pos, false);
    if (!moves.length) return { move: 0, nodes: 0 };

    if (level.blunder && Math.random() < level.blunder) {
      return { move: moves[Math.floor(Math.random() * moves.length)], nodes: 0, random: true };
    }

    var ctx = createSearch(level);
    var best = moves[0];
    var bestScore = -Infinity;

    // Iterative deepening keeps a usable move around when the budget runs out.
    for (var depth = 1; depth <= level.depth; depth++) {
      var localBest = null;
      var localScore = -Infinity;
      var ordered = orderMoves(pos, moves);

      for (var i = 0; i < ordered.length; i++) {
        makeMove(pos, ordered[i]);
        // Narrowing beta to the best score so far is what makes the cutoffs pay off.
        var score = -alphaBeta(pos, ctx, depth - 1, -Infinity, -localScore, 1, level.quiesce);
        unmakeMove(pos);
        if (ctx.aborted) break;
        if (score > localScore) {
          localScore = score;
          localBest = ordered[i];
        }
      }

      if (localBest !== null && !ctx.aborted) {
        best = localBest;
        bestScore = localScore;
      }
      if (ctx.aborted) break;
    }

    return { move: best, score: bestScore, nodes: ctx.nodes };
  }

  /* ---------------- draw and end detection ---------------- */

  function insufficientMaterial(pos) {
    var counts = [];
    var bishops = [];
    for (var sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      var piece = pos.board[sq];
      if (!piece) continue;
      var type = Math.abs(piece);
      if (type === KING) continue;
      if (type === PAWN || type === ROOK || type === QUEEN) return false;
      counts.push(type);
      if (type === BISHOP) bishops.push((rankOf(sq) + fileOf(sq)) % 2);
    }
    if (counts.length === 0) return true;
    if (counts.length === 1) return true;
    if (counts.length === 2 && bishops.length === 2 && bishops[0] === bishops[1]) return true;
    return false;
  }

  window.ChessEngine = {
    START_FEN: START_FEN,
    createPosition: createPosition,
    loadFen: loadFen,
    toFen: toFen,
    positionKey: positionKey,
    perft: perft,
    generateLegalMoves: generateLegalMoves,
    makeMove: makeMove,
    unmakeMove: unmakeMove,
    moveToSan: moveToSan,
    chooseMove: chooseMove,
    evaluate: evaluate,
    inCheck: inCheck,
    insufficientMaterial: insufficientMaterial,
    moveFrom: moveFrom,
    moveTo: moveTo,
    movePromo: movePromo,
    moveFlags: moveFlags,
    squareName: squareName,
    FLAGS: { CAPTURE: F_CAPTURE, EP: F_EP, CASTLE: F_CASTLE, DOUBLE: F_DOUBLE, PROMO: F_PROMO },
    PIECES: { PAWN: PAWN, KNIGHT: KNIGHT, BISHOP: BISHOP, ROOK: ROOK, QUEEN: QUEEN, KING: KING }
  };

  /* ------------------------------------------------------------------ *
   * User interface
   * ------------------------------------------------------------------ */

  // Only the solid glyphs are used; white pieces are recoloured in CSS so they
  // stay visible on fonts that draw the outline versions very thin.
  var GLYPH = { 1: "\u265F", 2: "\u265E", 3: "\u265D", 4: "\u265C", 5: "\u265B", 6: "\u265A" };
  var PIECE_NAME_KEY = {
    1: "chess.piece.pawn",
    2: "chess.piece.knight",
    3: "chess.piece.bishop",
    4: "chess.piece.rook",
    5: "chess.piece.queen",
    6: "chess.piece.king"
  };

  var MOVE_TONES = [{ freq: 392.0, dur: 0.06, gain: 0.07 }];
  var CAPTURE_TONES = [{ freq: 233.08, dur: 0.11, gain: 0.1 }];
  var CHECK_TONES = [
    { freq: 587.33, dur: 0.08, step: 0.07, gain: 0.1 },
    { freq: 698.46, dur: 0.12, gain: 0.1 }
  ];
  var WIN_TONES = [
    { freq: 523.25, dur: 0.16, step: 0.11 },
    { freq: 659.25, dur: 0.16, step: 0.11 },
    { freq: 783.99, dur: 0.16, step: 0.11 },
    { freq: 1046.5, dur: 0.45, gain: 0.22 }
  ];
  var LOSS_TONES = [
    { freq: 392.0, dur: 0.18, step: 0.14, gain: 0.14 },
    { freq: 311.13, dur: 0.34, gain: 0.14 }
  ];

  var pos = null;
  var playerSide = WHITE;
  var level = "normal";
  var flipped = false;
  var selected = -1;
  var legalCache = [];
  var sanList = [];
  var repetition = {};
  var gameOver = false;
  var thinking = false;
  var pendingPromo = null;
  var lastMove = { from: -1, to: -1 };
  var statusState = null;
  var cells = [];
  var gameId = 0;

  function t(key, params) {
    return typeof window.t === "function" ? window.t(key, params) : key;
  }

  function $(id) {
    return document.getElementById(id);
  }

  function tone(sequence) {
    if (typeof window.playGameTones === "function") window.playGameTones(sequence);
  }

  function setStatus(state) {
    statusState = state;
    var el = $("chessStatus");
    if (!el) return;
    el.textContent = state ? t(state.key, state.params) : "";
    el.className = "chess-status" + (state && state.tone ? " " + state.tone : "");
  }

  function displayToSquare(index) {
    var row = Math.floor(index / 8);
    var col = index % 8;
    var rank = flipped ? row : 7 - row;
    var file = flipped ? 7 - col : col;
    return rank * 16 + file;
  }

  function buildBoard() {
    var board = $("chessBoard");
    if (!board) return;
    board.textContent = "";
    cells = [];

    for (var i = 0; i < 64; i++) {
      var cell = document.createElement("button");
      cell.type = "button";
      cell.className = "chess-cell";
      cell.setAttribute("role", "gridcell");
      cell.addEventListener("click", onCellClick);
      board.appendChild(cell);
      cells.push(cell);
    }
  }

  // The search uses finer weights, but the readout follows the usual
  // pawn-count convention players expect.
  var HUD_VALUES = [0, 1, 3, 3, 5, 9, 0];

  function refreshMaterial() {
    var el = $("chessMaterial");
    if (!el || !pos) return;
    var score = 0;
    for (var sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      var piece = pos.board[sq];
      if (!piece) continue;
      var value = HUD_VALUES[Math.abs(piece)];
      score += piece > 0 ? value : -value;
    }
    var mine = playerSide === WHITE ? score : -score;
    el.textContent = mine > 0 ? "+" + mine : String(mine);
  }

  function render() {
    if (!pos || !cells.length) return;

    var targets = {};
    if (selected >= 0) {
      for (var i = 0; i < legalCache.length; i++) {
        if (moveFrom(legalCache[i]) === selected) targets[moveTo(legalCache[i])] = true;
      }
    }

    var checkedKing = -1;
    if (inCheck(pos, pos.turn)) checkedKing = kingSquare(pos, pos.turn);

    for (var d = 0; d < 64; d++) {
      var sq = displayToSquare(d);
      var cell = cells[d];
      var piece = pos.board[sq];
      var dark = (rankOf(sq) + fileOf(sq)) % 2 === 0;

      var classes = ["chess-cell", dark ? "dark" : "light"];
      if (sq === selected) classes.push("selected");
      if (targets[sq]) classes.push(piece ? "target-capture" : "target");
      if (sq === lastMove.from || sq === lastMove.to) classes.push("last");
      if (sq === checkedKing) classes.push("in-check");
      cell.className = classes.join(" ");

      cell.textContent = piece ? GLYPH[Math.abs(piece)] : "";
      cell.dataset.sq = String(sq);
      cell.dataset.color = piece ? (piece > 0 ? "w" : "b") : "";

      // Files run along the bottom edge and ranks up the left edge.
      var row = Math.floor(d / 8);
      var col = d % 8;
      if (row === 7) cell.dataset.file = "abcdefgh".charAt(fileOf(sq));
      else delete cell.dataset.file;
      if (col === 0) cell.dataset.rank = String(rankOf(sq) + 1);
      else delete cell.dataset.rank;

      // Word order differs by language, so the pairing lives in the dictionary.
      var name = piece
        ? t("chess.aria.piece", {
            side: t(piece > 0 ? "chess.side.white" : "chess.side.black"),
            piece: t(PIECE_NAME_KEY[Math.abs(piece)])
          })
        : t("chess.empty");
      cell.setAttribute("aria-label", squareName(sq) + ", " + name);
      // The board also locks while a promotion is waiting on a choice.
      cell.disabled = gameOver || thinking || !!pendingPromo;
    }

    var turnEl = $("chessTurn");
    if (turnEl) turnEl.textContent = t(pos.turn === WHITE ? "chess.side.white" : "chess.side.black");
    var countEl = $("chessMoveCount");
    if (countEl) countEl.textContent = String(Math.floor(sanList.length / 2) + (sanList.length % 2));
    refreshMaterial();
    renderMoves();

    var undoBtn = $("chessUndoBtn");
    if (undoBtn) undoBtn.disabled = thinking || !!pendingPromo || sanList.length === 0;
  }

  function renderMoves() {
    var list = $("chessMoves");
    if (!list) return;
    list.textContent = "";
    for (var i = 0; i < sanList.length; i += 2) {
      var item = document.createElement("li");
      var white = document.createElement("span");
      white.textContent = sanList[i];
      item.appendChild(white);
      if (sanList[i + 1]) {
        var black = document.createElement("span");
        black.textContent = sanList[i + 1];
        item.appendChild(black);
      }
      list.appendChild(item);
    }
    list.scrollTop = list.scrollHeight;
  }

  function refreshLegal() {
    legalCache = generateLegalMoves(pos, false);
  }

  function recordRepetition() {
    var key = positionKey(pos);
    repetition[key] = (repetition[key] || 0) + 1;
    return repetition[key];
  }

  function finish(state) {
    gameOver = true;
    setStatus(state);
    render();
  }

  function checkGameEnd() {
    refreshLegal();
    var side = pos.turn;

    if (!legalCache.length) {
      if (inCheck(pos, side)) {
        var playerWon = side !== playerSide;
        tone(playerWon ? WIN_TONES : LOSS_TONES);
        finish({
          key: playerWon ? "chess.status.youWin" : "chess.status.youLose",
          tone: playerWon ? "win" : "lose"
        });
      } else {
        finish({ key: "chess.status.stalemate", tone: "draw" });
      }
      return true;
    }

    if (pos.halfmove >= 100) {
      finish({ key: "chess.status.fiftyMove", tone: "draw" });
      return true;
    }
    if (insufficientMaterial(pos)) {
      finish({ key: "chess.status.material", tone: "draw" });
      return true;
    }
    if (repetition[positionKey(pos)] >= 3) {
      finish({ key: "chess.status.repetition", tone: "draw" });
      return true;
    }
    return false;
  }

  function applyMove(move) {
    var san = moveToSan(pos, move, legalCache);
    var flags = moveFlags(move);

    makeMove(pos, move);
    sanList.push(san);
    lastMove = { from: moveFrom(move), to: moveTo(move) };
    recordRepetition();

    if (inCheck(pos, pos.turn)) tone(CHECK_TONES);
    else if (flags & F_CAPTURE) tone(CAPTURE_TONES);
    else tone(MOVE_TONES);
  }

  // A level that answers in a few milliseconds feels like a glitch rather than a
  // reply, so the move is held back until the board has visibly been the engine's.
  var MIN_THINK_MS = 320;

  function runEngineMove() {
    var ticket = gameId;
    thinking = true;
    setStatus({ key: "chess.status.thinking" });
    render();

    // Yield once so the thinking state paints before the search blocks the thread.
    setTimeout(function () {
      if (ticket !== gameId) return;
      var started = Date.now();
      var result = chooseMove(pos, level);
      var wait = Math.max(0, MIN_THINK_MS - (Date.now() - started));

      setTimeout(function () {
        if (ticket !== gameId) return;
        thinking = false;

        if (!result.move) {
          checkGameEnd();
          return;
        }

        refreshLegal();
        applyMove(result.move);
        if (checkGameEnd()) return;

        setStatus(
          inCheck(pos, pos.turn)
            ? { key: "chess.status.yourTurnCheck", tone: "warn" }
            : { key: "chess.status.yourTurn" }
        );
        refreshLegal();
        render();
      }, wait);
    }, 30);
  }

  function afterPlayerMove() {
    selected = -1;
    if (checkGameEnd()) return;
    runEngineMove();
  }

  function onCellClick(event) {
    if (gameOver || thinking || pendingPromo) return;
    if (pos.turn !== playerSide) return;

    var sq = parseInt(event.currentTarget.dataset.sq, 10);
    var piece = pos.board[sq];

    if (selected >= 0) {
      var matches = legalCache.filter(function (m) {
        return moveFrom(m) === selected && moveTo(m) === sq;
      });

      if (matches.length) {
        if (matches.length > 1 && (moveFlags(matches[0]) & F_PROMO)) {
          openPromotion(matches);
          return;
        }
        applyMove(matches[0]);
        afterPlayerMove();
        return;
      }
    }

    if (piece && (piece > 0 ? WHITE : BLACK) === playerSide) {
      selected = sq;
    } else {
      selected = -1;
    }
    render();
  }

  function openPromotion(moves) {
    pendingPromo = moves;
    var panel = $("chessPromo");
    var row = $("chessPromoRow");
    if (!panel || !row) {
      applyMove(moves[0]);
      afterPlayerMove();
      return;
    }

    row.textContent = "";
    moves.forEach(function (move) {
      var type = movePromo(move);
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chess-promo-btn";
      btn.dataset.color = playerSide === WHITE ? "w" : "b";
      btn.textContent = GLYPH[type];
      btn.setAttribute("aria-label", t(PIECE_NAME_KEY[type]));
      btn.addEventListener("click", function () {
        pendingPromo = null;
        panel.hidden = true;
        applyMove(move);
        afterPlayerMove();
      });
      row.appendChild(btn);
    });

    panel.hidden = false;
    render();
    var first = row.querySelector("button");
    if (first) first.focus();
  }

  function newGame() {
    // Invalidates any search that is still pending from the previous game.
    gameId++;
    pos = createPosition();
    loadFen(pos, START_FEN);
    selected = -1;
    sanList = [];
    repetition = {};
    gameOver = false;
    thinking = false;
    pendingPromo = null;
    lastMove = { from: -1, to: -1 };
    flipped = playerSide === BLACK;

    var panel = $("chessPromo");
    if (panel) panel.hidden = true;

    recordRepetition();
    refreshLegal();
    setStatus({ key: "chess.status.start" });
    render();

    if (playerSide === BLACK) runEngineMove();
  }

  // Rolls back the player's move together with the reply it drew.
  function undoMove() {
    if (thinking || pendingPromo || !sanList.length) return;
    var steps = pos.turn === playerSide ? 2 : 1;
    steps = Math.min(steps, sanList.length);

    for (var i = 0; i < steps; i++) {
      var key = positionKey(pos);
      if (repetition[key]) repetition[key]--;
      unmakeMove(pos);
      sanList.pop();
    }

    gameOver = false;
    selected = -1;
    lastMove = { from: -1, to: -1 };
    if (pos.ply > 0) {
      var prev = pos.undo[pos.ply - 1];
      lastMove = { from: moveFrom(prev.move), to: moveTo(prev.move) };
    }
    refreshLegal();
    setStatus({ key: "chess.status.undone" });
    render();
  }

  function setLevel(next) {
    level = LEVELS[next] ? next : "normal";
    document.querySelectorAll(".chess-diff[data-level]").forEach(function (btn) {
      btn.classList.toggle("active", btn.dataset.level === level);
      btn.setAttribute("aria-pressed", btn.dataset.level === level ? "true" : "false");
    });
  }

  function setSide(next) {
    playerSide = next === "b" ? BLACK : WHITE;
    document.querySelectorAll(".chess-diff[data-side]").forEach(function (btn) {
      var on = (btn.dataset.side === "b" ? BLACK : WHITE) === playerSide;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
    });
  }

  function wire() {
    var openBtn = $("openChessBtn");
    var view = $("chessView");
    if (!openBtn || !view) return;

    openBtn.addEventListener("click", function () {
      if (typeof showView === "function") showView(view);
      else {
        document.querySelectorAll("main").forEach(function (m) {
          m.hidden = m !== view;
        });
      }
    });

    var backBtn = $("backHomeFromChessBtn");
    if (backBtn) {
      backBtn.addEventListener("click", function () {
        if (typeof showView === "function" && $("homeView")) showView($("homeView"));
        openBtn.focus();
      });
    }

    document.querySelectorAll(".chess-diff[data-level]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setLevel(btn.dataset.level);
        newGame();
      });
    });

    document.querySelectorAll(".chess-diff[data-side]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setSide(btn.dataset.side);
        newGame();
      });
    });

    var newBtn = $("chessNewBtn");
    if (newBtn) newBtn.addEventListener("click", newGame);

    var undoBtn = $("chessUndoBtn");
    if (undoBtn) undoBtn.addEventListener("click", undoMove);

    var flipBtn = $("chessFlipBtn");
    if (flipBtn) {
      flipBtn.addEventListener("click", function () {
        flipped = !flipped;
        render();
      });
    }

    window.refreshChessI18n = function () {
      setStatus(statusState);
      render();
    };

    buildBoard();
    setLevel(level);
    setSide("w");
    newGame();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", wire);
  } else {
    wire();
  }
})();
