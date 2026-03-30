import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { HxDesignState } from '../types/vessel'

// ── NPS nominal pipe OD (inches) ─────────────────────────────────────────────
const NPS_OD: Record<string, number> = {
  '1/2': 0.84,  '3/4': 1.05,   '1': 1.315,  '1-1/2': 1.9,
  '2': 2.375,   '3': 3.5,      '4': 4.5,    '6': 6.625,
  '8': 8.625,   '10': 10.75,   '12': 12.75, '14': 14,
  '16': 16,     '18': 18,      '20': 20,    '24': 24,
}
function npsPipeOD(s: string) { return NPS_OD[s] ?? 4.5 }
function neckLen(d: number)   { return d < 2 ? 4 : d < 4 ? 5 : d < 10 ? 6 : 8 }
function flangeThk(d: number) { return d < 2 ? 0.875 : d < 6 ? 1.125 : 1.625 }
function flangeOR(d: number)  { return d * 0.72 + 1.25 }

// ── Dispose ───────────────────────────────────────────────────────────────────
function disposeGroup(g: THREE.Group) {
  g.traverse(o => {
    if (!(o instanceof THREE.Mesh)) return
    o.geometry.dispose()
    const ms = Array.isArray(o.material) ? o.material : [o.material]
    ms.forEach((m: THREE.Material) => m.dispose())
  })
  g.clear()
}

