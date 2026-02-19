// ============================================================
// game.js — DAMAS ONLINE THE CRIS IF (VERSION FINAL)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getDatabase, ref, set, get, onValue, update }
  from "https://www.gstatic.com/firebasejs/10.12.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyACr8sCnegUV0aqO6Ubrol7KMoq1wcJ_Pg",
  authDomain: "ludo-thecrisif.firebaseapp.com",
  databaseURL: "https://ludo-thecrisif-default-rtdb.firebaseio.com",
  projectId: "ludo-thecrisif",
  storageBucket: "ludo-thecrisif.firebasestorage.app",
  messagingSenderId: "643959425506",
  appId: "1:643959425506:web:c0515d6e4d007ce611d1bb"
};

const app = initializeApp(firebaseConfig);
const db  = getDatabase(app);

// ============================================================
// VARIABLES GLOBALES
// ============================================================
const ROWS = 8, COLS = 8;
const canvas = document.getElementById("board");
const ctx    = canvas.getContext("2d");

let myColor   = "white";
let myName    = "Jugador";
let myRole    = null;
let roomId    = null;
let gameState = null;
let selected  = null;
let myTurn    = false;

// ============================================================
// LOBBY
// ============================================================
window.selectPiece = function(el) {
  document.querySelectorAll(".piece-opt").forEach(b => b.classList.remove("selected"));
  el.classList.add("selected");
  myColor = el.dataset.color;
};

window.createRoom = async function() {
  myName = document.getElementById("player-name").value.trim() || "Cris";
  roomId = Math.floor(1000 + Math.random() * 9000).toString();
  myRole = "host";
  myColor = document.querySelector(".piece-opt.selected").dataset.color;

  const board = buildBoard();
  await set(ref(db, `damas/${roomId}`), {
    board,
    turn:   "white",
    status: "waiting",
    host:   { name: myName, color: myColor }
  });

  document.getElementById("room-code-text").textContent = roomId;
  document.getElementById("room-display").style.display = "block";
  listenRoom();
};

window.joinRoom = async function() {
  myName = document.getElementById("player-name").value.trim() || "Amigo";
  roomId = document.getElementById("room-input").value.trim();
  if(roomId.length !== 4) { showToast("❌ Código inválido"); return; }

  const snap = await get(ref(db, `damas/${roomId}`));
  if(!snap.exists()) { showToast("❌ Sala no encontrada"); return; }

  const data = snap.val();
  if(data.status === "playing") { showToast("❌ Sala llena"); return; }

  // Guest toma el color contrario al host
  myColor = data.host.color === "white" ? "black" : "white";
  myRole  = "guest";

  await update(ref(db, `damas/${roomId}`), {
    guest:  { name: myName, color: myColor },
    status: "playing"
  });

  listenRoom();
};

// ============================================================
// CONSTRUIR TABLERO INICIAL
// ============================================================
function buildBoard() {
  // Guardamos como array plano de 64 para evitar problemas con Firebase
  // Índice = r*8 + c
  const board = new Array(64).fill(null);
  for(let r = 0; r < 8; r++) {
    for(let c = 0; c < 8; c++) {
      if((r + c) % 2 === 1) {
        if(r < 3)      board[r*8+c] = { color:"black", king:false };
        else if(r > 4) board[r*8+c] = { color:"white", king:false };
      }
    }
  }
  return board;
}

function getCell(board, r, c) {
  if(r < 0 || r >= 8 || c < 0 || c >= 8) return undefined;
  return board[r*8+c] || null;
}

function setCell(board, r, c, val) {
  board[r*8+c] = val;
}

// ============================================================
// ESCUCHAR FIREBASE
// ============================================================
function listenRoom() {
  onValue(ref(db, `damas/${roomId}`), snap => {
    if(!snap.exists()) return;
    const data = snap.val();
    gameState = data;

    if(data.status === "playing" && document.getElementById("lobby").style.display !== "none") {
      startGame(data);
    }

    if(data.status === "playing" || data.status === "won") {
      myTurn  = (data.turn === myColor);
      selected = null;
      drawBoard(data.board);
      updateUI(data);
    }

    if(data.status === "won") {
      showWin(data.winner === myColor);
    }
  });
}

// ============================================================
// INICIAR JUEGO
// ============================================================
function startGame(data) {
  document.getElementById("lobby").style.display = "none";
  document.getElementById("game").style.display  = "block";

  const host    = data.host  || {};
  const guest   = data.guest || {};
  const oppName = myRole === "host" ? (guest.name || "Rival") : (host.name || "Rival");

  document.getElementById("my-dot").style.background  = myColor === "white" ? "#e8e0d0" : "#222";
  document.getElementById("opp-dot").style.background = myColor === "white" ? "#222" : "#e8e0d0";
  document.getElementById("my-name-label").textContent  = myName;
  document.getElementById("opp-name-label").textContent = oppName;

  myTurn = (data.turn === myColor);
  drawBoard(data.board);
  updateUI(data);
}

