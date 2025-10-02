// README - 패치 요약
// 1) src/han/strokes.ts : 자모(초/중/종) 템플릿
// 2) src/han/generator.ts : 임의의 한글 음절(가~힣) → 절차적으로 획 가이드 생성
// 3) src/components/CanvasWriter.tsx : 스냅+부드러운 브러시 캔버스
// 사용법 예시:
// <CanvasWriter char="강" width={900} height={600} />
// 어떤 한글도 char에 넣으면 자동으로 획 가이드가 생성됩니다.