// ── Build heat exchanger ───────────────────────────────────────────────────────
function buildHx(
  grp: THREE.Group,
  cam: THREE.PerspectiveCamera,
  ctl: OrbitControls,
  form: HxDesignState,
  skipCamera = false,
) {
  const isV      = form.orientation === 'vertical'
  const od       = Math.max(parseFloat(form.shellOd) || 24, 6)
  const r        = od / 2
  const L        = Math.max(parseFloat(form.shellLength) || 120, 8)
  const wallThk  = Math.max(r * 0.022, 0.25)
  const tsThk    = Math.max(r * 0.10, 2.0)   // tubesheet thickness

  // ── Materials ──────────────────────────────────────────────────────────────
  const shellMat  = new THREE.MeshStandardMaterial({ color: 0xb4c8d8, metalness: 0.55, roughness: 0.40, transparent: true, opacity: 0.50, side: THREE.DoubleSide })
  const shellSolid = new THREE.MeshStandardMaterial({ color: 0xb4c8d8, metalness: 0.58, roughness: 0.36 })
  const tsMat     = new THREE.MeshStandardMaterial({ color: 0x6070a0, metalness: 0.74, roughness: 0.26 })
  const channMat  = new THREE.MeshStandardMaterial({ color: 0xc0ccd8, metalness: 0.60, roughness: 0.34 })
  const coverMat  = new THREE.MeshStandardMaterial({ color: 0xced8e2, metalness: 0.64, roughness: 0.28 })
  const baffleMat = new THREE.MeshStandardMaterial({ color: 0x7a8ea8, metalness: 0.58, roughness: 0.44 })
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0xd4cfc0, metalness: 0.72, roughness: 0.22 })
  const flangeMat = new THREE.MeshStandardMaterial({ color: 0xe8e4da, metalness: 0.78, roughness: 0.16 })

  // ── Placement helpers ──────────────────────────────────────────────────────
  // placeCyl: position a CylinderGeometry (local Y axis → vessel axis)
  function placeCyl(m: THREE.Mesh, axisCenter: number) {
    if (!isV) { m.rotation.z = -Math.PI / 2; m.position.x = axisCenter }
    else       { m.position.y = axisCenter }
    grp.add(m)
  }
  // placeDisc: position a CircleGeometry (normal → vessel axis direction)
  function placeDisc(m: THREE.Mesh, axisPos: number, facingOut: boolean) {
    if (!isV) { m.rotation.y = facingOut ? Math.PI / 2 : -Math.PI / 2; m.position.x = axisPos }
    else       { m.rotation.x = facingOut ? -Math.PI / 2 : Math.PI / 2; m.position.y = axisPos }
    grp.add(m)
  }
  // placeLath: position a LatheGeometry whose apex is at local +Y
  function placeLath(m: THREE.Mesh, axisPos: number, apexTowardPos: boolean) {
    if (!isV) {
      m.rotation.z = apexTowardPos ? -Math.PI / 2 : Math.PI / 2
      m.position.x = axisPos
    } else {
      if (!apexTowardPos) m.rotation.x = Math.PI
      m.position.y = axisPos
    }
    grp.add(m)
  }

  // ── Shell (semi-transparent so baffles show through) ───────────────────────
  placeCyl(new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 64, 1, true), shellMat), 0)

  // ── Tubesheets (slightly larger OD than shell, solid darker) ───────────────
  placeCyl(new THREE.Mesh(new THREE.CylinderGeometry(r + 1.5, r + 1.5, tsThk, 64), tsMat),  L / 2)
  placeCyl(new THREE.Mesh(new THREE.CylinderGeometry(r + 1.5, r + 1.5, tsThk, 64), tsMat), -L / 2)

  // Close tubesheet inner faces
  placeDisc(new THREE.Mesh(new THREE.CircleGeometry(r, 64), tsMat), L / 2 - tsThk / 2, false)
  placeDisc(new THREE.Mesh(new THREE.CircleGeometry(r, 64), tsMat), -(L / 2 - tsThk / 2), true)

  // ── Channel head builder ───────────────────────────────────────────────────
  const frontType  = form.temaFront || 'A'
  const rearType   = form.temaRear  || 'U'
  const channelLen = Math.max(r * 0.55, 10)

  function mkChannelHead(tsBase: number, isPos: boolean, tipo: string) {
    const sign   = isPos ? 1 : -1
    const chMid  = tsBase + sign * channelLen / 2
    const chEnd  = tsBase + sign * channelLen

    // Channel cylinder
    placeCyl(new THREE.Mesh(new THREE.CylinderGeometry(r + 0.5, r + 0.5, channelLen, 64, 1, true), channMat), chMid)

    if (tipo === 'B') {
      // Bonnet — hemispherical end
      const pts: THREE.Vector2[] = []
      for (let i = 0; i <= 36; i++) {
        const t = (i / 36) * (Math.PI / 2)
        pts.push(new THREE.Vector2((r + 0.5) * Math.cos(t), (r + 0.5) * Math.sin(t)))
      }
      placeLath(new THREE.Mesh(new THREE.LatheGeometry(pts, 64), coverMat), chEnd, isPos)
    } else {
      // Flat cover plate (A, C, N, D)
      const ct = tipo === 'D' ? tsThk * 2.2 : tsThk * 1.1
      placeCyl(new THREE.Mesh(new THREE.CylinderGeometry(r + 1.5, r + 1.5, ct, 64), coverMat), chEnd + sign * ct / 2)
      placeDisc(new THREE.Mesh(new THREE.CircleGeometry(r + 1.5, 64), coverMat), chEnd + sign * ct, isPos)
    }
  }

  // Front channel
  mkChannelHead(L / 2 + tsThk, true, frontType)

  // Rear arrangement
  const FLOATING = ['S', 'T', 'P', 'W']
  const FIXED    = ['L', 'M', 'N']

  if (rearType === 'U') {
    // U-tube — solid face cap behind rear tubesheet
    placeDisc(new THREE.Mesh(new THREE.CircleGeometry(r + 1.5, 64), tsMat), -(L / 2 + tsThk / 2 + 0.1), false)
  } else if (FLOATING.includes(rearType)) {
    // Floating head — dome visible inside shell at rear
    const fhR = r * 0.70
    const pts: THREE.Vector2[] = []
    for (let i = 0; i <= 28; i++) {
      const t = (i / 28) * (Math.PI / 2)
      pts.push(new THREE.Vector2(fhR * Math.cos(t), fhR * Math.sin(t)))
    }
    // Backing ring / split ring flange
    placeCyl(new THREE.Mesh(new THREE.CylinderGeometry(r + 1.5, r + 1.5, tsThk * 0.65, 64), tsMat), -(L / 2 + tsThk * 0.95))
    // Floating head dome (apex points away from shell interior → toward -axis)
    placeLath(new THREE.Mesh(new THREE.LatheGeometry(pts, 48), coverMat), -(L / 2 + tsThk * 0.65), false)
  } else if (FIXED.includes(rearType)) {
    // Fixed rear — mirror of front
    mkChannelHead(-(L / 2 + tsThk), false, frontType)
  } else {
    // Unknown — just close it
    placeDisc(new THREE.Mesh(new THREE.CircleGeometry(r + 1.5, 64), tsMat), -(L / 2 + tsThk / 2), false)
  }

  // ── Baffles (visible through transparent shell) ────────────────────────────
  const bSpacing = Math.max(parseFloat(form.baffleSpacing) || L / 6, 4)
  const bCount   = Math.min(Math.max(0, Math.floor(L / bSpacing) - 1), 40)
  if (bCount > 0) {
    const bGeo = new THREE.CylinderGeometry(r * 0.98 - wallThk, r * 0.98 - wallThk, 0.6, 64, 1, false)
    for (let i = 1; i <= bCount; i++) {
      const pos = -L / 2 + (i / (bCount + 1)) * L
      placeCyl(new THREE.Mesh(bGeo, baffleMat), pos)
    }
  }

  // ── Nozzle helpers ─────────────────────────────────────────────────────────
  function addShellNozzle_H(xPos: number, theta: number, pipeOD: number) {
    const pr = pipeOD / 2, nL = neckLen(pipeOD), fT = flangeThk(pipeOD), fR = flangeOR(pipeOD)
    const ny = Math.cos(theta), nz = Math.sin(theta)
    function addCyl(rTop: number, rBot: number, height: number, dist: number, mat: THREE.MeshStandardMaterial) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, height, rTop > 2 ? 32 : 16), mat)
      m.position.set(xPos, (r + dist) * ny, (r + dist) * nz)
      m.rotation.x = theta
      grp.add(m)
    }
    const padH = wallThk * 2.8
    addCyl(pr * 1.6, pr * 1.6, padH, padH * 0.35, shellSolid)
    addCyl(pr, pr, nL, nL / 2, nozzleMat)
    addCyl(fR, fR, fT, nL + fT / 2, flangeMat)
    addCyl(pr * 1.25 + 0.25, pr * 1.25 + 0.25, 0.12, nL + fT + 0.06, flangeMat)
  }

  function addShellNozzle_V(yPos: number, theta: number, pipeOD: number) {
    const pr = pipeOD / 2, nL = neckLen(pipeOD), fT = flangeThk(pipeOD), fR = flangeOR(pipeOD)
    const nx = Math.cos(theta), nz = Math.sin(theta)
    const rotAxis = new THREE.Vector3(nz, 0, -nx)
    function addCyl(rTop: number, rBot: number, height: number, dist: number, mat: THREE.MeshStandardMaterial) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, height, rTop > 2 ? 32 : 16), mat)
      m.position.set((r + dist) * nx, yPos, (r + dist) * nz)
      m.setRotationFromAxisAngle(rotAxis, Math.PI / 2)
      grp.add(m)
    }
    const padH = wallThk * 2.8
    addCyl(pr * 1.6, pr * 1.6, padH, padH * 0.35, shellSolid)
    addCyl(pr, pr, nL, nL / 2, nozzleMat)
    addCyl(fR, fR, fT, nL + fT / 2, flangeMat)
    addCyl(pr * 1.25 + 0.25, pr * 1.25 + 0.25, 0.12, nL + fT + 0.06, flangeMat)
  }

  function addHeadNozzle_H(headX: number, yOff: number, zOff: number, rotZ: number, pipeOD: number) {
    const pr = pipeOD / 2, nL = neckLen(pipeOD), fT = flangeThk(pipeOD), fR = flangeOR(pipeOD)
    const sign = rotZ < 0 ? 1 : -1
    function addCyl(rTop: number, height: number, dist: number, mat: THREE.MeshStandardMaterial) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rTop, height, rTop > 2 ? 32 : 16), mat)
      m.rotation.z = rotZ
      m.position.set(headX + sign * dist, yOff, zOff)
      grp.add(m)
    }
    const padH = wallThk * 2.8
    addCyl(pr * 1.6, padH, padH * 0.35, channMat)
    addCyl(pr, nL, nL / 2 + wallThk, nozzleMat)
    addCyl(fR, fT, nL + fT / 2 + wallThk, flangeMat)
    addCyl(pr * 1.25 + 0.25, 0.12, nL + fT + 0.06 + wallThk, flangeMat)
  }

  function addHeadNozzle_V(headY: number, xOff: number, zOff: number, sign: 1 | -1, pipeOD: number) {
    const pr = pipeOD / 2, nL = neckLen(pipeOD), fT = flangeThk(pipeOD), fR = flangeOR(pipeOD)
    function addCyl(rTop: number, height: number, dist: number, mat: THREE.MeshStandardMaterial) {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rTop, height, rTop > 2 ? 32 : 16), mat)
      m.position.set(xOff, headY + sign * dist, zOff)
      grp.add(m)
    }
    const padH = wallThk * 2.8
    addCyl(pr * 1.6, padH, padH * 0.35, channMat)
    addCyl(pr, nL, nL / 2 + wallThk, nozzleMat)
    addCyl(fR, fT, nL + fT / 2 + wallThk, flangeMat)
    addCyl(pr * 1.25 + 0.25, 0.12, nL + fT + 0.06 + wallThk, flangeMat)
  }

  // ── Place nozzles ──────────────────────────────────────────────────────────
  const shellNzls = form.nozzles.filter(n => n.location === 'shell')
  const posNzls   = form.nozzles.filter(n => n.location === 'right_head') // front channel
  const negNzls   = form.nozzles.filter(n => n.location === 'left_head')  // rear

  shellNzls.forEach((nz, i) => {
    const count = shellNzls.length
    const angleDeg = nz.shellAngle !== null && nz.shellAngle !== undefined
      ? nz.shellAngle
      : (i / count) * 360
    const theta    = (angleDeg * Math.PI) / 180
    const axisPos  = count === 1 ? 0 : ((i / (count - 1)) * 0.6 - 0.3) * L
    if (isV) addShellNozzle_V(axisPos, theta, npsPipeOD(nz.size))
    else     addShellNozzle_H(axisPos, theta, npsPipeOD(nz.size))
  })

  // Front cover face position
  const frontCoverExt = (frontType === 'B' ? (r + 0.5) : tsThk * 1.1) + channelLen
  const frontFacePos  = L / 2 + tsThk + frontCoverExt

  // Rear face position
  const rearFacePos = FIXED.includes(rearType)
    ? -(L / 2 + tsThk + frontCoverExt)
    : -(L / 2 + tsThk + 2)

  const placeEndNozzles = (nzls: typeof posNzls, facePos: number, isPos: boolean) => {
    nzls.forEach((nz, i) => {
      const count    = nzls.length
      const isOffset = nz.headPos === 'offset' || count > 1
      const offsetR  = isOffset ? Math.min(r * 0.28, 7) : 0
      const angle    = count > 1 ? (i / count) * Math.PI * 2 : 0
      const yOff     = isOffset ? offsetR * Math.cos(angle) : 0
      const zOff     = isOffset ? offsetR * Math.sin(angle) : 0
      if (isV) addHeadNozzle_V(facePos, yOff, zOff, isPos ? 1 : -1, npsPipeOD(nz.size))
      else     addHeadNozzle_H(facePos, yOff, zOff, isPos ? -Math.PI / 2 : Math.PI / 2, npsPipeOD(nz.size))
    })
  }

  placeEndNozzles(posNzls, frontFacePos, true)
  placeEndNozzles(negNzls, rearFacePos, false)

  // ── Camera ────────────────────────────────────────────────────────────────
  if (!skipCamera) {
    const frontExt = tsThk + frontCoverExt + 6
    const rearExt  = FIXED.includes(rearType) ? tsThk + frontCoverExt + 6 : tsThk + 10

    const fov = (38 * Math.PI) / 180
    cam.fov = 38; cam.near = 0.5; cam.far = 6000; cam.up.set(0, 1, 0)

    if (isV) {
      const topY    = L / 2 + frontExt
      const bottomY = -(L / 2 + rearExt)
      const centerY = (topY + bottomY) / 2
      const halfH   = (topY - bottomY) / 2
      const boundR  = Math.sqrt((r + 6) ** 2 + halfH ** 2)
      const dist    = (boundR / Math.sin(fov / 2)) * 1.4
      cam.position.set(r * 0.4 + od * 0.22, centerY, dist * 1.15)
      cam.near = boundR * 0.003; cam.far = dist * 8
      cam.updateProjectionMatrix()
      ctl.target.set(0, centerY, 0)
    } else {
      const halfX  = L / 2 + Math.max(frontExt, rearExt) + 2
      const maxR   = r + 6
      const boundR = Math.sqrt(halfX ** 2 + maxR ** 2)
      const dist   = (boundR / Math.sin(fov / 2)) * 1.08
      cam.position.set(halfX * 0.06, maxR * 0.46, dist * 0.92)
      cam.near = boundR * 0.003; cam.far = dist * 8
      cam.updateProjectionMatrix()
      ctl.target.set(0, 0, 0)
    }
    ctl.update()
  }
}