// ============================================================
// ACTUALIZAR UI
// ============================================================
function updateUI(data) {
  const board = data.board;
  let myCount = 0, oppCount = 0;
  const oppColor = myColor === "white" ? "black" : "white";

  for(let i = 0; i < 64; i++) {
    const p = board[i];
    if(!p) continue;
    if(p.color === myColor) myCount++;
    else oppCount++;
  }

  document.getElementById("my-count").textContent  = myCount;
  document.getElementById("opp-count").textContent = oppCount;

  const turnLbl  = document.getElementById("turn-label");
  const statusEl = document.getElementById("status-msg");

  if(myTurn) {
    turnLbl.textContent  = "⚔️ Tu turno";
    statusEl.textContent = "Selecciona una pieza para mover";
  } else {
    const oppData = myRole === "host" ? data.guest : data.host;
    const oppName = oppData ? oppData.name : "Rival";
    turnLbl.textContent  = `⏳ Turno de ${oppName}`;
    statusEl.textContent = `Esperando a ${oppName}...`;
  }
}

// ============================================================
// CLICK EN TABLERO
// ============================================================
window.handleClick = function(e) {
  if(!myTurn || !gameState) return;

  const rect   = canvas.getBoundingClientRect();
  const scaleX = canvas.width  / rect.width;
  const scaleY = canvas.height / rect.height;
  const mx     = (e.clientX - rect.left) * scaleX;
  const my2    = (e.clientY - rect.top)  * scaleY;
  const cs     = canvas.width / 8;

  let clickR = Math.floor(my2 / cs);
  let clickC = Math.floor(mx / cs);

  // Las negras ven el tablero al revés
  if(myColor === "black") {
    clickR = 7 - clickR;
    clickC = 7 - clickC;
  }

  const board = gameState.board;
  const cell  = getCell(board, clickR, clickC);
  const isMyPiece = cell && cell.color === myColor;

  // SELECCIONAR PIEZA
  if(selected === null) {
    if(!isMyPiece) return;
    // Verificar si hay capturas forzadas
    const forced = getForcedPieces(board, myColor);
    if(forced.length > 0 && !forced.some(([r,c]) => r===clickR && c===clickC)) {
      showToast("⚠️ ¡Debes capturar primero!");
      return;
    }
    selected = [clickR, clickC];
    drawBoard(board);
    return;
  }

  const [sr, sc] = selected;

  // Click en otra pieza propia → cambiar selección
  if(isMyPiece) {
    const forced = getForcedPieces(board, myColor);
    if(forced.length > 0 && !forced.some(([r,c]) => r===clickR && c===clickC)) {
      showToast("⚠️ ¡Debes capturar primero!");
      return;
    }
    selected = [clickR, clickC];
    drawBoard(board);
    return;
  }

  // Intentar mover o capturar
  const piece = getCell(board, sr, sc);
  const caps  = getCaptures(sr, sc, piece, board);
  const moves = caps.length > 0 ? [] : getMoves(sr, sc, piece, board);

  if(caps.some(([r,c]) => r===clickR && c===clickC)) {
    doCapture(sr, sc, clickR, clickC, board, piece);
  } else if(moves.some(([r,c]) => r===clickR && c===clickC)) {
    doMove(sr, sc, clickR, clickC, board, piece);
  } else {
    selected = null;
    drawBoard(board);
  }
};

// ============================================================
// MOVER
// ============================================================
async function doMove(sr, sc, tr, tc, board, piece) {
  const nb = [...board];
  setCell(nb, tr, tc, getCell(nb, sr, sc));
  setCell(nb, sr, sc, null);
  promote(nb, tr, tc);

  const winner  = checkWin(nb);
  const nextTurn = myColor === "white" ? "black" : "white";
  const updates = { board: nb, turn: nextTurn };
  if(winner) { updates.status = "won"; updates.winner = winner; }

  selected = null;
  await update(ref(db, `damas/${roomId}`), updates);
}

