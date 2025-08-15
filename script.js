// ====== Configurable "About Me" text ======
const ABOUT_ME = `Hi, I'm Evander Mejia. I am a computer science student with an interest in web development. I hope you enjoy playing.`;

// ====== Piece symbols (Unicode) ======
const SYMBOLS = {
  'wP':'\u2659','wR':'\u2656','wN':'\u2658','wB':'\u2657','wQ':'\u2655','wK':'\u2654',
  'bP':'\u265F','bR':'\u265C','bN':'\u265E','bB':'\u265D','bQ':'\u265B','bK':'\u265A'
};
// Convert the double-escaped sequences to actual characters once
for (const k in SYMBOLS) {
  SYMBOLS[k] = SYMBOLS[k].replace(/\\u([0-9A-Fa-f]{4})/g, (_,h) =>
    String.fromCharCode(parseInt(h, 16))
  );
}

// ====== State ======
const state = {
  board: new Array(64).fill(null),
  turn: 'w',
  selected: null,
  legalTargets: [],
  history: [],
  playing: false,
  result: null
};

// ====== Helpers ======
const files = i => i % 8;
const ranks = i => Math.floor(i / 8);
const idx = (r, c) => r * 8 + c;
const inside = (r, c) => r >= 0 && r < 8 && c >= 0 && c < 8;
function cloneBoard(b) { return b.slice(); }

// ====== Setup & Reset ======
function setupStart() {
  const b = new Array(64).fill(null);
  const back = ['R','N','B','Q','K','B','N','R'];
  for (let c = 0; c < 8; c++) {
    b[idx(0, c)] = 'b' + back[c];
    b[idx(1, c)] = 'bP';
    b[idx(6, c)] = 'wP';
    b[idx(7, c)] = 'w' + back[c];
  }
  Object.assign(state, { board: b, turn: 'w', selected: null, legalTargets: [], result: null, history: [] });
  render();
  setStatus('White to move');
  setMoves('');
}

// ====== Rendering ======
const boardEl = document.getElementById('board');
function render() {
  boardEl.innerHTML = '';
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const i = idx(r, c);
      const piece = state.board[i];
      const sq = document.createElement('div');
      sq.className = 'sq ' + ((r + c) % 2 === 0 ? 'light' : 'dark');
      sq.dataset.index = i;
      if (state.selected === i) sq.classList.add('selected');
      if (state.legalTargets.includes(i)) {
        sq.classList.add(state.board[i] ? 'capture' : 'moveTarget');
      }
      if (isLastMoveSquare(i)) sq.classList.add('highlight');
      sq.addEventListener('click', onSquareClick);
      sq.setAttribute('role', 'gridcell');
      sq.setAttribute('aria-label', piece ? piece : 'empty');
      if (piece) {
        sq.textContent = SYMBOLS[piece];
        sq.classList.add(piece[0] === 'w' ? 'white-piece' : 'black-piece');
      }
      boardEl.appendChild(sq);
    }
  }
  // Make squares focusable for keyboard nav
  Array.from(boardEl.children).forEach(el => el.setAttribute('tabindex', '0'));
}

function isLastMoveSquare(i) {
  const h = state.history;
  if (!h.length) return false;
  const last = h[h.length - 1];
  return last.from === i || last.to === i;
}

function setStatus(text) {
  document.getElementById('status').textContent = text;
}

function setMoves(text) {
  document.getElementById('moves').textContent = text;
}

// ====== Interaction Logic ======
function onSquareClick(e) {
  if (!state.playing || state.result) return;
  const i = Number(e.currentTarget.dataset.index);
  const piece = state.board[i];
  
  if (state.selected !== null) {
    if (state.legalTargets.includes(i)) {
      makeMove({ from: state.selected, to: i });
      postMoveUpdate();
      return;
    }
  }

  if (piece && piece[0] === state.turn) {
    state.selected = i;
    state.legalTargets = legalMovesFrom(i, state.board, state.turn);
    render();
  } else {
    state.selected = null;
    state.legalTargets = [];
    render();
  }
}

function postMoveUpdate() {
  state.selected = null;
  state.legalTargets = [];
  render();
  const color = state.turn;
  const enemy = color === 'w' ? 'b' : 'w';
  const inCheck = isKingInCheck(state.board, color);
  const legalExists = anyLegalMove(state.board, color);

  if (!legalExists) {
    if (inCheck) {
      state.result = `${enemy} wins by checkmate`;
      setStatus(`Checkmate. ${enemy === 'w' ? 'White' : 'Black'} wins. Press Reset.`);
    } else {
      state.result = 'draw by stalemate';
      setStatus('Stalemate. Press Reset.');
    }
  } else {
    setStatus(`${color === 'w' ? 'White' : 'Black'} to move${inCheck ? ' · in check' : ''}`);
  }
}

