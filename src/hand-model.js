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
  const thumbAttachT = 0.34; // hauteur d'accroche sur le tarse (0=poignet, 1=doigts)
  const halfWidthAt = wristWidth / 2 + (p.tarsus.width / 2 - wristWidth / 2) * thumbAttachT;

  const thumbBase = new THREE.Group();
  thumbBase.position.set(halfWidthAt, p.tarsus.length * thumbAttachT, 0);
  const thumbBasePose = pose.thumb_base;
  if (thumbBasePose) thumbBase.rotation.set(thumbBasePose.x, thumbBasePose.y, thumbBasePose.z);
  tarsus.add(thumbBase);
  registry.push({ id: 'thumb_base', label: 'Pouce (base)', object: thumbBase, kind: 'rotate' });

  const bw = p.thumb.base.width, bl = p.thumb.base.length;
  const tetra = createTetrahedron(
    { x: 0, y: 0, z: 0 },
    { x: 0, y: bl, z: 0 },
    { x: 0, y: bl * 0.4, z: bw },
    { x: bw * 1.3, y: bl * 0.5, z: bw * 0.25 }
  );
  thumbBase.add(tetra);

  // Ancre au sommet (apex) du tétraèdre, d'où partent les phalanges.
  const apex = new THREE.Object3D();
  apex.position.set(bw * 1.3, bl * 0.5, bw * 0.25);
  thumbBase.add(apex);

  const thumbSegments = splitPhalanges(
    p.thumb.length, p.thumb.radius,
    THUMB_FRACTIONS, THUMB_RADIUS_FACTORS, THUMB_NAMES, THUMB_LABELS
  );
  buildPhalanxChain(
    apex, new THREE.Vector3(0, 0, 0), THREE.MathUtils.degToRad(-58),
    thumbSegments, pose, registry, 'thumb', 'Pouce'
  );

  // --- Main gauche = symétrique de la main droite -------------------------
  // Les matériaux de volume sont en DoubleSide : une échelle négative
  // (qui inverse le sens des faces) n'y change donc rien visuellement.
  root.scale.x = p.handedness === 'left' ? -1 : 1;

  return { root, registry };
}