// ============================================================
// CAPTURAR
// ============================================================
async function doCapture(sr, sc, tr, tc, board, piece) {
  const nb = [...board];
  const mr = (sr + tr) / 2;
  const mc = (sc + tc) / 2;
  setCell(nb, tr, tc, getCell(nb, sr, sc));
  setCell(nb, sr, sc, null);
  setCell(nb, mr, mc, null);
  promote(nb, tr, tc);

  // Verificar si puede seguir capturando
  const moreCaps = getCaptures(tr, tc, getCell(nb, tr, tc), nb);
  if(moreCaps.length > 0) {
    gameState.board = nb;
    selected = [tr, tc];
    drawBoard(nb);
    await update(ref(db, `damas/${roomId}`), { board: nb });
    showToast("💥 ¡Sigue capturando!");
    return;
  }

  const winner  = checkWin(nb);
  const nextTurn = myColor === "white" ? "black" : "white";
  const updates = { board: nb, turn: nextTurn };
  if(winner) { updates.status = "won"; updates.winner = winner; }

  selected = null;
  await update(ref(db, `damas/${roomId}`), updates);
}

// ============================================================
// REGLAS
// ============================================================
function getMoves(r, c, piece, board) {
  const dirs = piece.king
    ? [[-1,-1],[-1,1],[1,-1],[1,1]]
    : piece.color === "white" ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
  return dirs
    .map(([dr,dc]) => [r+dr, c+dc])
    .filter(([tr,tc]) => tr>=0&&tr<8&&tc>=0&&tc<8 && !getCell(board,tr,tc));
}

function getCaptures(r, c, piece, board) {
  const dirs = piece.king
    ? [[-1,-1],[-1,1],[1,-1],[1,1]]
    : piece.color === "white" ? [[-1,-1],[-1,1]] : [[1,-1],[1,1]];
  const caps = [];
  for(const [dr,dc] of dirs) {
    const mr=r+dr, mc=c+dc, tr=r+dr*2, tc=c+dc*2;
    if(tr<0||tr>=8||tc<0||tc>=8) continue;
    const mid = getCell(board,mr,mc);
    const dst = getCell(board,tr,tc);
    if(mid && mid.color !== piece.color && !dst) caps.push([tr,tc]);
  }
  return caps;
}

function getForcedPieces(board, color) {
  const forced = [];
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) {
    const p = getCell(board,r,c);
    if(p && p.color === color && getCaptures(r,c,p,board).length > 0) forced.push([r,c]);
  }
  return forced;
}

function promote(board, r, c) {
  const p = getCell(board,r,c);
  if(!p) return;
  if(p.color==="white" && r===0) p.king=true;
  if(p.color==="black" && r===7) p.king=true;
}

function checkWin(board) {
  let whites=0, blacks=0;
  for(let i=0;i<64;i++) {
    const p=board[i];
    if(!p) continue;
    if(p.color==="white") whites++;
    else blacks++;
  }
  if(whites===0) return "black";
  if(blacks===0) return "white";
  // Sin movimientos posibles
  const wMove = canMove(board,"white");
  const bMove = canMove(board,"black");
  if(!wMove) return "black";
  if(!bMove) return "white";
  return null;
}

function canMove(board, color) {
  for(let r=0;r<8;r++) for(let c=0;c<8;c++) {
    const p=getCell(board,r,c);
    if(p && p.color===color) {
      if(getCaptures(r,c,p,board).length>0) return true;
      if(getMoves(r,c,p,board).length>0) return true;
    }
  }
  return false;
}

