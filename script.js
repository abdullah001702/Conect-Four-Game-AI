/**
 * ════════════════════════════════════════════════════════════
 * CONNECT FOUR — AI EDITION
 * script.js  |  Game Logic + Minimax AI with Alpha-Beta Pruning
 *
 * GAME TREE REPRESENTATION:
 * ─────────────────────────
 * The Minimax algorithm models the game as a tree:
 *   • Root node     = current board state
 *   • Child nodes   = all possible moves (column drops)
 *   • Leaf nodes    = terminal states (win/draw/depth limit)
 *   • Each node stores a heuristic score (+∞ = AI wins, -∞ = human wins)
 *
 * ALGORITHM FLOW:
 *   maximizingPlayer (AI) → picks move with HIGHEST score
 *   minimizingPlayer (Human) → assumes LOWEST score chosen
 *   Alpha-Beta Pruning → skips branches that can't affect outcome,
 *                        drastically reducing nodes evaluated.
 *
 * EVALUATION FUNCTION:
 *   Scores board windows of 4 cells, considering:
 *   • 4-in-a-row (win)      → ±100,000
 *   • 3-in-a-row + 1 empty  → ±  5,000
 *   • 2-in-a-row + 2 empty  → ±    200
 *   • Center column bonus   → +      3 per piece
 * ════════════════════════════════════════════════════════════
 */

"use strict";

/* ══════════════════════════════════════════
   CONSTANTS
══════════════════════════════════════════ */
const ROWS    = 6;
const COLS    = 7;
const EMPTY   = 0;
const P1      = 1;   // Human (always red)
const P2      = 2;   // Human2 or AI (yellow)

const DEPTH_MAP = {
  easy:   0,   // random moves
  medium: 4,   // minimax depth 4
  hard:   6,   // minimax depth 6
};

/* Scores for the evaluation function */
const SCORE_WIN    = 100_000;
const SCORE_THREE  =   5_000;
const SCORE_TWO    =     200;
const SCORE_CENTER =       3;

/* ══════════════════════════════════════════
   STATE
══════════════════════════════════════════ */
let board      = [];        // 2D array [row][col]
let gameActive = false;
let currentPlayer = P1;
let mode       = "pvp";     // "pvp" | "pva"
let difficulty = "medium";
let p1Name     = "Player 1";
let p2Name     = "Player 2";
let scores     = { p1: 0, p2: 0, draws: 0 };
let moveHistory = [];       // stack of { col, row, player } for undo
let soundOn    = true;
let aiThinking = false;
let treeSample = [];        // last AI decision tree sample

/* ══════════════════════════════════════════
   DOM REFERENCES
══════════════════════════════════════════ */
const boardEl         = document.getElementById("board");
const turnDisc        = document.getElementById("turnDisc");
const turnText        = document.getElementById("turnText");
const startBtn        = document.getElementById("startBtn");
const resetBtn        = document.getElementById("resetBtn");
const undoBtn         = document.getElementById("undoBtn");
const soundBtn        = document.getElementById("soundBtn");
const themeToggle     = document.getElementById("themeToggle");
const overlay         = document.getElementById("overlay");
const overlayTitle    = document.getElementById("overlayTitle");
const overlaySubtitle = document.getElementById("overlaySubtitle");
const overlayIcon     = document.getElementById("overlayIcon");
const overlayRestart  = document.getElementById("overlayRestart");
const overlayMenu     = document.getElementById("overlayMenu");
const moveLogEl       = document.getElementById("moveLog");
const p1NameInput     = document.getElementById("p1Name");
const p2NameInput     = document.getElementById("p2Name");
const p2NameGroup     = document.getElementById("p2NameGroup");
const difficultyGroup = document.getElementById("difficultyGroup");
const aiInfoCard      = document.getElementById("aiInfoCard");
const treeCard        = document.getElementById("treeCard");
const treeVizEl       = document.getElementById("treeViz");
const aiNodesEl       = document.getElementById("aiNodes");
const aiTimeEl        = document.getElementById("aiTime");
const aiDepthEl       = document.getElementById("aiDepthDisplay");
const scoreP1El       = document.getElementById("scoreP1");
const scoreP2El       = document.getElementById("scoreP2");
const scoreDrawsEl    = document.getElementById("scoreDraws");
const scoreP1Name     = document.getElementById("scoreP1Name");
const scoreP2Name     = document.getElementById("scoreP2Name");
const columnArrows    = document.getElementById("columnArrows");

