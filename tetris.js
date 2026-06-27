/* ============================================================
   TETRIS — tetris.js
   Full implementation: pieces, rotation, wall-kicks, ghost,
   hold, next-preview, scoring, levels, line-clear animation,
   combo system, high score, pause, game-over.
   ============================================================ */

'use strict';

// ── Constants ────────────────────────────────────────────────
const COLS      = 10;
const ROWS      = 20;
const CELL      = 30;           // px per cell on main canvas
const PREVIEW_CELL = 24;        // px per cell on preview canvases

// Tetrominoes: each shape is an array of rotations,
// each rotation is an array of [col, row] offsets from pivot.
const TETROMINOES = {
  I: {
    color: '#00f5d4',
    glow:  '#00f5d480',
    rotations: [
      [[0,1],[1,1],[2,1],[3,1]],
      [[2,0],[2,1],[2,2],[2,3]],
      [[0,2],[1,2],[2,2],[3,2]],
      [[1,0],[1,1],[1,2],[1,3]],
    ],
  },
  O: {
    color: '#f9c74f',
    glow:  '#f9c74f80',
    rotations: [
      [[1,0],[2,0],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[2,1]],
    ],
  },
  T: {
    color: '#b5179e',
    glow:  '#b5179e80',
    rotations: [
      [[0,1],[1,1],[2,1],[1,0]],
      [[1,0],[1,1],[1,2],[2,1]],
      [[0,1],[1,1],[2,1],[1,2]],
      [[1,0],[1,1],[1,2],[0,1]],
    ],
  },
  S: {
    color: '#06d6a0',
    glow:  '#06d6a080',
    rotations: [
      [[1,0],[2,0],[0,1],[1,1]],
      [[1,0],[1,1],[2,1],[2,2]],
      [[1,1],[2,1],[0,2],[1,2]],
      [[0,0],[0,1],[1,1],[1,2]],
    ],
  },
  Z: {
    color: '#ef233c',
    glow:  '#ef233c80',
    rotations: [
      [[0,0],[1,0],[1,1],[2,1]],
      [[2,0],[1,1],[2,1],[1,2]],
      [[0,1],[1,1],[1,2],[2,2]],
      [[1,0],[0,1],[1,1],[0,2]],
    ],
  },
  J: {
    color: '#4361ee',
    glow:  '#4361ee80',
    rotations: [
      [[0,0],[0,1],[1,1],[2,1]],
      [[1,0],[2,0],[1,1],[1,2]],
      [[0,1],[1,1],[2,1],[2,2]],
      [[1,0],[1,1],[0,2],[1,2]],
    ],
  },
  L: {
    color: '#fb8500',
    glow:  '#fb850080',
    rotations: [
      [[2,0],[0,1],[1,1],[2,1]],
      [[1,0],[1,1],[1,2],[2,2]],
      [[0,1],[1,1],[2,1],[0,2]],
      [[0,0],[1,0],[1,1],[1,2]],
    ],
  },
};

const PIECE_KEYS = Object.keys(TETROMINOES);

// SRS wall-kick data (J, L, S, T, Z pieces)
// [from_rotation][to_rotation] → array of [dx, dy] offsets to try
const WALL_KICKS = {
  '0>1': [[ 0,0],[-1,0],[-1,-1],[0, 2],[-1, 2]],
  '1>0': [[ 0,0],[ 1,0],[ 1, 1],[0,-2],[ 1,-2]],
  '1>2': [[ 0,0],[ 1,0],[ 1, 1],[0,-2],[ 1,-2]],
  '2>1': [[ 0,0],[-1,0],[-1,-1],[0, 2],[-1, 2]],
  '2>3': [[ 0,0],[ 1,0],[ 1,-1],[0, 2],[ 1, 2]],
  '3>2': [[ 0,0],[-1,0],[-1, 1],[0,-2],[-1,-2]],
  '3>0': [[ 0,0],[-1,0],[-1, 1],[0,-2],[-1,-2]],
  '0>3': [[ 0,0],[ 1,0],[ 1,-1],[0, 2],[ 1, 2]],
};