// ============================================================
// DIBUJAR TABLERO
// ============================================================
function drawBoard(board) {
  const W  = canvas.width;
  const cs = W / 8;
  ctx.clearRect(0,0,W,W);

  // Casillas
  for(let r=0;r<8;r++) {
    for(let c=0;c<8;c++) {
      const dr = myColor==="black" ? 7-r : r;
      const dc = myColor==="black" ? 7-c : c;
      const x  = c*cs, y = r*cs;
      const dark = (dr+dc)%2===1;

      const grad = ctx.createLinearGradient(x,y,x+cs,y+cs);
      if(dark) {
        grad.addColorStop(0,"#2a1600");
        grad.addColorStop(1,"#1a0c00");
      } else {
        grad.addColorStop(0,"#f5e6c8");
        grad.addColorStop(1,"#e8d4a8");
      }
      ctx.fillStyle=grad;
      ctx.fillRect(x,y,cs,cs);
      ctx.strokeStyle=dark?"rgba(0,0,0,0.3)":"rgba(255,255,255,0.1)";
      ctx.lineWidth=0.5;
      ctx.strokeRect(x,y,cs,cs);
    }
  }

  // Resaltar seleccionada
  if(selected && myTurn) {
    const [sr,sc]=selected;
    const dr=myColor==="black"?7-sr:sr;
    const dc=myColor==="black"?7-sc:sc;
    ctx.fillStyle="rgba(240,192,64,0.4)";
    ctx.fillRect(dc*cs,dr*cs,cs,cs);
    ctx.strokeStyle="#f0c040";
    ctx.lineWidth=2.5;
    ctx.strokeRect(dc*cs+1,dr*cs+1,cs-2,cs-2);

    const piece=getCell(board,sr,sc);
    if(piece) {
      const caps  = getCaptures(sr,sc,piece,board);
      const moves = caps.length>0?[]:getMoves(sr,sc,piece,board);
      [...caps,...moves].forEach(([hr,hc])=>{
        const hdr=myColor==="black"?7-hr:hr;
        const hdc=myColor==="black"?7-hc:hc;
        ctx.beginPath();
        ctx.arc(hdc*cs+cs/2,hdr*cs+cs/2,cs*0.2,0,Math.PI*2);
        ctx.fillStyle=caps.length>0?"rgba(255,80,80,0.6)":"rgba(240,192,64,0.5)";
        ctx.fill();
      });
    }
  }

  // Capturas forzadas (borde rojo parpadeante)
  if(myTurn) {
    const forced=getForcedPieces(board,myColor);
    forced.forEach(([fr,fc])=>{
      if(selected&&selected[0]===fr&&selected[1]===fc) return;
      const dr=myColor==="black"?7-fr:fr;
      const dc=myColor==="black"?7-fc:fc;
      ctx.strokeStyle="#ff4444";
      ctx.lineWidth=2;
      ctx.setLineDash([4,3]);
      ctx.strokeRect(dc*cs+1,dr*cs+1,cs-2,cs-2);
      ctx.setLineDash([]);
    });
  }

  // Piezas
  for(let r=0;r<8;r++) {
    for(let c=0;c<8;c++) {
      const piece=getCell(board,r,c);
      if(!piece) continue;
      const dr=myColor==="black"?7-r:r;
      const dc=myColor==="black"?7-c:c;
      drawPiece(dc*cs+cs/2, dr*cs+cs/2, cs*0.42, piece);
    }
  }
}

function drawPiece(x,y,r,piece) {
  const isWhite=piece.color==="white";
  // Sombra
  ctx.beginPath(); ctx.arc(x+2,y+3,r,0,Math.PI*2);
  ctx.fillStyle="rgba(0,0,0,0.5)"; ctx.fill();
  // Cuerpo
  const grad=ctx.createRadialGradient(x-r*0.3,y-r*0.3,r*0.05,x,y,r);
  if(isWhite){grad.addColorStop(0,"#fff");grad.addColorStop(0.4,"#ede5d5");grad.addColorStop(0.8,"#c8bfb0");grad.addColorStop(1,"#9e9286");}
  else{grad.addColorStop(0,"#888");grad.addColorStop(0.4,"#333");grad.addColorStop(0.8,"#111");grad.addColorStop(1,"#000");}
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
  ctx.fillStyle=grad; ctx.fill();
  ctx.strokeStyle=isWhite?"rgba(120,100,80,0.5)":"rgba(0,0,0,0.8)";
  ctx.lineWidth=1.5; ctx.stroke();
  // Brillo
  const shine=ctx.createRadialGradient(x-r*0.3,y-r*0.35,0,x-r*0.2,y-r*0.2,r*0.6);
  shine.addColorStop(0,isWhite?"rgba(255,255,255,0.7)":"rgba(255,255,255,0.25)");
  shine.addColorStop(1,"rgba(255,255,255,0)");
  ctx.beginPath(); ctx.arc(x,y,r,0,Math.PI*2);
  ctx.fillStyle=shine; ctx.fill();
  // Anillo
  ctx.beginPath(); ctx.arc(x,y,r*0.72,0,Math.PI*2);
  ctx.strokeStyle=isWhite?"rgba(160,140,120,0.4)":"rgba(255,255,255,0.12)";
  ctx.lineWidth=1; ctx.stroke();
  // Corona
  if(piece.king){
    ctx.font=`bold ${r*0.85}px serif`;
    ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.fillStyle=isWhite?"rgba(180,130,20,0.9)":"rgba(255,210,60,0.9)";
    ctx.fillText("♛",x,y+1);
  }
}

// ============================================================
// WIN
// ============================================================
function showWin(iWon) {
  const ws=document.getElementById("win-screen");
  ws.style.display="flex";
  document.getElementById("win-emoji").textContent=iWon?"🏆":"😢";
  document.getElementById("win-text").textContent=iWon?"¡GANASTE!":"PERDISTE";
  document.getElementById("win-sub").textContent=iWon?"¡Eres el mejor, THE CRIS IF!":"¡Sigue intentándolo!";
}

// ============================================================
// TOAST
// ============================================================
function showToast(msg) {
  const t=document.getElementById("toast");
  t.textContent=msg; t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),2500);
}
window.showToast=showToast;

// Dibujo inicial
drawBoard(buildBoard());