/* ══════════════════════════════════════════
   BOARD INIT
══════════════════════════════════════════ */

/** Create the visual 6×7 board cells */
function buildBoardDOM() {
  boardEl.innerHTML = "";
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const cell = document.createElement("div");
      cell.className = "cell";
      cell.dataset.row = r;
      cell.dataset.col = c;

      // Invisible disc fill div (will be coloured on drop)
      const fill = document.createElement("div");
      fill.className = "disc-fill";
      cell.appendChild(fill);

      cell.addEventListener("click", () => handleCellClick(c));
      cell.addEventListener("mouseenter", () => highlightColumn(c, true));
      cell.addEventListener("mouseleave", () => highlightColumn(c, false));
      boardEl.appendChild(cell);
    }
  }
}

/** Reset internal board state */
function resetBoard() {
  board = Array.from({ length: ROWS }, () => Array(COLS).fill(EMPTY));
  moveHistory = [];
  treeSample  = [];
}

/* ══════════════════════════════════════════
   GAME FLOW
══════════════════════════════════════════ */

function startGame() {
  p1Name = p1NameInput.value.trim() || "Player 1";
  p2Name = p2NameInput.value.trim() || (mode === "pva" ? "AI" : "Player 2");

  scoreP1Name.textContent = p1Name.slice(0, 10);
  scoreP2Name.textContent = p2Name.slice(0, 10);

  resetBoard();
  buildBoardDOM();
  clearMoveLog();
  treeVizEl.innerHTML = "";

  currentPlayer = P1;
  gameActive    = true;
  aiThinking    = false;

  boardEl.classList.add("active");
  boardEl.classList.remove("p2-turn");
  boardEl.classList.add("p1-turn");

  updateTurnIndicator();
  overlay.hidden = true;

  if (mode === "pva") {
    aiDepthEl.textContent = difficulty === "easy" ? "Random" : DEPTH_MAP[difficulty];
  }
}

function handleCellClick(col) {
  if (!gameActive || aiThinking) return;
  if (mode === "pva" && currentPlayer === P2) return; // AI's turn

  dropDisc(col);
}

function dropDisc(col) {
  const row = getAvailableRow(board, col);
  if (row === -1) return; // column full

  // Place piece in logical board
  board[row][col] = currentPlayer;
  moveHistory.push({ col, row, player: currentPlayer });

  // Animate drop
  animateDrop(row, col, currentPlayer, () => {
    afterDropCheck(row, col);
  });
}

/**
 * After a disc lands, check win / draw
 */
function afterDropCheck(row, col) {
  const winCells = checkWin(board, row, col, board[row][col]);

  if (winCells) {
    highlightWin(winCells, board[row][col]);
    endGame("win", board[row][col]);
    return;
  }

  if (isDraw(board)) {
    endGame("draw", null);
    return;
  }

  // Switch turn
  currentPlayer = currentPlayer === P1 ? P2 : P1;
  updateTurnIndicator();

  logMove(moveHistory.length, col, currentPlayer === P1 ? P2 : P1);

  // AI move
  if (mode === "pva" && currentPlayer === P2 && gameActive) {
    scheduleAI();
  }
}

function endGame(result, winner) {
  gameActive = false;
  boardEl.classList.remove("active");

  if (result === "win") {
    const name = winner === P1 ? p1Name : p2Name;
    overlayTitle.textContent = `${name} Wins!`;
    overlaySubtitle.textContent = winner === P1 ? "Excellent strategy!" : (mode === "pva" ? "The AI outplayed you!" : "Well played!");
    overlayIcon.textContent = winner === P1 ? "🏆" : (mode === "pva" ? "🤖" : "🏆");

    if (winner === P1) { scores.p1++; scoreP1El.textContent = scores.p1; }
    else               { scores.p2++; scoreP2El.textContent = scores.p2; }

    if (soundOn) playTone(660, "square", 0.4, 0.4);
  } else {
    overlayTitle.textContent = "It's a Draw!";
    overlaySubtitle.textContent = "Great minds think alike.";
    overlayIcon.textContent = "🤝";
    scores.draws++;
    scoreDrawsEl.textContent = scores.draws;
    if (soundOn) playTone(300, "sine", 0.3, 0.2);
  }

  setTimeout(() => { overlay.hidden = false; }, 700);
}