// SRS wall-kick data for I piece
const WALL_KICKS_I = {
  '0>1': [[ 0,0],[-2,0],[ 1,0],[-2, 1],[ 1,-2]],
  '1>0': [[ 0,0],[ 2,0],[-1,0],[ 2,-1],[-1, 2]],
  '1>2': [[ 0,0],[-1,0],[ 2,0],[-1,-2],[ 2, 1]],
  '2>1': [[ 0,0],[ 1,0],[-2,0],[ 1, 2],[-2,-1]],
  '2>3': [[ 0,0],[ 2,0],[-1,0],[ 2,-1],[-1, 2]],
  '3>2': [[ 0,0],[-2,0],[ 1,0],[-2, 1],[ 1,-2]],
  '3>0': [[ 0,0],[ 1,0],[-2,0],[ 1, 2],[-2,-1]],
  '0>3': [[ 0,0],[-1,0],[ 2,0],[-1,-2],[ 2, 1]],
};

// Scoring table
const SCORE_TABLE = {
  1: 100,
  2: 300,
  3: 500,
  4: 800,
};

// Level speeds (ms per drop)
const LEVEL_SPEEDS = [800, 717, 633, 550, 467, 383, 300, 217, 133, 100, 83];

// ── Utilities ────────────────────────────────────────────────
function randomPiece() {
  const key = PIECE_KEYS[Math.floor(Math.random() * PIECE_KEYS.length)];
  return { key, rotation: 0, x: 3, y: 0 };
}

function getCells(piece) {
  return TETROMINOES[piece.key].rotations[piece.rotation].map(([dc, dr]) => [
    piece.x + dc,
    piece.y + dr,
  ]);
}

function getColor(pieceKey)  { return TETROMINOES[pieceKey].color; }
function getGlow(pieceKey)   { return TETROMINOES[pieceKey].glow; }

// ── Game State ───────────────────────────────────────────────
class TetrisGame {
  constructor() {
    // Canvases
    this.canvas    = document.getElementById('game-canvas');
    this.ghostCvs  = document.getElementById('ghost-canvas');
    this.nextCvs   = document.getElementById('next-canvas');
    this.holdCvs   = document.getElementById('hold-canvas');

    this.ctx       = this.canvas.getContext('2d');
    this.ghostCtx  = this.ghostCvs.getContext('2d');
    this.nextCtx   = this.nextCvs.getContext('2d');
    this.holdCtx   = this.holdCvs.getContext('2d');

    // UI elements
    this.elScore     = document.getElementById('score');
    this.elHighScore = document.getElementById('high-score');
    this.elLevel     = document.getElementById('level');
    this.elLines     = document.getElementById('lines');
    this.elCombo     = document.getElementById('combo-count');
    this.elComboBlk  = document.getElementById('combo-block');

    this.overlayStart    = document.getElementById('overlay-start');
    this.overlayPause    = document.getElementById('overlay-pause');
    this.overlayGameOver = document.getElementById('overlay-gameover');
    this.elFinalScore    = document.getElementById('final-score-text');

    // Buttons
    document.getElementById('btn-start').addEventListener('click',        () => this.startGame());
    document.getElementById('btn-resume').addEventListener('click',       () => this.togglePause());
    document.getElementById('btn-restart-pause').addEventListener('click',() => this.restartGame());
    document.getElementById('btn-restart').addEventListener('click',      () => this.restartGame());
    document.getElementById('btn-pause-side').addEventListener('click',   () => this.togglePause());
    document.getElementById('btn-new-game').addEventListener('click',     () => this.restartGame());

    // Keyboard
    document.addEventListener('keydown', (e) => this.handleKey(e));

    this.highScore   = parseInt(localStorage.getItem('tetrisHighScore') || '0', 10);
    this.elHighScore.textContent = this.highScore;

    this._rafId      = null;
    this._lastTime   = 0;
    this._dropTimer  = 0;
    this._lockTimer  = 0;
    this._lockDelay  = 500;   // ms before piece locks after touching floor
    this._lockMoves  = 0;     // reset count for infinite spin prevention
    this._maxLockMoves = 15;
    this._lineClearAnim = null;

    this.state = 'idle'; // idle | playing | paused | gameover
  }

