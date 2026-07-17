// 3D Shard 파쇄·조립 시스템 (참조: 3d-shard-webgl-pretext-insights.md)
// PlaneGeometry(14x14).toNonIndexed() → 삼각형 페이스별 centroid/velocity/rotation
// 속성 → 커스텀 셰이더에서 uAssembly(0=파쇄, 1=조립)로 선형 결합.
import * as THREE from 'three'

const VERT = /* glsl */ `
uniform float uAssembly;
uniform float uTime;
attribute vec3 aCentroid;
attribute vec3 aVelocity;
attribute vec3 aAxis;
attribute float aAngle;
varying vec2 vUv;
varying vec3 vNormal;
varying float vScatter;

mat3 rotationMatrix(vec3 axis, float angle) {
  float s = sin(angle);
  float c = cos(angle);
  float oc = 1.0 - c;
  return mat3(
    oc * axis.x * axis.x + c,          oc * axis.x * axis.y - axis.z * s, oc * axis.z * axis.x + axis.y * s,
    oc * axis.x * axis.y + axis.z * s, oc * axis.y * axis.y + c,          oc * axis.y * axis.z - axis.x * s,
    oc * axis.z * axis.x - axis.y * s, oc * axis.y * axis.z + axis.x * s, oc * axis.z * axis.z + c
  );
}

void main() {
  float t = 1.0 - uAssembly;
  mat3 rot = rotationMatrix(normalize(aAxis), aAngle * t);
  vec3 local = position - aCentroid;
  // 파쇄 상태에서 조각이 미세하게 부유
  float wobble = sin(uTime * 0.6 + aCentroid.x * 8.0 + aCentroid.y * 6.0) * 0.03;
  vec3 p = rot * local + aCentroid + aVelocity * t + vec3(0.0, wobble, wobble * 0.5) * t;
  vNormal = rot * normal;
  vUv = uv;
  vScatter = t;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
}
`

const FRAG = /* glsl */ `
uniform sampler2D uMap;
varying vec2 vUv;
varying vec3 vNormal;
varying float vScatter;

void main() {
  vec4 tex = texture2D(uMap, vUv);
  if (tex.a < 0.5) discard;
  vec3 n = normalize(vNormal);
  // 단순 directional light — 평면 조각에 입체 음영 (문서 팁 3)
  float diff = max(dot(n, normalize(vec3(0.4, 0.7, 1.0))), 0.0);
  vec3 col = tex.rgb * (0.5 + 0.5 * diff);
  // 파쇄 시 단면에서 pale navy(#8EADDC) edge glow
  float glow = vScatter * pow(1.0 - abs(n.z), 2.5);
  col += vec3(0.557, 0.678, 0.863) * glow * 0.9;
  gl_FragColor = vec4(col, tex.a);
}
`

export class ShardScene {
  private renderer: THREE.WebGLRenderer
  private scene = new THREE.Scene()
  private camera: THREE.PerspectiveCamera
  private material: THREE.ShaderMaterial
  private mesh: THREE.Mesh
  private clock = new THREE.Clock()
  private rafId = 0
  private animated: boolean

  constructor(canvas: HTMLCanvasElement, texture: HTMLCanvasElement, animated: boolean) {
    this.animated = animated
    this.renderer = new THREE.WebGLRenderer({ canvas, alpha: true, antialias: true })
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))

    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 20)
    this.camera.position.z = 2.4

    const map = new THREE.CanvasTexture(texture)
    map.colorSpace = THREE.SRGBColorSpace

    const geometry = new THREE.PlaneGeometry(1.5, 1.5, 14, 14).toNonIndexed()
    this.bindShardAttributes(geometry)

    this.material = new THREE.ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uMap: { value: map },
        uAssembly: { value: animated ? 0.0 : 1.0 },
        uTime: { value: 0 },
      },
      transparent: true,
      side: THREE.DoubleSide,
    })

    this.mesh = new THREE.Mesh(geometry, this.material)
    this.scene.add(this.mesh)

    this.resize()
    window.addEventListener('resize', this.resize)

    if (animated) {
      this.loop()
    } else {
      this.renderer.render(this.scene, this.camera) // reduced motion: 조립 상태 1프레임 정적 렌더
    }
  }

  // 페이스(삼각형)별 무게중심·방사형 속도·회전축/각을 버텍스 3개에 동일하게 부여
  private bindShardAttributes(geometry: THREE.BufferGeometry) {
    const pos = geometry.attributes.position
    const count = pos.count
    const centroids = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)
    const axes = new Float32Array(count * 3)
    const angles = new Float32Array(count)

    for (let f = 0; f < count / 3; f++) {
      const i = f * 3
      const cx = (pos.getX(i) + pos.getX(i + 1) + pos.getX(i + 2)) / 3
      const cy = (pos.getY(i) + pos.getY(i + 1) + pos.getY(i + 2)) / 3
      const cz = (pos.getZ(i) + pos.getZ(i + 1) + pos.getZ(i + 2)) / 3

      // 중심에서 바깥으로 발산 + Z 깊이 진폭 (문서 §1-B)
      const radial = new THREE.Vector3(cx, cy, 0)
      if (radial.lengthSq() < 1e-6) radial.set(Math.random() - 0.5, Math.random() - 0.5, 0)
      radial.normalize().multiplyScalar(0.6 + Math.random() * 0.9)
      const vz = (Math.random() - 0.5) * 2.2

      const axis = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
      const angle = Math.random() * Math.PI * 3 // 0 ~ 540도

      for (let v = 0; v < 3; v++) {
        const j = (i + v) * 3
        centroids[j] = cx; centroids[j + 1] = cy; centroids[j + 2] = cz
        velocities[j] = radial.x; velocities[j + 1] = radial.y; velocities[j + 2] = vz
        axes[j] = axis.x; axes[j + 1] = axis.y; axes[j + 2] = axis.z
        angles[i + v] = angle
      }
    }

    geometry.setAttribute('aCentroid', new THREE.BufferAttribute(centroids, 3))
    geometry.setAttribute('aVelocity', new THREE.BufferAttribute(velocities, 3))
    geometry.setAttribute('aAxis', new THREE.BufferAttribute(axes, 3))
    geometry.setAttribute('aAngle', new THREE.BufferAttribute(angles, 1))
  }

  setAssembly(value: number) {
    this.material.uniforms.uAssembly.value = THREE.MathUtils.clamp(value, 0, 1)
  }

  private resize = () => {
    const canvas = this.renderer.domElement
    const w = canvas.clientWidth
    const h = canvas.clientHeight
    if (w === 0 || h === 0) return
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    // 모바일 세로 화면에서 십자가가 잘리지 않게 카메라 거리 보정
    this.camera.position.z = w < h ? 2.4 * (h / w) * 0.8 : 2.4
    if (!this.animated) this.renderer.render(this.scene, this.camera)
  }

  private loop = () => {
    this.rafId = requestAnimationFrame(this.loop)
    this.material.uniforms.uTime.value = this.clock.getElapsedTime()
    this.renderer.render(this.scene, this.camera)
  }

  dispose() {
    cancelAnimationFrame(this.rafId)
    window.removeEventListener('resize', this.resize)
    this.renderer.dispose()
  }
}
