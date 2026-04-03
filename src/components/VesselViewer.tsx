import { useRef, useEffect, useState } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import type { VesselDesignState } from '../types/vessel'

// ── NPS nominal pipe OD (inches) ─────────────────────────────────────────────
const NPS_OD: Record<string, number> = {
  '1/2': 0.84, '3/4': 1.05, '1': 1.315, '1-1/2': 1.9,
  '2': 2.375,  '3': 3.5,   '4': 4.5,   '6': 6.625,
  '8': 8.625,  '10': 10.75, '12': 12.75, '14': 14,
  '16': 16,    '18': 18,   '20': 20,   '24': 24,
}
function npsPipeOD(size: string) { return NPS_OD[size] ?? 4.5 }
function neckLen(od: number)    { return od < 2 ? 4 : od < 4 ? 5 : od < 10 ? 6 : 8 }
function flangeThk(od: number)  { return od < 2 ? 0.875 : od < 6 ? 1.125 : 1.625 }
function flangeOR(od: number)   { return od * 0.72 + 1.25 }

// ── Head profile (LatheGeometry rotates around Y; rim at y=0, apex at y=depth) ─
function headPoints(r: number, ht: string): THREE.Vector2[] {
  const n = 48, pts: THREE.Vector2[] = []
  if (ht === 'Hemispherical') {
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * (Math.PI / 2)
      pts.push(new THREE.Vector2(r * Math.cos(t), r * Math.sin(t)))
    }
  } else if (ht === 'ASME F&D' || ht === 'Torispherical') {
    const d = r * 0.338
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * (Math.PI / 2)
      pts.push(new THREE.Vector2(r * Math.cos(t), d * Math.sin(t)))
    }
  } else if (ht === 'Flat') {
    const tk = Math.max(r * 0.045, 0.5)
    pts.push(new THREE.Vector2(r, 0))
    pts.push(new THREE.Vector2(r, tk * 0.6))
    pts.push(new THREE.Vector2(r * 0.05, tk))
    pts.push(new THREE.Vector2(0, tk))
  } else {
    const d = r / 2 // 2:1 Elliptical
    for (let i = 0; i <= n; i++) {
      const t = (i / n) * (Math.PI / 2)
      pts.push(new THREE.Vector2(r * Math.cos(t), d * Math.sin(t)))
    }
  }
  return pts
}
function headDepth(r: number, ht: string) {
  if (ht === 'Hemispherical') return r
  if (ht === 'ASME F&D' || ht === 'Torispherical') return r * 0.338
  if (ht === 'Flat') return Math.max(r * 0.045, 0.5)
  return r / 2
}

// ── Dispose ───────────────────────────────────────────────────────────────────
function disposeGroup(g: THREE.Group) {
  g.traverse((o) => {
    if (!(o instanceof THREE.Mesh)) return
    o.geometry.dispose()
    const ms = Array.isArray(o.material) ? o.material : [o.material]
    ms.forEach((m: THREE.Material) => m.dispose())
  })
  g.clear()
}

// ── Camera fit ────────────────────────────────────────────────────────────────
function fitCamera(
  cam: THREE.PerspectiveCamera,
  ctl: OrbitControls,
  isV: boolean,
  od: number,
  shellLen: number,
  hd: number,
  supportExtent: number,
  extraRadial = 0,
) {
  const r = od / 2
  const fov = (cam.fov * Math.PI) / 180

  // Restore to perspective defaults in case we were in a top/bottom view
  cam.fov = 38
  cam.near = 0.5
  cam.far  = 6000
  cam.up.set(0, 1, 0)

  if (isV) {
    // Vertical: vessel height along Y
    const halfH = shellLen / 2 + hd
    const radBound = r + extraRadial + 4
    const boundR = Math.sqrt(radBound ** 2 + (halfH + supportExtent + 4) ** 2)
    const dist = (boundR / Math.sin(fov / 2)) * 1.4
    const topY = shellLen / 2 + hd
    const bottomY = -(shellLen / 2 + hd + supportExtent)
    const centerY = (topY + bottomY) / 2 - supportExtent * 0.6
    cam.position.set(r * 0.4 + od * 0.22, centerY, dist * 1.15)
    cam.near = boundR * 0.003; cam.far = dist * 8
    cam.updateProjectionMatrix()
    ctl.target.set(0, centerY, 0)
  } else {
    // Horizontal: vessel axis along X
    const halfX = shellLen / 2 + hd
    const maxR = r + supportExtent + extraRadial + 4
    const boundR = Math.sqrt(halfX ** 2 + maxR ** 2)
    const dist = (boundR / Math.sin(fov / 2)) * 1.08
    cam.position.set(halfX * 0.06, maxR * 0.46, dist * 0.92)
    cam.near = boundR * 0.003; cam.far = dist * 8
    cam.updateProjectionMatrix()
    ctl.target.set(0, -supportExtent * 0.22, 0)
  }
  ctl.update()
}

