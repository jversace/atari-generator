// mannequin.js — Construit toute la hiérarchie du mannequin à partir de
// l'objet `params`. Chaque partie est un THREE.Group parenté à la partie
// précédente : c'est cette hiérarchie parent/enfant (native à Three.js)
// qui garantit gratuitement l'exigence 3.a et 5.a ("les éléments en aval
// suivent") — on n'a rien à coder pour la propagation, on la reçoit du
// moteur de scène.
//
// Une nouvelle hiérarchie est reconstruite à chaque changement de cote
// (rebuild()) : le nombre de polygones est minuscule, donc c'est plus
// simple et largement assez rapide que de la mise à jour incrémentale.
// En revanche, les rotations posées en mode "Posture" (params.pose) sont
// réappliquées après la reconstruction pour ne pas perdre la pose.
//
// Convention d'axes : +Z = avant du corps, -Z = arrière. La colonne
// s'accroche sur la face ARRIÈRE (Z négatif) du bassin et du thorax.

import * as THREE from 'three';
import {
  createFrustumBox, createEllipsoid, createLimbSegment,
  createJointSphere, createFlatBlock, createHandle, createEdgeOverlay, createCylinderContour
} from './geometry.js';

const UP = new THREE.Vector3(0, 1, 0);

// Quaternion "amorti" alignant l'axe vertical sur la tangente de la courbe
// à un paramètre t donné (0 = bas de la colonne, 1 = haut). damping < 1
// évite une inclinaison trop brutale du bassin/thorax pour de petites
// variations de courbure. Exporté pour être réutilisé pendant le glisser
// interactif des poignées (voir main-renderer.js), sans dupliquer le calcul.
export function tiltQuaternionFromCurve(curve, t, damping = 1) {
  const tangent = curve.getTangent(t).normalize();
  const full = new THREE.Quaternion().setFromUnitVectors(UP, tangent);
  return damping >= 1 ? full : new THREE.Quaternion().slerp(full, damping);
}

// side = +1 (droite) ou -1 (gauche) ; sert à faire varier params.pose par membre
function buildArm(parentGroup, params, side, pose, registry) {
  const p = params;
  const shoulder = new THREE.Group();
  shoulder.position.set(side * p.thorax.topWidth / 2 * 1.02, p.thorax.height * 0.86, 0);
  shoulder.add(createJointSphere(p.joints.shoulder));
  parentGroup.add(shoulder);

  const upperArm = new THREE.Group();
  const upperArmPose = pose[`upperArm_${side}`];
  // Pose de repos par défaut : bras à l'horizontale, dans le prolongement
  // de l'épaule (position en croix / T-pose), pas replié vers l'intérieur.
  upperArm.rotation.set(
    upperArmPose ? upperArmPose.x : 0,
    upperArmPose ? upperArmPose.y : 0,
    upperArmPose ? upperArmPose.z : -side * THREE.MathUtils.degToRad(90)
  );
  const upperSeg = createLimbSegment(p.upperArm.length, p.upperArm.radius);
  upperArm.add(upperSeg.group);
  shoulder.add(upperArm);
  registry.push({ id: `upperArm_${side}`, label: side > 0 ? 'Bras droit (épaule)' : 'Bras gauche (épaule)', object: upperArm, kind: 'rotate' });

  const elbow = new THREE.Group();
  elbow.add(createJointSphere(p.joints.elbow));
  upperSeg.distal.add(elbow);

  const forearm = new THREE.Group();
  const forearmPose = pose[`forearm_${side}`];
  if (forearmPose) forearm.rotation.set(forearmPose.x, forearmPose.y, forearmPose.z);
  const forearmSeg = createLimbSegment(p.forearm.length, p.forearm.radius);
  forearm.add(forearmSeg.group);
  elbow.add(forearm);
  registry.push({ id: `forearm_${side}`, label: side > 0 ? 'Avant-bras droit (coude)' : 'Avant-bras gauche (coude)', object: forearm, kind: 'rotate' });

  const wrist = new THREE.Group();
  wrist.add(createJointSphere(p.joints.wrist));
  forearmSeg.distal.add(wrist);

  const hand = new THREE.Group();
  const handPose = pose[`hand_${side}`];
  if (handPose) hand.rotation.set(handPose.x, handPose.y, handPose.z);
  hand.add(createFlatBlock(p.hand.width, p.hand.length, p.hand.thickness));
  wrist.add(hand);
  registry.push({ id: `hand_${side}`, label: side > 0 ? 'Main droite' : 'Main gauche', object: hand, kind: 'rotate' });
}

