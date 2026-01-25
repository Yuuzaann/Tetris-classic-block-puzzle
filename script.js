const canvas = document.getElementById('tetris');
const ctx = canvas.getContext('2d');
ctx.scale(20, 20);

/* ===== SUARA ===== */
const sounds = {
    move: new Audio('assets/move.wav'),
    rotate: new Audio('assets/rotate.wav'),
    drop: new Audio('assets/drop.wav'),
    line: new Audio('assets/line.wav'),
    gameover: new Audio('assets/gameover.wav'),
    bgm: new Audio('assets/bgm.wav')
};
sounds.bgm.loop = true;
sounds.bgm.volume = 0.5; // volume default 50%

/* ===== STATUS GAME ===== */
let isRunning = false;
let isPaused = false;
let gameOverState = false;

/* ===== ARENA ===== */
const arena = Array.from({length: 20}, () => Array(12).fill(0));
const colors = [null,'#f87171','#60a5fa','#34d399','#facc15','#c084fc','#fb923c','#38bdf8'];

/* ===== PLAYER ===== */
const player = { pos: {x:5, y:0}, matrix: null, score:0, level:1 };
let dropCounter=0, dropInterval=1000, lastTime=0;

/* ===== HIGH SCORE ===== */
let highScore = localStorage.getItem('tetrisHigh') || 0;
document.getElementById('highScore').innerText = highScore;

/* ===== BUTTON PAUSE ===== */
const pauseBtn = document.getElementById('pauseBtn');

/* ===== FUNGSI PIECES ===== */
function createPiece(type){
    if(type==='T') return [[0,1,0],[1,1,1],[0,0,0]];
    if(type==='O') return [[2,2],[2,2]];
    if(type==='L') return [[0,0,3],[3,3,3],[0,0,0]];
    if(type==='J') return [[4,0,0],[4,4,4],[0,0,0]];
    if(type==='I') return [[0,0,0,0],[5,5,5,5],[0,0,0,0],[0,0,0,0]];
    if(type==='S') return [[0,6,6],[6,6,0],[0,0,0]];
    if(type==='Z') return [[7,7,0],[0,7,7],[0,0,0]];
}

/* ===== FUNGSI UTAMA GAME ===== */
function collide(arena, player){
    return player.matrix.some((row,y) =>
        row.some((value,x) =>
            value!==0 && (arena[y+player.pos.y]?.[x+player.pos.x])!==0
        )
    );
}

function merge(arena, player){
    player.matrix.forEach((row,y) => {
        row.forEach((value,x)=>{
            if(value) arena[y+player.pos.y][x+player.pos.x] = value;
        });
    });
}

function arenaSweep(){
    let cleared = 0;
    for(let y=arena.length-1;y>=0;y--){
        if(arena[y].every(v=>v!==0)){
            arena.splice(y,1);
            arena.unshift(Array(12).fill(0));
            cleared++;
            sounds.line.currentTime=0;
            sounds.line.play();
        }
    }
    if(cleared){
        player.score += cleared*10;
        player.level = Math.floor(player.score/50)+1;
        dropInterval = Math.max(120, 1000*Math.pow(0.85, player.level-1));
        updateScore();
    }
}

/* ===== GAMBAR MATRIX ===== */
function drawMatrix(matrix, offset){
    matrix.forEach((row,y)=>{
        row.forEach((value,x)=>{
            if(value){
                ctx.fillStyle = colors[value];
                ctx.fillRect(x+offset.x, y+offset.y, 1, 1);
            }
        });
    });
}

/* ===== PULSE ANIMASI PAUSE ===== */
let pulseScale=1, pulseDir=1;
function draw(){
    ctx.fillStyle = '#020617';
    ctx.fillRect(0,0,canvas.width,canvas.height);

    drawMatrix(arena,{x:0,y:0});
    drawMatrix(player.matrix, player.pos);

    if(isPaused){
        ctx.save();
        ctx.fillStyle='rgba(0,0,0,0.65)';
        ctx.fillRect(0,0,12,20);

        pulseScale += 0.02*pulseDir;
        if(pulseScale>1.3 || pulseScale<0.7) pulseDir*=-1;

        ctx.fillStyle='#38bdf8';
        ctx.textAlign='center';
        ctx.textBaseline='middle';
        ctx.font=`bold ${3*pulseScale}px Arial`;
        ctx.fillText('⏸',6,9);
        ctx.font=`bold ${1.2*pulseScale}px Arial`;
        ctx.fillText('PAUSE',6,11);

        ctx.restore();
    }
}