// ── Build vessel ──────────────────────────────────────────────────────────────
function buildVessel(
  grp: THREE.Group,
  cam: THREE.PerspectiveCamera,
  ctl: OrbitControls,
  form: VesselDesignState,
  skipCamera = false,
) {
  const isV = form.orientation === 'vertical'
  const od = Math.max(parseFloat(form.shellOd) || 48, 6)
  const r = od / 2
  const L = Math.max(parseFloat(form.shellLength) || 120, 8)
  const ht = form.headType || '2:1 Elliptical'
  const hd = headDepth(r, ht)
  const saddleH = Math.max(r * 0.20, 6)
  const saddleW = Math.max(r * 0.30, 6)
  const wallThk = Math.max(r * 0.022, 0.25)

  // ── Materials ──────────────────────────────────────────────────────────────
  const vesselMat = new THREE.MeshStandardMaterial({ color: 0xb4c8d8, metalness: 0.62, roughness: 0.32 })
  const nozzleMat = new THREE.MeshStandardMaterial({ color: 0xd4cfc0, metalness: 0.72, roughness: 0.22 })
  const flangeMat = new THREE.MeshStandardMaterial({ color: 0xe8e4da, metalness: 0.78, roughness: 0.16 })
  const suppSolid = new THREE.MeshStandardMaterial({ color: 0x7e8c96, metalness: 0.44, roughness: 0.62 })
  // Skirt-specific materials — more visible against dark background
  const skirtMat    = new THREE.MeshStandardMaterial({ color: 0xd8dde2, metalness: 0.30, roughness: 0.72, side: THREE.DoubleSide })
  const baseRingMat = new THREE.MeshStandardMaterial({ color: 0xe0e4e8, metalness: 0.40, roughness: 0.55 })
  const baseRingDS  = new THREE.MeshStandardMaterial({ color: 0xe0e4e8, metalness: 0.40, roughness: 0.55, side: THREE.DoubleSide })
  // Saddle-specific materials
  const saddleMat   = new THREE.MeshStandardMaterial({ color: 0xb0bcc8, metalness: 0.48, roughness: 0.55, side: THREE.DoubleSide })
  const saddleSolid = new THREE.MeshStandardMaterial({ color: 0xb0bcc8, metalness: 0.48, roughness: 0.55 })
  // Sight glass — warm amber/bronze, visually distinct from steel nozzles
  const sightGlassMat = new THREE.MeshStandardMaterial({ color: 0x8B6914, metalness: 0.15, roughness: 0.80 })

  // ── Shell ──────────────────────────────────────────────────────────────────
  // Horizontal: rotation.z = −π/2 rotates CylinderGeometry's Y-axis to world +X.
  // Vertical:   no rotation — CylinderGeometry is already along Y.
  const shellMesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, L, 64, 1, true), vesselMat)
  if (!isV) shellMesh.rotation.z = -Math.PI / 2
  grp.add(shellMesh)

  // End caps (hidden behind heads, close tube ends)
  const capGeo = new THREE.CircleGeometry(r, 64)
  const mkCap = (posAxis: number, facingUp: boolean) => {
    const cap = new THREE.Mesh(capGeo, vesselMat)
    if (isV) {
      cap.rotation.x = facingUp ? -Math.PI / 2 : Math.PI / 2
      cap.position.y = posAxis
    } else {
      cap.rotation.y = facingUp ? Math.PI / 2 : -Math.PI / 2
      cap.position.x = posAxis
    }
    grp.add(cap)
  }
  mkCap(L / 2, true)
  mkCap(-L / 2, false)

  // ── Heads ──────────────────────────────────────────────────────────────────
  // Horizontal right (right_head = +X side):
  //   rotation.z = −π/2 maps LatheGeometry's +Y apex to world +X.
  // Horizontal left (left_head = −X side):
  //   rotation.z = +π/2 maps apex to world −X.
  // Vertical top (right_head = +Y side):
  //   No rotation — LatheGeometry apex naturally points +Y.
  // Vertical bottom (left_head = −Y side):
  //   rotation.x = π flips apex to −Y.
  const headGeo = new THREE.LatheGeometry(headPoints(r, ht), 64)

  const mkHead = (axisPos: number, isPositiveSide: boolean) => {
    const h = new THREE.Mesh(headGeo, vesselMat)
    if (isV) {
      if (!isPositiveSide) h.rotation.x = Math.PI
      h.position.y = axisPos
    } else {
      h.rotation.z = isPositiveSide ? -Math.PI / 2 : Math.PI / 2
      h.position.x = axisPos
    }
    grp.add(h)
  }
  mkHead(L / 2, true)   // right / top
  mkHead(-L / 2, false) // left  / bottom


  // ── Nozzle helpers ─────────────────────────────────────────────────────────

  // Shell nozzle — HORIZONTAL:
  //   theta in YZ plane, 0 = top (+Y), rotation.x = theta.
  function addShellNozzle_H(xPos: number, theta: number, pipeOD: number) {
    const pr = pipeOD / 2, nL = neckLen(pipeOD), fT = flangeThk(pipeOD), fR = flangeOR(pipeOD)
    const ny = Math.cos(theta), nz = Math.sin(theta)

    const addCyl = (rTop: number, rBot: number, height: number, dist: number, mat: THREE.MeshStandardMaterial) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, height, rTop > 2 ? 32 : 16), mat)
      m.position.set(xPos, (r + dist) * ny, (r + dist) * nz)
      m.rotation.x = theta
      grp.add(m)
    }
    const padH = wallThk * 2.8
    addCyl(pr * 1.6, pr * 1.6, padH, padH * 0.35, vesselMat)
    addCyl(pr, pr, nL, nL / 2, nozzleMat)
    addCyl(fR, fR, fT, nL + fT / 2, flangeMat)
    addCyl(pr * 1.25 + 0.25, pr * 1.25 + 0.25, 0.12, nL + fT + 0.06, flangeMat)
  }

  // Shell nozzle — VERTICAL:
  //   theta in XZ plane, 0 = +X (front). Rotates CylinderGeometry's Y-axis to (cos θ, 0, sin θ).
  //   Rotation axis = (sin θ, 0, −cos θ), angle = π/2 (always, since target is in XZ plane).
  function addShellNozzle_V(yPos: number, theta: number, pipeOD: number) {
    const pr = pipeOD / 2, nL = neckLen(pipeOD), fT = flangeThk(pipeOD), fR = flangeOR(pipeOD)
    const nx = Math.cos(theta), nz = Math.sin(theta)
    const rotAxis = new THREE.Vector3(nz, 0, -nx) // normalized: ||(nz,0,-nx)|| = 1

    const addCyl = (rTop: number, rBot: number, height: number, dist: number, mat: THREE.MeshStandardMaterial) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rBot, height, rTop > 2 ? 32 : 16), mat)
      m.position.set((r + dist) * nx, yPos, (r + dist) * nz)
      m.setRotationFromAxisAngle(rotAxis, Math.PI / 2)
      grp.add(m)
    }
    const padH = wallThk * 2.8
    addCyl(pr * 1.6, pr * 1.6, padH, padH * 0.35, vesselMat)
    addCyl(pr, pr, nL, nL / 2, nozzleMat)
    addCyl(fR, fR, fT, nL + fT / 2, flangeMat)
    addCyl(pr * 1.25 + 0.25, pr * 1.25 + 0.25, 0.12, nL + fT + 0.06, flangeMat)
  }

  // Head nozzle — HORIZONTAL: axial along ±X.
  //   rotZ = −π/2 → right head (+X); rotZ = +π/2 → left head (−X).
  function addHeadNozzle_H(headX: number, yOff: number, zOff: number, rotZ: number, pipeOD: number) {
    const pr = pipeOD / 2, nL = neckLen(pipeOD), fT = flangeThk(pipeOD), fR = flangeOR(pipeOD)
    const sign = rotZ < 0 ? 1 : -1

    const addCyl = (rTop: number, height: number, dist: number, mat: THREE.MeshStandardMaterial) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rTop, height, rTop > 2 ? 32 : 16), mat)
      m.rotation.z = rotZ
      m.position.set(headX + sign * dist, yOff, zOff)
      grp.add(m)
    }
    const padH = wallThk * 2.8
    addCyl(pr * 1.6, padH, padH * 0.35, vesselMat)
    addCyl(pr, nL, nL / 2 + wallThk, nozzleMat)
    addCyl(fR, fT, nL + fT / 2 + wallThk, flangeMat)
    addCyl(pr * 1.25 + 0.25, 0.12, nL + fT + 0.06 + wallThk, flangeMat)
  }

  // Head nozzle — VERTICAL: axial along ±Y.
  //   CylinderGeometry is already along Y — no rotation needed, just sign the position.
  function addHeadNozzle_V(headY: number, xOff: number, zOff: number, sign: 1 | -1, pipeOD: number) {
    const pr = pipeOD / 2, nL = neckLen(pipeOD), fT = flangeThk(pipeOD), fR = flangeOR(pipeOD)

    const addCyl = (rTop: number, height: number, dist: number, mat: THREE.MeshStandardMaterial) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rTop, height, rTop > 2 ? 32 : 16), mat)
      m.position.set(xOff, headY + sign * dist, zOff)
      grp.add(m)
    }
    const padH = wallThk * 2.8
    addCyl(pr * 1.6, padH, padH * 0.35, vesselMat)
    addCyl(pr, nL, nL / 2 + wallThk, nozzleMat)
    addCyl(fR, fT, nL + fT / 2 + wallThk, flangeMat)
    addCyl(pr * 1.25 + 0.25, 0.12, nL + fT + 0.06 + wallThk, flangeMat)
  }

  // ── Sight glass nozzle helpers (~2" projection, amber material) ─────────────

  function addSightGlassShell_H(xPos: number, theta: number, pipeOD: number) {
    const pr = pipeOD / 2, fR = flangeOR(pipeOD) * 0.7
    const ny = Math.cos(theta), nz = Math.sin(theta)
    const nL = 2
    const addCyl = (rTop: number, height: number, dist: number, mat: THREE.MeshStandardMaterial) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rTop, height, 24), mat)
      m.position.set(xPos, (r + dist) * ny, (r + dist) * nz)
      m.rotation.x = theta
      grp.add(m)
    }
    const padH = wallThk * 2.8
    addCyl(pr * 1.6, padH, padH * 0.35, vesselMat)
    addCyl(pr, nL, nL / 2, sightGlassMat)
    addCyl(fR, 0.75, nL + 0.375, sightGlassMat)
  }

  function addSightGlassShell_V(yPos: number, theta: number, pipeOD: number) {
    const pr = pipeOD / 2, fR = flangeOR(pipeOD) * 0.7
    const nx = Math.cos(theta), nz = Math.sin(theta)
    const rotAxis = new THREE.Vector3(nz, 0, -nx)
    const nL = 2
    const addCyl = (rTop: number, height: number, dist: number, mat: THREE.MeshStandardMaterial) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rTop, height, 24), mat)
      m.position.set((r + dist) * nx, yPos, (r + dist) * nz)
      m.setRotationFromAxisAngle(rotAxis, Math.PI / 2)
      grp.add(m)
    }
    const padH = wallThk * 2.8
    addCyl(pr * 1.6, padH, padH * 0.35, vesselMat)
    addCyl(pr, nL, nL / 2, sightGlassMat)
    addCyl(fR, 0.75, nL + 0.375, sightGlassMat)
  }

  function addSightGlassHead_H(headX: number, yOff: number, zOff: number, rotZ: number, pipeOD: number) {
    const pr = pipeOD / 2, fR = flangeOR(pipeOD) * 0.7
    const sign = rotZ < 0 ? 1 : -1
    const nL = 2
    const addCyl = (rTop: number, height: number, dist: number, mat: THREE.MeshStandardMaterial) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rTop, height, 24), mat)
      m.rotation.z = rotZ
      m.position.set(headX + sign * dist, yOff, zOff)
      grp.add(m)
    }
    const padH = wallThk * 2.8
    addCyl(pr * 1.6, padH, padH * 0.35, vesselMat)
    addCyl(pr, nL, nL / 2 + wallThk, sightGlassMat)
    addCyl(fR, 0.75, nL + 0.375 + wallThk, sightGlassMat)
  }

  function addSightGlassHead_V(headY: number, xOff: number, zOff: number, sign: 1 | -1, pipeOD: number) {
    const pr = pipeOD / 2, fR = flangeOR(pipeOD) * 0.7
    const nL = 2
    const addCyl = (rTop: number, height: number, dist: number, mat: THREE.MeshStandardMaterial) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(rTop, rTop, height, 24), mat)
      m.position.set(xOff, headY + sign * dist, zOff)
      grp.add(m)
    }
    const padH = wallThk * 2.8
    addCyl(pr * 1.6, padH, padH * 0.35, vesselMat)
    addCyl(pr, nL, nL / 2 + wallThk, sightGlassMat)
    addCyl(fR, 0.75, nL + 0.375 + wallThk, sightGlassMat)
  }

  // ── Manway OD helper — parse '20"' → 20, fall back to 20 ─────────────────
  function manwayOD(nz: typeof form.nozzles[0]): number {
    const raw = (nz.manwaySize ?? '20"').replace(/['"]/g, '')
    return parseFloat(raw) || 20
  }

  // ── Place nozzles ──────────────────────────────────────────────────────────
  // DB values kept as 'left_head' / 'right_head' in both orientations.
  // Semantically: right_head = positive-axis end (+X horizontal, +Y vertical).
  //               left_head  = negative-axis end.
  const shellNzls = form.nozzles.filter((n) => n.location === 'shell')
  const posNzls   = form.nozzles.filter((n) => n.location === 'right_head') // +axis end
  const negNzls   = form.nozzles.filter((n) => n.location === 'left_head')  // −axis end

  // When vertical vessel has lugs, offset auto-distributed nozzles by 45° so they
  // land between lugs (at 45°/135°/225°/315°) rather than on them (0°/90°/180°/270°).
  const lugAngleOffset = (isV && form.supportType === 'lugs') ? 45 : 0

  shellNzls.forEach((nz, i) => {
    const count = shellNzls.length
    const angleDeg = nz.shellAngle !== null && nz.shellAngle !== undefined
      ? nz.shellAngle
      : (i / count) * 360 + lugAngleOffset
    const theta = (angleDeg * Math.PI) / 180
    const axisPos = count === 1 ? 0 : ((i / (count - 1)) * 0.6 - 0.3) * L

    if (nz.nozzleType === 'sight_glass') {
      if (isV) addSightGlassShell_V(axisPos, theta, npsPipeOD(nz.size))
      else     addSightGlassShell_H(axisPos, theta, npsPipeOD(nz.size))
    } else if (nz.nozzleType === 'manway') {
      const od = manwayOD(nz)
      // Horizontal: manways on the side (theta=π/2), never on top (theta=0)
      // Vertical: apply same lug offset as standard nozzles; also shift elevation below lug zone
      const mTheta = !isV ? Math.PI / 2 : theta
      const mAxisPos = (isV && form.supportType === 'lugs') ? -(L * 0.35) : axisPos
      if (isV) addShellNozzle_V(mAxisPos, mTheta, od)
      else     addShellNozzle_H(axisPos, mTheta, od)
    } else {
      const od = npsPipeOD(nz.size)
      if (isV) addShellNozzle_V(axisPos, theta, od)
      else     addShellNozzle_H(axisPos, theta, od)
    }
  })

  // Counter for redirected vertical-vessel head manways → shell side placement
  let vHeadManwayIdx = 0

  const placeEndNozzles = (nzls: typeof posNzls, apexPos: number, isPos: boolean) => {
    nzls.forEach((nz, i) => {
      const count = nzls.length
      const isOffset = nz.headPos === 'offset' || count > 1
      const offsetR = isOffset ? Math.min(r * 0.28, 7) : 0
      const ang = (i / Math.max(count, 1)) * Math.PI * 2
      const off1 = offsetR * Math.cos(ang)
      const off2 = offsetR * Math.sin(ang)

      if (nz.nozzleType === 'sight_glass') {
        if (isV) addSightGlassHead_V(apexPos, off1, off2, isPos ? 1 : -1, npsPipeOD(nz.size))
        else     addSightGlassHead_H(apexPos, off1, off2, isPos ? -Math.PI / 2 : Math.PI / 2, npsPipeOD(nz.size))
      } else if (nz.nozzleType === 'manway' && isV) {
        // Vertical vessels: redirect head manways to shell side rather than top/bottom heads
        const od = manwayOD(nz)
        const baseAngle = form.supportType === 'lugs' ? Math.PI / 4 : Math.PI / 2
        const mTheta = (vHeadManwayIdx % 2 === 0) ? baseAngle : baseAngle + Math.PI
        const mY = -(L / 4) - Math.floor(vHeadManwayIdx / 2) * L * 0.12
        addShellNozzle_V(mY, mTheta, od)
        vHeadManwayIdx++
      } else {
        const od = nz.nozzleType === 'manway' ? manwayOD(nz) : npsPipeOD(nz.size)
        if (isV) addHeadNozzle_V(apexPos, off1, off2, isPos ? 1 : -1, od)
        else     addHeadNozzle_H(apexPos, off1, off2, isPos ? -Math.PI / 2 : Math.PI / 2, od)
      }
    })
  }

  const posApex = isV ? L / 2 + hd : L / 2 + hd   // same value, different axis semantics
  const negApex = isV ? -(L / 2 + hd) : -(L / 2 + hd)
  placeEndNozzles(posNzls, posApex, true)
  placeEndNozzles(negNzls, negApex, false)

  // ── Supports ───────────────────────────────────────────────────────────────
  // The form enforces: horizontal → saddles only; vertical → skirt/legs/lugs only.
  // supportExtent = how far the supports extend beyond the vessel's outer boundary.
  let supportExtent = 0
  let extraRadial   = 0  // extra radial spread beyond vessel OD (for camera)

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  SADDLE GEOMETRY - LOCKED. DO NOT MODIFY WITHOUT EXPLICIT       ║
  // ║  WRITTEN PERMISSION FROM BRET MUNDT. THIS TOOK A LONG TIME     ║
  // ║  TO GET RIGHT. ANY CHANGE REQUIRES CONFIRMATION BEFORE CODING. ║
  // ╚══════════════════════════════════════════════════════════════════╝

  // ── Saddles (horizontal only) ──────────────────────────────────────────────
  // Each saddle: two trapezoidal end plates (ShapeGeometry) + web panel (BoxGeometry) + base plate.
  // End plates face along vessel axis (X). Web panel is thin in Z, saddleW wide in X.
  if (form.supportType === 'saddles') {
    supportExtent = saddleH
    const baseThk = Math.max(2.0, r * 0.03)

    // Tangent points at 4 o'clock (330°) and 8 o'clock (210°) on vessel circle.
    // In local shape coords (x→worldZ, y→worldY after rotation.y=-π/2):
    //   tanZ = r·sin(60°) = r·√3/2,  tanY = r·cos(180°+60°) = -r/2
    const tanZ =  r * Math.sqrt(3) / 2   // ±Z of tangent points
    const tanY = -r / 2                   // Y of tangent points (above vessel bottom)

    // Web spans from base plate top up to the tangent points
    const webBot     = -(r + saddleH - baseThk)   // Y at top of base plate
    const baseY      = -(r + saddleH - baseThk / 2)
    const webPanelH  = tanY - webBot               // height of the rectangular side panel
    const webPanelY  = (tanY + webBot) / 2

    // Base plate Z spans tangent points ± margin
    const baseZW = tanZ * 2 + 8

    // End plate: solid trapezoid with curved top, defined in shape local XY.
    // After rotation.y = -π/2: shape.x → world Z, shape.y → world Y.
    const makeEndPlate = (): THREE.ShapeGeometry => {
      const shape = new THREE.Shape()
      // Trace CCW: start bottom-left, go right, up to right tangent,
      // CW arc through vessel bottom to left tangent, close down.
      shape.moveTo(-tanZ, webBot)             // bottom-left
      shape.lineTo( tanZ, webBot)             // bottom-right
      shape.lineTo( tanZ, tanY)              // up to right tangent (4 o'clock)
      shape.absarc(0, 0, r, -Math.PI / 6, -5 * Math.PI / 6, true)  // CW arc 330°→210° through bottom
      shape.closePath()                       // left tangent straight down to start
      return new THREE.ShapeGeometry(shape, 48)
    }

    for (const sx of [-L * 0.25, L * 0.25]) {
      // End plates at each end of saddle width, facing outward along vessel axis
      for (const dx of [-saddleW / 2, saddleW / 2]) {
        const ep = new THREE.Mesh(makeEndPlate(), saddleMat)
        ep.rotation.y = -Math.PI / 2        // local x→worldZ, local y→worldY
        ep.position.set(sx + dx, 0, 0)
        grp.add(ep)
      }

      // Connecting plates: one at front face (+Z) and one at back face (-Z) of the saddle,
      // positioned at the tangent point Z (±tanZ). saddleW along X, webPanelH tall, 1" in Z.
      for (const pz of [tanZ, -tanZ]) {
        const cp = new THREE.Mesh(
          new THREE.BoxGeometry(saddleW, webPanelH, 1),
          saddleSolid
        )
        cp.position.set(sx, webPanelY, pz)
        grp.add(cp)
      }

      // Base plate: saddleW+6 along X, baseThk tall, baseZW wide in Z
      const base = new THREE.Mesh(
        new THREE.BoxGeometry(saddleW + 6, baseThk, baseZW),
        saddleSolid
      )
      base.position.set(sx, baseY, 0)
      grp.add(base)

      // Wear pad: one continuous curved plate per saddle, flush on vessel OD.
      // Inner radius = r (vessel OD), outer radius = r + 0.75 (3/4" plate thickness).
      // thetaStart = 7π/6, thetaLength = 2π/3 (210° to 330° arc, saddle contact zone).
      // Height = saddleW + 4 along vessel axis, centered at sx. rotation.z = π/2.
      const wearPad = new THREE.Mesh(
        new THREE.CylinderGeometry(r + 0.75, r + 0.75, saddleW + 4, 48, 1, true, Math.PI * 7 / 6, Math.PI * 2 / 3),
        saddleSolid
      )
      wearPad.rotation.z = Math.PI / 2
      wearPad.position.set(sx, 0, 0)
      grp.add(wearPad)
    }
  }

  // ── Skirt (vertical only) ──────────────────────────────────────────────────
  // Skirt attaches at the tangent line (y = −L/2) and extends downward.
  else if (form.supportType === 'skirt') {
    const skirtH = Math.max(r * 1.4, 18)
    supportExtent = Math.max(0, skirtH - hd)  // how far skirt extends below head apex
    const skirtR = r + 1
    const skirtCenterY = -(L / 2 + skirtH / 2)

    // Full-circle skirt cylinder
    const skirt = new THREE.Mesh(
      new THREE.CylinderGeometry(skirtR, skirtR, skirtH, 64, 1, true),
      skirtMat
    )
    skirt.position.y = skirtCenterY   // top of skirt at tangent line (−L/2)
    grp.add(skirt)

    // ── Circular access opening simulation ─────────────────────────────────
    // No CSG in Three.js — simulate with a dark disc (radius=12", 24" dia) on
    // the front face (+Z, theta=0 → z=skirtR in CylinderGeometry convention).
    // A slightly lighter ring frames the edge to read as a cut opening.
    const openingR = Math.min(12, skirtR * 0.45)  // 24" dia, capped for small vessels
    const openingMat = new THREE.MeshStandardMaterial({ color: 0x080c12, roughness: 0.95, metalness: 0.05 })
    const openingDisc = new THREE.Mesh(new THREE.CircleGeometry(openingR, 48), openingMat)
    openingDisc.position.set(0, skirtCenterY, skirtR + 0.05)  // flush on +Z face
    grp.add(openingDisc)

    const rimMat = new THREE.MeshStandardMaterial({ color: 0xc8cfd8, roughness: 0.65, metalness: 0.45 })
    const openingRim = new THREE.Mesh(new THREE.RingGeometry(openingR, openingR + 1.25, 48), rimMat)
    openingRim.position.set(0, skirtCenterY, skirtR + 0.08)   // just proud of the disc
    grp.add(openingRim)

    // ── Base ring: solid flat annular plate (washer) at bottom of skirt ───
    const brIR  = Math.max(r - 3, 2)   // inner edge (slightly inside skirt)
    const brOR  = r + 7                 // outer edge (overhangs skirt by ~6")
    const brH   = 3                     // plate thickness
    const brY   = -(L / 2 + skirtH)    // top surface of base ring = bottom of skirt

    // Top face (horizontal ring facing up)
    const brTop = new THREE.Mesh(new THREE.RingGeometry(brIR, brOR, 48), baseRingDS)
    brTop.rotation.x = -Math.PI / 2
    brTop.position.y = brY
    grp.add(brTop)

    // Bottom face (horizontal ring facing down)
    const brBot = new THREE.Mesh(new THREE.RingGeometry(brIR, brOR, 48), baseRingDS)
    brBot.rotation.x = Math.PI / 2
    brBot.position.y = brY - brH
    grp.add(brBot)

    // Outer cylindrical edge
    const brOuterCyl = new THREE.Mesh(new THREE.CylinderGeometry(brOR, brOR, brH, 48, 1, true), baseRingMat)
    brOuterCyl.position.y = brY - brH / 2
    grp.add(brOuterCyl)

    // Inner cylindrical edge (visible from above looking down)
    const brInnerCyl = new THREE.Mesh(new THREE.CylinderGeometry(brIR, brIR, brH, 48, 1, true), baseRingMat)
    brInnerCyl.position.y = brY - brH / 2
    grp.add(brInnerCyl)

    // 4 anchor chairs at skirt base
    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2
      const chair = new THREE.Mesh(new THREE.BoxGeometry(1.5, 3.5, 3), suppSolid)
      chair.position.set((r + 1) * Math.cos(ang), brY + 3.5 / 2, (r + 1) * Math.sin(ang))
      grp.add(chair)
    }
  }

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  LEG GEOMETRY - LOCKED. DO NOT MODIFY WITHOUT EXPLICIT         ║
  // ║  WRITTEN PERMISSION FROM BRET MUNDT.                           ║
  // ╚══════════════════════════════════════════════════════════════════╝
  // ── Legs (vertical only) ────────────────────────────────────────────────────
  // 4 legs at 0°/90°/180°/270°. 4×4 square column, straight vertical, with a 45° miter
  // wedge at the top (outer top corner cut diagonally to the vessel contact point).
  else if (form.supportType === 'legs') {
    const legVertH   = Math.max(r * 1.3, 18)
    const legAttachY = -(L / 2 - L / 4)         // 1/4 shell up from bottom tangent = −L/4
    const legBottomY = -(L / 2 + hd + legVertH)  // grade level
    const legActualH = legAttachY - legBottomY
    const legOff     = r + 2                     // column center radial distance

    supportExtent = legVertH
    extraRadial   = 10

    // Miter wedge: triangular prism (4" tall) replacing the top 4" of the column.
    // Local coords: x∈[−2,+2] radial (−2=inner/vessel, +2=outer),
    //               y∈[0,4] vertical, z∈[−2,+2] tangential.
    // 45° cut: inner edge rises to y=4, outer edge stays at y=0.
    const makeLegWedge = (): THREE.BufferGeometry => {
      const p = new Float32Array([
        // Front face (z=−2): triangle
        -2,0,-2,  +2,0,-2,  -2,4,-2,
        // Back face (z=+2): triangle
        -2,0,+2,  -2,4,+2,  +2,0,+2,
        // Inner face (x=−2): rectangle
        -2,0,-2,  -2,4,-2,  -2,4,+2,
        -2,0,-2,  -2,4,+2,  -2,0,+2,
        // Bottom face (y=0): rectangle
        -2,0,-2,  -2,0,+2,  +2,0,+2,
        -2,0,-2,  +2,0,+2,  +2,0,-2,
        // Slanted face: diagonal from inner-top to outer-bottom
        -2,4,-2,  +2,0,-2,  +2,0,+2,
        -2,4,-2,  +2,0,+2,  -2,4,+2,
      ])
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(p, 3))
      geo.computeVertexNormals()
      return geo
    }

    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2
      const ca = Math.cos(ang), sa = Math.sin(ang)


      const cx = legOff * ca, cz = legOff * sa

      // Straight column (bottom portion, 4" shorter than full height for the miter wedge)
      const colH = legActualH - 4
      const col = new THREE.Mesh(new THREE.BoxGeometry(4, colH, 4), saddleSolid)
      col.position.set(cx, (legBottomY + legAttachY - 4) / 2, cz)
      grp.add(col)

      // Miter wedge: top of column. Local y=0 sits at (legAttachY − 4), inner top at legAttachY.
      const wedge = new THREE.Mesh(makeLegWedge(), saddleMat)
      wedge.rotation.y = -ang
      wedge.position.set(cx, legAttachY - 4, cz)
      grp.add(wedge)

      // Base plate: 12×1×12 at grade
      const bp = new THREE.Mesh(new THREE.BoxGeometry(12, 1, 12), saddleSolid)
      bp.position.set(cx, legBottomY - 0.5, cz)
      grp.add(bp)

      // Gussets: two per leg, mitered triangular prism on each tangential side.
      // Same 45° right-triangle shape as the front miter wedge (gusH=4).
      // Local x=radial (0=vessel shell, 4=outer leg face), y=vertical (0=bottom, 4=top),
      // z=tangential (±0.375" thick). Inner-bottom corner placed at vessel shell ±sideOff.
      const makeLegGusset = (): THREE.BufferGeometry => {
        const t = 0.375, h = 4  // half-thickness and height (=radial extent for 45°)
        const p = new Float32Array([
          // Front face (z=−t): triangle inner-bottom, outer-bottom, inner-top
           0,0,-t,  h,0,-t,  0,h,-t,
          // Back face (z=+t): triangle inner-bottom, inner-top, outer-bottom
           0,0,+t,  0,h,+t,  h,0,+t,
          // Inner face (x=0): rectangle bottom→top
           0,0,-t,  0,h,-t,  0,h,+t,
           0,0,-t,  0,h,+t,  0,0,+t,
          // Bottom face (y=0): rectangle inner→outer
           0,0,-t,  0,0,+t,  h,0,+t,
           0,0,-t,  h,0,+t,  h,0,-t,
          // Slanted face (hypotenuse): inner-top to outer-bottom
           0,h,-t,  h,0,-t,  h,0,+t,
           0,h,-t,  h,0,+t,  0,h,+t,
        ])
        const geo = new THREE.BufferGeometry()
        geo.setAttribute('position', new THREE.BufferAttribute(p, 3))
        geo.computeVertexNormals()
        return geo
      }

      for (const side of [-1, 1]) {
        const gus = new THREE.Mesh(makeLegGusset(), saddleMat)
        gus.rotation.y = -ang
        // Inner-bottom corner at vessel shell (r), ±2.375" tangentially from leg center
        gus.position.set(
          r * ca - side * sa * 2.375,
          legAttachY - 4,
          r * sa + side * ca * 2.375
        )
        grp.add(gus)
      }
    }
  }

  // ╔══════════════════════════════════════════════════════════════════╗
  // ║  LUG GEOMETRY - LOCKED. DO NOT MODIFY WITHOUT EXPLICIT         ║
  // ║  WRITTEN PERMISSION FROM BRET MUNDT.                           ║
  // ╚══════════════════════════════════════════════════════════════════╝

  // ── Lugs (vertical only) ────────────────────────────────────────────────────
  // 4 support lugs at 90° intervals at y = +L/4 (upper quarter of shell).
  // Each lug: two triangular web plates (6" apart, radial-vertical plane with 45° miter)
  // + a horizontal bearing plate connecting the web bottoms.
  else if (form.supportType === 'lugs') {
    const lugY  = L * 0.25  // vessel shell connection height (upper quarter)
    const webH  = 8         // web height at inner edge = radial extent (45° miter)
    const webThk = 0.75     // tangential thickness of each web plate
    supportExtent = 0
    extraRadial   = 12

    // Triangular web plate: right triangle prism in local XY.
    // x=0: inner edge (vessel shell, local origin). x=webH: outer edge.
    // y=0: bottom (bearing plate level = lugY−webH in world). y=webH: inner-top (vessel connection = lugY).
    // 45° miter: slanted face from (0,webH) to (webH,0).
    const makeWebGeo = (): THREE.BufferGeometry => {
      const t = webThk / 2, h = webH
      const p = new Float32Array([
        // Front face (z=−t): triangle A(0,0), C(h,0), B(0,h)
         0,0,-t,   h,0,-t,   0,h,-t,
        // Back face (z=+t): triangle A, B, C
         0,0,+t,   0,h,+t,   h,0,+t,
        // Inner face (x=0): rectangle A→B
         0,0,-t,   0,h,-t,   0,h,+t,
         0,0,-t,   0,h,+t,   0,0,+t,
        // Bottom face (y=0): rectangle A→C
         0,0,-t,   0,0,+t,   h,0,+t,
         0,0,-t,   h,0,+t,   h,0,-t,
        // Slanted face (hypotenuse B→C): diagonal inner-top to outer-bottom
         0,h,-t,   h,0,-t,   h,0,+t,
         0,h,-t,   h,0,+t,   0,h,+t,
      ])
      const geo = new THREE.BufferGeometry()
      geo.setAttribute('position', new THREE.BufferAttribute(p, 3))
      geo.computeVertexNormals()
      return geo
    }

    for (let i = 0; i < 4; i++) {
      const ang = (i / 4) * Math.PI * 2
      const ca = Math.cos(ang), sa = Math.sin(ang)

      // Bearing plate: 8" radial × 1" thick × 10" tangential, top flush with web bottoms.
      // Web bottoms are at lugY − webH, so plate center at lugY − webH − 0.5.
      const plate = new THREE.Mesh(new THREE.BoxGeometry(8, 1, 10), saddleSolid)
      plate.rotation.y = -ang
      plate.position.set((r + 4) * ca, lugY - webH - 0.5, (r + 4) * sa)
      grp.add(plate)

      // Two web plates, ±3" tangentially (6" apart center-to-center).
      // Each web's inner-bottom corner placed at (vessel shell r, lugY−webH, ±3" tangential).
      for (const side of [-1, 1]) {
        const web = new THREE.Mesh(makeWebGeo(), saddleMat)
        web.rotation.y = -ang
        web.position.set(
          r * ca - side * sa * 3,
          lugY - webH,              // local y=0 at bearing plate level, local y=webH at lugY
          r * sa + side * ca * 3
        )
        grp.add(web)
      }
    }
  }


  // ── Camera ─────────────────────────────────────────────────────────────────
  if (!skipCamera) fitCamera(cam, ctl, isV, od, L, hd, supportExtent, extraRadial)
}