// ── Component ─────────────────────────────────────────────────────────────────
type ViewMode = '3d' | 'top' | 'bottom'

interface HxCtx {
  renderer: THREE.WebGLRenderer
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  hxGroup: THREE.Group
  grid: THREE.GridHelper
  frameId: number
}

export default function HeatExchangerViewer({ form }: { form: HxDesignState }) {
  const mountRef    = useRef<HTMLDivElement>(null)
  const ctxRef      = useRef<HxCtx | null>(null)
  const viewModeRef = useRef<ViewMode>('3d')
  const [viewMode, setViewMode] = useState<ViewMode>('3d')

  // Scene init (runs once)
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false })
    renderer.setPixelRatio(window.devicePixelRatio)
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.setClearColor(0x0a1520)
    mount.appendChild(renderer.domElement)

    const camera = new THREE.PerspectiveCamera(38, mount.clientWidth / mount.clientHeight, 0.5, 6000)
    camera.position.set(0, 30, 200)

    const scene = new THREE.Scene()
    scene.add(new THREE.AmbientLight(0xc8d8e8, 0.55))

    const key = new THREE.DirectionalLight(0xffffff, 0.9)
    key.position.set(80, 130, 160)
    key.castShadow = true
    key.shadow.mapSize.set(2048, 2048)
    key.shadow.camera.left   = -350; key.shadow.camera.right  = 350
    key.shadow.camera.top    =  220; key.shadow.camera.bottom = -220
    key.shadow.camera.near   = 10;   key.shadow.camera.far    = 900
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x7090b0, 0.48)
    fill.position.set(-160, 70, -110)
    scene.add(fill)
    const rim = new THREE.DirectionalLight(0xa8c0d8, 0.28)
    rim.position.set(0, -120, -220)
    scene.add(rim)

    const grid = new THREE.GridHelper(2400, 64, 0x182838, 0x101e2c)
    grid.position.y = -80
    scene.add(grid)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping  = true
    controls.dampingFactor  = 0.06
    controls.minDistance    = 4
    controls.maxDistance    = 2400
    controls.maxPolarAngle  = Math.PI * 0.88

    const hxGroup = new THREE.Group()
    scene.add(hxGroup)

    let frameId = 0
    const animate = () => { frameId = requestAnimationFrame(animate); controls.update(); renderer.render(scene, camera) }
    animate()

    const ro = new ResizeObserver(() => {
      if (!mount) return
      camera.aspect = mount.clientWidth / mount.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(mount.clientWidth, mount.clientHeight)
    })
    ro.observe(mount)

    ctxRef.current = { renderer, camera, controls, hxGroup, grid, frameId }

    return () => {
      cancelAnimationFrame(frameId)
      ro.disconnect()
      controls.dispose()
      disposeGroup(hxGroup)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  // Rebuild when form changes
  useEffect(() => {
    const ctx = ctxRef.current
    if (!ctx) return
    const inOrtho = viewModeRef.current !== '3d'
    disposeGroup(ctx.hxGroup)
    buildHx(ctx.hxGroup, ctx.camera, ctx.controls, form, inOrtho)
    if (inOrtho) switchView(viewModeRef.current)

    const od = Math.max(parseFloat(form.shellOd) || 24, 6)
    ctx.grid.position.y = -(od / 2 + 10)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  function switchView(mode: ViewMode) {
    const ctx = ctxRef.current
    if (!ctx) return
    viewModeRef.current = mode
    setViewMode(mode)

    const od = Math.max(parseFloat(form.shellOd) || 24, 6)
    const L  = Math.max(parseFloat(form.shellLength) || 120, 8)

    if (mode === '3d') {
      disposeGroup(ctx.hxGroup)
      buildHx(ctx.hxGroup, ctx.camera, ctx.controls, form, false)
    } else {
      const size = Math.max(od * 1.5, L * 1.2, 80)
      const dist = size * 14
      const sign = mode === 'top' ? 1 : -1
      ctx.camera.fov  = 5
      ctx.camera.near = dist * 0.04
      ctx.camera.far  = dist * 3
      ctx.camera.up.set(0, 0, -1)
      ctx.camera.updateProjectionMatrix()
      ctx.camera.position.set(0.01, sign * dist, 0)
      ctx.controls.target.set(0, 0, 0)
      ctx.controls.update()
    }
  }

  const btnBase    = 'text-xs font-medium px-2.5 py-1 rounded transition-colors select-none'
  const btnActive  = 'bg-slate-200 text-slate-900'
  const btnInactive = 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100'

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" style={{ touchAction: 'none' }} />
      <div className="absolute top-3 left-3 flex gap-1.5">
        {([['3d', '3D View'], ['top', 'Top View'], ['bottom', 'Bottom View']] as [ViewMode, string][]).map(
          ([mode, label]) => (
            <button key={mode} onClick={() => switchView(mode)}
              className={`${btnBase} ${viewMode === mode ? btnActive : btnInactive}`}>
              {label}
            </button>
          )
        )}
      </div>
    </div>
  )
}
