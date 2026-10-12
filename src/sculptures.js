// Simplified SDF reconstructions of famous sculptures.
// Units: block-normalised metres, y up, base at y = 0, figure faces +z.
// Figure's right side is -x (viewer looks from +z).
import {
  sphere, ellipsoid, capsule, roundBox, cylinder,
  union, subtract, intersect, mirrorX, rotateX, rotateZ,
} from './sdf.js';

const plinth = (hx, hz, h = 0.05) => roundBox([0, h / 2, 0], [hx, h / 2, hz], 0.008);
const above0 = roundBox([0, 1, 0], [2, 1, 2]); // keeps y >= 0

/** 基克拉泽斯女像 · Cycladic figurine (~2500 BC) */
export function cycladic() {
  const legs = mirrorX(capsule([0.032, 0.06, 0], [0.042, 0.45, 0], 0.028, 0.042));
  const feet = mirrorX(capsule([0.03, 0.065, 0.0], [0.034, 0.06, 0.035], 0.02));
  const hips = ellipsoid(0, 0.47, 0, 0.085, 0.07, 0.045);
  const torso = ellipsoid(0, 0.6, 0, 0.085, 0.13, 0.04);
  const breasts = mirrorX(sphere(0.035, 0.65, 0.028, 0.02));
  const upperArms = mirrorX(capsule([0.09, 0.7, 0], [0.085, 0.585, 0.02], 0.022));
  const foldedArms = capsule([-0.085, 0.58, 0.026], [0.085, 0.56, 0.026], 0.021);
  const neck = capsule([0, 0.71, 0], [0, 0.8, -0.004], 0.026);
  const head = rotateX(union(0.01,
    ellipsoid(0, 0.88, 0, 0.065, 0.085, 0.034),
    ellipsoid(0, 0.9, 0.03, 0.012, 0.05, 0.016),
  ), -0.25, 0.8, 0);
  return union(0.015,
    plinth(0.1, 0.06, 0.05), legs, feet, hips, torso, breasts, upperArms, foldedArms, neck, head);
}

/** 复活节岛摩艾石像 · Moai, Rapa Nui (1250–1500) */
export function moai() {
  const body = roundBox([0, 0.27, 0], [0.17, 0.22, 0.13], 0.06);
  const head = roundBox([0, 0.68, 0], [0.13, 0.22, 0.12], 0.05);
  const brow = roundBox([0, 0.77, 0.11], [0.13, 0.025, 0.03], 0.02);
  const nose = ellipsoid(0, 0.67, 0.13, 0.036, 0.09, 0.04);
  const lips = roundBox([0, 0.55, 0.12], [0.07, 0.025, 0.02], 0.015);
  const chin = ellipsoid(0, 0.49, 0.09, 0.09, 0.05, 0.05);
  const ears = mirrorX(ellipsoid(0.13, 0.66, 0, 0.022, 0.1, 0.04));
  const arms = mirrorX(capsule([0.17, 0.42, 0.02], [0.15, 0.19, 0.07], 0.025));
  const hands = mirrorX(capsule([0.14, 0.19, 0.09], [0.035, 0.15, 0.13], 0.02));
  const sculpt = union(0.02,
    plinth(0.2, 0.17, 0.06), body, head, brow, nose, lips, chin, ears, arms, hands);
  const eyes = mirrorX(sphere(0.06, 0.725, 0.145, 0.032));
  return subtract(0.01, sculpt, eyes);
}

