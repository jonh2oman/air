import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { 
  Rotate3d, 
  Eye, 
  Compass,
  Sliders,
  Layers,
  Sparkles,
  Sun,
  Cloud,
  Sunset
} from 'lucide-react';
import { ControlSurfacesState } from '../types';
import { soundManager } from '../utils/audio';

type SkyTheme = 'day' | 'sunset' | 'overcast';

export const FlightControls3D: React.FC = () => {
  const [controls, setControls] = useState<ControlSurfacesState>({
    pitch: 0,
    roll: 0,
    yaw: 0,
    trimElevator: 0,
    showAxes: false,
    autoCenter: true,
    viewAngle: 'orbit',
    aircraftModel: 'trainer', // Cessna 172 by default
  });

  const [showAxes, setShowAxes] = useState(false); // Independent, dedicated toggle
  const [spoilers, setSpoilers] = useState(0); // 0 to 100% for glider
  const [engineRpm, setEngineRpm] = useState(2300); // Throttle
  const [wireframeMode, setWireframeMode] = useState(false);
  const [skyTheme, setSkyTheme] = useState<SkyTheme>('day');
  const [isLoading, setIsLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [modelError, setModelError] = useState<string | null>(null);
  // Mirrors for values read inside the Three.js animation loop (the scene
  // effect must not be rebuilt every time a slider moves)
  const engineRpmRef = useRef(engineRpm);
  engineRpmRef.current = engineRpm;

  const [isDraggingStick, setIsDraggingStick] = useState(false);
  const stickPadRef = useRef<HTMLDivElement | null>(null);
  const canvasMountRef = useRef<HTMLDivElement | null>(null);

  // References for Three.js scene objects
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    aircraftContainer: THREE.Group;
    loadedModel: THREE.Object3D | null;
    elevatorNode: THREE.Object3D | null;
    rudderNode: THREE.Object3D | null;
    aileronLNode: THREE.Object3D | null;
    aileronRNode: THREE.Object3D | null;
    speedbrakeLNode: THREE.Object3D | null;
    speedbrakeRNode: THREE.Object3D | null;
    cloudsGroup: THREE.Group;
    skyMesh: THREE.Mesh;
    skyMaterial: THREE.MeshBasicMaterial;
    axesGroup: THREE.Group;
    materials: THREE.Material[];
    isInteractingCamera: boolean;
    mousePrevX: number;
    mousePrevY: number;
    camSpherical: { radius: number; theta: number; phi: number };
  } | null>(null);

  // Helper: Generate Atmospheric Skyscape Texture
  const generateSkyTexture = (theme: SkyTheme) => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;
    const grad = ctx.createLinearGradient(0, 0, 0, 512);

    if (theme === 'day') {
      grad.addColorStop(0.0, '#0369a1'); // Deep Sky Blue
      grad.addColorStop(0.35, '#38bdf8'); // Bright Sky
      grad.addColorStop(0.65, '#bae6fd'); // Atmospheric Horizon Haze
      grad.addColorStop(0.82, '#e0f2fe'); // Crisp Horizon
      grad.addColorStop(1.0, '#7dd3fc'); // Earth Haze
    } else if (theme === 'sunset') {
      grad.addColorStop(0.0, '#1e1b4b'); // Twilight Indigo
      grad.addColorStop(0.3, '#4338ca'); // Purple Sky
      grad.addColorStop(0.6, '#ea580c'); // Radiant Orange
      grad.addColorStop(0.78, '#f59e0b'); // Golden Horizon
      grad.addColorStop(1.0, '#7c2d12'); // Earth Dusk
    } else {
      // Overcast
      grad.addColorStop(0.0, '#475569'); // Slate Cloud Deck
      grad.addColorStop(0.4, '#64748b'); // Overcast Gray
      grad.addColorStop(0.75, '#cbd5e1'); // Horizon Mist
      grad.addColorStop(1.0, '#94a3b8');
    }

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.ClampToEdgeWrapping;
    tex.wrapT = THREE.ClampToEdgeWrapping;
    return tex;
  };

  // Helper: Generate Aerial Farmland / Earth Texture for the ground far below
  const generateGroundTexture = () => {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d')!;

    // Base earth green
    ctx.fillStyle = '#1e3a1e';
    ctx.fillRect(0, 0, 512, 512);

    // Patchwork fields
    const fieldColors = ['#274e27', '#2e5d2e', '#415e34', '#516839', '#3e4f2d', '#2b442b', '#1e331e'];
    for (let x = 0; x < 512; x += 40) {
      for (let y = 0; y < 512; y += 40) {
        ctx.fillStyle = fieldColors[Math.floor(Math.random() * fieldColors.length)];
        ctx.fillRect(x + 1, y + 1, 38, 38);
      }
    }

    // Winding river
    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 14;
    ctx.beginPath();
    ctx.moveTo(0, 180);
    ctx.bezierCurveTo(160, 240, 320, 120, 512, 280);
    ctx.stroke();

    const tex = new THREE.CanvasTexture(canvas);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(6, 6);
    return tex;
  };

  // Load Scene & 3D Models
  useEffect(() => {
    const canvasMount = canvasMountRef.current;
    if (!canvasMount) return;

    const width = canvasMount.clientWidth || 800;
    const height = canvasMount.clientHeight || 520;

    setIsLoading(true);
    setLoadingProgress(15);

    const scene = new THREE.Scene();

    // Atmospheric Fog matching horizon haze
    const fogColor = skyTheme === 'day' ? 0xbae6fd : skyTheme === 'sunset' ? 0xf59e0b : 0xcbd5e1;
    scene.fog = new THREE.FogExp2(fogColor, 0.007);

    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 300);
    camera.position.set(0, 3.5, 9.5);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = skyTheme === 'day' ? 1.25 : 1.1;

    canvasMount.replaceChildren(renderer.domElement);

    // ============================================
    // 1. AERIAL SKYDOME & LIGHTING
    // ============================================
    const skyTex = generateSkyTexture(skyTheme);
    const skyGeo = new THREE.SphereGeometry(180, 32, 24);
    const skyMat = new THREE.MeshBasicMaterial({ map: skyTex, side: THREE.BackSide, depthWrite: false });
    const skyMesh = new THREE.Mesh(skyGeo, skyMat);
    scene.add(skyMesh);

    // Natural Sunlight
    const sunLight = new THREE.DirectionalLight(
      skyTheme === 'sunset' ? 0xffedd5 : 0xffffff, 
      skyTheme === 'sunset' ? 2.4 : 2.2
    );
    sunLight.position.set(15, 24, 18);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 0.5;
    sunLight.shadow.camera.far = 50;
    sunLight.shadow.camera.left = -14;
    sunLight.shadow.camera.right = 14;
    sunLight.shadow.camera.top = 14;
    sunLight.shadow.camera.bottom = -14;
    sunLight.shadow.bias = -0.0003;
    scene.add(sunLight);

    // Sky Hemisphere Ambient Fill
    const hemiLight = new THREE.HemisphereLight(
      skyTheme === 'sunset' ? 0xfdba74 : 0xbae6fd,
      0x1e293b,
      skyTheme === 'sunset' ? 1.1 : 1.0
    );
    scene.add(hemiLight);

    // Sun Disc in the sky
    const sunDiscGeo = new THREE.SphereGeometry(3.5, 16, 16);
    const sunDiscMat = new THREE.MeshBasicMaterial({ 
      color: skyTheme === 'sunset' ? 0xffedd5 : 0xfffae0,
      transparent: true,
      opacity: 0.95
    });
    const sunDisc = new THREE.Mesh(sunDiscGeo, sunDiscMat);
    sunDisc.position.set(28, 45, 35);
    scene.add(sunDisc);

    // ============================================
    // 2. AERIAL TERRAIN & EARTH HORIZON (FAR BELOW)
    // ============================================
    const groundTex = generateGroundTexture();
    const groundGeo = new THREE.PlaneGeometry(240, 240);
    const groundMat = new THREE.MeshStandardMaterial({
      map: groundTex,
      roughness: 0.95,
      metalness: 0.05,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -18; // 3,000 ft below the aircraft
    ground.receiveShadow = true;
    scene.add(ground);

    // ============================================
    // 3. DRIFTING 3D CUMULUS CLOUDS
    // ============================================
    const cloudsGroup = new THREE.Group();
    scene.add(cloudsGroup);

    const cloudPuffMat = new THREE.MeshStandardMaterial({
      color: skyTheme === 'sunset' ? 0xfde047 : 0xffffff,
      roughness: 0.9,
      metalness: 0.05,
      transparent: true,
      opacity: 0.88,
    });

    // Create 16 fluffy cumulus cloud clusters scattered around
    for (let c = 0; c < 16; c++) {
      const cluster = new THREE.Group();
      const numPuffs = 5 + Math.floor(Math.random() * 6);
      const clusterRadius = 2.5 + Math.random() * 2.5;

      for (let p = 0; p < numPuffs; p++) {
        const puffGeo = new THREE.SphereGeometry(clusterRadius * (0.6 + Math.random() * 0.4), 8, 8);
        const puff = new THREE.Mesh(puffGeo, cloudPuffMat);
        puff.position.set(
          (Math.random() - 0.5) * clusterRadius * 2,
          (Math.random() - 0.5) * clusterRadius * 0.6,
          (Math.random() - 0.5) * clusterRadius * 2
        );
        puff.castShadow = true;
        cluster.add(puff);
      }

      cluster.position.set(
        (Math.random() - 0.5) * 110,
        -4 - Math.random() * 8, // Below the plane
        (Math.random() - 0.5) * 110
      );
      cloudsGroup.add(cluster);
    }

    // ============================================
    // 4. AIRCRAFT HIERARCHY & FLIGHT AXES
    // ============================================
    const aircraftContainer = new THREE.Group();
    scene.add(aircraftContainer);

    const axesGroup = new THREE.Group();
    aircraftContainer.add(axesGroup);

    // Coordinate Flight Axes
    // Longitudinal Axis (Roll) - Nose to Tail (Sky Blue)
    const longMat = new THREE.LineBasicMaterial({ color: 0x38bdf8, linewidth: 3 });
    const longGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 0, 6.5),
      new THREE.Vector3(0, 0, -6.5),
    ]);
    axesGroup.add(new THREE.Line(longGeo, longMat));

    // Lateral Axis (Pitch) - Wingtip to Wingtip (Red)
    const latMat = new THREE.LineBasicMaterial({ color: 0xef4444, linewidth: 3 });
    const latGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(-8.5, 0.2, 0.0),
      new THREE.Vector3(8.5, 0.2, 0.0),
    ]);
    axesGroup.add(new THREE.Line(latGeo, latMat));

    // Normal/Vertical Axis (Yaw) - Top to Bottom (Emerald Green)
    const vertMat = new THREE.LineBasicMaterial({ color: 0x10b981, linewidth: 3 });
    const vertGeo = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, 4.0, 0.0),
      new THREE.Vector3(0, -4.0, 0.0),
    ]);
    axesGroup.add(new THREE.Line(vertGeo, vertMat));

    axesGroup.visible = showAxes;

    // Load glTF 3D Model — served relative to the app's base path so it also
    // resolves under GitHub Pages (e.g. /air/glider.glb), not just domain root.
    const base = import.meta.env.BASE_URL || '/';
    const modelPath = `${base}${controls.aircraftModel === 'glider' ? 'glider.glb' : 'c172.glb'}`;
    setIsLoading(true);
    setLoadingProgress(0);
    setModelError(null);
    const loader = new GLTFLoader();

    sceneRef.current = {
      scene,
      camera,
      renderer,
      aircraftContainer,
      loadedModel: null,
      elevatorNode: null,
      rudderNode: null,
      aileronLNode: null,
      aileronRNode: null,
      speedbrakeLNode: null,
      speedbrakeRNode: null,
      cloudsGroup,
      skyMesh,
      skyMaterial: skyMat,
      axesGroup,
      materials: [],
      isInteractingCamera: false,
      mousePrevX: 0,
      mousePrevY: 0,
      camSpherical: { radius: 9.5, theta: Math.PI / 4, phi: Math.PI / 3.0 },
    };

    loader.load(
      modelPath,
      (gltf) => {
        const root = gltf.scene;
        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        // Center root
        root.position.x = -center.x;
        root.position.y = -center.y;
        root.position.z = -center.z;

        const modelHolder = new THREE.Group();

        if (controls.aircraftModel === 'glider') {
          // ASK-21 Glider scaling
          const scale = 7.0 / Math.max(size.x, size.z);
          modelHolder.scale.set(scale, scale, scale);
          modelHolder.rotation.y = Math.PI; // Nose faces forward along -Z
        } else {
          // Cessna 172 scaling (clean model with original attached propeller)
          const scale = 6.2 / Math.max(size.x, size.z);
          modelHolder.scale.set(scale, scale, scale);
          modelHolder.rotation.y = -Math.PI / 2; // Nose faces forward along -Z
        }

        modelHolder.add(root);
        aircraftContainer.add(modelHolder);

        const materialsList: THREE.Material[] = [];
        let elevNode: THREE.Object3D | null = null;
        let rudNode: THREE.Object3D | null = null;
        let ailLNode: THREE.Object3D | null = null;
        let ailRNode: THREE.Object3D | null = null;
        let spLNode: THREE.Object3D | null = null;
        let spRNode: THREE.Object3D | null = null;

        // Traverse hierarchy
        root.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh;
            mesh.castShadow = true;
            mesh.receiveShadow = true;

            if (mesh.material) {
              if (Array.isArray(mesh.material)) {
                mesh.material.forEach((m) => materialsList.push(m));
              } else {
                materialsList.push(mesh.material);
              }
            }
          }

          const nodeName = child.name.toLowerCase();
          if (nodeName.includes('elevator')) elevNode = child;
          if (nodeName.includes('rudder')) rudNode = child;
          if (nodeName.includes('aileronl') || nodeName.includes('aileron.l')) ailLNode = child;
          if (nodeName.includes('aileronr') || nodeName.includes('aileron.r')) ailRNode = child;
          if (nodeName.includes('speedbrakel') || nodeName.includes('spoilerl')) spLNode = child;
          if (nodeName.includes('speedbraker') || nodeName.includes('spoilerr')) spRNode = child;
        });

        // Store base transforms for zero-drift hinge articulation
        if (elevNode) {
          (elevNode as THREE.Object3D).userData.basePos = (elevNode as THREE.Object3D).position.clone();
          (elevNode as THREE.Object3D).userData.baseQuat = (elevNode as THREE.Object3D).quaternion.clone();
        }
        if (rudNode) {
          (rudNode as THREE.Object3D).userData.basePos = (rudNode as THREE.Object3D).position.clone();
          (rudNode as THREE.Object3D).userData.baseQuat = (rudNode as THREE.Object3D).quaternion.clone();
        }
        if (ailLNode) {
          (ailLNode as THREE.Object3D).userData.basePos = (ailLNode as THREE.Object3D).position.clone();
          (ailLNode as THREE.Object3D).userData.baseQuat = (ailLNode as THREE.Object3D).quaternion.clone();
        }
        if (ailRNode) {
          (ailRNode as THREE.Object3D).userData.basePos = (ailRNode as THREE.Object3D).position.clone();
          (ailRNode as THREE.Object3D).userData.baseQuat = (ailRNode as THREE.Object3D).quaternion.clone();
        }
        if (spLNode) {
          (spLNode as THREE.Object3D).userData.basePos = (spLNode as THREE.Object3D).position.clone();
        }
        if (spRNode) {
          (spRNode as THREE.Object3D).userData.basePos = (spRNode as THREE.Object3D).position.clone();
        }

        if (sceneRef.current) {
          sceneRef.current.loadedModel = modelHolder;
          sceneRef.current.materials = materialsList;
          sceneRef.current.elevatorNode = elevNode;
          sceneRef.current.rudderNode = rudNode;
          sceneRef.current.aileronLNode = ailLNode;
          sceneRef.current.aileronRNode = ailRNode;
          sceneRef.current.speedbrakeLNode = spLNode;
          sceneRef.current.speedbrakeRNode = spRNode;
        }

        setIsLoading(false);
      },
      (xhr) => {
        if (xhr.total > 0) {
          setLoadingProgress(Math.round((xhr.loaded / xhr.total) * 100));
        }
      },
      (err) => {
        console.error('Error loading glTF aircraft:', err);
        setIsLoading(false);
        setModelError(
          `Could not load the 3D model (${modelPath}). Check that the .glb file is deployed alongside the app, then reload.`
        );
      }
    );

    // Orbit mouse controls on the canvas
    const dom = renderer.domElement;
    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) {
        sceneRef.current!.isInteractingCamera = true;
        sceneRef.current!.mousePrevX = e.clientX;
        sceneRef.current!.mousePrevY = e.clientY;
      }
    };
    const onMouseMove = (e: MouseEvent) => {
      if (!sceneRef.current || !sceneRef.current.isInteractingCamera) return;
      const dx = e.clientX - sceneRef.current.mousePrevX;
      const dy = e.clientY - sceneRef.current.mousePrevY;
      sceneRef.current.mousePrevX = e.clientX;
      sceneRef.current.mousePrevY = e.clientY;

      const sph = sceneRef.current.camSpherical;
      sph.theta -= dx * 0.007;
      sph.phi = Math.max(0.1, Math.min(Math.PI / 2 - 0.05, sph.phi - dy * 0.007));
    };
    const onMouseUp = () => {
      if (sceneRef.current) sceneRef.current.isInteractingCamera = false;
    };
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      if (!sceneRef.current) return;
      const sph = sceneRef.current.camSpherical;
      sph.radius = Math.max(3.0, Math.min(18.0, sph.radius + e.deltaY * 0.01));
    };

    dom.addEventListener('mousedown', onMouseDown);
    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    dom.addEventListener('wheel', onWheel, { passive: false });

    const handleResize = () => {
      if (!canvasMount || !sceneRef.current) return;
      const w = canvasMount.clientWidth;
      const h = canvasMount.clientHeight;
      sceneRef.current.camera.aspect = w / h;
      sceneRef.current.camera.updateProjectionMatrix();
      sceneRef.current.renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    // Animation Loop with Cloud Drift
    let reqId: number;
    let clock = new THREE.Clock();

    const animate = () => {
      reqId = requestAnimationFrame(animate);
      if (!sceneRef.current) return;

      const { 
        camera, 
        renderer, 
        camSpherical, 
        cloudsGroup 
      } = sceneRef.current;
      const delta = clock.getDelta();

      // Drifting 3D clouds (engine RPM read via ref — the loop outlives renders)
      const driftSpeed = (controls.aircraftModel === 'glider' ? 45 : engineRpmRef.current / 35) * 0.04;
      cloudsGroup.children.forEach((cloud) => {
        cloud.position.z += driftSpeed * delta * 5.0;
        if (cloud.position.z > 55) {
          cloud.position.z = -55;
          cloud.position.x = (Math.random() - 0.5) * 110;
        }
      });

      // Camera position from spherical coords
      camera.position.x = camSpherical.radius * Math.sin(camSpherical.phi) * Math.sin(camSpherical.theta);
      camera.position.y = camSpherical.radius * Math.cos(camSpherical.phi);
      camera.position.z = camSpherical.radius * Math.sin(camSpherical.phi) * Math.cos(camSpherical.theta);
      camera.lookAt(0, 0.2, 0.0);

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(reqId);
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
      dom.removeEventListener('mousedown', onMouseDown);
      dom.removeEventListener('wheel', onWheel);
      // Dispose the loaded model: geometries, materials and textures, so
      // switching aircraft (or unmounting) doesn't leak GPU memory.
      if (sceneRef.current?.loadedModel) {
        sceneRef.current.loadedModel.traverse((obj) => {
          const mesh = obj as THREE.Mesh;
          if (mesh.isMesh) {
            mesh.geometry?.dispose();
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach((m) => {
              const mat = m as THREE.MeshStandardMaterial;
              if (mat.map) mat.map.dispose();
              if (mat.normalMap) mat.normalMap.dispose();
              mat.dispose();
            });
          }
        });
      }
      renderer.dispose();
      if (canvasMountRef.current && renderer.domElement.parentNode === canvasMountRef.current) {
        canvasMountRef.current.removeChild(renderer.domElement);
      }
    };
  }, [controls.aircraftModel, skyTheme]);

  // Dedicated Effect: Direct toggle for visual flight axes
  useEffect(() => {
    if (sceneRef.current?.axesGroup) {
      sceneRef.current.axesGroup.visible = showAxes;
    }
  }, [showAxes]);

  // Wireframe toggle
  useEffect(() => {
    if (!sceneRef.current) return;
    sceneRef.current.materials.forEach((mat) => {
      if ('wireframe' in mat) {
        (mat as THREE.MeshStandardMaterial).wireframe = wireframeMode;
      }
    });
  }, [wireframeMode]);

  // Helper to rotate submesh around its hinge line without drifting
  const rotateAroundHinge = (
    node: THREE.Object3D | null,
    hingeLocal: THREE.Vector3,
    axis: THREE.Vector3,
    angle: number
  ) => {
    if (!node || !node.userData.basePos || !node.userData.baseQuat) return;
    const basePos = node.userData.basePos as THREE.Vector3;
    const baseQuat = node.userData.baseQuat as THREE.Quaternion;

    const qDelta = new THREE.Quaternion().setFromAxisAngle(axis, angle);
    const worldH_before = hingeLocal.clone().applyQuaternion(baseQuat).add(basePos);
    node.quaternion.copy(baseQuat).multiply(qDelta);
    const worldH_rotated = hingeLocal.clone().applyQuaternion(node.quaternion).add(basePos);
    node.position.copy(basePos).add(worldH_before).sub(worldH_rotated);
  };

  // Deflect control surfaces & rotate aircraft attitude based on flight controls
  useEffect(() => {
    if (!sceneRef.current) return;
    const { 
      aircraftContainer,
      elevatorNode,
      rudderNode,
      aileronLNode,
      aileronRNode,
      speedbrakeLNode,
      speedbrakeRNode
    } = sceneRef.current;

    // 1. Deflect Elevator: Pull stick back (pitch > 0, positive = nose-up) -> elevator trailing edge deflects UP (+Y)
    rotateAroundHinge(
      elevatorNode,
      new THREE.Vector3(0.2917, -0.007, 0),
      new THREE.Vector3(0, 0, 1),
      controls.pitch * 0.45
    );

    // 2. Deflect Rudder: Right rudder (yaw > 0) -> rudder deflects RIGHT (+X)
    rotateAroundHinge(
      rudderNode,
      new THREE.Vector3(3.7558, 1.341, 0),
      new THREE.Vector3(0, 1, 0),
      controls.yaw * 0.45
    );

    // 3. Deflect Ailerons:
    // Roll Right (roll > 0): Right aileron moves UP, Left aileron moves DOWN
    rotateAroundHinge(
      aileronLNode,
      new THREE.Vector3(-0.2555, 0.405, 6.254),
      new THREE.Vector3(0, 0, 1),
      -controls.roll * 0.40
    );
    rotateAroundHinge(
      aileronRNode,
      new THREE.Vector3(-0.252, 0.405, -6.254),
      new THREE.Vector3(0, 0, 1),
      controls.roll * 0.40
    );

    // 4. Spoilers / Airbrakes: Pop up from wings
    if (speedbrakeLNode && speedbrakeRNode && speedbrakeLNode.userData.basePos && speedbrakeRNode.userData.basePos) {
      const spOffset = (spoilers / 100) * 0.18;
      speedbrakeLNode.position.copy(speedbrakeLNode.userData.basePos as THREE.Vector3).add(new THREE.Vector3(0, spOffset, 0));
      speedbrakeRNode.position.copy(speedbrakeRNode.userData.basePos as THREE.Vector3).add(new THREE.Vector3(0, spOffset, 0));
    }

    // 5. Aircraft attitude rotation along the primary axes (natural response)
    // Pull back stick (pitch > 0, positive = nose-up) -> nose pitches UP
    aircraftContainer.rotation.x = controls.pitch * 0.28; // Lateral / Pitch
    // Stick right (roll > 0) -> banks right
    aircraftContainer.rotation.z = -controls.roll * 0.38;  // Longitudinal / Roll
    // Right rudder (yaw > 0) -> yaws right
    aircraftContainer.rotation.y = -controls.yaw * 0.28;   // Normal / Yaw
  }, [controls, spoilers]);

  // Virtual Joystick pointer events
  const handleStickPointerDown = (e: React.PointerEvent) => {
    setIsDraggingStick(true);
    updateStickPos(e);
  };

  const updateStickPos = (e: React.PointerEvent | PointerEvent) => {
    if (!stickPadRef.current) return;
    const rect = stickPadRef.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const maxRadius = rect.width / 2 - 14;

    const dx = Math.max(-maxRadius, Math.min(maxRadius, e.clientX - centerX));
    const dy = Math.max(-maxRadius, Math.min(maxRadius, e.clientY - centerY));

    const rollNorm = dx / maxRadius;
    // Pull the stick DOWN toward you (dy > 0) = nose UP, so positive pitch = nose-up everywhere
    const pitchNorm = dy / maxRadius;

    setControls((prev) => ({
      ...prev,
      roll: Math.round(rollNorm * 100) / 100,
      pitch: Math.round(pitchNorm * 100) / 100,
    }));
  };

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (isDraggingStick) updateStickPos(e);
    };
    const onPointerUp = () => {
      if (isDraggingStick) {
        setIsDraggingStick(false);
        if (controls.autoCenter) {
          setControls((prev) => ({ ...prev, pitch: 0, roll: 0 }));
        }
      }
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isDraggingStick, controls.autoCenter]);

  // Camera preset buttons
  const setCameraPreset = (preset: 'orbit' | 'front' | 'tail' | 'cockpit' | 'top') => {
    if (!sceneRef.current) return;
    const sph = sceneRef.current.camSpherical;
    soundManager.playClick();
    if (preset === 'orbit') {
      sph.radius = 9.5;
      sph.theta = Math.PI / 4;
      sph.phi = Math.PI / 3.0;
    } else if (preset === 'front') {
      sph.radius = 8.0;
      sph.theta = Math.PI;
      sph.phi = Math.PI / 2.7;
    } else if (preset === 'tail') {
      sph.radius = 7.5;
      sph.theta = 0;
      sph.phi = Math.PI / 2.7;
    } else if (preset === 'cockpit') {
      sph.radius = 3.8;
      sph.theta = 0.2;
      sph.phi = Math.PI / 2.8;
    } else if (preset === 'top') {
      sph.radius = 11.0;
      sph.theta = 0;
      sph.phi = 0.12;
    }
  };

  return (
    <div className="space-y-6">
      {/* Title Bar & Model Switcher */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 backdrop-blur shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-rcac-blue/60 border border-rcac-sky/40 rounded-lg text-rcac-sky">
            <Rotate3d className="w-6 h-6 animate-spin" style={{ animationDuration: '14s' }} />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">
              Module 2: 3D Flight Simulation in Aerial Skyscape
            </h2>
            <p className="text-sm text-slate-400">
              Photorealistic 3D CAD Aircraft • Real-Time Control Deflections • 3D Atmospheric Sky & Clouds
            </p>
          </div>
        </div>

        {/* Fleet & Skyscape Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Fleet Switcher */}
          <div className="flex rounded-lg bg-slate-800 p-1 border border-slate-700">
            <button
              onClick={() => {
                setControls((prev) => ({ ...prev, aircraftModel: 'trainer' }));
                soundManager.playClick();
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                controls.aircraftModel === 'trainer'
                  ? 'bg-rcac-gold text-slate-950 shadow font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🛩️ Cessna 172 Skyhawk
            </button>
            <button
              onClick={() => {
                setControls((prev) => ({ ...prev, aircraftModel: 'glider' }));
                soundManager.playClick();
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                controls.aircraftModel === 'glider'
                  ? 'bg-rcac-sky text-slate-950 shadow font-bold'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🇨🇦 ASK-21 Cadet Glider
            </button>
          </div>

          {/* Sky Theme Switcher */}
          <div className="flex rounded-lg bg-slate-800 p-1 border border-slate-700">
            <button
              onClick={() => { setSkyTheme('day'); soundManager.playClick(); }}
              title="Daylight Sky"
              className={`p-1.5 rounded-md transition ${skyTheme === 'day' ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Sun className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setSkyTheme('sunset'); soundManager.playClick(); }}
              title="Golden Hour / Sunset"
              className={`p-1.5 rounded-md transition ${skyTheme === 'sunset' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'}`}
            >
              <Sunset className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setSkyTheme('overcast'); soundManager.playClick(); }}
              title="Overcast Skies"
              className={`p-1.5 rounded-md transition ${skyTheme === 'overcast' ? 'bg-slate-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Cloud className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Wireframe CAD Toggle */}
          <button
            onClick={() => {
              setWireframeMode(!wireframeMode);
              soundManager.playClick();
            }}
            className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
              wireframeMode
                ? 'bg-emerald-500/20 border-emerald-400 text-emerald-300 ring-1 ring-emerald-400/40'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>{wireframeMode ? 'Wireframe: ON' : 'Wireframe'}</span>
          </button>

          {/* Prominent Visual Flight Axes Toggle */}
          <button
            onClick={() => {
              setShowAxes(!showAxes);
              soundManager.playClick();
            }}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition flex items-center gap-1.5 ${
              showAxes
                ? 'bg-sky-500/20 border-sky-400 text-sky-300 shadow-md ring-1 ring-sky-400/40'
                : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>{showAxes ? 'Visual Axes: ON' : 'Visual Axes: OFF'}</span>
          </button>
        </div>
      </div>

      {/* Main 3D Viewport & Cadet Controls Deck */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* 3D Canvas Viewport (2 Columns) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative flex flex-col">
          {/* Header bar */}
          <div className="bg-slate-950/80 backdrop-blur px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center space-x-3">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-rcac-sky font-bold">
                {controls.aircraftModel === 'trainer' ? 'CESSNA 172 SKYHAWK' : 'SCHLEICHER ASK-21 CADET GLIDER'}
              </span>
              <span className="text-slate-400 hidden sm:inline">
                {controls.aircraftModel === 'trainer' ? '[Single-Engine High-Wing]' : '[34:1 High Performance Glider]'}
              </span>
            </div>

            {/* Quick Camera Preset Buttons */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setCameraPreset('orbit')}
                className="px-2 py-0.5 bg-slate-800/90 hover:bg-slate-700 rounded text-slate-300 text-[11px]"
              >
                Orbit
              </button>
              <button
                onClick={() => setCameraPreset('front')}
                className="px-2 py-0.5 bg-slate-800/90 hover:bg-slate-700 rounded text-slate-300 text-[11px]"
              >
                Nose
              </button>
              <button
                onClick={() => setCameraPreset('tail')}
                className="px-2 py-0.5 bg-slate-800/90 hover:bg-slate-700 rounded text-slate-300 text-[11px]"
              >
                Tail Chase
              </button>
              <button
                onClick={() => setCameraPreset('cockpit')}
                className="px-2 py-0.5 bg-slate-800/90 hover:bg-slate-700 rounded text-slate-300 text-[11px]"
              >
                Close-Up
              </button>
              <button
                onClick={() => setCameraPreset('top')}
                className="px-2 py-0.5 bg-slate-800/90 hover:bg-slate-700 rounded text-slate-300 text-[11px]"
              >
                Top Plan
              </button>
            </div>
          </div>

          {/* 3D Container with Skyscape View */}
          <div 
            className="w-full aspect-[16/10] min-h-[460px] bg-sky-950 cursor-grab active:cursor-grabbing relative overflow-hidden"
          >
            {/* Dedicated canvas mount container */}
            <div ref={canvasMountRef} className="absolute inset-0 w-full h-full" />

            {/* Loading Overlay */}
            {isLoading && (
              <div className="absolute inset-0 z-20 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center space-y-4 pointer-events-none">
                <div className="w-12 h-12 rounded-full border-4 border-slate-800 border-t-rcac-sky animate-spin" />
                <div className="text-center font-mono">
                  <p className="text-sm font-bold text-white">Rendering Aircraft & Atmospheric Skyscape...</p>
                  <p className="text-xs text-rcac-sky mt-1">{loadingProgress}% Completed</p>
                </div>
              </div>
            )}

            {/* Model Load Failure */}
            {!isLoading && modelError && (
              <div className="absolute inset-0 z-20 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-center space-y-3 p-6 text-center">
                <p className="text-rose-400 font-bold">⚠ 3D Model Failed to Load</p>
                <p className="text-xs text-slate-400 font-mono max-w-md">{modelError}</p>
                <button
                  onClick={() => window.location.reload()}
                  className="px-4 py-2 bg-rcac-sky text-slate-950 text-sm font-bold rounded-lg hover:bg-sky-400 transition"
                >
                  Reload
                </button>
              </div>
            )}

            {/* Overlay Info HUD */}
            <div className="absolute top-3 left-3 bg-slate-950/85 backdrop-blur p-2.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 space-y-1.5 shadow-lg">
              <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-1">
                <span className="font-bold text-white uppercase text-[10px] tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3 h-3 text-rcac-gold" />
                  <span>3D Flight Attitude</span>
                </span>
                {/* HUD quick toggle for axes */}
                <button
                  onClick={() => { setShowAxes(!showAxes); soundManager.playClick(); }}
                  className={`text-[9px] font-mono px-1.5 py-0.5 rounded border transition ${
                    showAxes ? 'bg-sky-500/30 border-sky-400 text-sky-200' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                  }`}
                >
                  {showAxes ? 'Axes: ON' : 'Axes: OFF'}
                </button>
              </div>
              <div><strong className="text-rose-400">Pitch (Lateral Axis):</strong> {(controls.pitch * 25).toFixed(0)}°</div>
              <div><strong className="text-sky-400">Roll (Longitudinal Axis):</strong> {(controls.roll * 25).toFixed(0)}°</div>
              <div><strong className="text-emerald-400">Yaw (Normal Axis):</strong> {(controls.yaw * 25).toFixed(0)}°</div>
              {controls.aircraftModel === 'glider' && (
                <div><strong className="text-amber-400">Airbrakes / Spoilers:</strong> {spoilers}%</div>
              )}
            </div>

            <div className="absolute bottom-3 left-3 bg-slate-950/80 backdrop-blur px-3 py-1.5 rounded-lg border border-slate-800 text-[11px] text-slate-300 select-none pointer-events-none">
              ✈️ 3,000 ft AGL Skyscape • Drag to orbit • Scroll wheel to zoom
            </div>
          </div>
        </div>

        {/* Cockpit Control Deck (1 Column) */}
        <div className="flex flex-col space-y-5">
          {/* Flight Stick Touchpad */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Cadet Flight Stick
              </h3>
              <label className="flex items-center gap-1.5 text-xs text-slate-400 cursor-pointer">
                <input
                  type="checkbox"
                  checked={controls.autoCenter}
                  onChange={(e) => setControls((prev) => ({ ...prev, autoCenter: e.target.checked }))}
                  className="rounded text-rcac-sky focus:ring-0"
                />
                <span>Auto-Center</span>
              </label>
            </div>

            {/* 2D Joystick Touchpad */}
            <div className="flex flex-col items-center">
              <div
                ref={stickPadRef}
                onPointerDown={handleStickPointerDown}
                className="w-48 h-48 rounded-full bg-slate-950 border-2 border-slate-800 relative shadow-inner cursor-pointer flex items-center justify-center overflow-hidden touch-none"
              >
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-full h-px bg-slate-800" />
                  <div className="h-full w-px bg-slate-800 absolute" />
                  <div className="w-32 h-32 rounded-full border border-slate-800/80" />
                  <div className="w-16 h-16 rounded-full border border-slate-800/50" />
                </div>

                {/* Stick Knob */}
                <div
                  className="w-10 h-10 rounded-full bg-gradient-to-br from-rcac-sky to-blue-700 border-2 border-white shadow-lg pointer-events-none flex items-center justify-center text-slate-950 font-bold text-xs"
                  style={{
                    transform: `translate(${controls.roll * 75}px, ${controls.pitch * 75}px)`,
                    transition: isDraggingStick ? 'none' : 'transform 0.25s cubic-bezier(0.18, 0.89, 0.32, 1.28)',
                  }}
                >
                  🕹️
                </div>
              </div>
              <div className="flex justify-between w-48 text-[10px] text-slate-500 mt-2 font-mono">
                <span>◀ Left Bank</span>
                <span>Stick</span>
                <span>Right Bank ▶</span>
              </div>
            </div>

            {/* Rudder Pedals */}
            <div className="space-y-2 pt-2 border-t border-slate-800">
              <div className="flex justify-between text-xs">
                <span className="font-semibold text-slate-300">Rudder Pedals (Yaw Axis)</span>
                <span className="font-mono text-emerald-400 font-bold">
                  {controls.yaw < 0 ? `LEFT ${(Math.abs(controls.yaw) * 100).toFixed(0)}%` : controls.yaw > 0 ? `RIGHT ${(controls.yaw * 100).toFixed(0)}%` : 'CENTER'}
                </span>
              </div>
              <input
                type="range"
                min="-1"
                max="1"
                step="0.05"
                value={controls.yaw}
                onChange={(e) => setControls((prev) => ({ ...prev, yaw: parseFloat(e.target.value) }))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>Left Pedal</span>
                <button
                  onClick={() => setControls((prev) => ({ ...prev, yaw: 0 }))}
                  className="text-rcac-sky hover:underline"
                >
                  Center
                </button>
                <span>Right Pedal</span>
              </div>
            </div>

            {/* Engine Throttle (For Cessna 172) */}
            {controls.aircraftModel === 'trainer' ? (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-amber-400 flex items-center gap-1.5">
                    <span>Engine Throttle</span>
                  </span>
                  <span className="font-mono text-amber-400 font-bold">{engineRpm} RPM</span>
                </div>
                <input
                  type="range"
                  min="600"
                  max="2700"
                  step="50"
                  value={engineRpm}
                  onChange={(e) => setEngineRpm(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Idle (600 RPM)</span>
                  <span>Cruise (2300)</span>
                  <span>Full (2700 RPM)</span>
                </div>
              </div>
            ) : (
              /* Glider Dive Spoilers / Airbrakes Lever (For Glider) */
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div className="flex justify-between text-xs">
                  <span className="font-semibold text-amber-400">Glider Dive Spoilers</span>
                  <span className="font-mono text-amber-400 font-bold">{spoilers}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  step="5"
                  value={spoilers}
                  onChange={(e) => setSpoilers(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>Flush (Stowed)</span>
                  <span>50%</span>
                  <span>Full Drag</span>
                </div>
              </div>
            )}
          </div>

          {/* Aerodynamic Features Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl text-xs space-y-2.5">
            <h4 className="font-bold text-white flex items-center justify-between border-b border-slate-800 pb-1.5">
              <span>{controls.aircraftModel === 'trainer' ? 'Cessna 172 Flight Systems' : 'ASK-21 Glider Systems'}</span>
              <span className="text-[10px] text-rcac-gold font-mono">ROYAL CANADIAN AIR CADETS</span>
            </h4>

            {controls.aircraftModel === 'trainer' ? (
              <div className="space-y-1.5 text-slate-300 leading-relaxed text-[11px]">
                <p>
                  • <strong>High-Wing Stability:</strong> On a high-wing aircraft the fuselage hangs below the wing, so in a sideslip the lower wing meets the airflow at a slightly higher angle of attack — a gentle restoring roll (the "keel effect"). Combined with wing dihedral, this gives the 172 its forgiving lateral stability. It is not a pendulum: the restoring forces are aerodynamic, not gravitational.
                </p>
                <p>
                  • <strong>Visual Flight Axes:</strong> Toggle the Visual Axes button above or in the HUD to display the three orthogonal coordinate axes passing through the aircraft's center of gravity.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5 text-slate-300 leading-relaxed text-[11px]">
                <p>
                  • <strong>Soaring in Thermals:</strong> High aspect ratio wings minimize induced drag at low airspeeds, allowing the glider to circle tightly inside rising warm air columns.
                </p>
                <p>
                  • <strong>Glide Ratio:</strong> 34:1 means that from 3,000 feet, you can glide about 17 nautical miles in calm air (3,000 ft × 34 ÷ 6,076 ft/NM)!
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