function buildLeg(parentGroup, params, side, pose, registry) {
  const p = params;
  const hip = new THREE.Group();
  hip.position.set(side * p.pelvis.topWidth / 2 * 0.95, p.pelvis.wedgeHeight * 0.4, p.pelvis.botDepth * 0.1);
  hip.add(createJointSphere(p.joints.hip));
  parentGroup.add(hip);

  const thigh = new THREE.Group();
  const thighPose = pose[`thigh_${side}`];
  thigh.rotation.set(
    thighPose ? thighPose.x : THREE.MathUtils.degToRad(178),
    thighPose ? thighPose.y : 0,
    thighPose ? thighPose.z : (thighPose ? 0 : side * THREE.MathUtils.degToRad(3))
  );
  const thighSeg = createLimbSegment(p.thigh.length, p.thigh.radius);
  thigh.add(thighSeg.group);
  hip.add(thigh);
  registry.push({ id: `thigh_${side}`, label: side > 0 ? 'Cuisse droite (hanche)' : 'Cuisse gauche (hanche)', object: thigh, kind: 'rotate' });

  const knee = new THREE.Group();
  knee.add(createJointSphere(p.joints.knee));
  thighSeg.distal.add(knee);

  const shin = new THREE.Group();
  const shinPose = pose[`shin_${side}`];
  if (shinPose) shin.rotation.set(shinPose.x, shinPose.y, shinPose.z);
  const shinSeg = createLimbSegment(p.shin.length, p.shin.radius);
  shin.add(shinSeg.group);
  knee.add(shin);
  registry.push({ id: `shin_${side}`, label: side > 0 ? 'Tibia droit (genou)' : 'Tibia gauche (genou)', object: shin, kind: 'rotate' });

  const ankle = new THREE.Group();
  ankle.add(createJointSphere(p.joints.ankle));
  shinSeg.distal.add(ankle);

  const foot = new THREE.Group();
  const footPose = pose[`foot_${side}`];
  foot.rotation.set(
    footPose ? footPose.x : THREE.MathUtils.degToRad(-90),
    footPose ? footPose.y : 0,
    footPose ? footPose.z : 0
  );
  foot.add(createFlatBlock(p.foot.width, p.foot.length, p.foot.thickness));
  ankle.add(foot);
  registry.push({ id: `foot_${side}`, label: side > 0 ? 'Pied droit' : 'Pied gauche', object: foot, kind: 'rotate' });
}