/* ===== LOOP GAME ===== */
function update(time=0){
    if(!isRunning || isPaused || gameOverState) return;
    const delta = time - lastTime;
    lastTime = time;
    dropCounter += delta;
    if(dropCounter>dropInterval) drop();
    draw();
    requestAnimationFrame(update);
}

/* ===== FUNGSI DROP ===== */
function drop(){
    player.pos.y++;
    if(collide(arena, player)){
        player.pos.y--;
        merge(arena, player);
        arenaSweep();
        resetPlayer();
    }
    dropCounter=0;
    sounds.drop.currentTime=0;
    sounds.drop.play();
}

function move(dir){
    if(!isRunning || isPaused) return;
    player.pos.x += dir;
    if(collide(arena, player)) player.pos.x -= dir;
    else { sounds.move.currentTime=0; sounds.move.play(); }
}

/* ===== ROTASI PIECE ===== */
function rotateMatrix(matrix){
    for(let y=0;y<matrix.length;y++)
        for(let x=0;x<y;x++)
            [matrix[x][y], matrix[y][x]] = [matrix[y][x], matrix[x][y]];
    matrix.forEach(row=>row.reverse());
}

function rotate(){
    if(!isRunning || isPaused) return;
    const oldMatrix = player.matrix.map(r=>[...r]);
    const oldX = player.pos.x;
    rotateMatrix(player.matrix);
    const kicks = [0,-1,1,-2,2];
    let success=false;
    for(let k of kicks){
        player.pos.x = oldX+k;
        if(!collide(arena, player)){success=true; break;}
    }
    if(!success){player.matrix = oldMatrix; player.pos.x = oldX;}
    else { sounds.rotate.currentTime=0; sounds.rotate.play(); }
}

/* ===== RESET PLAYER ===== */
function resetPlayer(){
    const pieces = 'TJLOSZI';
    player.matrix = createPiece(pieces[Math.random()*pieces.length|0]);
    player.pos.y = 0;
    player.pos.x = 5;
    if(collide(arena, player)) endGame();
}

/* ===== START GAME ===== */
function startGame(){
    document.getElementById('startScreen').style.display='none';
    document.getElementById('gameOver').style.display='none';
    arena.forEach(r=>r.fill(0));
    player.score=0; player.level=1; dropInterval=1000;
    gameOverState=false; isPaused=false; isRunning=true;
    pauseBtn.innerText='PAUSE';
    sounds.bgm.currentTime=0; sounds.bgm.play();
    resetPlayer(); updateScore(); lastTime=0; update();
}

/* ===== PAUSE / RESUME ===== */
function pauseGame(){
    if(!isRunning) return;
    isPaused = !isPaused;
    if(isPaused){ 
        sounds.bgm.pause(); 
        pauseBtn.innerText='RESUME';
    } else { 
        sounds.bgm.play(); 
        pauseBtn.innerText='PAUSE'; 
        lastTime=0; 
        update(); 
    }
}

/* ===== KELUAR GAME ===== */
function exitGame(){
    sounds.bgm.pause(); 
    isRunning=false; 
    isPaused=false; 
    pauseBtn.innerText='PAUSE';
    document.getElementById('startScreen').style.display='flex';
}

/* ===== GAME OVER ===== */
function endGame(){
    sounds.bgm.pause(); 
    sounds.gameover.play();
    gameOverState=true; 
    isRunning=false; 
    pauseBtn.innerText='PAUSE';
    document.getElementById('gameOver').style.display='flex';
}

/* ===== UPDATE SCORE & LEVEL ===== */
function updateScore(){
    document.getElementById('score').innerText = player.score;
    document.getElementById('level').innerText = player.level;
    if(player.score > highScore){
        highScore = player.score;
        localStorage.setItem('tetrisHigh', highScore);
        document.getElementById('highScore').innerText = highScore;
    }
}

/* ===== ATUR VOLUME BGM ===== */
document.getElementById('bgmVolume').addEventListener('input', e=>{
    sounds.bgm.volume = e.target.value;
});

/* ===== KEYBOARD ===== */
document.addEventListener('keydown', e=>{
    if(e.key==='ArrowLeft'||e.key==='a') move(-1);
    if(e.key==='ArrowRight'||e.key==='d') move(1);
    if(e.key==='ArrowDown'||e.key==='s') drop();
    if(e.key==='ArrowUp'||e.key==='w') rotate();
    if(e.key==='Escape') pauseGame();
});
