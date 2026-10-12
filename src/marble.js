// Marble material: procedural veins + chalk guide contours driven by per-vertex target distance.
import * as THREE from 'three';

const NOISE = /* glsl */ `
float mhash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
float mnoise(vec3 x){
  vec3 i = floor(x), f = fract(x); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(mix(mhash(i), mhash(i + vec3(1,0,0)), f.x), mix(mhash(i + vec3(0,1,0)), mhash(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(mhash(i + vec3(0,0,1)), mhash(i + vec3(1,0,1)), f.x), mix(mhash(i + vec3(0,1,1)), mhash(i + vec3(1,1,1)), f.x), f.y), f.z);
}
float mfbm(vec3 p){ float s = 0.0, a = 0.5; for (int o = 0; o < 5; o++){ s += a * mnoise(p); p *= 2.03; a *= 0.5; } return s; }
`;

/**
 * guides: uniforms.uGuide (0..1 opacity), uSpacing (contour spacing, m), uTol (on-target band, m).
 * Debris uses the same material with uGuide = 0.
 */
export function createMarbleMaterial({ veinSeed = 1, tint = 0xf2ede4 } = {}) {
  const uniforms = {
    uGuide: { value: 1 },
    uSpacing: { value: 0.02 },
    uTol: { value: 0.006 },
    uSeed: { value: veinSeed },
  };
  const mat = new THREE.MeshStandardMaterial({ color: tint, roughness: 0.62, metalness: 0 });
  mat.userData.uniforms = uniforms;
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms);
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', `#include <common>
attribute float aTarget; attribute float aPlaster; attribute float aPolish;
varying float vTarget; varying float vPlaster; varying float vPolish; varying vec3 vObj;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vTarget = aTarget; vPlaster = aPlaster; vPolish = aPolish; vObj = position;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>
uniform float uGuide; uniform float uSpacing; uniform float uTol; uniform float uSeed;
varying float vTarget; varying float vPlaster; varying float vPolish; varying vec3 vObj;
${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
{
  vec3 p = vObj * 6.0 + uSeed * 3.1;
  float warp = mfbm(p * 1.5);
  float vein = abs(sin((p.x * 0.6 + p.y * 1.4 + p.z * 0.4) * 3.0 + warp * 7.0));
  vein = pow(smoothstep(0.0, 0.18, vein), 0.6);
  float grain = mfbm(vObj * 140.0);
  vec3 stone = diffuseColor.rgb * (0.9 + 0.1 * grain);
  stone = mix(vec3(0.42, 0.42, 0.44), stone, 0.35 + 0.65 * vein);
  // Plaster: matte warm white, no veins.
  stone = mix(stone, vec3(0.93, 0.9, 0.82), vPlaster);
  if (uGuide > 0.0) {
    float d = vTarget;
    float w = fwidth(d) * 1.2;
    // Chalk contours above the target surface; denser lines = more stone to remove.
    float contour = 1.0 - smoothstep(0.0, w, abs(fract(d / uSpacing + 0.5) - 0.5) * uSpacing);
    float above = step(uTol, d);
    vec3 chalk = vec3(0.12, 0.32, 0.75);
    stone = mix(stone, chalk, contour * above * 0.55 * uGuide);
    // Target outline band: green when finished, red when overcut.
    float onTarget = 1.0 - smoothstep(uTol * 0.5, uTol, abs(d));
    stone = mix(stone, vec3(0.25, 0.7, 0.3), onTarget * 0.35 * uGuide);
    float over = smoothstep(-uTol * 0.5, -uTol * 1.5, d) * (1.0 - vPlaster);
    stone = mix(stone, vec3(0.85, 0.15, 0.1), over * 0.6 * uGuide);
  }
  diffuseColor.rgb = stone;
}`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
roughnessFactor = mix(roughnessFactor, 0.18, vPolish * (1.0 - vPlaster));
roughnessFactor = mix(roughnessFactor, 0.85, vPlaster);`);
  };
  mat.customProgramCacheKey = () => 'marble-v1';
  return mat;
}

/** Build a BufferGeometry from mesher output. */
export function geometryFromMesh(m) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(m.position, 3));
  g.setAttribute('normal', new THREE.BufferAttribute(m.normal, 3));
  g.setAttribute('aTarget', new THREE.BufferAttribute(m.target, 1));
  g.setAttribute('aPlaster', new THREE.BufferAttribute(m.plaster, 1));
  g.setAttribute('aPolish', new THREE.BufferAttribute(m.polish, 1));
  g.setIndex(new THREE.BufferAttribute(m.index, 1));
  g.computeBoundingSphere();
  return g;
}