/* ══════════════════════════════════════════
   ANIMATION
══════════════════════════════════════════ */

/**
 * Animate a disc falling into position.
 * Uses CSS animation with a custom property for travel distance.
 * @param {number} row - destination row
 * @param {number} col - column
 * @param {number} player - P1 or P2
 * @param {Function} onComplete - callback when animation ends
 */
function animateDrop(row, col, player, onComplete) {
  const cell  = getCellEl(row, col);
  const fill  = cell.querySelector(".disc-fill");
  const color = player === P1 ? "red" : "yellow";

  // Calculate rows to fall (from top)
  const rowsToFall = row + 1;
  const duration   = Math.min(0.12 + rowsToFall * 0.055, 0.55);

  fill.style.setProperty("--drop-duration", duration + "s");
  fill.style.setProperty("--drop-from", `-${(ROWS - row) * 120}%`);
  fill.className = `disc-fill ${color} drop`;

  if (soundOn) playTone(200 + col * 40, "triangle", 0.12, 0.25);

  fill.addEventListener("animationend", () => {
    fill.classList.remove("drop");
    fill.style.transform = "translateY(0)";
    onComplete();
  }, { once: true });
}

function highlightWin(cells, player) {
  const cls = player === P1 ? "red-win" : "yellow-win";
  cells.forEach(([r, c]) => {
    const cell = getCellEl(r, c);
    cell.classList.add("win-cell", cls);
  });
}

function highlightColumn(col, on) {
  for (let r = 0; r < ROWS; r++) {
    const cell = getCellEl(r, col);
    if (on) cell.classList.add("col-hover");
    else    cell.classList.remove("col-hover");
  }
  const arrow = columnArrows.querySelector(`[data-col="${col}"]`);
  if (arrow) {
    arrow.style.color = on
      ? (currentPlayer === P1 ? "var(--red)" : "var(--yellow)")
      : "transparent";
  }
}

/* ══════════════════════════════════════════
   BOARD HELPERS
══════════════════════════════════════════ */

/** Returns the lowest empty row in a column, or -1 if full */
function getAvailableRow(b, col) {
  for (let r = ROWS - 1; r >= 0; r--) {
    if (b[r][col] === EMPTY) return r;
  }
  return -1;
}

/** Deep-copy a board array */
function cloneBoard(b) {
  return b.map(row => [...row]);
}

/** Get valid (non-full) columns, centre-ordered for better pruning */
function getValidCols(b) {
  const order = [3, 2, 4, 1, 5, 0, 6]; // centre-first ordering
  return order.filter(c => getAvailableRow(b, c) !== -1);
}

function isDraw(b) {
  return getValidCols(b).length === 0;
}

/** Get DOM cell element */
function getCellEl(row, col) {
  return boardEl.querySelector(`[data-row="${row}"][data-col="${col}"]`);
}

/* ══════════════════════════════════════════
   WIN DETECTION
══════════════════════════════════════════ */

/**
 * Check if placing at (row, col) caused a win for `player`.
 * Returns the 4 winning cell coordinates, or null.
 */
function checkWin(b, row, col, player) {
  const dirs = [
    [[0,1],[0,-1]],   // horizontal
    [[1,0],[-1,0]],   // vertical
    [[1,1],[-1,-1]],  // diagonal ↘
    [[1,-1],[-1,1]],  // diagonal ↙
  ];

  for (const [d1, d2] of dirs) {
    const cells = [[row, col]];

    for (const [dr, dc] of [d1, d2]) {
      let r = row + dr, c = col + dc;
      while (r >= 0 && r < ROWS && c >= 0 && c < COLS && b[r][c] === player) {
        cells.push([r, c]);
        r += dr; c += dc;
      }
    }

    if (cells.length >= 4) return cells.slice(0, 4);
  }
  return null;
}

/** Quick win check without storing cells (used in evaluation) */
function isWinningMove(b, col, player) {
  const row = getAvailableRow(b, col);
  if (row === -1) return false;
  b[row][col] = player;
  const win = checkWin(b, row, col, player) !== null;
  b[row][col] = EMPTY;
  return win;
}

/** Check if current board is terminal (any win or draw) */
function isTerminal(b) {
  // Check if last played move caused a win – requires scanning all
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (b[r][c] !== EMPTY) {
        if (checkWin(b, r, c, b[r][c])) return true;
      }
    }
  }
  return isDraw(b);
}