// ====== Move Generation ======
function legalMovesFrom(from, board, side) {
  const piece = board[from];
  if (!piece || piece[0] !== side) return [];
  const pseudoMoves = generatePseudoMoves(from, board);
  const legal = [];
  for (const to of pseudoMoves) {
    const b2 = cloneBoard(board);
    b2[to] = b2[from];
    b2[from] = null;
    const r = ranks(to), p = b2[to];
    if (p[1] === 'P' && ((p[0] === 'w' && r === 0) || (p[0] === 'b' && r === 7))) {
      b2[to] = p[0] + 'Q';
    }
    if (!isKingInCheck(b2, side)) legal.push(to);
  }
  return legal;
}

function anyLegalMove(board, side) {
  return board.some((p, i) => p && p[0] === side && legalMovesFrom(i, board, side).length);
}

function generatePseudoMoves(from, board) {
  const p = board[from];
  if (!p) return [];
  const [color, type] = [p[0], p[1]];
  const r0 = ranks(from), c0 = files(from);
  const moves = [];

  const tryPush = (r, c) => {
    if (!inside(r, c)) return false;
    const i = idx(r, c);
    if (!board[i]) { moves.push(i); return true; }
    return false;
  };
  const tryCapture = (r, c) => {
    if (!inside(r, c)) return;
    const i = idx(r, c), q = board[i];
    if (q && q[0] !== color) moves.push(i);
  };

  if (type === 'P') {
    const dir = color === 'w' ? -1 : 1;
    if (tryPush(r0 + dir, c0)) {
      const startRank = color === 'w' ? 6 : 1;
      if (r0 === startRank) tryPush(r0 + 2 * dir, c0);
    }
    tryCapture(r0 + dir, c0 - 1);
    tryCapture(r0 + dir, c0 + 1);
  }

  if (type === 'N') {
    [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]].forEach(([dr, dc]) => {
      const r = r0 + dr, c = c0 + dc;
      if (inside(r, c)) {
        const i = idx(r, c), q = board[i];
        if (!q || q[0] !== color) moves.push(i);
      }
    });
  }

  if (['B','R','Q'].includes(type)) {
    const directions = [];
    if (['B','Q'].includes(type)) directions.push([1,1],[1,-1],[-1,1],[-1,-1]);
    if (['R','Q'].includes(type)) directions.push([1,0],[-1,0],[0,1],[0,-1]);
    
    directions.forEach(([dr, dc]) => {
      let r = r0 + dr, c = c0 + dc;
      while (inside(r, c)) {
        const i = idx(r, c), q = board[i];
        if (!q) {
          moves.push(i);
        } else {
          if (q[0] !== color) moves.push(i);
          break;
        }
        r += dr; c += dc;
      }
    });
  }

  if (type === 'K') {
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        if (dr === 0 && dc === 0) continue;
        const r = r0 + dr, c = c0 + dc;
        if (inside(r, c)) {
          const i = idx(r, c), q = board[i];
          if (!q || q[0] !== color) moves.push(i);
        }
      }
    }
  }

  return moves;
}

// ====== Check Detection ======
function isKingInCheck(board, side) {
  const target = side + 'K';
  const kingIndex = board.findIndex(p => p === target);
  return kingIndex < 0 || isSquareAttacked(board, kingIndex, side);
}

function isSquareAttacked(board, squareIndex, side) {
  const enemy = side === 'w' ? 'b' : 'w';
  const r0 = ranks(squareIndex), c0 = files(squareIndex);

  // Pawn attacks
  const pawnDir = enemy === 'w' ? -1 : 1;
  [-1, 1].forEach(dc => {
    const r = r0 + pawnDir, c = c0 + dc;
    if (inside(r, c) && board[idx(r, c)] === enemy + 'P') return true;
  });

  // Knight attacks
  [[2,1],[2,-1],[-2,1],[-2,-1],[1,2],[1,-2],[-1,2],[-1,-2]].forEach(([dr, dc]) => {
    const r = r0 + dr, c = c0 + dc;
    if (inside(r, c) && board[idx(r, c)] === enemy + 'N') return true;
  });

  // Sliding attacks
  const slideDirs = {
    diagonal: [[1,1],[1,-1],[-1,1],[-1,-1]],
    straight: [[1,0],[-1,0],[0,1],[0,-1]]
  };

  for (const [type, dirs] of Object.entries(slideDirs)) {
    dirs.forEach(([dr, dc]) => {
      let r = r0 + dr, c = c0 + dc;
      while (inside(r, c)) {
        const q = board[idx(r, c)];
        if (q) {
          const pieceType = q[1];
          if (q[0] === enemy &&
             ((type === 'diagonal' && ['B', 'Q'].includes(pieceType)) ||
             (type === 'straight' && ['R', 'Q'].includes(pieceType)))) {
            return true;
          }
          break;
        }
        r += dr; c += dc;
      }
    });
  }

  // Adjacent king
  for (let dr = -1; dr <= 1; dr++) {
    for (let dc = -1; dc <= 1; dc++) {
      if (dr === 0 && dc === 0) continue;
      const r = r0 + dr, c = c0 + dc;
      if (inside(r, c) && board[idx(r, c)] === enemy + 'K') return true;
    }
  }

  return false;
}

