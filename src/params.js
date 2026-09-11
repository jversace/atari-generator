// params.js — Un seul objet "params" décrit entièrement la géométrie du
// mannequin. Modifier un champ + appeler rebuild() suffit à tout mettre à
// jour : c'est la source de vérité unique (pas d'état dupliqué ailleurs).
//
// Unités arbitraires ~ cm (mannequin par défaut ≈ 174 unités de haut,
// ~8,3 têtes). Ces valeurs par défaut sont les valeurs de RÉFÉRENCE :
// chaque slider du panneau (voir controlSchema plus bas) est centré sur
// sa propre valeur par défaut (min = défaut×0,5, max = défaut×1,5), pour
// pouvoir ajuster aussi bien vers le haut que vers le bas.

export function defaultParams() {
  return {
    head:   { width: 15, height: 21, depth: 15.5 },
    neck:   { height: 7, radius: 3.6 },

    thorax: { topWidth: 31, topDepth: 11.5, botWidth: 24, botDepth: 10, height: 25.5 },
    pelvis: { topWidth: 26.5, topDepth: 15, botWidth: 20, botDepth: 11, height: 12,
              wedgeHeight: 10 },

    spine:  { length: 11, curve1: 0, curve2: 1.5 }, // curve1 = près du bassin (bas), curve2 = près du thorax (haut)

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
    //
    // Le bassin et le thorax n'ont volontairement PAS de position (px/
    // py/pz) figée ici : elle est recalculée automatiquement à partir
    // de la longueur des jambes / de la colonne (voir mannequin.js), ce
    // qui garantit que les corrections de proportions ci-dessus (et
    // toute future modification des cotes) restent cohérentes plutôt
    // que de retomber sur une position fige capturée à l'ancienne
    // longueur de colonne. Seule l'inclinaison (x/y/z) de la pose
    // d'origine est conservée.
    pose: {
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
    }
  };
}

// Schéma déclaratif -> génère automatiquement les sliders du panneau.
// path = chemin dans l'objet params, séparé par des points.
// Plages centrées sur la valeur par défaut (min = défaut×0,5,
// max = défaut×1,5) — exception pour spine.curve1/curve2, en écart
// additif symétrique (±16) car leur défaut peut être 0 ou négatif.
export const controlSchema = [
  { group: 'Tête / cou', key: 'head_neck', fields: [
    { path: 'head.width',  label: 'Largeur tête',  min: 7.5,  max: 22.5, step: 0.5 },
    { path: 'head.height', label: 'Hauteur tête',   min: 10.5, max: 31.5, step: 0.5 },
    { path: 'head.depth',  label: 'Profondeur tête',min: 7.8,  max: 23.2, step: 0.5 },
    { path: 'neck.height', label: 'Hauteur cou',    min: 3.5,  max: 10.5, step: 0.5 },
  ]},
  { group: 'Colonne', key: 'spine', fields: [
    { path: 'spine.length', label: 'Longueur colonne', min: 5.5, max: 16.5, step: 0.5 },
    { path: 'spine.curve1', label: 'Courbure basse (lombaire)', min: -16, max: 16, step: 0.5 },
    { path: 'spine.curve2', label: 'Courbure haute (thoracique)', min: -14.5, max: 17.5, step: 0.5 },
  ]},
  { group: 'Thorax', key: 'thorax', fields: [
    { path: 'thorax.topWidth',  label: 'Largeur haute', min: 15.5, max: 46.5, step: 0.5 },
    { path: 'thorax.topDepth',  label: 'Profondeur haute', min: 5.8, max: 17.2, step: 0.5 },
    { path: 'thorax.botWidth',  label: 'Largeur basse', min: 12, max: 36, step: 0.5 },
    { path: 'thorax.botDepth',  label: 'Profondeur basse', min: 5, max: 15, step: 0.5 },
    { path: 'thorax.height',    label: 'Hauteur', min: 12.8, max: 38.2, step: 0.5 },
  ]},
  { group: 'Bassin / pelvis', key: 'pelvis', fields: [
    { path: 'pelvis.topWidth',  label: 'Largeur iliaque', min: 13.2, max: 39.8, step: 0.5 },
    { path: 'pelvis.topDepth',  label: 'Profondeur iliaque', min: 7.5, max: 22.5, step: 0.5 },
    { path: 'pelvis.botWidth',  label: 'Largeur basse', min: 10, max: 30, step: 0.5 },
    { path: 'pelvis.botDepth',  label: 'Profondeur basse', min: 5.5, max: 16.5, step: 0.5 },
    { path: 'pelvis.height',    label: 'Hauteur bloc', min: 6, max: 18, step: 0.5 },
    { path: 'pelvis.wedgeHeight', label: 'Hauteur du coin', min: 5, max: 15, step: 0.5 },
  ]},
  { group: 'Bras (les 2 côtés)', key: 'arms', fields: [
    { path: 'upperArm.length', label: 'Longueur bras',    min: 14.5, max: 43.5, step: 0.5 },
    { path: 'upperArm.radius', label: 'Diamètre bras',    min: 1.3,  max: 3.9, step: 0.2 },
    { path: 'forearm.length',  label: 'Longueur avant-bras', min: 12, max: 36, step: 0.5 },
    { path: 'forearm.radius',  label: 'Diamètre avant-bras', min: 1.1,  max: 3.3, step: 0.2 },
    { path: 'hand.length',     label: 'Longueur main', min: 6.5, max: 19.5, step: 0.5 },
    { path: 'hand.width',      label: 'Largeur main',  min: 3,  max: 9, step: 0.5 },
  ]},
  { group: 'Jambes (les 2 côtés)', key: 'legs', fields: [
    { path: 'thigh.length', label: 'Longueur cuisse', min: 22, max: 66, step: 0.5 },
    { path: 'thigh.radius', label: 'Diamètre cuisse', min: 2.1,  max: 6.4, step: 0.2 },
    { path: 'shin.length',  label: 'Longueur tibia',  min: 20, max: 60, step: 0.5 },
    { path: 'shin.radius',  label: 'Diamètre tibia',  min: 1.7, max: 5.1, step: 0.2 },
    { path: 'foot.length',  label: 'Longueur pied',   min: 12, max: 36, step: 0.5 },
    { path: 'foot.width',   label: 'Largeur pied',    min: 4.5, max: 13.5, step: 0.5 },
  ]},
  { group: 'Articulations (diamètre)', key: 'joints', fields: [
    { path: 'joints.shoulder', label: 'Épaule', min: 2.5, max: 7.5, step: 0.2 },
    { path: 'joints.elbow',    label: 'Coude',  min: 1.8, max: 5.4, step: 0.2 },
    { path: 'joints.wrist',    label: 'Poignet',min: 1.3,  max: 3.9, step: 0.2 },
    { path: 'joints.hip',      label: 'Hanche', min: 2.8, max: 8.4, step: 0.2 },
    { path: 'joints.knee',     label: 'Genou',  min: 2.3,  max: 6.9, step: 0.2 },
    { path: 'joints.ankle',    label: 'Cheville', min: 1.6, max: 4.8, step: 0.2 },
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
