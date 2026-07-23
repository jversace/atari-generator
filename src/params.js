// params.js — Un seul objet "params" décrit entièrement la géométrie du
// mannequin. Modifier un champ + appeler rebuild() suffit à tout mettre à
// jour : c'est la source de vérité unique (pas d'état dupliqué ailleurs).
//
// Unités arbitraires ~ cm (mannequin par défaut ≈ 180 unités de haut).

export function defaultParams() {
  return {
    head:   { width: 15, height: 21, depth: 15.5 },
    neck:   { height: 4, radius: 3.6 },

    thorax: { topWidth: 31, topDepth: 11.5, botWidth: 24, botDepth: 10, height: 29.5 },
    pelvis: { topWidth: 26.5, topDepth: 15, botWidth: 20, botDepth: 11, height: 12,
              wedgeHeight: 10 },

    spine:  { length: 18, curve1: 0, curve2: 1.5 }, // curve1 = près du bassin (bas), curve2 = près du thorax (haut)

    upperArm: { length: 29, radius: 2.6 },
    forearm:  { length: 24, radius: 2.2 },
    hand:     { length: 13, width: 6, thickness: 2.4 },

    thigh: { length: 44, radius: 4.3 },
    shin:  { length: 40, radius: 3.4 },
    foot:  { length: 24, width: 9, thickness: 4.2 },

    joints: {
      shoulder: 5, elbow: 3.6, wrist: 2.6,
      hip: 5.6, knee: 4.6, ankle: 3.2
    },

    // Pose de repos par défaut au démarrage (voir mode Posture). Rempli/
    // actualisé aussi dynamiquement pendant le glisser-déposer en mode
    // Posture ; ce n'est pas un slider dans le panneau.
    pose: {
      pelvis: {
        x: 0.19615743697499669, y: 0.044317724752046386, z: -0.004430317263664948,
        px: 0, py: 87.2, pz: 0
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
        x: -0.32045243001131385, y: 0.0040155189910689735, z: 0.003930671887990523,
        px: 0, py: 17, pz: 0
      }
    }
  };
}

// Schéma déclaratif -> génère automatiquement les sliders du panneau.
// path = chemin dans l'objet params, séparé par des points.
export const controlSchema = [
  { group: 'Tête / cou', fields: [
    { path: 'head.width',  label: 'Largeur tête',  min: 7,  max: 28, step: 0.5 },
    { path: 'head.height', label: 'Hauteur tête',   min: 10, max: 40, step: 0.5 },
    { path: 'head.depth',  label: 'Profondeur tête',min: 7,  max: 30, step: 0.5 },
    { path: 'neck.height', label: 'Hauteur cou',    min: 3,  max: 14, step: 0.5 },
  ]},
  { group: 'Colonne', fields: [
    { path: 'spine.length', label: 'Longueur colonne', min: 8, max: 32, step: 1 },
    { path: 'spine.curve1', label: 'Courbure basse (lombaire)', min: -16, max: 16, step: 0.5 },
    { path: 'spine.curve2', label: 'Courbure haute (thoracique)', min: -16, max: 16, step: 0.5 },
  ]},
  { group: 'Thorax', fields: [
    { path: 'thorax.topWidth',  label: 'Largeur haute', min: 17, max: 68, step: 0.5 },
    { path: 'thorax.topDepth',  label: 'Profondeur haute', min: 9, max: 36, step: 0.5 },
    { path: 'thorax.botWidth',  label: 'Largeur basse', min: 12, max: 48, step: 0.5 },
    { path: 'thorax.botDepth',  label: 'Profondeur basse', min: 6, max: 26, step: 0.5 },
    { path: 'thorax.height',    label: 'Hauteur', min: 22, max: 88, step: 0.5 },
  ]},
  { group: 'Bassin / pelvis', fields: [
    { path: 'pelvis.topWidth',  label: 'Largeur iliaque', min: 13, max: 52, step: 0.5 },
    { path: 'pelvis.topDepth',  label: 'Profondeur iliaque', min: 7, max: 30, step: 0.5 },
    { path: 'pelvis.botWidth',  label: 'Largeur basse', min: 10, max: 40, step: 0.5 },
    { path: 'pelvis.botDepth',  label: 'Profondeur basse', min: 5, max: 22, step: 0.5 },
    { path: 'pelvis.height',    label: 'Hauteur bloc', min: 6, max: 24, step: 0.5 },
    { path: 'pelvis.wedgeHeight', label: 'Hauteur du coin', min: 5, max: 20, step: 0.5 },
  ]},
  { group: 'Bras (les 2 côtés)', fields: [
    { path: 'upperArm.length', label: 'Longueur bras',    min: 14, max: 58, step: 0.5 },
    { path: 'upperArm.radius', label: 'Diamètre bras',    min: 1,  max: 5.2, step: 0.2 },
    { path: 'forearm.length',  label: 'Longueur avant-bras', min: 12, max: 48, step: 0.5 },
    { path: 'forearm.radius',  label: 'Diamètre avant-bras', min: 1,  max: 4.4, step: 0.2 },
    { path: 'hand.length',     label: 'Longueur main', min: 8, max: 34, step: 0.5 },
    { path: 'hand.width',      label: 'Largeur main',  min: 4,  max: 15, step: 0.5 },
  ]},
  { group: 'Jambes (les 2 côtés)', fields: [
    { path: 'thigh.length', label: 'Longueur cuisse', min: 22, max: 88, step: 0.5 },
    { path: 'thigh.radius', label: 'Diamètre cuisse', min: 2,  max: 8.6, step: 0.2 },
    { path: 'shin.length',  label: 'Longueur tibia',  min: 20, max: 80, step: 0.5 },
    { path: 'shin.radius',  label: 'Diamètre tibia',  min: 1.5, max: 6.8, step: 0.2 },
    { path: 'foot.length',  label: 'Longueur pied',   min: 12, max: 48, step: 0.5 },
    { path: 'foot.width',   label: 'Largeur pied',    min: 4.5, max: 18, step: 0.5 },
  ]},
  { group: 'Articulations (diamètre)', fields: [
    { path: 'joints.shoulder', label: 'Épaule', min: 2, max: 9.2, step: 0.2 },
    { path: 'joints.elbow',    label: 'Coude',  min: 1.5, max: 7.2, step: 0.2 },
    { path: 'joints.wrist',    label: 'Poignet',min: 1,  max: 5.2, step: 0.2 },
    { path: 'joints.hip',      label: 'Hanche', min: 2.5, max: 11.2, step: 0.2 },
    { path: 'joints.knee',     label: 'Genou',  min: 2,  max: 9.2, step: 0.2 },
    { path: 'joints.ankle',    label: 'Cheville', min: 1.5, max: 6.4, step: 0.2 },
  ]},
];

export function getPath(obj, path) {
  return path.split('.').reduce((o, k) => o[k], obj);
}
export function setPath(obj, path, value) {
  const keys = path.split('.');
  const last = keys.pop();
  const target = keys.reduce((o, k) => o[k], obj);
  target[last] = value;
}