// ── Three.js context ─────────────────────────────────────────────────────────
interface Ctx {
  renderer: THREE.WebGLRenderer
  camera: THREE.PerspectiveCamera
  controls: OrbitControls
  vesselGroup: THREE.Group
  grid: THREE.GridHelper
  frameId: number
}

type ViewMode = '3d' | 'top' | 'bottom'

// ── Component ─────────────────────────────────────────────────────────────────
export default function VesselViewer({ form }: { form: VesselDesignState }) {
  const mountRef    = useRef<HTMLDivElement>(null)
  const ctxRef      = useRef<Ctx | null>(null)
  const viewModeRef = useRef<ViewMode>('3d')
  const [viewMode, setViewMode] = useState<ViewMode>('3d')
  const saved3dCamera = useRef<{
    position: THREE.Vector3
    target: THREE.Vector3
    fov: number
    near: number
    far: number
  } | null>(null)

  // Init once
  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1f2e)
    scene.fog = new THREE.FogExp2(0x1a1f2e, 0.00055)

    const camera = new THREE.PerspectiveCamera(38, mount.clientWidth / mount.clientHeight, 0.5, 6000)
    camera.position.set(70, 45, 220)

    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
    renderer.setSize(mount.clientWidth, mount.clientHeight)
    renderer.shadowMap.enabled = true
    renderer.shadowMap.type = THREE.PCFSoftShadowMap
    renderer.toneMapping = THREE.ACESFilmicToneMapping
    renderer.toneMappingExposure = 1.15
    mount.appendChild(renderer.domElement)

    scene.add(new THREE.AmbientLight(0xd0dde8, 0.60))
    const key = new THREE.DirectionalLight(0xfff8f0, 1.05)
    key.position.set(160, 260, 130)
    key.castShadow = true
    key.shadow.mapSize.set(1024, 1024)
    key.shadow.camera.left = -350; key.shadow.camera.right = 350
    key.shadow.camera.top  =  220; key.shadow.camera.bottom = -220
    key.shadow.camera.near = 10;   key.shadow.camera.far = 900
    scene.add(key)
    const fill = new THREE.DirectionalLight(0x7090b0, 0.48)
    fill.position.set(-160, 70, -110); scene.add(fill)
    const rim = new THREE.DirectionalLight(0xa8c0d8, 0.28)
    rim.position.set(0, -120, -220); scene.add(rim)

    const grid = new THREE.GridHelper(2400, 64, 0x182838, 0x101e2c)
    grid.position.y = -80
    scene.add(grid)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.enableDamping = true
    controls.dampingFactor = 0.06
    controls.minDistance = 4
    controls.maxDistance = 2400
    controls.maxPolarAngle = Math.PI * 0.88

    const vesselGroup = new THREE.Group()
    scene.add(vesselGroup)

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

    ctxRef.current = { renderer, camera, controls, vesselGroup, grid, frameId }

    return () => {
      cancelAnimationFrame(frameId)
      ro.disconnect()
      controls.dispose()
      disposeGroup(vesselGroup)
      renderer.dispose()
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [])

  // ── Switch between 3D / Top / Bottom views ──────────────────────────────────
  function switchView(mode: ViewMode) {
    const ctx = ctxRef.current
    if (!ctx) return
    viewModeRef.current = mode
    setViewMode(mode)

    const od  = Math.max(parseFloat(form.shellOd) || 48, 6)
    const L   = Math.max(parseFloat(form.shellLength) || 120, 8)
    const r   = od / 2
    const hd  = headDepth(r, form.headType || '2:1 Elliptical')
    const sH  = Math.max(r * 0.20, 6)

    // Save 3D camera state before leaving it
    if (viewModeRef.current === '3d' && mode !== '3d') {
      saved3dCamera.current = {
        position: ctx.camera.position.clone(),
        target:   ctx.controls.target.clone(),
        fov:      ctx.camera.fov,
        near:     ctx.camera.near,
        far:      ctx.camera.far,
      }
    }

    if (mode === '3d') {
      if (saved3dCamera.current) {
        const s = saved3dCamera.current
        ctx.camera.fov  = s.fov
        ctx.camera.near = s.near
        ctx.camera.far  = s.far
        ctx.camera.up.set(0, 1, 0)
        ctx.camera.position.copy(s.position)
        ctx.camera.updateProjectionMatrix()
        ctx.controls.target.copy(s.target)
        ctx.controls.update()
      } else {
        fitCamera(ctx.camera, ctx.controls, form.orientation === 'vertical', od, L, hd, sH)
      }
    } else {
      // Near-orthographic top / bottom view using very small FOV
      const size = Math.max(od * 1.5, L * 1.2, 80)
      const dist = size * 14
      const sign = mode === 'top' ? 1 : -1

      ctx.camera.fov  = 5
      ctx.camera.near = dist * 0.04
      ctx.camera.far  = dist * 3
      ctx.camera.up.set(0, 0, -1)   // −Z is "up" so vessel axis (X) runs left→right
      ctx.camera.updateProjectionMatrix()
      ctx.camera.position.set(0.01, sign * dist, 0)  // tiny X offset prevents degenerate lookAt
      ctx.controls.target.set(0, 0, 0)
      ctx.controls.update()
    }
  }

  // Rebuild when form changes
  useEffect(() => {
    const ctx = ctxRef.current
    if (!ctx) return
    const inOrtho = viewModeRef.current !== '3d'
    // Vessel dimensions may have changed — saved 3D position is now stale
    saved3dCamera.current = null
    disposeGroup(ctx.vesselGroup)
    buildVessel(ctx.vesselGroup, ctx.camera, ctx.controls, form, inOrtho)

    // Re-apply ortho view if active (vessel dimensions may have changed)
    if (inOrtho) switchView(viewModeRef.current)

    // Move grid to ground level
    const isV = form.orientation === 'vertical'
    const od = Math.max(parseFloat(form.shellOd) || 48, 6)
    const r = od / 2
    const L = Math.max(parseFloat(form.shellLength) || 120, 8)
    const hd = headDepth(r, form.headType || '2:1 Elliptical')
    const saddleH = Math.max(r * 0.20, 6)
    const legVertH = Math.max(r * 1.3, 18)
    const skirtH   = Math.max(r * 1.4, 18)

    let groundY: number
    if (isV) {
      groundY =
        form.supportType === 'skirt' ? -(L / 2 + skirtH + 2)
        : form.supportType === 'legs' ? -(L / 2 * 0.62 + legVertH + 2)
        : -(L / 2 + hd + 4)
    } else {
      groundY =
        form.supportType === 'saddles' ? -(r + saddleH + 2.5)
        : -(r + r * 0.1 + 3)
    }
    ctx.grid.position.y = groundY
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form])

  const btnBase = 'text-xs font-medium px-2.5 py-1 rounded transition-colors select-none'
  const btnActive = 'bg-slate-200 text-slate-900'
  const btnInactive = 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-slate-100'

  return (
    <div className="relative w-full h-full">
      <div ref={mountRef} className="w-full h-full" style={{ touchAction: 'none' }} />

      {/* View toggle buttons */}
      <div className="absolute top-3 left-3 flex gap-1.5">
        {([['3d', '3D View'], ['top', 'Top View'], ['bottom', 'Bottom View']] as [ViewMode, string][]).map(
          ([mode, label]) => (
            <button
              key={mode}
              onClick={() => switchView(mode)}
              className={`${btnBase} ${viewMode === mode ? btnActive : btnInactive}`}
            >
              {label}
            </button>
          ),
        )}
      </div>
    </div>
  )
}