/** 纳芙蒂蒂半身像 · Bust of Nefertiti (1345 BC) */
export function nefertiti() {
  // Bust cut flat at the bottom and back like the original; shoulders wider than deep.
  const chest = intersect(ellipsoid(0, 0.05, -0.01, 0.2, 0.2, 0.11), above0);
  const shoulders = intersect(capsule([-0.15, 0.13, -0.02], [0.15, 0.13, -0.02], 0.06), above0);
  const collar = ellipsoid(0, 0.2, 0.02, 0.1, 0.035, 0.075);
  // Long neck leaning forward.
  const neck = capsule([0, 0.17, 0.0], [0, 0.36, 0.045], 0.05, 0.042);
  const head = ellipsoid(0, 0.42, 0.06, 0.055, 0.068, 0.068);
  const jaw = ellipsoid(0, 0.375, 0.09, 0.04, 0.035, 0.04);
  const nose = ellipsoid(0, 0.415, 0.128, 0.011, 0.026, 0.016);
  const lips = ellipsoid(0, 0.383, 0.118, 0.018, 0.009, 0.01);
  const ears = mirrorX(ellipsoid(0.055, 0.415, 0.04, 0.009, 0.02, 0.014));
  // Flat-topped cap crown flaring upward and tilted back.
  const crownCone = capsule([0, 0.45, 0.03], [0, 0.6, -0.06], 0.06, 0.088);
  const crownCut = rotateX(roundBox([0, 0.3, 0], [0.3, 0.3, 0.3]), -0.55, 0.6, -0.06);
  const crown = intersect(crownCone, crownCut);
  const band = rotateX(cylinder([0, 0.475, 0.02], 0.066, 0.01), -0.55, 0.475, 0.02);
  return union(0.016, chest, shoulders, collar, neck, head, jaw, nose, lips, ears, crown, band);
}

/** 米洛的维纳斯 · Venus de Milo (150–125 BC) */
export function venus() {
  // Drapery: tapering column from plinth to hips, knotted roll slanting across the hips.
  const drapery = capsule([0, 0.1, 0], [0, 0.44, 0.005], 0.11, 0.105);
  const leftKnee = ellipsoid(0.04, 0.3, 0.05, 0.055, 0.12, 0.06);
  const fold = rotateZ(ellipsoid(0, 0.45, 0.02, 0.115, 0.03, 0.095), -0.12, 0, 0.45);
  // Nude torso with a slight S twist; flattened breasts blended into the chest.
  const torso = rotateZ(ellipsoid(0, 0.6, 0, 0.088, 0.15, 0.062), 0.06, 0, 0.45);
  const chest = ellipsoid(0, 0.67, 0.012, 0.09, 0.06, 0.06);
  const breasts = mirrorX(ellipsoid(0.04, 0.665, 0.048, 0.03, 0.026, 0.02));
  const shoulders = capsule([-0.095, 0.735, -0.01], [0.095, 0.745, -0.01], 0.034);
  const rightStump = capsule([-0.1, 0.735, 0], [-0.12, 0.67, 0.015], 0.03);
  const leftStump = capsule([0.1, 0.745, 0], [0.12, 0.71, -0.005], 0.03);
  const neck = capsule([0, 0.75, 0], [0.006, 0.82, 0.004], 0.029);
  const head = ellipsoid(0.01, 0.87, 0.01, 0.042, 0.054, 0.05);
  const nose = ellipsoid(0.01, 0.868, 0.058, 0.01, 0.018, 0.01);
  const bun = ellipsoid(0.01, 0.885, -0.042, 0.03, 0.025, 0.022);
  return union(0.02,
    plinth(0.14, 0.12, 0.06), drapery, leftKnee, fold, torso, chest, breasts,
    shoulders, rightStump, leftStump, neck, head, nose, bun);
}

