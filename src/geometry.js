// geometry.js — Petites briques géométriques réutilisées partout dans
// mannequin.js. Rien ici ne connaît la structure du mannequin : ce sont
// des fabriques génériques.
//
// Chaque mesh "plein" (volume, articulation, membre) est marqué
// userData.isSolid = true. En mode "traits de construction" (voir
// main-renderer.js -> doExportPNG), on ne masque plus ces meshes : on
// rend juste leur remplissage transparent, ce qui laisse voir le contour
// ET ce qu'il y a derrière (par ex. la colonne à travers le thorax).
//
// Pour les formes à arêtes vives (boîtes trapézoïdales), le contour est
// calculé automatiquement via EdgesGeometry — ça fonctionne très bien.
// Pour les formes RONDES (sphères, cylindres), EdgesGeometry ne convient
// pas : une surface lisse n'a par définition aucune arête "vive", donc au
// mieux ça donne un résultat épars, au pire rien du tout (c'est le bug
// de la tête invisible). On dessine donc pour elles un contour explicite,
// façon schéma de géométrie : cercles/ellipses de silhouette, comme sur
// un dessin technique.

import * as THREE from 'three';

const LINE_MATERIAL = () => new THREE.MeshBasicMaterial({ color: 0x111111 });
const VOLUME_MATERIAL = () => new THREE.MeshLambertMaterial({
  color: 0xd8d3c4, side: THREE.DoubleSide, flatShading: true
});

// Contour noir (arêtes) attaché en enfant d'un mesh "plein" à arêtes vives
// (boîtes). Exporté pour être réutilisé depuis mannequin.js.
export function createEdgeOverlay(geometry, color = 0x111111, thresholdAngle = 1) {
  return new THREE.LineSegments(
    new THREE.EdgesGeometry(geometry, thresholdAngle),
    new THREE.LineBasicMaterial({ color })
  );
}

function markSolidWithEdges(mesh, geometry, edgeColor, thresholdAngle) {
  mesh.userData.isSolid = true;
  mesh.add(createEdgeOverlay(geometry, edgeColor, thresholdAngle));
  return mesh;
}

// Un cercle (dans le plan XZ, rayon donné), utilisé comme brique de base
// pour les contours de sphères et de cylindres ci-dessous.
function createCircleLine(radius, segments, color) {
  const points = [];
  for (let i = 0; i <= segments; i++) {
    const a = (i / segments) * Math.PI * 2;
    points.push(new THREE.Vector3(radius * Math.cos(a), 0, radius * Math.sin(a)));
  }
  const geo = new THREE.BufferGeometry().setFromPoints(points);
  return new THREE.Line(geo, new THREE.LineBasicMaterial({ color }));
}

// Contour de sphère façon "planisphère" : 3 grands cercles perpendiculaires
// (équateur + 2 méridiens). C'est ce schéma classique qui se lit bien même
// à l'arrêt sur une image 2D (voir la référence donnée pour les ovoïdes).
// Exporté pour être réutilisé par la tête (ellipsoïde, via mise à l'échelle
// du parent) et par les sphères d'articulation.
export function createSphereContour(radius, color = 0x000000, segments = 40) {
  const group = new THREE.Group();
  const equator = createCircleLine(radius, segments, color);       // plan XZ
  const meridianA = createCircleLine(radius, segments, color);
  meridianA.rotation.x = Math.PI / 2;                               // -> plan XY
  const meridianB = createCircleLine(radius, segments, color);
  meridianB.rotation.z = Math.PI / 2;                               // -> plan YZ
  group.add(equator, meridianA, meridianB);
  return group;
}

// Contour de cylindre façon dessin technique : 2 cercles (bases) reliés par
// quelques lignes verticales (silhouette), au lieu d'un maillage complet.
// S'étend de y=0 à y=length (mêmes repères que createLimbSegment).
export function createCylinderContour(radius, length, color = 0x000000, radialLines = 4, segments = 40) {
  const group = new THREE.Group();
  const bottom = createCircleLine(radius, segments, color);
  const top = createCircleLine(radius, segments, color);
  top.position.y = length;
  group.add(bottom, top);
  for (let i = 0; i < radialLines; i++) {
    const a = (i / radialLines) * Math.PI * 2;
    const x = radius * Math.cos(a), z = radius * Math.sin(a);
    const geo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(x, 0, z), new THREE.Vector3(x, length, z)
    ]);
    group.add(new THREE.Line(geo, new THREE.LineBasicMaterial({ color })));
  }
  return group;
}

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
  return markSolidWithEdges(mesh, geo, 0x111111, 1);
}

// Ovaloïde (tête) : sphère basse résolution étirée selon 3 axes. Le
// contour (3 grands cercles, rayon 1) est ajouté comme enfant : il hérite
// de la mise à l'échelle du mesh et devient donc 3 ellipses, exactement
// à la forme de l'ovoïde final.
export function createEllipsoid(width, height, depth) {
  const geo = new THREE.SphereGeometry(1, 24, 16);
  const mesh = new THREE.Mesh(geo, VOLUME_MATERIAL());
  mesh.userData.isSolid = true;
  mesh.scale.set(width / 2, height / 2, depth / 2);
  mesh.add(createSphereContour(1, 0x222222, 40));
  return mesh;
}

// Segment "fil de fer" : un cylindre fin le long de l'axe Y local, du
// point (0,0,0) au point (0,length,0). Retourne aussi une ancre "distal"
// (Object3D vide) sur laquelle accrocher la suite de la chaîne : c'est ce
// point d'ancrage qui garantit qu'un changement de longueur ne fait que
// TRANSLATER les enfants, sans les déformer (exigence 3.a).
export function createLimbSegment(length, radius) {
  const group = new THREE.Group();

  const geo = new THREE.CylinderGeometry(radius, radius, length, 16);
  const mesh = new THREE.Mesh(geo, LINE_MATERIAL());
  mesh.position.y = length / 2; // le cylindre est centré par défaut
  mesh.userData.isSolid = true;
  group.add(mesh);
  group.add(createCylinderContour(radius, length, 0x000000, 2, 32));

  const distal = new THREE.Object3D();
  distal.position.set(0, length, 0);
  group.add(distal);

  return { group, mesh, distal };
}

// Sphère d'articulation — même principe de contour explicite que la tête.
export function createJointSphere(radius) {
  const geo = new THREE.SphereGeometry(radius, 16, 12);
  const mesh = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ color: 0xc0392b }));
  mesh.userData.isSolid = true;
  mesh.add(createSphereContour(radius, 0x000000, 32));
  return mesh;
}

// Pavé simplifié pour main / pied : s'étend le long de +Y depuis l'origine
// (continuité naturelle avec le segment "fil de fer" auquel il s'accroche).
export function createFlatBlock(width, length, thickness) {
  const geo = new THREE.BoxGeometry(width, length, thickness);
  const mesh = new THREE.Mesh(geo, VOLUME_MATERIAL());
  mesh.position.y = length / 2;
  return markSolidWithEdges(mesh, geo, 0x111111, 1);
}

// Petite poignée sphérique interactive (contrôle de courbure de la colonne,
// sélection en mode posture...). Volontairement PAS marquée "isSolid" :
// elle est déjà masquée pendant tout export (voir setSpineHandlesVisible),
// inutile de la faire aussi passer en transparent.
export function createHandle(radius, color = 0xff8c00) {
  const geo = new THREE.SphereGeometry(radius, 12, 8);
  return new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color }));
}