// ====== Recording Moves ======
function makeMove({ from, to }) {
  const moving = state.board[from];
  const prev = { from, to, captured: state.board[to], piece: moving };
  state.board[to] = moving;
  state.board[from] = null;

  const r = ranks(to);
  if (moving[1] === 'P' && ((moving[0] === 'w' && r === 0) || (moving[0] === 'b' && r === 7))) {
    state.board[to] = moving[0] + 'Q';
    prev.promoted = true;
  }

  state.history.push(prev);
  state.turn = state.turn === 'w' ? 'b' : 'w';

  const fileChar = c => 'abcdefgh'[c];
  const rankChar = r => (8 - r).toString();
  const fromAN = `${fileChar(files(from))}${rankChar(ranks(from))}`;
  const toAN = `${fileChar(files(to))}${rankChar(ranks(to))}`;
  const pieceType = moving[1];
  const captureSymbol = prev.captured ? 'x' : '-';

  setMoves((document.getElementById('moves').textContent +
            `\n${state.turn === 'b' ? 'W' : 'B'}: ${pieceType}${fromAN}${captureSymbol}${toAN}`).
           trim());
}

// ====== UI Wiring ======
document.getElementById('playBtn').addEventListener('click', () => { hideMenu(); setupStart(); });
document.getElementById('resetBtn').addEventListener('click', setupStart);

function showMenu() {
  state.playing = false;
  document.getElementById('menu').classList.remove('hidden');
}

function hideMenu() {
  state.playing = true;
  document.getElementById('menu').classList.add('hidden');
}

const aboutPanel = document.getElementById('about');
const instrPanel = document.getElementById('instructions');
document.getElementById('showAbout').addEventListener('click', () => {
  aboutPanel.classList.add('active');
  instrPanel.classList.remove('active');
});
document.getElementById('showInstructions').addEventListener('click', () => {
  instrPanel.classList.add('active');
  aboutPanel.classList.remove('active');
});

const menuSectionsContainer = document.getElementById('menuSections');
const menuAbout = document.getElementById('menuAbout');
const menuInstructions = document.getElementById('menuInstructions');
document.getElementById('menuAboutBtn').addEventListener('click', () => {
  menuSectionsContainer.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  menuAbout.classList.add('active');
});
document.getElementById('menuInstructionsBtn').addEventListener('click', () => {
  menuSectionsContainer.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
  menuInstructions.classList.add('active');
});

// ====== Light/Dark Toggle ======
document.getElementById('modeToggle').addEventListener('change', (e) => {
  document.body.classList.toggle('light', e.target.checked);
});

// Populate About texts
document.getElementById('aboutText').textContent = ABOUT_ME;
document.getElementById('menuAboutText').textContent = ABOUT_ME;

// Initial rendering and show menu
render();
showMenu();

// Keyboard navigation for board
boardEl.addEventListener('keydown', (e) => {
  if (!state.playing || state.result) return;
  const focus = document.activeElement;
  if (!focus.classList.contains('sq')) return;
  const i = Number(focus.dataset.index);
  const r = ranks(i), c = files(i);

  const tryFocus = (nr, nc) => {
    if (!inside(nr, nc)) return;
    boardEl.children[idx(nr, nc)].focus();
  };

  switch(e.key) {
    case 'ArrowUp': tryFocus(r - 1, c); e.preventDefault(); break;
    case 'ArrowDown': tryFocus(r + 1, c); e.preventDefault(); break;
    case 'ArrowLeft': tryFocus(r, c - 1); e.preventDefault(); break;
    case 'ArrowRight': tryFocus(r, c + 1); e.preventDefault(); break;
    case 'Enter':
    case ' ': focus.click(); e.preventDefault(); break;
  }
});
