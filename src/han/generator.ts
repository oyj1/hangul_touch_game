// src/han/generator.ts
import type { Glyph, Stroke } from './strokes';
import { CONSONANTS, VOWELS, FINAL_TWEAK } from './strokes';

export type CharGuide = { strokes: Stroke[]; snapTolerance: number; doneThreshold: number };

// 자모 분해
const CHO = ["ㄱ","ㄲ","ㄴ","ㄷ","ㄸ","ㄹ","ㅁ","ㅂ","ㅃ","ㅅ","ㅆ","ㅇ","ㅈ","ㅉ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];
const JUNG = ["ㅏ","ㅐ","ㅑ","ㅒ","ㅓ","ㅔ","ㅕ","ㅖ","ㅗ","ㅘ","ㅙ","ㅚ","ㅛ","ㅜ","ㅝ","ㅞ","ㅟ","ㅠ","ㅡ","ㅢ","ㅣ"];
const JONG = ["","ㄱ","ㄲ","ㄳ","ㄴ","ㄵ","ㄶ","ㄷ","ㄹ","ㄺ","ㄻ","ㄼ","ㄽ","ㄾ","ㄿ","ㅀ","ㅁ","ㅂ","ㅄ","ㅅ","ㅆ","ㅇ","ㅈ","ㅊ","ㅋ","ㅌ","ㅍ","ㅎ"];

export function splitHangul(s:string){
  const code = s.codePointAt(0)!;
  if(code < 0xAC00 || code > 0xD7A3) return {ch:s, cho:'', jung:'', jong:''};
  const i = code - 0xAC00;
  const cho = Math.floor(i / 588);
  const jung = Math.floor((i % 588) / 28);
  const jong = i % 28;
  return { ch:s, cho:CHO[cho], jung:JUNG[jung], jong:JONG[jong] };
}

// 배치 박스
type Box = {x:number,y:number,w:number,h:number};
const box = (x:number,y:number,w:number,h:number):Box=>({x,y,w,h});

// 자모를 박스에 스케일/이동
function place(g:Glyph, b:Box):Stroke[]{
  return g.strokes.map(st => ({
    kind: st.kind,
    points: st.points.map(([nx,ny]) => [b.x + nx*b.w, b.y + ny*b.h] as [number,number])
  }));
}

// 초성 박스(왼쪽), 중성 박스(오른쪽/상하), 종성 박스(아래) 규칙
function layoutBoxes(jung:string): {cho:Box; jung:Box; jong:Box}{
  // 기본 블록 여백
  const M = 0.08;
  const W = 1 - M*2, H = 1 - M*2;

  // 세로 모음 계열 (ㅏ,ㅑ,ㅓ,ㅕ,ㅣ)
  if(['ㅏ','ㅑ','ㅓ','ㅕ','ㅣ','ㅐ','ㅔ','ㅒ','ㅖ'].includes(jung)){
    return {
      cho:  box(M, M, W*0.52, H),            // 왼쪽
      jung: box(M+W*0.45, M, W*0.45, H),     // 오른쪽
      jong: box(M, M+H*0.58, W, H*0.42)      // 아래(전체폭)
    };
  }
  // 가로 모음 계열 (ㅗ,ㅛ,ㅜ,ㅠ,ㅡ)
  if(['ㅗ','ㅛ'].includes(jung)){
    return {
      cho:  box(M, M+H*0.25, W, H*0.45),     // 가운데
      jung: box(M, M, W, H*0.40),            // 위
      jong: box(M, M+H*0.65, W, H*0.35)      // 아래
    };
  }
  if(['ㅜ','ㅠ'].includes(jung)){
    return {
      cho:  box(M, M, W, H*0.45),            // 가운데
      jung: box(M, M+H*0.55, W, H*0.40),     // 아래
      jong: box(M, M+H*0.85, W, H*0.15)      // 더 아래(좁게)
    };
  }
  if(['ㅡ'].includes(jung)){
    return {
      cho:  box(M, M, W, H*0.60),
      jung: box(M, M+H*0.50, W, H*0.20),
      jong: box(M, M+H*0.70, W, H*0.30),
    };
  }
  // 복합 모음(ㅘ,ㅙ,ㅚ,ㅝ,ㅞ,ㅟ,ㅢ) → 기본 형태에 맞춰 근사
  if(['ㅘ','ㅙ','ㅚ'].includes(jung)){
    // ㅗ 변형 + 오른쪽 세로 추가
    return {
      cho:  box(M, M+H*0.25, W*0.60, H*0.45),
      jung: box(M+W*0.50, M, W*0.42, H), // 오른쪽 영역에 세로부 포함
      jong: box(M, M+H*0.65, W, H*0.35),
    };
  }
  if(['ㅝ','ㅞ','ㅟ'].includes(jung)){
    // ㅜ 변형 + 오른쪽 세로 추가
    return {
      cho:  box(M, M, W*0.60, H*0.45),
      jung: box(M+W*0.45, M, W*0.50, H),
      jong: box(M, M+H*0.85, W, H*0.15),
    };
  }
  if(['ㅢ'].includes(jung)){
    return {
      cho:  box(M, M, W, H*0.50),
      jung: box(M, M+H*0.45, W, H*0.50),
      jong: box(M, M+H*0.85, W, H*0.15),
    };
  }
  // fallback
  return {
    cho:  box(M, M, W*0.52, H),
    jung: box(M+W*0.45, M, W*0.45, H),
    jong: box(M, M+H*0.58, W, H*0.42)
  };
}

// 복합 자모 분해(쌍자음/겹받침 간단 근사)
function glyphForConsonant(c:string, isFinal=false):Glyph{
  const base = (isFinal && FINAL_TWEAK[c]) ? FINAL_TWEAK[c] : CONSONANTS[c];
  if(base) return base;

  // 쌍자음 간단 처리: ㄱㄱ, ㅅㅅ 등은 두 개를 살짝 간격두고 배치
  const mapDouble: Record<string, [string,string]> = {
    'ㄲ':['ㄱ','ㄱ'],'ㄸ':['ㄷ','ㄷ'],'ㅃ':['ㅂ','ㅂ'],'ㅆ':['ㅅ','ㅅ'],'ㅉ':['ㅈ','ㅈ']
  };
  if(mapDouble[c]){
    const [a,b] = mapDouble[c];
    const g1 = CONSONANTS[a], g2 = CONSONANTS[b];
    const shift = isFinal ? 0.20 : 0.12;
    return {
      strokes: [
        ...g1.strokes.map(s=>({...s, points:s.points.map(([x,y])=>[x-shift,y] as [number,number])})),
        ...g2.strokes.map(s=>({...s, points:s.points.map(([x,y])=>[x+shift,y] as [number,number])})),
      ]
    };
  }

  // 겹받침(ㄳ, ㄵ, ㄶ, ㄺ, ㄻ, ㄼ, ㄽ, ㄾ, ㄿ, ㅀ, ㅄ) → 구성요소 나란히
  const finals: Record<string,string[]> = {
    'ㄳ':['ㄱ','ㅅ'],'ㄵ':['ㄴ','ㅈ'],'ㄶ':['ㄴ','ㅎ'],'ㄺ':['ㄹ','ㄱ'],'ㄻ':['ㄹ','ㅁ'],
    'ㄼ':['ㄹ','ㅂ'],'ㄽ':['ㄹ','ㅅ'],'ㄾ':['ㄹ','ㅌ'],'ㄿ':['ㄹ','ㅍ'],'ㅀ':['ㄹ','ㅎ'],'ㅄ':['ㅂ','ㅅ']
  };
  if(isFinal && finals[c]){
    const parts = finals[c];
    const spread = 0.18;
    const strokes: Stroke[] = [];
    parts.forEach((p, i)=>{
      const g = glyphForConsonant(p,true);
      const dx = (i - (parts.length-1)/2) * spread;
      strokes.push(...g.strokes.map(s=>({...s, points:s.points.map(([x,y])=>[x+dx,y] as [number,number])})));
    });
    return { strokes };
  }

  // fallback(미정의): ㄱ
  return CONSONANTS['ㄱ'];
}

// 복합 모음 형태 근사
function glyphForVowel(v:string):Glyph{
  if(VOWELS[v]) return VOWELS[v];
  // ㅘ=ㅗ+ㅏ, ㅙ=ㅗ+ㅐ(가로+세로 두가로), ㅚ=ㅗ+ㅣ
  const comps: Record<string,string[]> = {
    'ㅘ':['ㅗ','ㅏ'],
    'ㅙ':['ㅗ','ㅑ'], // 근사
    'ㅚ':['ㅗ','ㅣ'],
    'ㅝ':['ㅜ','ㅓ'],
    'ㅞ':['ㅜ','ㅕ'], // 근사
    'ㅟ':['ㅜ','ㅣ'],
    'ㅢ':['ㅡ','ㅣ'],
    'ㅐ':['ㅏ','ㅣ'], // 근사
    'ㅔ':['ㅓ','ㅣ'], // 근사
    'ㅒ':['ㅑ','ㅣ'], // 근사
    'ㅖ':['ㅕ','ㅣ'], // 근사
  };
  if(comps[v]){
    const parts = comps[v];
    let strokes: Stroke[] = [];
    parts.forEach(p=>{ strokes = strokes.concat(glyphForVowel(p).strokes); });
    return { strokes };
  }
  return VOWELS['ㅣ'];
}

// 주어진 한글 음절에 대한 전체 가이드 생성
export function buildGuideForSyllable(ch:string): CharGuide {
  const { cho, jung, jong } = splitHangul(ch);
  const L = layoutBoxes(jung || 'ㅏ');

  const strokes: Stroke[] = [];
  if(cho){
    const g = glyphForConsonant(cho,false);
    strokes.push(...place(g, L.cho));
  }
  if(jung){
    const g = glyphForVowel(jung);
    strokes.push(...place(g, L.jung));
  }
  if(jong){
    const g = glyphForConsonant(jong,true);
    strokes.push(...place(g, L.jong));
  }

  return { strokes, snapTolerance: 16, doneThreshold: 0.86 };
}

// 배치 테스트: 연속 문자열에 대해 가이드 제공
export function buildGuidesForText(text:string): Record<string, CharGuide>{
  const map: Record<string, CharGuide> = {};
  Array.from(text).forEach(c=>{ map[c] = buildGuideForSyllable(c); });
  return map;
}