/** 思想者 · The Thinker, Rodin (1904) */
export function thinker() {
  const rock = roundBox([0, 0.15, -0.03], [0.17, 0.15, 0.15], 0.06);
  const thighs = mirrorX(capsule([0.07, 0.33, -0.04], [0.08, 0.36, 0.15], 0.055, 0.048));
  const shins = mirrorX(capsule([0.08, 0.36, 0.16], [0.075, 0.07, 0.17], 0.042, 0.032));
  const feet = mirrorX(capsule([0.075, 0.04, 0.16], [0.078, 0.035, 0.22], 0.03));
  const pelvis = ellipsoid(0, 0.37, -0.05, 0.13, 0.07, 0.09);
  const torso = rotateX(ellipsoid(0, 0.53, -0.04, 0.13, 0.17, 0.085), 0.45, 0.38, -0.05);
  const shoulders = capsule([-0.12, 0.62, 0.04], [0.12, 0.62, 0.04], 0.05);
  // Right elbow rests on left knee: arm crosses from -x shoulder to +x knee.
  const rUpper = capsule([-0.12, 0.62, 0.05], [0.05, 0.4, 0.14], 0.04, 0.034);
  const rFore = capsule([0.05, 0.4, 0.14], [0.0, 0.62, 0.18], 0.032, 0.028);
  const lUpper = capsule([0.12, 0.62, 0.04], [0.13, 0.45, 0.1], 0.04, 0.034);
  const lFore = capsule([0.13, 0.45, 0.1], [0.06, 0.39, 0.2], 0.032, 0.026);
  const neck = capsule([0, 0.64, 0.05], [0, 0.68, 0.12], 0.04);
  const head = ellipsoid(0, 0.7, 0.16, 0.056, 0.066, 0.06);
  const hand = ellipsoid(0, 0.64, 0.2, 0.034, 0.03, 0.034);
  return union(0.025,
    rock, thighs, shins, feet, pelvis, torso, shoulders,
    rUpper, rFore, lUpper, lFore, neck, head, hand);
}

/** 大卫 · David, Michelangelo (1501–1504) — contrapposto, weight on right leg */
export function david() {
  const base = roundBox([0, 0.035, 0], [0.13, 0.035, 0.12], 0.01);
  const stump = capsule([-0.09, 0.07, -0.05], [-0.085, 0.3, -0.05], 0.035, 0.03);
  const rLeg = union(0.01,
    capsule([-0.04, 0.08, 0.0], [-0.045, 0.27, 0.0], 0.026, 0.032),
    capsule([-0.045, 0.27, 0.0], [-0.045, 0.47, 0.0], 0.034, 0.048));
  const lLeg = union(0.01,
    capsule([0.07, 0.08, 0.05], [0.055, 0.27, 0.03], 0.024, 0.032),
    capsule([0.055, 0.27, 0.03], [0.045, 0.46, 0.0], 0.034, 0.046));
  const feet = union(0, capsule([-0.04, 0.08, 0.0], [-0.04, 0.08, 0.06], 0.022),
    capsule([0.07, 0.08, 0.05], [0.075, 0.08, 0.1], 0.02));
  const pelvis = rotateZ(ellipsoid(0, 0.5, 0, 0.09, 0.06, 0.06), -0.08, 0, 0.5);
  const torso = rotateZ(ellipsoid(0, 0.63, 0, 0.095, 0.13, 0.06), 0.06, 0, 0.5);
  const chest = ellipsoid(0, 0.7, 0.01, 0.105, 0.06, 0.06);
  const rArm = capsule([-0.1, 0.735, 0], [-0.115, 0.5, 0.01], 0.026, 0.02);
  const rHand = ellipsoid(-0.115, 0.47, 0.01, 0.022, 0.035, 0.022);
  const lUpper = capsule([0.1, 0.735, 0], [0.12, 0.64, 0.03], 0.026);
  const lFore = capsule([0.12, 0.64, 0.03], [0.065, 0.76, 0.035], 0.021);
  const neck = capsule([0, 0.74, 0], [0.008, 0.8, 0.005], 0.026);
  const head = ellipsoid(0.015, 0.845, 0.01, 0.042, 0.052, 0.048);
  const hair = ellipsoid(0.015, 0.865, -0.004, 0.047, 0.045, 0.048);
  return union(0.018,
    base, stump, rLeg, lLeg, feet, pelvis, torso, chest,
    rArm, rHand, lUpper, lFore, neck, head, hair);
}
