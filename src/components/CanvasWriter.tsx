// src/components/CanvasWriter.tsx
import { useRef, useEffect, useState } from 'react';
import type { CharGuide } from '../han/generator';
import { buildGuideForSyllable } from '../han/generator';

type Props = { char: string; width?: number; height?: number };

const BRUSH = { base: 6, max: 10 };
const SMOOTHING = 0.35;

function projectToPolyline(
  x: number, y: number, poly: [number, number][], width: number, height: number
){
  const toPx = ([nx, ny]: [number, number]) => [nx * width, ny * height] as [number, number];
  let bestDist = Infinity;
  let bestPoint: [number, number] = [x, y];
  let bestT = 0;
  let accLen = 0, totalLen = 0;
  for (let i = 0; i < poly.length - 1; i++) {
    const [x1, y1] = toPx(poly[i]);
    const [x2, y2] = toPx(poly[i + 1]);
    const vx = x2 - x1, vy = y2 - y1;
    const segLen = Math.hypot(vx, vy);
    totalLen += segLen;
    const tx = x - x1, ty = y - y1;
    const t = Math.max(0, Math.min(1, (tx * vx + ty * vy) / (segLen * segLen || 1)));
    const px = x1 + vx * t, py = y1 + vy * t;
    const d = Math.hypot(px - x, py - y);
    if (d < bestDist) { bestDist = d; bestPoint = [px, py]; bestT = (accLen + segLen * t); }
    accLen += segLen;
  }
  return { px: bestPoint[0], py: bestPoint[1], dist: bestDist, progressLen: bestT, totalLen };
}

export default function CanvasWriter({ char, width=800, height=500 }: Props){
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [guide, setGuide] = useState<CharGuide>(() => buildGuideForSyllable(char));
  const [strokeIdx, setStrokeIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(()=>{
    setGuide(buildGuideForSyllable(char));
    setStrokeIdx(0);
    setProgress(0);
  }, [char]);

  useEffect(()=>{
    const cvs = canvasRef.current!;
    const ctx = cvs.getContext('2d')!;
    const pointer = { x:0, y:0, down:false };
    const drawn = { path: [] as [number,number][], length: 0 };

    const rect = () => cvs.getBoundingClientRect();
    const toLocal = (e:PointerEvent) => ({ x: e.clientX - rect().left, y: e.clientY - rect().top });

    const onDown = (e:PointerEvent)=>{ Object.assign(pointer, toLocal(e), {down:true}); e.preventDefault(); };
    const onMove = (e:PointerEvent)=>{ const p = toLocal(e); pointer.x = p.x; pointer.y = p.y; };
    const onUp = ()=>{ pointer.down=false; };

    cvs.addEventListener('pointerdown', onDown);
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);

    let raf = 0;
    const loop = ()=>{
      ctx.clearRect(0,0,width,height);
      const cur = guide.strokes[strokeIdx];
      if(!cur){ cancelAnimationFrame(raf); return; }

      // 가이드(점선)
      ctx.save();
      ctx.setLineDash([8, 10]);
      ctx.strokeStyle = '#bdbdbd';
      ctx.lineWidth = 6;
      ctx.beginPath();
      const pts = cur.points as [number,number][];
      const toPx = ([nx, ny]: [number, number]) => [nx * width, ny * height] as [number, number];
      let [sx, sy] = toPx(pts[0]);
      ctx.moveTo(sx, sy);
      for(let i=1;i<pts.length;i++){
        const [x,y] = toPx(pts[i]);
        ctx.lineTo(x,y);
      }
      ctx.stroke();
      ctx.restore();

      // 스냅
      const proj = projectToPolyline(pointer.x, pointer.y, pts, width, height);
      const inSnap = proj.dist <= guide.snapTolerance;
      const last = drawn.path[drawn.path.length-1];
      const targetX = inSnap ? proj.px : pointer.x;
      const targetY = inSnap ? proj.py : pointer.y;
      const sx2 = last ? last[0] + (targetX - last[0]) * SMOOTHING : targetX;
      const sy2 = last ? last[1] + (targetY - last[1]) * SMOOTHING : targetY;

      if(pointer.down && inSnap){
        drawn.path.push([sx2, sy2]);
        const n = drawn.path.length;
        if(n>1){
          const [ax,ay] = drawn.path[n-2];
          drawn.length += Math.hypot(sx2-ax, sy2-ay);
        }
      }

      // 그리기
      ctx.beginPath();
      for(let i=0;i<drawn.path.length;i++){
        const [x,y] = drawn.path[i];
        if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
      }
      const prog = Math.min(1, drawn.length / proj.totalLen);
      ctx.lineWidth = BRUSH.base + (BRUSH.max - BRUSH.base) * prog * 0.4;
      ctx.strokeStyle = '#ff8a00';
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      ctx.stroke();
      setProgress(prog);

      // 완료 판정
      if(prog >= guide.doneThreshold && !pointer.down){
        drawn.path = []; drawn.length = 0;
        setStrokeIdx((s)=> Math.min(s+1, guide.strokes.length));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return ()=>{
      cancelAnimationFrame(raf);
      cvs.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [guide, strokeIdx, width, height]);

  return (
    <div className="relative">
      <canvas style={{touchAction:'none'}} ref={canvasRef} width={width} height={height} className="rounded-xl bg-white shadow"/>
      <div className="absolute right-3 top-3 px-2 py-1 text-sm bg-white/80 rounded">
        {Math.min(strokeIdx+1, guide.strokes.length)}/{guide.strokes.length}획 · {(progress*100|0)}%
      </div>
    </div>
  );
}