/* ══════════════════════════════════════════
   ╔════════════════════════════════════╗
   ║    MINIMAX WITH ALPHA-BETA PRUNING  ║
   ╚════════════════════════════════════╝

   GAME TREE STRUCTURE:
   ─────────────────────
   Each recursive call represents a NODE in the game tree:
     • node.board  = board configuration (state)
     • node.depth  = how many moves ahead we're looking
     • node.alpha  = best score the MAXIMIZER can guarantee
     • node.beta   = best score the MINIMIZER can guarantee

   BACKTRACKING (key mechanism):
   ──────────────────────────────
   After recursing into a child node, we UNDO the move (restore
   the board) so the same board array is reused — this is the
   "backtrack" step that gives the tree traversal its efficiency.

   ALPHA-BETA PRUNING:
   ────────────────────
   If the minimizer finds a score ≤ alpha, the maximizer already
   has a better path elsewhere — prune this branch (beta cutoff).
   If the maximizer finds a score ≥ beta, the minimizer already
   has a better path elsewhere — prune this branch (alpha cutoff).
   This reduces O(b^d) to O(b^(d/2)) in the best case.
══════════════════════════════════════════ */

let nodesEvaluated = 0; // diagnostic counter

/**
 * Minimax algorithm with Alpha-Beta Pruning.
 *
 * @param {number[][]} b          - current board state (node)
 * @param {number}     depth      - remaining depth to explore
 * @param {number}     alpha      - best score maximizer can guarantee
 * @param {number}     beta       - best score minimizer can guarantee
 * @param {boolean}    maximizing - true = AI's turn, false = human's turn
 * @param {Array}      sample     - optional array to capture tree snapshot
 * @returns {{ score: number, col: number }}
 */
function minimax(b, depth, alpha, beta, maximizing, sample = null) {
  nodesEvaluated++;  // count each node in the game tree

  const validCols = getValidCols(b);

  /* ── LEAF NODE: Terminal or depth limit ── */
  if (depth === 0 || validCols.length === 0) {
    // Check for terminal wins
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        if (b[r][c] === P2 && checkWin(b, r, c, P2)) return { score:  SCORE_WIN + depth, col: -1 };
        if (b[r][c] === P1 && checkWin(b, r, c, P1)) return { score: -SCORE_WIN - depth, col: -1 };
      }
    }
    // Depth limit reached → heuristic evaluation
    return { score: evaluateBoard(b), col: -1 };
  }

  let bestCol   = validCols[0];
  let bestScore = maximizing ? -Infinity : +Infinity;

  /* ── TREE EXPANSION: iterate over all child nodes ── */
  for (const col of validCols) {
    const row = getAvailableRow(b, col);

    /* EXPAND: place piece (create child node) */
    b[row][col] = maximizing ? P2 : P1;

    /* ── Immediate win check — no need to recurse ── */
    const immediateWin = checkWin(b, row, col, b[row][col]);
    let score;

    if (immediateWin) {
      score = maximizing ? SCORE_WIN + depth : -SCORE_WIN - depth;
    } else {
      /* RECURSE: explore this child's subtree */
      score = minimax(b, depth - 1, alpha, beta, !maximizing).score;
    }

    /* BACKTRACK: undo the move (restore parent state) */
    b[row][col] = EMPTY;

    /* ── SCORE PROPAGATION: update best choice ── */
    if (maximizing) {
      if (score > bestScore) { bestScore = score; bestCol = col; }
      alpha = Math.max(alpha, bestScore);
    } else {
      if (score < bestScore) { bestScore = score; bestCol = col; }
      beta = Math.min(beta, bestScore);
    }

    /* Capture top-level branch data for the tree visualizer */
    if (sample !== null) {
      sample.push({ col, score });
    }

    /* ── ALPHA-BETA PRUNING: cut off branches ── */
    if (beta <= alpha) break; // Prune! No need to explore further siblings
  }

  return { score: bestScore, col: bestCol };
}

/* ══════════════════════════════════════════
   EVALUATION FUNCTION
   Scores board heuristically from AI's perspective.
   Positive = good for AI (P2), Negative = good for Human (P1).
══════════════════════════════════════════ */

/**
 * Score a window of 4 cells.
 * @param {number[]} window - array of 4 cell values
 * @param {number}   piece  - the player being evaluated
 */
