// hand-model.js — Pendant de mannequin.js pour la main. Même principe :
// une hiérarchie de THREE.Group parent/enfant qui donne gratuitement la
// propagation (bouger le tarse déplace tout, plier une phalange ne
// déplace que ce qui est after elle dans la chaîne).
//
// Contrairement au corps, la main ne comporte pas de sphères
// d'articulation (non demandées dans le cahier des charges de la main) :
// les phalanges s'enchaînent directement, comme les segments de colonne.

import * as THREE from 'three';
import { createFrustumBox, createLimbSegment, createTetrahedron } from './geometry.js';

// Construit une chaîne de phalanges (cylindres) bout à bout.
// segments: [{ name, label, length, radius }, ...] — dans l'ordre
// proximal -> ... -> distal.
function buildPhalanxChain(parentGroup, basePos, baseRotationZ, segments, pose, registry, idPrefix, labelPrefix) {
  let parent = parentGroup;
  let currentPos = basePos;
  let currentRotZ = baseRotationZ;

  for (const seg of segments) {
    const segGroup = new THREE.Group();
    segGroup.position.copy(currentPos);
    const id = `${idPrefix}_${seg.name}`;
    const segPose = pose[id];
    segGroup.rotation.set(
      segPose ? segPose.x : 0,
      segPose ? segPose.y : 0,
      segPose ? segPose.z : currentRotZ
    );
    const built = createLimbSegment(seg.length, seg.radius);
    segGroup.add(built.group);
    parent.add(segGroup);
    registry.push({ id, label: `${labelPrefix} ${seg.label}`, object: segGroup, kind: 'rotate' });

    parent = built.distal;
    currentPos = new THREE.Vector3(0, 0, 0);
    currentRotZ = 0; // les segments suivants continuent tout droit par défaut
  }
}

// Répartition longueur/diamètre entre les 3 phalanges d'un doigt (ou les
// 2 du pouce, tableau plus court) : la dernière est toujours la plus
// petite (exigence explicite), sans exposer un slider par phalange.
function splitPhalanges(totalLength, baseRadius, fractions, radiusFactors, names, labels) {
  return fractions.map((frac, i) => ({
    name: names[i],
    label: labels[i],
    length: totalLength * frac,
    radius: baseRadius * radiusFactors[i],
  }));
}

const FINGER_FRACTIONS = [0.44, 0.30, 0.26];
const FINGER_RADIUS_FACTORS = [1, 0.85, 0.7];
const FINGER_NAMES = ['prox', 'mid', 'dist'];
const FINGER_LABELS = ['(base)', '(milieu)', '(bout)'];

const THUMB_FRACTIONS = [0.55, 0.45];
const THUMB_RADIUS_FACTORS = [1, 0.82];
const THUMB_NAMES = ['prox', 'dist'];
const THUMB_LABELS = ['(base)', '(bout)'];