  // ── Board ────────────────────────────────────────────────
  newBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  }

  // ── Start / Restart ──────────────────────────────────────
  startGame() {
    this.overlayStart.classList.add('hidden');
    this._initGame();
  }

  restartGame() {
    this.overlayPause.classList.add('hidden');
    this.overlayGameOver.classList.add('hidden');
    this._initGame();
  }

  _initGame() {
    cancelAnimationFrame(this._rafId);

    this.board       = this.newBoard();
    this.score       = 0;
    this.level       = 1;
    this.lines       = 0;
    this.combo       = -1;
    this.holdPiece   = null;
    this.holdUsed    = false;
    this.bag         = [];

    this.nextPiece   = this._drawFromBag();
    this.activePiece = this._spawnPiece();

    this._updateUI();
    this._dropTimer  = 0;
    this._lockTimer  = 0;
    this._lockMoves  = 0;
    this._lastTime   = 0;
    this.state       = 'playing';
    this._rafId      = requestAnimationFrame((t) => this._loop(t));
  }

  // ── 7-bag randomiser ────────────────────────────────────
  _drawFromBag() {
    if (this.bag.length === 0) {
      this.bag = [...PIECE_KEYS].sort(() => Math.random() - 0.5);
    }
    const key = this.bag.pop();
    return { key, rotation: 0, x: 3, y: 0 };
  }

  _spawnPiece() {
    const piece = this.nextPiece;
    this.nextPiece = this._drawFromBag();
    this._drawPreview(this.nextCtx, this.nextCvs, this.nextPiece);
    return piece;
  }

  // ── Collision ───────────────────────────────────────────
  _isValid(piece, dx = 0, dy = 0, rot = piece.rotation) {
    const cells = TETROMINOES[piece.key].rotations[rot].map(([dc, dr]) => [
      piece.x + dc + dx,
      piece.y + dr + dy,
    ]);
    return cells.every(([c, r]) =>
      c >= 0 && c < COLS && r >= 0 && r < ROWS &&
      (r < 0 || this.board[r][c] === null)
    );
  }

  // ── Rotation with SRS wall kicks ───────────────────────
  _rotate(dir) {
    const piece = this.activePiece;
    const newRot = (piece.rotation + (dir === 'cw' ? 1 : 3)) % 4;
    const kickTable = piece.key === 'I' ? WALL_KICKS_I : WALL_KICKS;
    const key = `${piece.rotation}>${newRot}`;
    const kicks = kickTable[key] || [[0,0]];

    for (const [dx, dy] of kicks) {
      if (this._isValid(piece, dx, dy, newRot)) {
        piece.x       += dx;
        piece.y       += dy;
        piece.rotation = newRot;
        this._onPieceAction();
        return true;
      }
    }
    return false;
  }

  // ── Movement ────────────────────────────────────────────
  _moveLeft()  { if (this._isValid(this.activePiece, -1, 0)) { this.activePiece.x--; this._onPieceAction(); } }
  _moveRight() { if (this._isValid(this.activePiece,  1, 0)) { this.activePiece.x++; this._onPieceAction(); } }

  _softDrop() {
    if (this._isValid(this.activePiece, 0, 1)) {
      this.activePiece.y++;
      this._dropTimer = 0;
      this.score++;
      this._updateUI();
    }
  }

  _hardDrop() {
    let dropped = 0;
    while (this._isValid(this.activePiece, 0, 1)) {
      this.activePiece.y++;
      dropped++;
    }
    this.score += dropped * 2;
    this._lockPiece();
  }

  // Lock-timer reset on movement (with move limit to prevent infinite spin)
  _onPieceAction() {
    if (this._lockTimer > 0 && this._lockMoves < this._maxLockMoves) {
      this._lockTimer = 0;
      this._lockMoves++;
    }
  }

  // ── Hold ────────────────────────────────────────────────
  _holdPiece() {
    if (this.holdUsed) return;
    const current = this.activePiece;
    current.rotation = 0;
    current.x = 3;
    current.y = 0;

    if (this.holdPiece) {
      this.activePiece = { ...this.holdPiece, rotation: 0, x: 3, y: 0 };
      this.holdPiece   = { key: current.key, rotation: 0, x: 3, y: 0 };
    } else {
      this.holdPiece   = { key: current.key, rotation: 0, x: 3, y: 0 };
      this.activePiece = this._spawnPiece();
    }

    this.holdUsed    = true;
    this._lockTimer  = 0;
    this._lockMoves  = 0;
    this._drawPreview(this.holdCtx, this.holdCvs, this.holdPiece);
  }

  // ── Ghost piece ─────────────────────────────────────────
  _getGhostY() {
    let dy = 0;
    while (this._isValid(this.activePiece, 0, dy + 1)) dy++;
    return dy;
  }

  // ── Lock piece ──────────────────────────────────────────
  _lockPiece() {
    const cells = getCells(this.activePiece);

    // Check top-out (game over)
    if (cells.some(([, r]) => r < 0)) {
      this._gameOver();
      return;
    }

    // Write to board
    for (const [c, r] of cells) {
      if (r >= 0) this.board[r][c] = this.activePiece.key;
    }

    // Clear lines
    this._clearLines();

    // Spawn next
    this.activePiece = this._spawnPiece();
    this.holdUsed    = false;
    this._lockTimer  = 0;
    this._lockMoves  = 0;
    this._dropTimer  = 0;

    // Check instant game over (new piece invalid)
    if (!this._isValid(this.activePiece)) {
      this._gameOver();
    }
  }

  // ── Line clearing ───────────────────────────────────────
  _clearLines() {
    const full = [];
    for (let r = 0; r < ROWS; r++) {
      if (this.board[r].every(cell => cell !== null)) full.push(r);
    }

    if (full.length === 0) {
      this.combo = -1;
      this.elComboBlk.classList.add('hidden');
      return;
    }

    this.combo++;
    this.lines += full.length;
    const baseScore = (SCORE_TABLE[full.length] || 0) * this.level;
    const comboBonus = this.combo > 0 ? 50 * this.combo * this.level : 0;
    this.score += baseScore + comboBonus;

    // Level up every 10 lines
    this.level = Math.min(10, Math.floor(this.lines / 10) + 1);

    // Remove full rows
    for (const r of full) {
      this.board.splice(r, 1);
      this.board.unshift(Array(COLS).fill(null));
    }

    if (this.combo > 0) {
      this.elComboBlk.classList.remove('hidden');
      this.elCombo.textContent = `x${this.combo}`;
    }

    this._updateUI();
  }

  // ── Scoring UI ──────────────────────────────────────────
  _updateUI() {
    this.elScore.textContent = this.score;
    this.elLevel.textContent = this.level;
    this.elLines.textContent = this.lines;

    if (this.score > this.highScore) {
      this.highScore = this.score;
      localStorage.setItem('tetrisHighScore', this.highScore);
      this.elHighScore.textContent = this.highScore;
    }
  }

  // ── Game over ───────────────────────────────────────────
  _gameOver() {
    this.state = 'gameover';
    cancelAnimationFrame(this._rafId);
    this.elFinalScore.textContent = `Score: ${this.score}`;
    this.overlayGameOver.classList.remove('hidden');
    this._render(); // final frame
  }

  // ── Pause ───────────────────────────────────────────────
  togglePause() {
    if (this.state === 'gameover' || this.state === 'idle') return;

    if (this.state === 'playing') {
      this.state = 'paused';
      cancelAnimationFrame(this._rafId);
      this.overlayPause.classList.remove('hidden');
    } else if (this.state === 'paused') {
      this.state = 'playing';
      this.overlayPause.classList.add('hidden');
      this._lastTime = 0;
      this._rafId = requestAnimationFrame((t) => this._loop(t));
    }
  }

  // ── Game loop ───────────────────────────────────────────
  _loop(timestamp) {
    if (this.state !== 'playing') return;

    const delta = this._lastTime ? timestamp - this._lastTime : 0;
    this._lastTime = timestamp;

    // Auto-drop
    this._dropTimer += delta;
    const speed = LEVEL_SPEEDS[Math.min(this.level - 1, LEVEL_SPEEDS.length - 1)];

    if (this._dropTimer >= speed) {
      this._dropTimer = 0;
      if (this._isValid(this.activePiece, 0, 1)) {
        this.activePiece.y++;
        this._lockTimer = 0;
      } else {
        this._lockTimer += speed; // count a full drop interval
      }
    }

    // Lock delay
    if (!this._isValid(this.activePiece, 0, 1)) {
      this._lockTimer += delta;
      if (this._lockTimer >= this._lockDelay) {
        this._lockPiece();
      }
    } else {
      this._lockTimer = 0;
    }

    this._render();
    this._rafId = requestAnimationFrame((t) => this._loop(t));
  }

  // ── Rendering ───────────────────────────────────────────
  _render() {
    const ctx = this.ctx;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Draw grid lines
    ctx.strokeStyle = '#131726';
    ctx.lineWidth = 0.5;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * CELL, 0);
      ctx.lineTo(c * CELL, ROWS * CELL);
      ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * CELL);
      ctx.lineTo(COLS * CELL, r * CELL);
      ctx.stroke();
    }

    // Draw board
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const key = this.board[r][c];
        if (key) this._drawCell(ctx, c, r, key, CELL);
      }
    }

    // Draw ghost piece
    if (this.state === 'playing') {
      this.ghostCtx.clearRect(0, 0, this.ghostCvs.width, this.ghostCvs.height);
      const ghostDY = this._getGhostY();
      if (ghostDY > 0) {
        const cells = getCells(this.activePiece);
        for (const [c, r] of cells) {
          this._drawGhostCell(this.ghostCtx, c, r + ghostDY, this.activePiece.key, CELL);
        }
      }

      // Draw active piece
      for (const [c, r] of getCells(this.activePiece)) {
        if (r >= 0) this._drawCell(ctx, c, r, this.activePiece.key, CELL);
      }
    }
  }

  _drawCell(ctx, col, row, key, size) {
    const x = col * size;
    const y = row * size;
    const color = getColor(key);
    const glow  = getGlow(key);
    const pad   = 1;

    // Shadow / glow
    ctx.shadowColor  = glow;
    ctx.shadowBlur   = 10;

    // Main fill
    ctx.fillStyle = color;
    ctx.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);

    // Highlight (top-left shine)
    const grad = ctx.createLinearGradient(x, y, x + size, y + size);
    grad.addColorStop(0, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = grad;
    ctx.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);

    // Border
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth   = 0.5;
    ctx.strokeRect(x + pad, y + pad, size - pad * 2, size - pad * 2);
  }

  _drawGhostCell(ctx, col, row, key, size) {
    if (row < 0) return;
    const x = col * size;
    const y = row * size;
    const color = getColor(key);
    const pad   = 1;

    ctx.save();
    ctx.globalAlpha = 0.18;
    ctx.fillStyle   = color;
    ctx.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);
    ctx.globalAlpha = 0.35;
    ctx.strokeStyle = color;
    ctx.lineWidth   = 1;
    ctx.strokeRect(x + pad, y + pad, size - pad * 2, size - pad * 2);
    ctx.restore();
  }

  _drawPreview(ctx, cvs, piece) {
    if (!piece) return;
    const size = PREVIEW_CELL;
    ctx.clearRect(0, 0, cvs.width, cvs.height);
    if (!piece) return;

    const cells = TETROMINOES[piece.key].rotations[0];
    // Centre the shape in the canvas
    const minC  = Math.min(...cells.map(([c]) => c));
    const maxC  = Math.max(...cells.map(([c]) => c));
    const minR  = Math.min(...cells.map(([, r]) => r));
    const maxR  = Math.max(...cells.map(([, r]) => r));
    const wCells = maxC - minC + 1;
    const hCells = maxR - minR + 1;
    const offX  = Math.floor((cvs.width  - wCells * size) / 2) - minC * size;
    const offY  = Math.floor((cvs.height - hCells * size) / 2) - minR * size;

    for (const [dc, dr] of cells) {
      this._drawCellAt(ctx, offX + dc * size, offY + dr * size, piece.key, size);
    }
  }

  _drawCellAt(ctx, x, y, key, size) {
    const color = getColor(key);
    const glow  = getGlow(key);
    const pad   = 1;

    ctx.shadowColor = glow;
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = color;
    ctx.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);

    const grad = ctx.createLinearGradient(x, y, x + size, y + size);
    grad.addColorStop(0, 'rgba(255,255,255,0.25)');
    grad.addColorStop(1, 'rgba(0,0,0,0.2)');
    ctx.fillStyle = grad;
    ctx.fillRect(x + pad, y + pad, size - pad * 2, size - pad * 2);

    ctx.shadowBlur  = 0;
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth   = 0.5;
    ctx.strokeRect(x + pad, y + pad, size - pad * 2, size - pad * 2);
  }

  // ── Keyboard handling ───────────────────────────────────
  handleKey(e) {
    if (this.state === 'idle') return;

    // Allow P to toggle pause at any time
    if (e.code === 'KeyP') {
      e.preventDefault();
      this.togglePause();
      return;
    }

    if (this.state !== 'playing') return;

    switch (e.code) {
      case 'ArrowLeft':
        e.preventDefault();
        this._moveLeft();
        break;
      case 'ArrowRight':
        e.preventDefault();
        this._moveRight();
        break;
      case 'ArrowDown':
        e.preventDefault();
        this._softDrop();
        break;
      case 'ArrowUp':
        e.preventDefault();
        this._rotate('cw');
        break;
      case 'KeyZ':
        e.preventDefault();
        this._rotate('ccw');
        break;
      case 'KeyX':
        e.preventDefault();
        this._rotate('cw');
        break;
      case 'Space':
        e.preventDefault();
        this._hardDrop();
        break;
      case 'KeyC':
      case 'ShiftLeft':
      case 'ShiftRight':
        e.preventDefault();
        this._holdPiece();
        break;
    }
  }
}