function scoreWindow(window, piece) {
  const opp = piece === P2 ? P1 : P2;
  const count     = window.filter(v => v === piece).length;
  const emptyCount = window.filter(v => v === EMPTY).length;
  const oppCount  = window.filter(v => v === opp).length;

  if (count === 4)                          return  SCORE_WIN;
  if (count === 3 && emptyCount === 1)      return  SCORE_THREE;
  if (count === 2 && emptyCount === 2)      return  SCORE_TWO;
  if (oppCount === 3 && emptyCount === 1)   return -SCORE_THREE * 2; // block priority
  if (oppCount === 2 && emptyCount === 2)   return -SCORE_TWO;

  return 0;
}

/**
 * Full board heuristic evaluation.
 * Scans all horizontal, vertical, diagonal windows of size 4.
 */
function evaluateBoard(b) {
  let score = 0;

  /* ── Center column bonus (centre control is strategically strong) ── */
  for (let r = 0; r < ROWS; r++) {
    if (b[r][3] === P2) score += SCORE_CENTER;
    if (b[r][3] === P1) score -= SCORE_CENTER;
  }

  /* ── Horizontal windows ── */
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const win = [b[r][c], b[r][c+1], b[r][c+2], b[r][c+3]];
      score += scoreWindow(win, P2);
    }
  }

  /* ── Vertical windows ── */
  for (let c = 0; c < COLS; c++) {
    for (let r = 0; r <= ROWS - 4; r++) {
      const win = [b[r][c], b[r+1][c], b[r+2][c], b[r+3][c]];
      score += scoreWindow(win, P2);
    }
  }

  /* ── Diagonal (↘) windows ── */
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 0; c <= COLS - 4; c++) {
      const win = [b[r][c], b[r+1][c+1], b[r+2][c+2], b[r+3][c+3]];
      score += scoreWindow(win, P2);
    }
  }

  /* ── Diagonal (↙) windows ── */
  for (let r = 0; r <= ROWS - 4; r++) {
    for (let c = 3; c < COLS; c++) {
      const win = [b[r][c], b[r+1][c-1], b[r+2][c-2], b[r+3][c-3]];
      score += scoreWindow(win, P2);
    }
  }

  return score;
}

/* ══════════════════════════════════════════
   AI CONTROLLER
══════════════════════════════════════════ */

function scheduleAI() {
  aiThinking = true;
  updateTurnIndicator(true); // show "thinking" state

  // Small delay so DOM updates before heavy computation
  setTimeout(() => {
    executeAIMove();
  }, 120);
}

function executeAIMove() {
  if (!gameActive) return;

  const t0 = performance.now();
  nodesEvaluated = 0;
  treeSample = [];
  let col;

  if (difficulty === "easy") {
    /* EASY: random valid move */
    const valid = getValidCols(board);
    col = valid[Math.floor(Math.random() * valid.length)];
    treeSample = valid.map(c => ({ col: c, score: Math.floor(Math.random() * 200 - 100) }));

  } else {
    /* MEDIUM / HARD: full minimax with alpha-beta pruning */
    const depth = DEPTH_MAP[difficulty];

    // Pass treeSample array to capture top-level branch data
    const result = minimax(
      cloneBoard(board),
      depth,
      -Infinity,
      +Infinity,
      true,         // maximizing = AI's turn
      treeSample    // capture branch scores for visualizer
    );
    col = result.col;
  }

  const elapsed = (performance.now() - t0).toFixed(1);

  /* Update AI stats panel */
  aiNodesEl.textContent = nodesEvaluated.toLocaleString();
  aiTimeEl.textContent  = elapsed;

  /* Render minimax tree visualization */
  renderTreeViz(treeSample, col);

  aiThinking = false;
  updateTurnIndicator();

  /* Actually drop the disc */
  if (col !== null && col !== undefined && gameActive) {
    dropDisc(col);
  }
}

/* ══════════════════════════════════════════
   TREE VISUALIZER
══════════════════════════════════════════ */

/**
 * Render a simplified snapshot of the AI's top-level decision branches.
 * Sorted by score descending; best choice is highlighted.
 */
