// 1024x1024 캔버스에 십자가 실루엣 + 앱 아이콘 + "갓생 | 聖活" 타이포를 합성한다.
// 십자가 밖은 알파 0 — fragment shader에서 discard되어 실루엣만 남는다.

const SIZE = 1024

// 라틴 십자가 비례 (참조 문서 팁 4: 고정 레이아웃이 동기화에 가장 간결)
const BAR = 264 // 바 두께
const V_TOP = 48
const V_BOTTOM = 984
const H_Y = 330 // 크로스바 상단
const H_LEFT = 132
const H_RIGHT = 892

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

export async function createCrossTexture(): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = SIZE
  canvas.height = SIZE
  const ctx = canvas.getContext('2d')!

  const [icon] = await Promise.all([
    loadImage('/icon.png'),
    document.fonts.load('600 96px "Noto Serif KR"'),
  ])

  const cx = SIZE / 2

  // 십자가 본체 — 파일 같은 옅은 면 위에 은은한 수직 그라디언트
  const grad = ctx.createLinearGradient(0, V_TOP, 0, V_BOTTOM)
  grad.addColorStop(0, '#FFFFFF')
  grad.addColorStop(1, '#E6EEFA')
  ctx.fillStyle = grad
  ctx.fillRect(cx - BAR / 2, V_TOP, BAR, V_BOTTOM - V_TOP)
  ctx.fillRect(H_LEFT, H_Y, H_RIGHT - H_LEFT, BAR)

  // 얇은 네이비 윤곽 — 조각 단면에서 색이 살짝 비치게
  ctx.strokeStyle = 'rgba(26, 54, 93, 0.35)'
  ctx.lineWidth = 4
  ctx.strokeRect(cx - BAR / 2, V_TOP, BAR, V_BOTTOM - V_TOP)
  ctx.strokeRect(H_LEFT, H_Y, H_RIGHT - H_LEFT, BAR)

  // 앱 아이콘 — 크로스바 위 세로 바 안
  const iconSize = 176
  ctx.save()
  const ix = cx - iconSize / 2
  const iy = V_TOP + 64
  ctx.beginPath()
  ctx.roundRect(ix, iy, iconSize, iconSize, 40)
  ctx.clip()
  ctx.drawImage(icon, ix, iy, iconSize, iconSize)
  ctx.restore()

  // 타이포 — 교차점 중앙, 크로스바를 가로지르게
  ctx.fillStyle = '#1A365D'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.font = '600 96px "Noto Serif KR", serif'
  ctx.fillText('갓생 | 聖活', cx, H_Y + BAR / 2)

  // 세로 바 하단 — 작은 태그라인
  ctx.font = '400 34px "Noto Serif KR", serif'
  ctx.fillStyle = 'rgba(26, 54, 93, 0.65)'
  ctx.save()
  ctx.translate(cx, 760)
  ctx.rotate(-Math.PI / 2)
  ctx.fillText('오늘의 말씀', 0, 0)
  ctx.restore()

  return canvas
}
