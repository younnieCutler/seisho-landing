import gsap from 'gsap'
import { ScrollTrigger } from 'gsap/ScrollTrigger'
import Lenis from 'lenis'
import { createCrossTexture } from './texture'
import { ShardScene } from './shard'

// TODO: App Store Connect에서 public link 발급 후 교체
const TESTFLIGHT_URL = 'https://testflight.apple.com/join/XXXXXXXX'

gsap.registerPlugin(ScrollTrigger)

const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

document.getElementById('cta-btn')!.setAttribute('href', TESTFLIGHT_URL)

// Lenis 관성 스크롤 + ScrollTrigger 동기화
if (!reducedMotion) {
  const lenis = new Lenis()
  lenis.on('scroll', ScrollTrigger.update)
  gsap.ticker.add((time) => lenis.raf(time * 1000))
  gsap.ticker.lagSmoothing(0)
}

async function initHero() {
  const canvas = document.getElementById('hero-canvas') as HTMLCanvasElement
  const fallback = document.getElementById('hero-fallback') as HTMLImageElement
  try {
    const texture = await createCrossTexture()
    const shards = new ShardScene(canvas, texture, !reducedMotion)

    if (reducedMotion) return // 정적 조립 상태 렌더로 종료 (문서 §4)

    // 인트로: 완전 파쇄 → 반쯤 부유 상태
    let scrollAssembly = 0
    const state = { intro: 0 }
    gsap.to(state, {
      intro: 0.12,
      duration: 2.2,
      ease: 'power2.out',
      onUpdate: () => shards.setAssembly(Math.max(state.intro, scrollAssembly)),
    })

    // 스크롤: 히어로 통과하며 조립 (scrub 1.2 — 시네마틱 딜레이, 문서 §3)
    ScrollTrigger.create({
      trigger: '#hero',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 1.2,
      onUpdate: (self) => {
        scrollAssembly = self.progress
        shards.setAssembly(Math.max(state.intro, scrollAssembly))
      },
    })
  } catch (err) {
    // WebGL 실패 → 정적 아이콘 폴백
    console.error('[hero] WebGL init failed, falling back to static image', err)
    canvas.hidden = true
    fallback.hidden = false
  }
}

function initReveals() {
  if (reducedMotion) return
  gsap.utils.toArray<HTMLElement>('.card, #story .story-line, #story h2, #cta .container > *').forEach((el) => {
    gsap.from(el, {
      opacity: 0,
      y: 36,
      duration: 0.9,
      ease: 'power2.out',
      scrollTrigger: { trigger: el, start: 'top 85%' },
    })
  })
}

initHero()
initReveals()