// ── DAS (Delayed Auto Shift) ─────────────────────────────────
// Handles held-key repeating for left/right movement
(function attachDAS(GameClass) {
  const DAS_DELAY  = 170; // ms before repeat starts
  const DAS_REPEAT =  50; // ms between repeats

  let game;
  let dasKey    = null;
  let dasTimer  = null;
  let dasRepeat = null;

  function clearDAS() {
    clearTimeout(dasTimer);
    clearInterval(dasRepeat);
    dasKey = null;
  }

  document.addEventListener('keydown', (e) => {
    if (!game || game.state !== 'playing') return;
    if (e.repeat) return; // handled by our own timer

    if (e.code === 'ArrowLeft' || e.code === 'ArrowRight') {
      clearDAS();
      dasKey = e.code;
      dasTimer = setTimeout(() => {
        dasRepeat = setInterval(() => {
          if (dasKey === 'ArrowLeft')  game._moveLeft();
          if (dasKey === 'ArrowRight') game._moveRight();
        }, DAS_REPEAT);
      }, DAS_DELAY);
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.code === dasKey) clearDAS();
  });

  // Hook into game creation
  const _orig = GameClass.prototype._initGame;
  GameClass.prototype._initGame = function () {
    game = this;
    clearDAS();
    _orig.call(this);
  };
})(TetrisGame);

// ── Boot ─────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  new TetrisGame();
});
