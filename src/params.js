// params.js — Un seul objet "params" décrit entièrement la géométrie du
// mannequin. Modifier un champ + appeler rebuild() suffit à tout mettre à
// jour : c'est la source de vérité unique (pas d'état dupliqué ailleurs).
//
// Plusieurs MODÈLES DE RÉFÉRENCE (referenceModels ci-dessous) fournissent
// chacun un jeu complet de cotes par défaut. Changer de modèle (menu
// Options > Modèle) réapplique ces cotes à `params` SANS toucher à
// `params.pose` (la posture est conservée), et recalcule les plages de
// tous les sliders pour qu'elles restent centrées sur les nouvelles
// valeurs de référence (voir computeFieldRange, utilisé par
// main-renderer.js). Unités arbitraires ~cm.

export const referenceModels = {
  male: {
    head:   { width: 15, height: 21, depth: 15.5 },
    neck:   { height: 7, radius: 3.6 },
    thorax: { topWidth: 31, topDepth: 11.5, botWidth: 24, botDepth: 10, height: 25.5 },
    pelvis: { topWidth: 26.5, topDepth: 15, botWidth: 20, botDepth: 11, height: 12, wedgeHeight: 10 },
    spine:  { length: 11, curve1: 0, curve2: 1.5 },
    upperArm: { length: 29, radius: 2.6 },
    forearm:  { length: 24, radius: 2.2 },
    hand:     { length: 13, width: 6, thickness: 2.4 },
    thigh: { length: 44, radius: 4.3 },
    shin:  { length: 40, radius: 3.4 },
    foot:  { length: 24, width: 9, thickness: 4.2 },
    joints: { shoulder: 5, elbow: 3.6, wrist: 2.6, hip: 5.6, knee: 4.6, ankle: 3.2 },
  },
  // Approximation stylisée d'un squelette féminin moyen (pas une donnée
  // médicale) : carrure/thorax plus étroits, bassin relativement plus
  // large que les épaules (contrairement au modèle "male"), silhouette
  // globalement plus courte, ossature plus fine (rayons réduits).
  female: {
    head:   { width: 14, height: 19.5, depth: 14.5 },
    neck:   { height: 7, radius: 3.0 },
    thorax: { topWidth: 27, topDepth: 10, botWidth: 21, botDepth: 8.5, height: 22 },
    pelvis: { topWidth: 28, topDepth: 15.5, botWidth: 21, botDepth: 11.5, height: 11, wedgeHeight: 11 },
    spine:  { length: 10, curve1: 0, curve2: 1.5 },
    upperArm: { length: 26, radius: 2.1 },
    forearm:  { length: 21.5, radius: 1.8 },
    hand:     { length: 12, width: 5.3, thickness: 2.1 },
    thigh: { length: 40, radius: 3.8 },
    shin:  { length: 36, radius: 2.9 },
    foot:  { length: 22, width: 8, thickness: 3.8 },
    joints: { shoulder: 4.2, elbow: 3.0, wrist: 2.2, hip: 5.0, knee: 3.9, ankle: 2.7 },
  },
};

export function getReferenceDimensions(modelId) {
  return referenceModels[modelId] || referenceModels.male;
}

// Pose de repos par défaut — indépendante du modèle de référence choisi
// (seules les COTES varient d'un modèle à l'autre, pas la posture). Le
// bassin et le thorax n'ont volontairement pas de position (px/py/pz)
// figée : elle se recalcule automatiquement à partir des cotes (voir
// mannequin.js), pour rester cohérente quel que soit le modèle actif.
function defaultPose() {
  return {
    pelvis: {
      x: 0.19615743697499669, y: 0.044317724752046386, z: -0.004430317263664948
    },
    head: {
      x: 0.2799589423405697, y: 0.049007000645637504, z: 0.016165920113074165
    },
    upperArm_1: {
      x: -0.10694769478122487, y: -0.41536285310251697, z: -2.402434608415354
    },
    "upperArm_-1": {
      x: -0.10626707236202153, y: 0.1195719444395438, z: 2.2231079923680985
    },
    "forearm_-1": {
      x: 0.8754575535000418, y: -0.45293716493725206, z: 0.3931653738686478
    },
    forearm_1: {
      x: 0.46853254276540834, y: 0.3623772445376796, z: -0.17568650244754003
    },
    "thigh_-1": {
      x: 2.869303920048008, y: -0.01364421728800222, z: -0.04493190304609964
    },
    thigh_1: {
      x: 2.879862098582674, y: -0.011826982267220922, z: 0.05887969740471983
    },
    "shin_-1": {
      x: 0.09742327805244776, y: 0.027410435186025327, z: -0.005133087236261002
    },
    shin_1: {
      x: 0.08015670521528295, y: 0.029124817208911347, z: 0.029897696588273445
    },
    thorax: {
      x: -0.32045243001131385, y: 0.0040155189910689735, z: 0.003930671887990523
    }
  };
}