// Construit le mannequin complet. Retourne :
//  - root       : le THREE.Group à ajouter à la scène
//  - registry   : liste des parties sélectionnables en mode Posture
//  - spineHandles : les 2 poignées de courbure de la colonne (mode Bézier)
//  - spineControl : hooks pour le rafraîchissement temps réel (voir main-renderer.js)
export function buildMannequin(params) {
  const p = params;
  const pose = p.pose || {};
  const root = new THREE.Group();
  const registry = [];

  const legLength = p.thigh.length + p.shin.length + p.joints.ankle;

  // --- Courbe de la colonne (calculée d'abord, en coordonnées locales
  // pures) : le bassin ET le thorax s'accrochent chacun à une extrémité de
  // cette même courbe, donc on en a besoin avant de construire l'un ou
  // l'autre. B'(0) ne dépend que de curve1, B'(1) que de curve2 (propriété
  // des courbes de Bézier cubiques) : les deux inclinaisons sont donc bien
  // indépendantes l'une de l'autre.
  const spineLen = p.spine.length;
  const start = new THREE.Vector3(0, 0, 0);
  const end = new THREE.Vector3(0, spineLen, 0);
  const handle1 = createHandle(1.6);
  handle1.position.set(0, spineLen / 3, p.spine.curve1);
  const handle2 = createHandle(1.6);
  handle2.position.set(0, spineLen * 2 / 3, p.spine.curve2);
  const curve = new THREE.CubicBezierCurve3(start, handle1.position, handle2.position, end);

  // --- Bassin ----------------------------------------------------------
  const pelvis = new THREE.Group();
  const pelvisPose = pose.pelvis;
  pelvis.position.set(
    pelvisPose ? pelvisPose.px : 0,
    pelvisPose ? pelvisPose.py : legLength,
    pelvisPose ? pelvisPose.pz : 0
  );
  const hasPelvisOverride = !!pelvisPose;
  if (pelvisPose) {
    pelvis.rotation.set(pelvisPose.x, pelvisPose.y, pelvisPose.z);
  } else {
    // Inclinaison du bassin dérivée de la courbure basse de la colonne
    // (accrochée par sa face arrière, tout en bas) — amortie pour rester
    // plausible même aux valeurs extrêmes du slider.
    pelvis.quaternion.copy(tiltQuaternionFromCurve(curve, 0, 0.4));
  }
  root.add(pelvis);
  registry.push({ id: 'pelvis', label: 'Bassin / pelvis', object: pelvis, kind: 'both' });

  // coin bas (wedge) : de quasi rien à (botWidth,botDepth)
  const wedge = createFrustumBox(p.pelvis.botWidth, p.pelvis.botDepth, 1.2, 1.2, p.pelvis.wedgeHeight);
  pelvis.add(wedge);
  // boîte iliaque au-dessus du coin
  const iliacBox = createFrustumBox(p.pelvis.topWidth, p.pelvis.topDepth, p.pelvis.botWidth, p.pelvis.botDepth, p.pelvis.height);
  iliacBox.position.y = p.pelvis.wedgeHeight;
  pelvis.add(iliacBox);

  const pelvisTopY = p.pelvis.wedgeHeight + p.pelvis.height;
  // Décale l'accroche de la colonne vers la face arrière du bassin plutôt
  // que son centre.
  const pelvisBackOffset = -Math.max(p.pelvis.topDepth, p.pelvis.botDepth) * 0.3;

  // --- Colonne (double courbure, Bézier cubique) ------------------------
  const spineGroup = new THREE.Group();
  spineGroup.position.set(0, pelvisTopY, pelvisBackOffset);
  pelvis.add(spineGroup);

  const spineTubeGeo = new THREE.TubeGeometry(curve, 20, 1.1, 6, false);
  const spineTube = new THREE.Mesh(spineTubeGeo, new THREE.MeshBasicMaterial({ color: 0x111111 }));
  spineTube.userData.isSolid = true;
  spineTube.add(createEdgeOverlay(spineTubeGeo, 0x000000, 15));
  spineGroup.add(spineTube, handle1, handle2);
  const spineHandles = [
    { id: 'spineCurve1', label: 'Courbure basse (lombaire)', object: handle1, paramPath: 'spine.curve1' },
    { id: 'spineCurve2', label: 'Courbure haute (thoracique)', object: handle2, paramPath: 'spine.curve2' },
  ];

  // --- Thorax (au bout de la colonne, orienté selon la tangente) --------
  const thorax = new THREE.Group();
  const thoraxPose = pose.thorax;
  if (thoraxPose && thoraxPose.px !== undefined) {
    thorax.position.set(thoraxPose.px, thoraxPose.py, thoraxPose.pz);
  } else {
    thorax.position.copy(curve.getPoint(1));
  }
  const hasThoraxOverride = !!(thoraxPose && thoraxPose.px !== undefined);
  if (thoraxPose) {
    thorax.rotation.set(thoraxPose.x, thoraxPose.y, thoraxPose.z);
  } else {
    thorax.quaternion.copy(tiltQuaternionFromCurve(curve, 1, 1));
  }
  spineGroup.add(thorax);
  registry.push({ id: 'thorax', label: 'Thorax', object: thorax, kind: 'both' });

  // Le volume du thorax est décalé vers l'avant : son origine (0,0,0),
  // elle, reste sur la ligne de la colonne (face arrière) — c'est là que
  // se poursuit visuellement la colonne à travers la cage thoracique.
  const thoraxDepthRef = Math.max(p.thorax.topDepth, p.thorax.botDepth);
  const thoraxMesh = createFrustumBox(p.thorax.topWidth, p.thorax.topDepth, p.thorax.botWidth, p.thorax.botDepth, p.thorax.height);
  thoraxMesh.position.z = thoraxDepthRef * 0.32;
  thorax.add(thoraxMesh);

  // Portion "thoracique" de la colonne : rigide (le thorax est un bloc
  // fixe), donc un simple cylindre droit suffit — pas besoin d'une
  // courbure indépendante ici. Il continue jusqu'au cou.
  const thoracicSpineGeo = new THREE.CylinderGeometry(1.1, 1.1, p.thorax.height, 12);
  const thoracicSpine = new THREE.Mesh(thoracicSpineGeo, new THREE.MeshBasicMaterial({ color: 0x111111 }));
  thoracicSpine.userData.isSolid = true;
  thoracicSpine.position.y = p.thorax.height / 2;
  thorax.add(thoracicSpine);
  // Contour ajouté au thorax (pas au mesh recentré ci-dessus) : il utilise
  // directement le repère y=0..hauteur, sans double décalage à gérer.
  thorax.add(createCylinderContour(1.1, p.thorax.height, 0x000000, 2, 24));

  // --- Cou + tête --------------------------------------------------------
  const neck = new THREE.Group();
  neck.position.set(0, p.thorax.height, 0);
  thorax.add(neck);
  const neckSeg = createLimbSegment(p.neck.height, p.neck.radius);
  neck.add(neckSeg.group);

  const head = new THREE.Group();
  const headPose = pose.head;
  if (headPose) head.rotation.set(headPose.x, headPose.y, headPose.z);
  neckSeg.distal.add(head);
  registry.push({ id: 'head', label: 'Tête', object: head, kind: 'rotate' });
  const headMesh = createEllipsoid(p.head.width, p.head.height, p.head.depth);
  headMesh.position.y = p.head.height / 2;
  head.add(headMesh);

  // --- Bras et jambes ---------------------------------------------------
  buildArm(thorax, p, 1, pose, registry);
  buildArm(thorax, p, -1, pose, registry);
  buildLeg(pelvis, p, 1, pose, registry);
  buildLeg(pelvis, p, -1, pose, registry);

  // Permet au renderer de rafraîchir la colonne (tube + bassin + thorax +
  // tout ce qui en dépend, via la hiérarchie) pendant qu'on glisse une
  // poignée, sans reconstruire l'ensemble du mannequin à chaque frame.
  const spineControl = {
    curve, spineTube, pelvis, thorax,
    hasPelvisOverride, hasThoraxOverride
  };

  return { root, registry, spineHandles, spineControl };
}
