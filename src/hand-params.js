// hand-params.js — Pendant de params.js pour l'onglet "Main". Mêmes
// conventions : un seul objet `params` décrit toute la géométrie, un
// schéma déclaratif génère les sliders.
//
// Repères locaux du modèle de main : Y = du poignet vers les doigts
// (comme l'axe d'extension des membres du corps), X = largeur
// (pouce/auriculaire), Z = épaisseur (paume <-> dos de la main).
// La main gauche est obtenue en symétrisant la main droite (voir
// hand-model.js), pas en redéfinissant des coordonnées séparées.

export function defaultHandParams() {
  return {
    handedness: 'right', // 'right' | 'left'

    // Tarse : volume à 8 sommets (2 trapèzes identiques en haut/bas,
    // 2 trapèzes identiques sur les côtés latéraux, 2 rectangles devant/
    // derrière). "ratio" = taille de l'extrémité poignet par rapport à
    // l'extrémité doigts (1 = pas de rétrécissement).
    tarsus: { width: 8, thickness: 2.6, length: 9, ratio: 0.72 },

    thumb: {
      base:     { width: 2.6, length: 2.8 },  // tétraèdre irrégulier (attache au tarse)
      length:   6.2,                           // longueur totale des 2 phalanges
      radius:   1.1
    },

    fingers: {
      index:  { length: 10,   radius: 0.95 },
      middle: { length: 11,   radius: 1.0 },
      ring:   { length: 10.2, radius: 0.9 },
      pinky:  { length: 8,    radius: 0.75 }
    },

    // Pose de repos (mode Posture) — comme pour le corps, pas un slider.
    pose: {}
  };
}

export const handControlSchema = [
  { group: 'Tarse', fields: [
    { path: 'tarsus.width',     label: 'Largeur',    min: 4,   max: 14,  step: 0.2 },
    { path: 'tarsus.thickness', label: 'Épaisseur',  min: 1.2, max: 5,   step: 0.1 },
    { path: 'tarsus.length',    label: 'Longueur',   min: 5,   max: 16,  step: 0.2 },
    { path: 'tarsus.ratio',     label: 'Ratio poignet/doigts', min: 0.4, max: 1, step: 0.02 },
  ]},
  { group: 'Pouce', fields: [
    { path: 'thumb.base.width',  label: 'Largeur de la base', min: 1.3, max: 5.2, step: 0.1 },
    { path: 'thumb.base.length', label: 'Longueur de la base', min: 1.4, max: 5.6, step: 0.1 },
    { path: 'thumb.length',      label: 'Longueur des phalanges', min: 3,   max: 12,  step: 0.2 },
    { path: 'thumb.radius',      label: 'Diamètre',              min: 0.5, max: 2.2, step: 0.05 },
  ]},
  { group: 'Doigts', fields: [
    { path: 'fingers.index.length',  label: 'Index — longueur',   min: 5, max: 20, step: 0.2 },
    { path: 'fingers.index.radius',  label: 'Index — diamètre',   min: 0.4, max: 1.9, step: 0.05 },
    { path: 'fingers.middle.length', label: 'Majeur — longueur',  min: 5, max: 22, step: 0.2 },
    { path: 'fingers.middle.radius', label: 'Majeur — diamètre',  min: 0.4, max: 2, step: 0.05 },
    { path: 'fingers.ring.length',   label: 'Annulaire — longueur', min: 5, max: 21, step: 0.2 },
    { path: 'fingers.ring.radius',   label: 'Annulaire — diamètre', min: 0.4, max: 1.8, step: 0.05 },
    { path: 'fingers.pinky.length',  label: 'Auriculaire — longueur', min: 4, max: 16, step: 0.2 },
    { path: 'fingers.pinky.radius',  label: 'Auriculaire — diamètre', min: 0.3, max: 1.5, step: 0.05 },
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
