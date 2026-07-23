// geometry.js — Petites briques géométriques réutilisées partout dans
// mannequin.js. Rien ici ne connaît la structure du mannequin : ce sont
// des fabriques génériques.

import * as THREE from 'three';

const LINE_MATERIAL = () => new THREE.MeshBasicMaterial({ color: 0x111111 });
const VOLUME_MATERIAL = () => new THREE.MeshLambertMaterial({
  color: 0xd8d3c4, side: THREE.DoubleSide, flatShading: true
});

// Volume à 8 sommets : rectangle du bas (botWidth x botDepth) relié à un
// rectangle du haut (topWidth x topDepth) de taille différente.
// Utilisé pour le thorax (haut > bas) et la partie "boîte" du pelvis.
// side: THREE.DoubleSide sur le matériau évite de se soucier du sens des
// faces (winding) — simplification volontaire pour ce prototype.
export function createFrustumBox(topWidth, topDepth, botWidth, botDepth, height) {
  const hw = topWidth / 2, hd = topDepth / 2;
  const bw = botWidth / 2, bd = botDepth / 2;

  const verts = new Float32Array([
    // bas (y=0) : 0..3
    -bw, 0, -bd,   bw, 0, -bd,   bw, 0, bd,   -bw, 0, bd,
    // haut (y=height) : 4..7
    -hw, height, -hd,   hw, height, -hd,   hw, height, hd,   -hw, height, hd,
  ]);

  const idx = [
    0,1,2, 0,2,3,      // bas
    4,6,5, 4,7,6,      // haut
    0,4,5, 0,5,1,      // face avant (z-)
    1,5,6, 1,6,2,      // face droite (x+)
    2,6,7, 2,7,3,      // face arrière (z+)
    3,7,4, 3,4,0,      // face gauche (x-)
  ];

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  const mesh = new THREE.Mesh(geo, VOLUME_MATERIAL());
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0x111111 })
  );
  mesh.add(edges);
  return mesh;
}

// Ovaloïde (tête) : sphère basse résolution étirée selon 3 axes.
export function createEllipsoid(width, height, depth) {
  const geo = new THREE.SphereGeometry(1, 20, 14);
  const mesh = new THREE.Mesh(geo, VOLUME_MATERIAL());
  mesh.scale.set(width / 2, height / 2, depth / 2);
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo, 20),
    new THREE.LineBasicMaterial({ color: 0x333333 })
  );
  mesh.add(edges);
  return mesh;
}

// Segment "fil de fer" : un cylindre fin le long de l'axe Y local, du
// point (0,0,0) au point (0,length,0). Retourne aussi une ancre "distal"
// (Object3D vide) sur laquelle accrocher la suite de la chaîne : c'est ce
// point d'ancrage qui garantit qu'un changement de longueur ne fait que
// TRANSLATER les enfants, sans les déformer (exigence 3.a).
export function createLimbSegment(length, radius) {
  const group = new THREE.Group();

  const geo = new THREE.CylinderGeometry(radius, radius, length, 10);
  const mesh = new THREE.Mesh(geo, LINE_MATERIAL());
  mesh.position.y = length / 2; // le cylindre est centré par défaut
  group.add(mesh);

  const distal = new THREE.Object3D();
  distal.position.set(0, length, 0);
  group.add(distal);

  return { group, mesh, distal };
}

// Sphère d'articulation.
export function createJointSphere(radius) {
  const geo = new THREE.SphereGeometry(radius, 14, 10);
  return new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xc0392b }));
}

// Pavé simplifié pour main / pied : s'étend le long de +Y depuis l'origine
// (continuité naturelle avec le segment "fil de fer" auquel il s'accroche).
export function createFlatBlock(width, length, thickness) {
  const geo = new THREE.BoxGeometry(width, length, thickness);
  const mesh = new THREE.Mesh(geo, VOLUME_MATERIAL());
  mesh.position.y = length / 2;
  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(geo),
    new THREE.LineBasicMaterial({ color: 0x111111 })
  );
  mesh.add(edges);
  return mesh;
}

// Petite poignée sphérique interactive (contrôle de courbure de la colonne,
// sélection en mode posture...).
export function createHandle(radius, color = 0xff8c00) {
  const geo = new THREE.SphereGeometry(radius, 12, 8);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
}
