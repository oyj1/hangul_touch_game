
// Simple Hangul Touch Tracing Alpha
// - Dotted guide from template paths
// - Touch/Mouse drawing with stroke-by-stroke checking
// - Lightweight matching: resample + average L2 distance
(() => {
  const canvas = document.getElementById('board');
  const ctx = canvas.getContext('2d');
  const btnReset = document.getElementById('btnReset');
  const btnHint = document.getElementById('btnHint');
  const btnNext = document.getElementById('btnNext');
  const btnPrev = document.getElementById('btnPrev');
  const difficultySel = document.getElementById('difficulty');
  const tip = document.getElementById('tip');
  const stageLabel = document.getElementById('stageLabel');
  const stepLabel = document.getElementById('stepLabel');
  const rewardBox = document.getElementById('reward');
  const wordStepsEl = document.getElementById('wordSteps').querySelectorAll('li');

  const state = {
    unit: null,
    currentStrokeIndex: 0, // which template stroke to draw now
    userStroke: [], // [ [x,y], ... ] normalized 0..1
    drawnStrokes: [], // accepted strokes -> array of paths
    pointerDown: false,
    step: 0 // 0..3 for 가/강/강아/강아지 (visual only)
  };

  // Difficulty thresholds
  function getThreshold(){
    const mode = difficultySel.value;
    if(mode === 'easy') return 0.14;
    if(mode === 'hard') return 0.09;
    return 0.12; // normal
  }

  // Utils
  function toCanvasXY(evt){
    const rect = canvas.getBoundingClientRect();
    const x = (evt.touches ? evt.touches[0].clientX : evt.clientX) - rect.left;
    const y = (evt.touches ? evt.touches[0].clientY : evt.clientY) - rect.top;
    return [x, y];
  }
  function clamp(v,min,max){return Math.max(min,Math.min(max,v));}

  function normPoint(px,py){
    return [px/canvas.width, py/canvas.height];
  }
  function denormPoint(nx,ny){
    return [nx*canvas.width, ny*canvas.height];
  }

  function distance(a,b){
    const dx=a[0]-b[0], dy=a[1]-b[1];
    return Math.hypot(dx,dy);
  }

  // Resample polyline to N points (including endpoints)
  function resample(path, N=64){
    if(path.length < 2) return path.slice();
    // Compute lengths
    let L = 0;
    const segLen = [];
    for(let i=0;i<path.length-1;i++){
      const d = distance(path[i], path[i+1]);
      segLen.push(d);
      L += d;
    }
    if(L === 0) return Array(N).fill(path[0]);
    const step = L/(N-1);
    let res = [path[0].slice()];
    let acc = 0;
    let i=0;
    let curr = path[0].slice();
    let remain = step;
    while(res.length < N){
      const d = distance(curr, path[i+1]);
      if(d >= remain){
        const t = remain/d;
        curr = [curr[0] + (path[i+1][0]-curr[0])*t, curr[1] + (path[i+1][1]-curr[1])*t];
        res.push(curr.slice());
        remain = step;
      }else{
        remain -= d;
        i++;
        if(i>=path.length-1){
          // flush
          if(res.length < N) res.push(path[path.length-1].slice());
          break;
        }
        curr = path[i].slice();
      }
    }
    if(res.length < N) res.push(path[path.length-1].slice());
    return res.slice(0,N);
  }

  function averageDistance(p1, p2){
    const n = Math.min(p1.length, p2.length);
    let s = 0;
    for(let i=0;i<n;i++) s += distance(p1[i], p2[i]);
    return s/n;
  }

  // Draw
  function clear(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
  }
  function drawGuide(){
    // dotted guide for remaining strokes, solid green for accepted ones
    // Draw accepted
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for(const path of state.drawnStrokes){
      ctx.setLineDash([]);
      ctx.lineWidth = 18;
      ctx.strokeStyle = '#00C853';
      drawPath(path);
    }
    // Draw current+future guides
    if(!state.unit) return;
    const strokes = state.unit.strokes;
    for(let i=state.currentStrokeIndex; i<strokes.length; i++){
      const path = denormPath(strokes[i].path);
      ctx.setLineDash([8,12]);
      ctx.lineWidth = 12;
      ctx.strokeStyle = '#999';
      drawPath(path);
      // start dot
      const p0 = path[0];
      ctx.setLineDash([]);
      ctx.fillStyle = i===state.currentStrokeIndex ? '#FF8A00' : '#bbb';
      ctx.beginPath();
      ctx.arc(p0[0], p0[1], 8, 0, Math.PI*2);
      ctx.fill();
    }
    // Draw user stroke in progress
    if(state.userStroke.length>1){
      ctx.setLineDash([]);
      ctx.lineWidth = 18;
      ctx.strokeStyle = '#333';
      drawPath(denormPath(state.userStroke));
    }
  }
  function drawPath(path){
    ctx.beginPath();
    ctx.moveTo(path[0][0], path[0][1]);
    for(let i=1;i<path.length;i++){
      ctx.lineTo(path[i][0], path[i][1]);
    }
    ctx.stroke();
  }
  function denormPath(npath){
    return npath.map(p => denormPoint(p[0], p[1]));
  }

  // Check stroke against template
  function checkStroke(){
    const idx = state.currentStrokeIndex;
    const tpl = state.unit.strokes[idx].path;
    if(state.userStroke.length < 8){
      return {ok:false, score: 1};
    }
    const U = resample(state.userStroke, 64);
    const T = resample(tpl, 64);
    // normalize translation and scale roughly
    function norm(path){
      let minx=Infinity,miny=Infinity,maxx=-Infinity,maxy=-Infinity;
      path.forEach(p=>{minx=Math.min(minx,p[0]);miny=Math.min(miny,p[1]);maxx=Math.max(maxx,p[0]);maxy=Math.max(maxy,p[1]);});
      const sx = maxx-minx, sy = maxy-miny;
      const s = Math.max(sx,sy) || 1e-6;
      return path.map(p=>[(p[0]-minx)/s,(p[1]-miny)/s]);
    }
    const Un = norm(U);
    const Tn = norm(T);
    const d = averageDistance(Un, Tn);
    const thr = getThreshold();
    return {ok: d < thr, score: d, thr};
  }

  function setStepVisual(){
    stageLabel.textContent = state.unit.label;
    stepLabel.textContent = `${state.step+1}/4`;
    // word steps UI
    wordStepsEl.forEach((li,i)=>{
      li.classList.toggle('active', i===state.step);
    });
    // dog appears fully only on final step (for fun)
    const dog = document.getElementById('dogImg');
    dog.style.opacity = (state.step>=3)?1:0.4+state.step*0.2;
  }

  function nextStrokeOrStage(){
    if(state.currentStrokeIndex < state.unit.strokes.length-1){
      state.currentStrokeIndex++;
      state.userStroke = [];
      tip.textContent = "좋았어! 다음 획도 점선을 따라 그려봐요.";
      drawAll();
    }else{
      // stage complete → show reward, enable Next
      rewardBox.hidden = false;
      btnNext.disabled = false;
      tip.textContent = "완성! '다음'을 눌러 진행하세요.";
      confettiOnce();
    }
  }

  function prevStage(){
    rewardBox.hidden = true;
    btnNext.disabled = true;
    state.step = Math.max(0, state.step-1);
    setStepVisual();
    resetStage();
  }

  function nextStage(){
    rewardBox.hidden = true;
    btnNext.disabled = true;
    state.step = Math.min(3, state.step+1);
    setStepVisual();
    resetStage();
  }

  function resetStage(){
    state.currentStrokeIndex = 0;
    state.userStroke = [];
    state.drawnStrokes = [];
    tip.textContent = "점선 위를 천천히 따라 그려봐요.";
    drawAll();
  }

  function drawAll(){
    clear();
    drawGuide();
  }

  function confettiOnce(){
    // simple canvas confetti effect
    const pieces = Array.from({length: 40}, ()=> ({
      x: Math.random()*canvas.width,
      y: -20 - Math.random()*100,
      r: 3+Math.random()*4,
      vy: 2+Math.random()*2
    }));
    let frame = 0;
    function anim(){
      frame++;
      if(frame>60) return;
      // redraw overlay only (call drawGuide first)
      drawAll();
      ctx.save();
      for(const p of pieces){
        p.y += p.vy;
        ctx.fillStyle = ['#FF8A00','#5CC3FF','#7ED957','#FFC400'][Math.floor(Math.random()*4)];
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fill();
      }
      ctx.restore();
      requestAnimationFrame(anim);
    }
    anim();
  }

  // Event handlers
  function onDown(evt){
    evt.preventDefault();
    state.pointerDown = true;
    rewardBox.hidden = true;
    btnNext.disabled = true;
    state.userStroke = [];
    const [x,y] = toCanvasXY(evt);
    state.userStroke.push(normPoint(x,y));
    drawAll();
  }
  function onMove(evt){
    if(!state.pointerDown) return;
    evt.preventDefault();
    const [x,y] = toCanvasXY(evt);
    state.userStroke.push(normPoint(x,y));
    drawAll();
  }
  function onUp(evt){
    if(!state.pointerDown) return;
    evt.preventDefault();
    state.pointerDown = false;
    // Evaluate
    const res = checkStroke();
    if(res.ok){
      tip.textContent = "잘했어요!";
      // lock stroke
      state.drawnStrokes.push(state.userStroke.slice());
      state.userStroke = [];
      drawAll();
      setTimeout(nextStrokeOrStage, 400);
    }else{
      tip.textContent = `조금 더 천천히 따라 그려봐요. (유사도 ${(1-res.score).toFixed(2)})`;
      // fade the wrong stroke (just clear)
      state.userStroke = [];
      drawAll();
    }
  }

  canvas.addEventListener('mousedown', onDown);
  canvas.addEventListener('mousemove', onMove);
  window.addEventListener('mouseup', onUp);
  canvas.addEventListener('touchstart', onDown, {passive:false});
  canvas.addEventListener('touchmove', onMove, {passive:false});
  canvas.addEventListener('touchend', onUp);

  btnReset.addEventListener('click', resetStage);
  btnHint.addEventListener('click', ()=>{
    tip.textContent = "시작점(주황 점)에서 점선을 따라 쓱~";
  });
  btnNext.addEventListener('click', nextStage);
  btnPrev.addEventListener('click', prevStage);
  difficultySel.addEventListener('change', ()=>{
    tip.textContent = "난이도를 바꿨어요. 다시 시도해볼까요?";
  });

  // Load unit data
  fetch('data/ga.json')
    .then(r=>r.json())
    .then(data => {
      state.unit = data;
      setStepVisual();
      resetStage();
    })
    .catch(e=>{
      tip.textContent = "데이터 로드 실패: " + e.message;
    });

})();