function renderTreeViz(sample, bestCol) {
  treeVizEl.innerHTML = "";
  if (!sample || sample.length === 0) return;

  // Sort descending by score
  const sorted = [...sample].sort((a, b) => b.score - a.score).slice(0, 7);

  sorted.forEach(({ col, score }) => {
    const node = document.createElement("div");
    const isBest = col === bestCol;
    node.className = `tree-node${isBest ? " best" : ""}`;

    const scoreLabel = score >= SCORE_WIN / 2
      ? "WIN"
      : score <= -SCORE_WIN / 2
        ? "LOSE"
        : score.toLocaleString();

    node.innerHTML = `
      <span class="tree-node-col">Col ${col + 1}</span>
      <span class="tree-node-score">Score: ${scoreLabel}</span>
      ${isBest ? '<span class="tree-node-badge">CHOSEN</span>' : ""}
    `;
    treeVizEl.appendChild(node);
  });
}

/* ══════════════════════════════════════════
   UI HELPERS
══════════════════════════════════════════ */

function updateTurnIndicator(thinking = false) {
  if (!gameActive) {
    turnText.textContent = "Press Start to Play";
    turnDisc.className = "turn-disc";
    boardEl.classList.remove("p1-turn", "p2-turn");
    return;
  }

  if (thinking) {
    const dots = `<span class="thinking-indicator">
      <span class="thinking-dot"></span>
      <span class="thinking-dot"></span>
      <span class="thinking-dot"></span>
    </span>`;
    const name = currentPlayer === P1 ? p1Name : p2Name;
    turnText.innerHTML = `${name} ${dots}`;
  } else {
    const name = currentPlayer === P1 ? p1Name : p2Name;
    turnText.textContent = `${name}'s Turn`;
  }

  turnDisc.className = "turn-disc " + (currentPlayer === P1 ? "red" : "yellow");
  boardEl.classList.toggle("p1-turn", currentPlayer === P1);
  boardEl.classList.toggle("p2-turn", currentPlayer === P2);
}

function logMove(num, col, player) {
  const placeholder = moveLogEl.querySelector(".log-placeholder");
  if (placeholder) placeholder.remove();

  const name  = player === P1 ? p1Name : p2Name;
  const color = player === P1 ? "red" : "yellow";

  const entry = document.createElement("div");
  entry.className = `log-entry p${player}`;
  entry.innerHTML = `
    <span class="log-move-num">#${num}</span>
    <div class="log-disc ${color}"></div>
    <span class="log-text">${name} → Col ${col + 1}</span>
  `;
  moveLogEl.appendChild(entry);
  moveLogEl.scrollTop = moveLogEl.scrollHeight;
}

function clearMoveLog() {
  moveLogEl.innerHTML = '<div class="log-placeholder">Game moves appear here…</div>';
}

/* ══════════════════════════════════════════
   UNDO
══════════════════════════════════════════ */

function undoMove() {
  if (!gameActive || moveHistory.length === 0 || aiThinking) return;

  // In PvA mode, undo both AI and human moves
  const undoCount = mode === "pva" && moveHistory.length >= 2 ? 2 : 1;

  for (let i = 0; i < undoCount; i++) {
    const last = moveHistory.pop();
    if (!last) break;
    board[last.row][last.col] = EMPTY;

    const cell = getCellEl(last.row, last.col);
    const fill = cell.querySelector(".disc-fill");
    fill.className = "disc-fill";
    fill.style.transform = "translateY(-120%)";
    cell.classList.remove("win-cell", "red-win", "yellow-win");
  }

  // Switch back
  const lastMove = moveHistory[moveHistory.length - 1];
  currentPlayer = lastMove ? (lastMove.player === P1 ? P2 : P1) : P1;
  updateTurnIndicator();

  // Trim log
  const entries = moveLogEl.querySelectorAll(".log-entry");
  for (let i = 0; i < undoCount; i++) {
    if (entries[entries.length - 1 - i]) entries[entries.length - 1 - i].remove();
  }
}

/* ══════════════════════════════════════════
   SOUND TOGGLE
══════════════════════════════════════════ */

function toggleSound() {
  soundOn = !soundOn;
  const icon = document.getElementById("soundIcon");
  if (soundOn) {
    icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <path d="M19.07 4.93a10 10 0 010 14.14M15.54 8.46a5 5 0 010 7.07"/>`;
  } else {
    icon.innerHTML = `<polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/>
      <line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/>`;
  }
}

/* ══════════════════════════════════════════
   THEME TOGGLE
══════════════════════════════════════════ */

function toggleTheme() {
  const html = document.documentElement;
  const isDark = html.dataset.theme === "dark";
  html.dataset.theme = isDark ? "light" : "dark";

  const icon = document.getElementById("themeIcon");
  if (isDark) {
    // Show moon (light mode active)
    icon.innerHTML = `<path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z"/>`;
  } else {
    // Show sun (dark mode active)
    icon.innerHTML = `<circle cx="12" cy="12" r="5"/>
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"/>`;
  }
}