export function defaultParams(modelId = 'male') {
  const d = getReferenceDimensions(modelId);
  return {
    head: { ...d.head },
    neck: { ...d.neck },
    thorax: { ...d.thorax },
    pelvis: { ...d.pelvis },
    spine: { ...d.spine },
    upperArm: { ...d.upperArm },
    forearm: { ...d.forearm },
    hand: { ...d.hand },
    thigh: { ...d.thigh },
    shin: { ...d.shin },
    foot: { ...d.foot },
    joints: { ...d.joints },
    pose: defaultPose(),
  };
}

// Schéma déclaratif -> génère automatiquement les sliders du panneau.
// path = chemin dans l'objet params, séparé par des points. PAS de
// min/max ici : la plage de chaque champ est calculée à la volée par
// computeFieldRange() à partir de la valeur de référence du modèle
// actif (voir main-renderer.js -> buildControlsUI), pour rester centrée
// quel que soit le modèle choisi.
export const controlSchema = [
  { group: 'Tête / cou', key: 'head_neck', fields: [
    { path: 'head.width',  step: 0.5 },
    { path: 'head.height', step: 0.5 },
    { path: 'head.depth',  step: 0.5 },
    { path: 'neck.height', step: 0.5 },
  ]},
  { group: 'Colonne', key: 'spine', fields: [
    { path: 'spine.length', step: 0.5 },
    { path: 'spine.curve1', step: 0.5, range: { additive: 16 } },
    { path: 'spine.curve2', step: 0.5, range: { additive: 16 } },
  ]},
  { group: 'Thorax', key: 'thorax', fields: [
    { path: 'thorax.topWidth',  step: 0.5 },
    { path: 'thorax.topDepth',  step: 0.5 },
    { path: 'thorax.botWidth',  step: 0.5 },
    { path: 'thorax.botDepth',  step: 0.5 },
    { path: 'thorax.height',    step: 0.5 },
  ]},
  { group: 'Bassin / pelvis', key: 'pelvis', fields: [
    { path: 'pelvis.topWidth',  step: 0.5 },
    { path: 'pelvis.topDepth',  step: 0.5 },
    { path: 'pelvis.botWidth',  step: 0.5 },
    { path: 'pelvis.botDepth',  step: 0.5 },
    { path: 'pelvis.height',    step: 0.5 },
    { path: 'pelvis.wedgeHeight', step: 0.5 },
  ]},
  { group: 'Bras (les 2 côtés)', key: 'arms', fields: [
    { path: 'upperArm.length', step: 0.5 },
    { path: 'upperArm.radius', step: 0.2 },
    { path: 'forearm.length',  step: 0.5 },
    { path: 'forearm.radius',  step: 0.2 },
    { path: 'hand.length',     step: 0.5 },
    { path: 'hand.width',      step: 0.5 },
  ]},
  { group: 'Jambes (les 2 côtés)', key: 'legs', fields: [
    { path: 'thigh.length', step: 0.5 },
    { path: 'thigh.radius', step: 0.2 },
    { path: 'shin.length',  step: 0.5 },
    { path: 'shin.radius',  step: 0.2 },
    { path: 'foot.length',  step: 0.5 },
    { path: 'foot.width',   step: 0.5 },
  ]},
  { group: 'Articulations (diamètre)', key: 'joints', fields: [
    { path: 'joints.shoulder', step: 0.2 },
    { path: 'joints.elbow',    step: 0.2 },
    { path: 'joints.wrist',    step: 0.2 },
    { path: 'joints.hip',      step: 0.2 },
    { path: 'joints.knee',     step: 0.2 },
    { path: 'joints.ankle',    step: 0.2 },
  ]},
];

// Plage [min, max] d'un champ, centrée sur sa valeur de référence
// (defaultValue) : par défaut ±50% (multiplicatif — ne convient pas à
// une valeur de référence nulle/négative), ou en écart additif si le
// champ déclare `range: { additive: N }` (cas de spine.curve1/curve2).
export function computeFieldRange(defaultValue, field) {
  if (field.range && field.range.additive != null) {
    const spread = field.range.additive;
    return [defaultValue - spread, defaultValue + spread];
  }
  const factor = (field.range && field.range.factor) || 0.5;
  return [defaultValue * (1 - factor), defaultValue * (1 + factor)];
}

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => o[k], obj);
}
export function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj);
  target[last] = value;
}