// Construit la main complète. Retourne { root, registry } — pas de
// "spineControl" ici, la main n'a pas de colonne/mode Bézier.
export function buildHand(params) {
  const p = params;
  const pose = p.pose || {};
  const root = new THREE.Group();
  const registry = [];

  // --- Tarse -------------------------------------------------------------
  const tarsus = new THREE.Group();
  const tarsusPose = pose.tarsus;
  if (tarsusPose) {
    tarsus.position.set(tarsusPose.px || 0, tarsusPose.py || 0, tarsusPose.pz || 0);
    tarsus.rotation.set(tarsusPose.x, tarsusPose.y, tarsusPose.z);
  }
  root.add(tarsus);
  registry.push({ id: 'tarsus', label: 'Tarse', object: tarsus, kind: 'both' });

  // Extrémité "doigts" (haut, y=length) = 2 trapèzes ABCD/EFGH ; extrémité
  // "poignet" (bas, y=0) rétrécie du ratio réglable. Les 2 faces latérales
  // deviennent alors elles aussi des trapèzes, et devant/derrière des
  // rectangles — exactement la forme demandée.
  const wristWidth = p.tarsus.width * p.tarsus.ratio;
  const wristThickness = p.tarsus.thickness * p.tarsus.ratio;
  const tarsusMesh = createFrustumBox(
    p.tarsus.width, p.tarsus.thickness,
    wristWidth, wristThickness,
    p.tarsus.length
  );
  tarsus.add(tarsusMesh);

  // --- Doigts (4), accrochés au sommet du tarse ---------------------------
  const fingersAnchor = new THREE.Group();
  fingersAnchor.position.set(0, p.tarsus.length, 0);
  tarsus.add(fingersAnchor);

  const fingerOrder = [
    { key: 'pinky',  label: 'Auriculaire', xFrac: -0.36 },
    { key: 'ring',   label: 'Annulaire',   xFrac: -0.12 },
    { key: 'middle', label: 'Majeur',      xFrac: 0.12 },
    { key: 'index',  label: 'Index',       xFrac: 0.36 },
  ];
  for (const f of fingerOrder) {
    const fp = p.fingers[f.key];
    const segments = splitPhalanges(
      fp.length, fp.radius,
      FINGER_FRACTIONS, FINGER_RADIUS_FACTORS, FINGER_NAMES, FINGER_LABELS
    );
    const x = f.xFrac * p.tarsus.width;
    buildPhalanxChain(fingersAnchor, new THREE.Vector3(x, 0, 0), 0, segments, pose, registry, f.key, f.label);
  }

  // --- Pouce : tétraèdre irrégulier accroché au flanc du tarse, prolongé
  // de 2 cylindres (phalanges) ---------------------------------------------
  // Le flanc du tarse n'est pas un plan vertical : il est conique (le
  // tarse se rétrécit vers le poignet). Pour que le triangle de base y
  // soit parfaitement flush, chaque sommet est calculé À la largeur/
  // épaisseur réelles du tarse à sa propre hauteur — pas sur un plan fixe.
  const halfWidthAt = (y) => (wristWidth / 2) + (p.tarsus.width / 2 - wristWidth / 2) * (y / p.tarsus.length);
  const halfThickAt = (y) => (wristThickness / 2) + (p.tarsus.thickness / 2 - wristThickness / 2) * (y / p.tarsus.length);

  const topY = p.tarsus.length * 0.5;      // pas plus haut que la moitié du tarse
  const bottomY = p.tarsus.length * 0.06;  // pointe presque au bord du poignet
  const reach = halfThickAt(topY) * 2.2;   // de combien le pouce dépasse du flanc

  // Pivot du pouce = pointe du triangle (côté poignet) : un point d'ancrage
  // anatomiquement raisonnable pour la rotation en mode Posture.
  const pivot = { x: halfWidthAt(bottomY), y: bottomY, z: 0 };
  const thumbBase = new THREE.Group();
  thumbBase.position.set(pivot.x, pivot.y, pivot.z);
  const thumbBasePose = pose.thumb_base;
  if (thumbBasePose) thumbBase.rotation.set(thumbBasePose.x, thumbBasePose.y, thumbBasePose.z);
  tarsus.add(thumbBase);
  registry.push({ id: 'thumb_base', label: 'Pouce (base)', object: thumbBase, kind: 'rotate' });

  // Sommets exprimés en coordonnées LOCALES au pivot (donc - pivot.*).
  const wTop = halfWidthAt(topY), tTop = halfThickAt(topY);
  const v0 = { x: wTop - pivot.x, y: topY - pivot.y, z: -tTop };            // base, côté doigts, flanc arrière
  const v1 = { x: wTop - pivot.x, y: topY - pivot.y, z: tTop };             // base, côté doigts, flanc avant
  const v2 = { x: 0, y: 0, z: 0 };                                          // pointe, côté poignet (= pivot)
  const v3 = { x: wTop - pivot.x + reach, y: topY - pivot.y, z: 0 };        // sommet extérieur, à hauteur de la base
  const tetra = createTetrahedron(v0, v1, v2, v3);
  thumbBase.add(tetra);

  // Accroche de la phalange : sur la face v0-v1-v3 (perpendiculaire au
  // flanc, orientée vers le haut) — pas au centre de cette face, mais
  // décalée vers le sommet extérieur (v3).
  const centroid = {
    x: (v0.x + v1.x + v3.x) / 3,
    y: (v0.y + v1.y + v3.y) / 3,
    z: (v0.z + v1.z + v3.z) / 3,
  };
  const towardV3 = 0.7; // 0 = centre de la face, 1 = exactement au sommet
  const apex = new THREE.Object3D();
  apex.position.set(
    centroid.x + (v3.x - centroid.x) * towardV3,
    centroid.y + (v3.y - centroid.y) * towardV3,
    centroid.z + (v3.z - centroid.z) * towardV3
  );
  thumbBase.add(apex);

  // Le pouce pointe à 45° de l'axe des doigts (+Y), pas à 90°.
  const thumbSegments = splitPhalanges(
    p.thumb.length, p.thumb.radius,
    THUMB_FRACTIONS, THUMB_RADIUS_FACTORS, THUMB_NAMES, THUMB_LABELS
  );
  buildPhalanxChain(
    apex, new THREE.Vector3(0, 0, 0), THREE.MathUtils.degToRad(-45),
    thumbSegments, pose, registry, 'thumb', 'Pouce'
  );

  // --- Main gauche = symétrique de la main droite -------------------------
  // Les matériaux de volume sont en DoubleSide : une échelle négative
  // (qui inverse le sens des faces) n'y change donc rien visuellement.
  root.scale.x = p.handedness === 'left' ? -1 : 1;

  return { root, registry };
}