/* ══════════════════════════════════════════
   MODE & DIFFICULTY SELECTION
══════════════════════════════════════════ */

document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    mode = btn.dataset.mode;

    const isPvA = mode === "pva";
    difficultyGroup.style.display = isPvA ? "" : "none";
    p2NameGroup.style.display     = isPvA ? "none" : "";
    aiInfoCard.style.display      = isPvA ? "" : "none";
    treeCard.style.display        = isPvA ? "" : "none";

    if (isPvA) {
      p2NameInput.value = "AI";
    } else {
      p2NameInput.value = "Player 2";
    }
  });
});

document.querySelectorAll(".diff-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".diff-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    difficulty = btn.dataset.diff;
    if (DEPTH_MAP[difficulty] !== undefined) {
      aiDepthEl.textContent = difficulty === "easy" ? "Random" : DEPTH_MAP[difficulty];
    }
  });
});

/* ══════════════════════════════════════════
   EVENT LISTENERS
══════════════════════════════════════════ */

startBtn.addEventListener("click", startGame);

resetBtn.addEventListener("click", () => {
  if (!gameActive && moveHistory.length === 0) return;
  startGame();
});

undoBtn.addEventListener("click", undoMove);
soundBtn.addEventListener("click", toggleSound);
themeToggle.addEventListener("click", toggleTheme);

overlayRestart.addEventListener("click", () => {
  overlay.hidden = true;
  startGame();
});

overlayMenu.addEventListener("click", () => {
  overlay.hidden = true;
  gameActive = false;
  boardEl.classList.remove("active");
  updateTurnIndicator();
});

/* Column arrows click */
columnArrows.querySelectorAll(".col-arrow").forEach(arrow => {
  arrow.addEventListener("click", () => handleCellClick(+arrow.dataset.col));
});

/* ══════════════════════════════════════════
   INIT
══════════════════════════════════════════ */

(function init() {
  buildBoardDOM();
  updateTurnIndicator();

  // Pre-configure UI state
  difficultyGroup.style.display = "none";
  aiInfoCard.style.display      = "none";
  treeCard.style.display        = "none";
})();

/**
 * ════════════════════════════════════════════════════════════
 * HOW MINIMAX WORKS IN THIS PROJECT (Summary)
 * ════════════════════════════════════════════════════════════
 *
 * 1. TREE CONSTRUCTION (implicit via recursion):
 *    When the AI needs to move, minimax() is called on the
 *    current board. Each recursive call is a NODE representing
 *    one possible future board state. The tree has branching
 *    factor ≈ 7 (one per column) and depth 4–6.
 *
 * 2. EXPANSION:
 *    For each valid column, we simulate placing the piece
 *    (b[row][col] = piece), then recurse into the resulting
 *    child node.
 *
 * 3. BACKTRACKING:
 *    After recursing, we UNDO the move (b[row][col] = EMPTY).
 *    This lets a single board array represent the entire
 *    exploration without allocating copies at every node.
 *
 * 4. SCORE PROPAGATION:
 *    At leaf nodes, evaluateBoard() returns a heuristic score.
 *    Maximizing nodes propagate the MAXIMUM child score upward.
 *    Minimizing nodes propagate the MINIMUM child score upward.
 *
 * 5. ALPHA-BETA PRUNING:
 *    Alpha (maximizer floor) and Beta (minimizer ceiling) are
 *    passed down the tree. When beta ≤ alpha, the current branch
 *    is pruned — the other player has a better alternative
 *    elsewhere, so we never need to finish exploring here.
 *    This typically cuts 60–80% of nodes from evaluation.
 *
 * 6. EVALUATION HEURISTICS:
 *    - Windows of 4 scanned in all directions
 *    - 4-in-a-row → ±100,000 (certain win/loss)
 *    - 3-in-a-row + 1 empty → ±5,000 (strong threat)
 *    - 2-in-a-row + 2 empty → ±200  (mild threat)
 *    - Blocking opponent's 3-in-a-row given 2× negative weight
 *    - Center column pieces get +3 bonus (strategic position)
 * ════════════════════════════════════════════════════════════
 */
