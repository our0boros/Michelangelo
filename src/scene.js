// Renderer, workshop lighting, turntable stand, debris physics and dust.
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { meshRegion } from './mesher.js';
import { geometryFromMesh } from './marble.js';

export class Workshop {
  constructor(canvas) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true });
    this.renderer.setPixelRatio(Math.min(2, window.devicePixelRatio));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x2a221c);
    this.scene.fog = new THREE.Fog(0x2a221c, 4, 9);

    this.camera = new THREE.PerspectiveCamera(40, 1, 0.02, 30);
    this.camera.position.set(0.9, 0.9, 1.6);
    this.controls = new OrbitControls(this.camera, canvas);
    this.controls.enableDamping = true;
    // Left button is reserved for the chisel; right = orbit, middle = zoom, shift+right = pan.
    this.controls.mouseButtons = { LEFT: null, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE };
    this.controls.minDistance = 0.3;
    this.controls.maxDistance = 4;
    this.controls.maxPolarAngle = Math.PI * 0.55;

    this.scene.add(new THREE.HemisphereLight(0xfff2e0, 0x3a2d22, 0.9));
    const key = new THREE.DirectionalLight(0xfff0d8, 2.6);
    key.position.set(1.5, 2.6, 1.8);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    Object.assign(key.shadow.camera, { left: -1, right: 1, top: 1.6, bottom: -0.4, near: 0.5, far: 6 });
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.01;
    this.scene.add(key);
    const rim = new THREE.DirectionalLight(0xbcd0ff, 0.7);
    rim.position.set(-2, 1.4, -1.5);
    this.scene.add(rim);

    const floor = new THREE.Mesh(new THREE.PlaneGeometry(14, 14),
      new THREE.MeshStandardMaterial({ color: 0x5b4636, roughness: 0.95 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.62;
    floor.receiveShadow = true;
    this.scene.add(floor);
    this.floorY = -0.62;

    // Banker (sculptor's turntable stand); the block sits on top at y = 0.
    const wood = new THREE.MeshStandardMaterial({ color: 0x7a5434, roughness: 0.8 });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 40), wood);
    top.position.y = -0.02;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.11, 0.58, 16), wood);
    leg.position.y = -0.33;
    for (const m of [top, leg]) { m.castShadow = m.receiveShadow = true; }
    this.scene.add(top, leg);
    this.standRadius = 0.34;

    this.turntable = new THREE.Group();
    this.scene.add(this.turntable);

    this.debris = [];
    this.dust = [];
    this.dustGeo = new THREE.SphereGeometry(1, 5, 4);
    this.dustMat = new THREE.MeshBasicMaterial({ color: 0xeee6d8, transparent: true, opacity: 0.8, depthWrite: false });

    this.cursor = new THREE.Mesh(new THREE.RingGeometry(0.85, 1, 40),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthTest: false }));
    this.cursor.renderOrder = 10;
    this.cursor.visible = false;
    this.scene.add(this.cursor);

    this.resize();
    window.addEventListener('resize', () => this.resize());
  }

  resize() {
    const w = window.innerWidth, h = window.innerHeight;
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  frame(height) {
    this.controls.target.set(0, height * 0.5, 0);
    this.camera.position.set(height * 0.9, height * 0.85, height * 1.9);
    this.controls.update();
  }

  /** Show the hover ring on the surface; `risk` 0..1 colours it white→red. */
  setCursor(hit, radius, risk) {
    if (!hit) { this.cursor.visible = false; return; }
    const p = this.turntable.localToWorld(new THREE.Vector3(...hit.point));
    const n = new THREE.Vector3(...hit.normal).transformDirection(this.turntable.matrixWorld);
    this.cursor.position.copy(p).addScaledVector(n, 0.002);
    this.cursor.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), n);
    this.cursor.scale.setScalar(radius);
    this.cursor.material.color.setRGB(1, 1 - risk * 0.85, 1 - risk);
    this.cursor.visible = true;
  }

  /** Spawn falling debris from a detached fragment volume. */
  spawnDebris(frag, material, impulse) {
    const m = meshRegion(frag.vol);
    if (m.index.length === 0) return;
    const c = frag.center;
    for (let i = 0; i < m.position.length; i += 3) {
      m.position[i] -= c[0]; m.position[i + 1] -= c[1]; m.position[i + 2] -= c[2];
    }
    const mesh = new THREE.Mesh(geometryFromMesh(m), material);
    mesh.castShadow = true;
    mesh.position.copy(this.turntable.localToWorld(new THREE.Vector3(...c)));
    mesh.quaternion.copy(this.turntable.quaternion);
    this.scene.add(mesh);
    const vel = new THREE.Vector3(...impulse).applyQuaternion(this.turntable.quaternion);
    const spin = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(6);
    mesh.geometry.computeBoundingSphere();
    this.debris.push({ mesh, vel, spin, r: mesh.geometry.boundingSphere.radius, age: 0, rest: false, mass: frag.points });
  }

  puff(hit, count, scale = 1) {
    const p = this.turntable.localToWorld(new THREE.Vector3(...hit.point));
    const n = new THREE.Vector3(...hit.normal).transformDirection(this.turntable.matrixWorld);
    for (let i = 0; i < count; i++) {
      const m = new THREE.Mesh(this.dustGeo, this.dustMat);
      m.scale.setScalar((0.002 + Math.random() * 0.004) * scale);
      m.position.copy(p);
      const v = n.clone().multiplyScalar(0.4 + Math.random() * 0.8)
        .add(new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.5, Math.random() - 0.5).multiplyScalar(0.9));
      this.scene.add(m);
      this.dust.push({ m, v, life: 0.6 + Math.random() * 0.6 });
    }
  }

  /** Integrate debris + dust. Calls onLand(mass) the first time a piece hits the stand or floor. */
  step(dt, onLand) {
    const g = -9.8;
    for (const d of this.debris) {
      if (d.rest) continue;
      d.age += dt;
      d.vel.y += g * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.spin.x * dt; d.mesh.rotation.y += d.spin.y * dt; d.mesh.rotation.z += d.spin.z * dt;
      const p = d.mesh.position;
      const onStand = Math.hypot(p.x, p.z) < this.standRadius && p.y > -0.1;
      const ground = onStand ? 0 : this.floorY;
      if (p.y - d.r * 0.5 < ground) {
        p.y = ground + d.r * 0.5;
        if (!d.landed) { d.landed = true; onLand?.(d.mass); }
        d.vel.y *= -0.25; d.vel.x *= 0.6; d.vel.z *= 0.6; d.spin.multiplyScalar(0.5);
        if (onStand) d.vel.x += Math.sign(p.x || 1) * 0.4; // roll off the stand
        if (Math.abs(d.vel.y) < 0.3 && !onStand) d.rest = true;
      }
    }
    // Keep the floor tidy: oldest resting pieces disappear.
    if (this.debris.length > 60) {
      const old = this.debris.shift();
      this.scene.remove(old.mesh); old.mesh.geometry.dispose();
    }
    for (let i = this.dust.length - 1; i >= 0; i--) {
      const d = this.dust[i];
      d.life -= dt;
      d.v.y += g * 0.25 * dt;
      d.v.multiplyScalar(0.96);
      d.m.position.addScaledVector(d.v, dt);
      if (d.life <= 0) { this.scene.remove(d.m); this.dust.splice(i, 1); }
    }
  }

  clearDebris() {
    for (const d of this.debris) { this.scene.remove(d.mesh); d.mesh.geometry.dispose(); }
    for (const d of this.dust) this.scene.remove(d.m);
    this.debris = []; this.dust = [];
  }

  render() { this.controls.update(); this.renderer.render(this.scene, this.camera); }
}
