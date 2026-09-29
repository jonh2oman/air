import React, { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { 
  Play, 
  RotateCcw, 
  Camera, 
  Wind, 
  Gauge, 
  ChevronUp, 
  ChevronDown, 
  AlertTriangle, 
  Trophy, 
  Compass, 
  Volume2,
  Info,
  Maximize2
} from 'lucide-react';
import { soundManager } from '../utils/audio';

// Reused scratch vector for the chase camera (avoids a per-frame allocation)
const chaseTargetVec = new THREE.Vector3();

type FlightScenario = 'takeoff' | 'landing' | 'circuit' | 'glider-winch';
type CameraMode = 'cockpit' | 'chase';

interface FlightState {
  x: number; // lateral position (m)
  y: number; // altitude (m) (0 = runway surface)
  z: number; // longitudinal position (m) (Runway 27 along -Z)
  vx: number;
  vy: number;
  vz: number;
  pitch: number; // radians
  roll: number;  // radians
  yaw: number;   // radians
  pitchRate: number;
  rollRate: number;
  yawRate: number;
  throttle: number; // 0 to 100%
  flaps: number; // 0, 10, 20, 30 deg (or spoiler % for glider)
  brakes: boolean;
  airspeed: number; // knots
  altitudeFt: number; // feet AGL
  vsiFpm: number; // vertical speed fpm
  headingDeg: number; // 0 to 360
  stallWarning: boolean;
  onGround: boolean;
  status: 'ready' | 'flying' | 'landed' | 'crashed';
  landingFeedback: string | null;
}

export const FlightSimulator3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scenario, setScenario] = useState<FlightScenario>('takeoff');
  const [aircraftType, setAircraftType] = useState<'c172' | 'glider'>('c172');
  const [cameraMode, setCameraMode] = useState<CameraMode>('chase');
  const [isSimRunning, setIsSimRunning] = useState<boolean>(true);

  // Flight Physics Telemetry for UI
  const [telemetry, setTelemetry] = useState<FlightState>({
    x: 0,
    y: 0,
    z: 800,
    vx: 0,
    vy: 0,
    vz: 0,
    pitch: 0,
    roll: 0,
    yaw: 0,
    pitchRate: 0,
    rollRate: 0,
    yawRate: 0,
    throttle: 0,
    flaps: 0,
    brakes: true,
    airspeed: 0,
    altitudeFt: 0,
    vsiFpm: 0,
    headingDeg: 270,
    stallWarning: false,
    onGround: true,
    status: 'ready',
    landingFeedback: null
  });

  // PAPI Light status: 0 (all red) to 4 (all white)
  const [papiLights, setPapiLights] = useState<[boolean, boolean, boolean, boolean]>([false, false, false, false]);
  // PAPI indicator is only shown when established on final near the touchdown point
  const [papiVisible, setPapiVisible] = useState<boolean>(false);
  // Visible notice when the GLB aircraft model fails to load (procedural backup in use)
  const [modelLoadError, setModelLoadError] = useState<string | null>(null);
  const [stickOffset, setStickOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

  // Virtual Controls
  const controlInputs = useRef({
    pitchInput: 0, // -1 (back/climb) to +1 (forward/dive)
    rollInput: 0,  // -1 (left) to +1 (right)
    yawInput: 0,   // -1 (left) to +1 (right rudder)
    throttleInput: 0, // 0 to 100
    brakes: false
  });

  // Simulator Engine Internal Refs
  const simState = useRef<FlightState>({ ...telemetry });
  const sceneRef = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    aircraftGroup: THREE.Group;
    loadedModel: THREE.Group | null;
    elevatorNode: THREE.Object3D | null;
    rudderNode: THREE.Object3D | null;
    aileronLNode: THREE.Object3D | null;
    aileronRNode: THREE.Object3D | null;
    speedbrakeLNode: THREE.Object3D | null;
    speedbrakeRNode: THREE.Object3D | null;
    papiMeshes: THREE.Mesh[];
    runwayLength: number;
    touchdownZ: number;
  } | null>(null);

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

  // Robust Flight Stick Pointer Drag Handler with selection blocking
  const handleStickPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    window.getSelection()?.removeAllRanges();
    document.body.style.userSelect = 'none';
    const pad = e.currentTarget;
    try {
      pad.setPointerCapture(e.pointerId);
    } catch {}

    const rect = pad.getBoundingClientRect();
    const maxRadius = rect.width / 2 - 20;

    const updateFromCoords = (clientX: number, clientY: number) => {
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const dx = clientX - cx;
      const dy = clientY - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const clampedDist = Math.min(maxRadius, dist);
      const angle = Math.atan2(dy, dx);

      const nx = clampedDist * Math.cos(angle);
      const ny = clampedDist * Math.sin(angle);

      // Roll: -1 (left) to +1 (right)
      const rollVal = nx / maxRadius;
      // Pitch: pulling back on stick (dragging down, ny > 0) must pitch nose UP (pitchInput = +1.0)
      const pitchVal = ny / maxRadius;

      controlInputs.current.rollInput = Math.max(-1, Math.min(1, rollVal));
      controlInputs.current.pitchInput = Math.max(-1, Math.min(1, pitchVal));

      setStickOffset({ x: nx, y: ny });
    };

    updateFromCoords(e.clientX, e.clientY);

    const onPointerMove = (ev: PointerEvent) => {
      ev.preventDefault();
      updateFromCoords(ev.clientX, ev.clientY);
    };

    const onPointerUp = (ev: PointerEvent) => {
      ev.preventDefault();
      controlInputs.current.rollInput = 0;
      controlInputs.current.pitchInput = 0;
      setStickOffset({ x: 0, y: 0 });
      document.body.style.userSelect = '';
      pad.removeEventListener('pointermove', onPointerMove);
      pad.removeEventListener('pointerup', onPointerUp);
      try {
        pad.releasePointerCapture(e.pointerId);
      } catch {}
    };

    pad.addEventListener('pointermove', onPointerMove);
    pad.addEventListener('pointerup', onPointerUp);
  };

  // Initialize Flight State based on Scenario
  const resetToScenario = (scen: FlightScenario, type: 'c172' | 'glider') => {
    let newState: FlightState;
    if (scen === 'takeoff') {
      newState = {
        x: 0,
        y: 0.1,
        z: 750, // Threshold of Runway 27
        vx: 0,
        vy: 0,
        vz: 0,
        pitch: 0,
        roll: 0,
        yaw: 0, // Facing Runway 27 (-Z)
        pitchRate: 0,
        rollRate: 0,
        yawRate: 0,
        throttle: 0,
        flaps: 0,
        brakes: true,
        airspeed: 0,
        altitudeFt: 0,
        vsiFpm: 0,
        headingDeg: 270,
        stallWarning: false,
        onGround: true,
        status: 'ready',
        landingFeedback: null
      };
      controlInputs.current.throttleInput = 0;
    } else if (scen === 'landing') {
      // True 3 NM final on a 3° glide path to the touchdown point (Z = 700):
      // 3 NM = 5556 m → Z = 700 + 5556 = 6256; height = 5556 × tan(3°) ≈ 291 m ≈ 955 ft AGL
      // Speed 65 knots (~33.4 m/s); 3° sink ≈ 1.75 m/s (~344 fpm)
      newState = {
        x: 0,
        y: 291,
        z: 6256,
        vx: 0,
        vy: -1.75,
        vz: -33.4,
        pitch: 0.035, // Flared attitude (~2 deg nose up) with 20 deg flaps
        roll: 0,
        yaw: 0,
        pitchRate: 0,
        rollRate: 0,
        yawRate: 0,
        throttle: 45,
        flaps: 20,
        brakes: false,
        airspeed: 65,
        altitudeFt: 955,
        vsiFpm: -344,
        headingDeg: 270,
        stallWarning: false,
        onGround: false,
        status: 'flying',
        landingFeedback: null
      };
      controlInputs.current.throttleInput = 45;
    } else if (scen === 'circuit') {
      // Downwind leg at 1,000 ft AGL (305m), heading 090 (+Z)
      newState = {
        x: -900,
        y: 305,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 42,
        pitch: 0.03,
        roll: 0,
        yaw: Math.PI,
        pitchRate: 0,
        rollRate: 0,
        yawRate: 0,
        throttle: 65,
        flaps: 0,
        brakes: false,
        airspeed: 82,
        altitudeFt: 1000,
        vsiFpm: 0,
        headingDeg: 90,
        stallWarning: false,
        onGround: false,
        status: 'flying',
        landingFeedback: null
      };
      controlInputs.current.throttleInput = 65;
    } else {
      // Glider Winch Launch scenario
      newState = {
        x: 0,
        y: 0.1,
        z: 750,
        vx: 0,
        vy: 0,
        vz: 0,
        pitch: 0,
        roll: 0,
        yaw: 0,
        pitchRate: 0,
        rollRate: 0,
        yawRate: 0,
        throttle: 0,
        flaps: 0,
        brakes: false,
        airspeed: 0,
        altitudeFt: 0,
        vsiFpm: 0,
        headingDeg: 270,
        stallWarning: false,
        onGround: true,
        status: 'ready',
        landingFeedback: null
      };
      controlInputs.current.throttleInput = 0;
    }

    controlInputs.current.pitchInput = 0;
    controlInputs.current.rollInput = 0;
    controlInputs.current.yawInput = 0;
    setStickOffset({ x: 0, y: 0 });

    simState.current = { ...newState };
    setTelemetry({ ...newState });
  };

  // Keyboard Event Listeners for Flight Controls
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent scrolling on arrows/space
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
        e.preventDefault();
      }

      switch (e.key) {
        case 'ArrowUp':
        case 'w':
        case 'W':
          controlInputs.current.pitchInput = -1.0; // Pitch Down (stick forward)
          setStickOffset((prev) => ({ ...prev, y: -44 }));
          break;
        case 'ArrowDown':
        case 's':
        case 'S':
          controlInputs.current.pitchInput = 1.0; // Pitch Up (stick back)
          setStickOffset((prev) => ({ ...prev, y: 44 }));
          break;
        case 'ArrowLeft':
        case 'a':
        case 'A':
          controlInputs.current.rollInput = -1.0; // Bank Left
          setStickOffset((prev) => ({ ...prev, x: -40 }));
          break;
        case 'ArrowRight':
        case 'd':
        case 'D':
          controlInputs.current.rollInput = 1.0; // Bank Right
          setStickOffset((prev) => ({ ...prev, x: 40 }));
          break;
        case 'q':
        case 'Q':
          controlInputs.current.yawInput = -1.0; // Rudder Left
          break;
        case 'e':
        case 'E':
          controlInputs.current.yawInput = 1.0; // Rudder Right
          break;
        case 'Shift':
          // Throttle Up
          controlInputs.current.throttleInput = Math.min(100, controlInputs.current.throttleInput + 5);
          break;
        case 'Control':
          // Throttle Down
          controlInputs.current.throttleInput = Math.max(0, controlInputs.current.throttleInput - 5);
          break;
        case 'f':
        case 'F':
          // Cycle Flaps
          setTelemetry((prev) => {
            const nextFlaps = prev.flaps >= 30 ? 0 : prev.flaps + 10;
            simState.current.flaps = nextFlaps;
            soundManager.playClick();
            return { ...prev, flaps: nextFlaps };
          });
          break;
        case 'b':
        case 'B':
        case ' ':
          // Wheel Brakes
          controlInputs.current.brakes = true;
          simState.current.brakes = true;
          break;
        case 'c':
        case 'C':
          // Toggle Camera
          setCameraMode((prev) => (prev === 'chase' ? 'cockpit' : 'chase'));
          soundManager.playClick();
          break;
        case 'r':
        case 'R':
          // Reset
          resetToScenario(scenario, aircraftType);
          soundManager.playClick();
          break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowUp':
        case 'ArrowDown':
        case 'w':
        case 'W':
        case 's':
        case 'S':
          controlInputs.current.pitchInput = 0;
          setStickOffset((prev) => ({ ...prev, y: 0 }));
          break;
        case 'ArrowLeft':
        case 'ArrowRight':
        case 'a':
        case 'A':
        case 'd':
        case 'D':
          controlInputs.current.rollInput = 0;
          setStickOffset((prev) => ({ ...prev, x: 0 }));
          break;
        case 'q':
        case 'Q':
        case 'e':
        case 'E':
          controlInputs.current.yawInput = 0;
          break;
        case 'b':
        case 'B':
        case ' ':
          controlInputs.current.brakes = false;
          simState.current.brakes = false;
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [scenario, aircraftType]);

  // Main Three.js Scene Setup & Physics Animation Loop
  useEffect(() => {
    if (!containerRef.current) return;
    setModelLoadError(null); // clear any previous model-load failure notice
    const width = containerRef.current.clientWidth;
    const height = containerRef.current.clientHeight;

    // 1. Scene, Camera, Renderer
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x7dd3fc); // Daylight Sky Blue
    scene.fog = new THREE.FogExp2(0x93c5fd, 0.00035);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.5, 12000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
    renderer.setSize(width, height);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    containerRef.current.appendChild(renderer.domElement);

    // 2. Lighting
    const hemiLight = new THREE.HemisphereLight(0xffffff, 0x334155, 0.9);
    scene.add(hemiLight);

    const sunLight = new THREE.DirectionalLight(0xfffaed, 1.4);
    sunLight.position.set(500, 1200, 800);
    sunLight.castShadow = true;
    sunLight.shadow.mapSize.width = 2048;
    sunLight.shadow.mapSize.height = 2048;
    sunLight.shadow.camera.near = 10;
    sunLight.shadow.camera.far = 4000;
    const d = 300;
    sunLight.shadow.camera.left = -d;
    sunLight.shadow.camera.right = d;
    sunLight.shadow.camera.top = d;
    sunLight.shadow.camera.bottom = -d;
    scene.add(sunLight);

    // 3. Terrain & Grass Airfield
    const terrainGeo = new THREE.PlaneGeometry(16000, 16000, 32, 32);
    const terrainMat = new THREE.MeshStandardMaterial({
      color: 0x166534, // Lush airfield grass
      roughness: 0.95,
      metalness: 0.05
    });
    const terrain = new THREE.Mesh(terrainGeo, terrainMat);
    terrain.rotation.x = -Math.PI / 2;
    terrain.position.y = -0.1;
    terrain.receiveShadow = true;
    scene.add(terrain);

    // 4. Paved Runway 27 / 09 (Length: 2,000m, Width: 45m)
    const runwayLength = 2000;
    const runwayWidth = 45;
    const runwayGeo = new THREE.PlaneGeometry(runwayWidth, runwayLength);
    const runwayMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Dark Asphalt
      roughness: 0.85,
      metalness: 0.1
    });
    const runway = new THREE.Mesh(runwayGeo, runwayMat);
    runway.rotation.x = -Math.PI / 2;
    runway.position.set(0, 0, 0);
    runway.receiveShadow = true;
    scene.add(runway);

    // Runway Centerline Dashes
    const centerlineGroup = new THREE.Group();
    const dashLength = 30;
    const dashGap = 20;
    const numDashes = Math.floor(runwayLength / (dashLength + dashGap));
    const dashGeo = new THREE.PlaneGeometry(1.2, dashLength);
    const whiteMarkMat = new THREE.MeshBasicMaterial({ color: 0xffffff });

    for (let i = -numDashes / 2; i < numDashes / 2; i++) {
      const dash = new THREE.Mesh(dashGeo, whiteMarkMat);
      dash.rotation.x = -Math.PI / 2;
      dash.position.set(0, 0.02, i * (dashLength + dashGap));
      centerlineGroup.add(dash);
    }
    scene.add(centerlineGroup);

    // Threshold Stripes (Piano Keys) at both ends
    const addThresholdStripes = (zPos: number) => {
      const stripeGeo = new THREE.PlaneGeometry(1.8, 30);
      for (let s = -18; s <= 18; s += 4.5) {
        const stripe = new THREE.Mesh(stripeGeo, whiteMarkMat);
        stripe.rotation.x = -Math.PI / 2;
        stripe.position.set(s, 0.02, zPos);
        scene.add(stripe);
      }
    };
    addThresholdStripes(runwayLength / 2 - 25); // Runway 27 threshold
    addThresholdStripes(-runwayLength / 2 + 25); // Runway 09 threshold

    // Runway Touchdown Aiming Markers
    const aimGeo = new THREE.PlaneGeometry(6, 45);
    const aim1 = new THREE.Mesh(aimGeo, whiteMarkMat);
    aim1.rotation.x = -Math.PI / 2;
    aim1.position.set(-10, 0.02, runwayLength / 2 - 300);
    scene.add(aim1);

    const aim2 = aim1.clone();
    aim2.position.set(10, 0.02, runwayLength / 2 - 300);
    scene.add(aim2);

    // 5. PAPI (Precision Approach Path Indicator) 4-Light Array
    // Located at X = -32 (left side of Runway 27 approach), Z = touchdown point (approx 650)
    const touchdownZ = runwayLength / 2 - 300; // Z = 700
    const papiMeshes: THREE.Mesh[] = [];
    const papiGroup = new THREE.Group();
    papiGroup.position.set(-32, 0.5, touchdownZ);

    for (let p = 0; p < 4; p++) {
      const boxGeo = new THREE.BoxGeometry(1.5, 1, 1.5);
      const boxMat = new THREE.MeshStandardMaterial({ color: 0x334155 });
      const box = new THREE.Mesh(boxGeo, boxMat);
      box.position.set(-p * 3.5, 0, 0);

      // Front lens light
      const lensGeo = new THREE.CircleGeometry(0.5, 16);
      const lensMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
      const lens = new THREE.Mesh(lensGeo, lensMat);
      lens.position.set(0, 0, 0.76);
      box.add(lens);

      papiMeshes.push(lens);
      papiGroup.add(box);
    }
    scene.add(papiGroup);

    // 6. Airfield Buildings (Hangar & Control Tower)
    const hangarGeo = new THREE.BoxGeometry(60, 18, 50);
    const hangarMat = new THREE.MeshStandardMaterial({ color: 0x64748b, roughness: 0.7 });
    const hangar = new THREE.Mesh(hangarGeo, hangarMat);
    hangar.position.set(120, 9, 200);
    hangar.castShadow = true;
    hangar.receiveShadow = true;
    scene.add(hangar);

    // Control Tower
    const towerGeo = new THREE.CylinderGeometry(6, 8, 45, 16);
    const towerMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0 });
    const tower = new THREE.Mesh(towerGeo, towerMat);
    tower.position.set(150, 22.5, 0);
    tower.castShadow = true;
    scene.add(tower);

    const cabGeo = new THREE.CylinderGeometry(10, 8, 8, 16);
    const cabMat = new THREE.MeshStandardMaterial({ color: 0x0284c7, roughness: 0.2 });
    const cab = new THREE.Mesh(cabGeo, cabMat);
    cab.position.set(150, 47, 0);
    scene.add(cab);

    // 7. Drifting Clouds
    const cloudsGroup = new THREE.Group();
    const cloudMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.9,
      transparent: true,
      opacity: 0.85
    });
    for (let c = 0; c < 24; c++) {
      const puff = new THREE.Mesh(new THREE.SphereGeometry(40 + Math.random() * 50, 8, 8), cloudMat);
      puff.position.set(
        (Math.random() - 0.5) * 8000,
        450 + Math.random() * 300,
        (Math.random() - 0.5) * 8000
      );
      cloudsGroup.add(puff);
    }
    scene.add(cloudsGroup);

    // 8. Aircraft Container
    const aircraftGroup = new THREE.Group();
    scene.add(aircraftGroup);

    // Fallback procedural aircraft while GLB loads
    const fallbackPlane = new THREE.Group();
    const fuseGeo = new THREE.ConeGeometry(1.2, 8, 8);
    fuseGeo.rotateX(Math.PI / 2);
    const fuseMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.4 });
    const fuselage = new THREE.Mesh(fuseGeo, fuseMat);
    fallbackPlane.add(fuselage);

    const wingGeo = new THREE.BoxGeometry(11, 0.15, 1.8);
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x0284c7 });
    const wings = new THREE.Mesh(wingGeo, wingMat);
    wings.position.set(0, 0.4, 0);
    fallbackPlane.add(wings);
    aircraftGroup.add(fallbackPlane);

    // Load actual GLB Model (C172 or Glider)
    const loader = new GLTFLoader();
    // BASE_URL-relative so models resolve under the GitHub Pages /air/ sub-path
    const modelUrl = `${import.meta.env.BASE_URL}${aircraftType === 'c172' ? 'c172.glb' : 'glider.glb'}`;

    loader.load(
      modelUrl,
      (gltf) => {
        aircraftGroup.remove(fallbackPlane);
        const root = gltf.scene;

        const box = new THREE.Box3().setFromObject(root);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());

        root.position.sub(center);
        const modelHolder = new THREE.Group();

        if (aircraftType === 'glider') {
          const s = 14.0 / Math.max(size.x, size.z);
          modelHolder.scale.set(s, s, s);
          modelHolder.rotation.y = Math.PI; // Glider faces forward
        } else {
          const s = 11.0 / Math.max(size.x, size.z);
          modelHolder.scale.set(s, s, s);
          modelHolder.rotation.y = -Math.PI / 2; // C172 faces forward
        }

        modelHolder.add(root);
        aircraftGroup.add(modelHolder);

        // Find and register control surface submeshes
        let elevNode: THREE.Object3D | null = null;
        let rudNode: THREE.Object3D | null = null;
        let ailLNode: THREE.Object3D | null = null;
        let ailRNode: THREE.Object3D | null = null;
        let spLNode: THREE.Object3D | null = null;
        let spRNode: THREE.Object3D | null = null;

        root.traverse((child) => {
          if ((child as THREE.Mesh).isMesh) {
            child.castShadow = true;
            child.receiveShadow = true;
          }
          const nodeName = child.name.toLowerCase();
          if (nodeName.includes('elevator')) elevNode = child;
          if (nodeName.includes('rudder')) rudNode = child;
          if (nodeName.includes('aileronl') || nodeName.includes('aileron.l')) ailLNode = child;
          if (nodeName.includes('aileronr') || nodeName.includes('aileron.r')) ailRNode = child;
          if (nodeName.includes('speedbrakel') || nodeName.includes('spoilerl')) spLNode = child;
          if (nodeName.includes('speedbraker') || nodeName.includes('spoilerr')) spRNode = child;
        });

        if (elevNode) {
          const node = elevNode as THREE.Object3D;
          node.userData.basePos = node.position.clone();
          node.userData.baseQuat = node.quaternion.clone();
        }
        if (rudNode) {
          const node = rudNode as THREE.Object3D;
          node.userData.basePos = node.position.clone();
          node.userData.baseQuat = node.quaternion.clone();
        }
        if (ailLNode) {
          const node = ailLNode as THREE.Object3D;
          node.userData.basePos = node.position.clone();
          node.userData.baseQuat = node.quaternion.clone();
        }
        if (ailRNode) {
          const node = ailRNode as THREE.Object3D;
          node.userData.basePos = node.position.clone();
          node.userData.baseQuat = node.quaternion.clone();
        }
        if (spLNode) {
          const node = spLNode as THREE.Object3D;
          node.userData.basePos = node.position.clone();
        }
        if (spRNode) {
          const node = spRNode as THREE.Object3D;
          node.userData.basePos = node.position.clone();
        }

        if (sceneRef.current) {
          sceneRef.current.loadedModel = modelHolder;
          sceneRef.current.elevatorNode = elevNode;
          sceneRef.current.rudderNode = rudNode;
          sceneRef.current.aileronLNode = ailLNode;
          sceneRef.current.aileronRNode = ailRNode;
          sceneRef.current.speedbrakeLNode = spLNode;
          sceneRef.current.speedbrakeRNode = spRNode;
        }
      },
      undefined,
      (err) => {
        console.warn('Could not load 3D GLB, using procedural aircraft:', err);
        setModelLoadError(`3D model failed to load (${modelUrl}) — showing simplified backup aircraft.`);
      }
    );

    sceneRef.current = {
      scene,
      camera,
      renderer,
      aircraftGroup,
      loadedModel: null,
      elevatorNode: null,
      rudderNode: null,
      aileronLNode: null,
      aileronRNode: null,
      speedbrakeLNode: null,
      speedbrakeRNode: null,
      papiMeshes,
      runwayLength,
      touchdownZ
    };

    resetToScenario(scenario, aircraftType);

    // ============================================
    // 9. REAL-TIME 6-DOF FLIGHT SIMULATION LOOP
    // ============================================
    let lastTime = performance.now();
    let animationFrameId: number;
    let frameCount = 0; // deterministic telemetry throttle (every 4th frame)
    let prevPapiKey = ''; // avoids redundant PAPI React state updates
    let stallLatched = false; // AoA stall hysteresis state

    const animate = (currentTime: number) => {
      animationFrameId = requestAnimationFrame(animate);

      const dt = Math.min((currentTime - lastTime) / 1000, 0.1);
      lastTime = currentTime;

      const state = simState.current;
      const inputs = controlInputs.current;

      if (isSimRunning) {
        // --- 1. AERODYNAMICS & PHYSICS CALCULATION ---
        const isGlider = aircraftType === 'glider';
        const mass = isGlider ? 500 : 1050; // kg
        const wingArea = isGlider ? 17.95 : 16.2; // m^2
        const rho = 1.225; // kg/m^3 air density at sea level

        // True Airspeed (TAS) in m/s
        const vHorizontal = Math.sqrt(state.vx * state.vx + state.vz * state.vz);
        const vTotal = Math.sqrt(state.vx * state.vx + state.vy * state.vy + state.vz * state.vz);
        const airspeedKts = vTotal * 1.94384; // m/s to knots

        // Flight Path Angle (gamma) and Angle of Attack (AoA)
        const flightPathAngle = Math.atan2(state.vy, vHorizontal || 0.01);
        const aoaRad = state.pitch - flightPathAngle;
        const aoaDeg = (aoaRad * 180) / Math.PI;

        // A stall is exceeding the critical angle of attack (~15°) — not a speed.
        // Hysteresis (engage above 15°, recover below 12°) stops flicker at the boundary.
        if (aoaDeg > 15) stallLatched = true;
        else if (aoaDeg < 12) stallLatched = false;
        const isStalled = stallLatched;
        // The stall WARNING is driven by low airspeed margin, like real warning systems
        const lowSpeedWarning = airspeedKts < (isGlider ? 44 : 55) && !state.onGround;
        soundManager.setStallHorn((isStalled || lowSpeedWarning) && !state.onGround);

        // Lift Coefficient (CL)
        let cl = 0.25 + 0.08 * aoaDeg + (state.flaps / 30) * 0.4;
        if (isStalled) {
          cl = Math.max(0.15, cl * 0.38); // Stalled lift loss
        }
        cl = Math.max(-0.5, Math.min(cl, 1.8));

        // Drag Coefficient (CD)
        const cd0 = isGlider ? 0.015 : 0.032;
        const inducedDrag = (cl * cl) / (Math.PI * 0.85 * (isGlider ? 20 : 7.4));
        const flapDrag = (state.flaps / 30) * (isGlider ? 0.09 : 0.05); // spoilers or flaps
        const gearDrag = state.onGround ? 0.04 : 0.01;
        const cd = cd0 + inducedDrag + flapDrag + gearDrag;

        // Forces in Newtons
        const lift = 0.5 * rho * vTotal * vTotal * wingArea * cl;
        const drag = 0.5 * rho * vTotal * vTotal * wingArea * cd;

        // Thrust Force
        let thrust = 0;
        if (!isGlider) {
          // Cessna 172 Engine: 180 HP (~134 kW), max thrust ~3,200 N at takeoff
          const maxThrust = 3200;
          thrust = (inputs.throttleInput / 100) * maxThrust * Math.max(0.3, 1 - airspeedKts / 150);
        } else if (
          scenario === 'glider-winch' &&
          state.y < 450 &&
          (state.status === 'flying' || (state.status === 'ready' && state.onGround))
        ) {
          // Winch launch: the winch pulls from 'ready' on the ground (otherwise the
          // glider could never reach flying speed), and keeps pulling until release altitude
          thrust = 4200;
        }

        // Control Responsiveness scales with dynamic pressure (q = 1/2 rho v^2)
        const controlAuth = Math.min(1.2, Math.max(0.2, airspeedKts / 60));

        // Angular Accelerations & Attitude Updates
        // Pitch: Pull back (pitchInput > 0) -> positive pitchTorque (nose pitches UP)
        const pitchTorque = (inputs.pitchInput * 0.85 - (isStalled ? 0.5 : 0)) * controlAuth;
        // Roll: Bank Right (rollInput > 0) -> negative rollTorque (right wing dips down)
        const rollTorque = -inputs.rollInput * 1.6 * controlAuth;
        // Yaw: Right Rudder (yawInput > 0) -> negative yawTorque (nose turns right)
        const yawTorque = -inputs.yawInput * 0.7 * controlAuth;

        state.pitchRate = THREE.MathUtils.lerp(state.pitchRate, pitchTorque, 8 * dt);
        state.rollRate = THREE.MathUtils.lerp(state.rollRate, rollTorque, 8 * dt);
        state.yawRate = THREE.MathUtils.lerp(state.yawRate, yawTorque, 8 * dt);

        state.pitch += state.pitchRate * dt;
        state.roll += state.rollRate * dt;
        state.yaw += state.yawRate * dt;

        // Auto-leveling tendency (dihedral / stability)
        if (Math.abs(inputs.rollInput) < 0.1) {
          state.roll *= Math.exp(-2.5 * dt);
        }

        // Accelerations
        const g = 9.81; // m/s^2
        const sinYaw = Math.sin(state.yaw);
        const cosYaw = Math.cos(state.yaw);

        // Forward vector in world coordinates (-Z is forward down runway)
        const forwardX = -sinYaw;
        const forwardZ = -cosYaw;

        let ax = 0;
        let ay = -g; // Gravity downward
        let az = 0;

        if (state.onGround) {
          // --- ON RUNWAY GROUND PHYSICS ---
          state.y = 0.1;
          state.vy = 0;
          state.roll = 0; // Wings level on runway
          // Allow up to ~14 degrees (0.24 rad) nose-up rotation on main landing gear:
          state.pitch = Math.max(-0.04, Math.min(state.pitch, 0.24));

          // Forward thrust along runway
          const netForwardForce = thrust - drag - (state.brakes ? mass * 4.5 : mass * 0.3);
          const forwardAcc = netForwardForce / mass;

          const currentSpeed = -state.vz;
          const nextSpeed = Math.max(0, currentSpeed + forwardAcc * dt);
          state.vz = -nextSpeed;
          state.vx = 0;

          // Liftoff check: rotate at Vr (approx 24 m/s C172, 16 m/s Glider)
          const liftoffSpeed = isGlider ? 16 : 24; // m/s
          const isRotating = state.pitch > 0.04 || inputs.pitchInput > 0.2;
          if (nextSpeed > liftoffSpeed && isRotating) {
            state.onGround = false;
            state.status = 'flying';
            state.vy = Math.max(1.5, state.pitch * nextSpeed * 0.5); // positive climb impulse
          }
        } else {
          // --- IN FLIGHT AERODYNAMIC FORCES ---
          const liftVertical = lift * Math.cos(state.roll) * Math.cos(state.pitch);
          // When banked right (roll < 0), liftHorizontal is positive (+X)
          const liftHorizontal = -lift * Math.sin(state.roll);

          ay += liftVertical / mass;

          // Thrust component along attitude
          const thrustX = thrust * forwardX * Math.cos(state.pitch);
          const thrustZ = thrust * forwardZ * Math.cos(state.pitch);
          const thrustY = thrust * Math.sin(state.pitch);

          ay += thrustY / mass;

          // Drag opposing velocity
          const dragX = vTotal > 0.1 ? -drag * (state.vx / vTotal) : 0;
          const dragY = vTotal > 0.1 ? -drag * (state.vy / vTotal) : 0;
          const dragZ = vTotal > 0.1 ? -drag * (state.vz / vTotal) : 0;

          ax = (thrustX + dragX + liftHorizontal * cosYaw) / mass;
          az = (thrustZ + dragZ - liftHorizontal * sinYaw) / mass;

          // Coordinated turn: banked lift curves the flight path — turn rate ω = g·tan(bank) / V.
          // Bank right is roll < 0; a right bank turns right (heading increases, so yaw decreases).
          const bankAngle = THREE.MathUtils.clamp(-state.roll, -1.2, 1.2);
          const coordTurnRate = (g * Math.tan(bankAngle)) / Math.max(vTotal, 10);
          state.yaw -= coordTurnRate * dt;

          state.vx += ax * dt;
          state.vy += ay * dt;
          state.vz += az * dt;

          // Touchdown Detection
          if (state.y <= 0.1) {
            state.y = 0.1;
            const touchdownFpm = state.vy * 196.85; // m/s to fpm
            soundManager.playTouchdown();

            let feedback = '';
            if (touchdownFpm > -100) {
              feedback = '🌟 Greaser! Textbook smooth landing (-' + Math.round(Math.abs(touchdownFpm)) + ' fpm)';
              state.status = 'landed';
            } else if (touchdownFpm > -450) {
              feedback = '✅ Good Landing (-' + Math.round(Math.abs(touchdownFpm)) + ' fpm)';
              state.status = 'landed';
            } else if (touchdownFpm > -750) {
              feedback = '⚠️ Hard Landing! Check gear inspection (-' + Math.round(Math.abs(touchdownFpm)) + ' fpm)';
              state.status = 'landed';
            } else {
              feedback = '💥 Gear Collapse / Crash! Excessive sink rate (-' + Math.round(Math.abs(touchdownFpm)) + ' fpm)';
              state.status = 'crashed';
            }

            state.onGround = true;
            state.landingFeedback = feedback;
          }
        }

        // Position Updates
        state.x += state.vx * dt;
        state.y = Math.max(0.1, state.y + state.vy * dt);
        state.z += state.vz * dt;

        // Telemetry calculation
        state.airspeed = Math.round(airspeedKts);
        state.altitudeFt = Math.round(state.y * 3.28084);
        state.vsiFpm = Math.round(state.vy * 196.85);
        state.headingDeg = Math.round((270 - (state.yaw * 180) / Math.PI + 360) % 360);
        state.throttle = Math.round(inputs.throttleInput);
        state.stallWarning = (isStalled || lowSpeedWarning) && !state.onGround;

        // Update React State for UI HUD (throttled: every 4th frame ≈ 15 Hz)
        frameCount++;
        if (frameCount % 4 === 0) {
          setTelemetry({ ...state });

          // --- PAPI GLIDE SLOPE EVALUATION (throttled with telemetry) ---
          // Only meaningful when established on final within range of the touchdown point
          const distToTouchdown = Math.sqrt(
            state.x * state.x + (state.z - touchdownZ) * (state.z - touchdownZ)
          );
          const yawNorm = Math.atan2(Math.sin(state.yaw), Math.cos(state.yaw));
          const papiActive =
            !state.onGround &&
            state.z > touchdownZ - 150 &&
            state.z <= touchdownZ + 6000 &&
            Math.abs(state.x) <= 120 &&
            Math.abs(yawNorm) < 0.3; // roughly aligned with Runway 27 final

          let lights: [boolean, boolean, boolean, boolean] = [false, false, false, false]; // false = red, true = white
          if (papiActive) {
            const glideAngleDeg = (Math.atan2(state.y, Math.max(10, distToTouchdown)) * 180) / Math.PI;
            if (glideAngleDeg > 3.5) {
              lights = [true, true, true, true]; // 4 White: Too high
            } else if (glideAngleDeg >= 3.2) {
              lights = [true, true, true, false]; // 3 White, 1 Red: Slightly high
            } else if (glideAngleDeg >= 2.8) {
              lights = [true, true, false, false]; // 2 White, 2 Red: ON GLIDE SLOPE (3 deg)
            } else if (glideAngleDeg >= 2.5) {
              lights = [true, false, false, false]; // 1 White, 3 Red: Slightly low
            } else {
              lights = [false, false, false, false]; // 4 Red: Too low
            }
          }

          // Only push React state / touch 3D lenses when something actually changed
          const papiKey = (papiActive ? 'on:' : 'off:') + lights.map((l) => (l ? '1' : '0')).join('');
          if (papiKey !== prevPapiKey) {
            prevPapiKey = papiKey;
            setPapiLights(lights);
            setPapiVisible(papiActive);
            papiMeshes.forEach((mesh, idx) => {
              const mat = mesh.material as THREE.MeshBasicMaterial;
              mat.color.setHex(!papiActive ? 0x475569 : lights[idx] ? 0xffffff : 0xef4444);
            });
          }
        }

        // --- 2. UPDATE 3D GRAPHICS POSITION & ROTATION ---
        aircraftGroup.position.set(state.x, state.y, state.z);
        aircraftGroup.rotation.order = 'YXZ';
        aircraftGroup.rotation.y = state.yaw;
        aircraftGroup.rotation.x = state.pitch;
        aircraftGroup.rotation.z = state.roll;

        // --- Real-Time Control Surface Articulation (Elevators, Rudder, Ailerons, Spoilers) ---
        if (sceneRef.current) {
          const { elevatorNode, rudderNode, aileronLNode, aileronRNode, speedbrakeLNode, speedbrakeRNode } = sceneRef.current;

          // 1. Elevator: Pull back (inputs.pitchInput > 0) -> elevator deflects UP (+Y)
          rotateAroundHinge(
            elevatorNode,
            new THREE.Vector3(0.2917, -0.007, 0),
            new THREE.Vector3(0, 0, 1),
            inputs.pitchInput * 0.45
          );

          // 2. Rudder: Right rudder (inputs.yawInput > 0) -> rudder deflects RIGHT (+X)
          rotateAroundHinge(
            rudderNode,
            new THREE.Vector3(3.7558, 1.341, 0),
            new THREE.Vector3(0, 1, 0),
            inputs.yawInput * 0.45
          );

          // 3. Ailerons: Bank Right (inputs.rollInput > 0) -> Right aileron UP, Left aileron DOWN
          rotateAroundHinge(
            aileronLNode,
            new THREE.Vector3(-0.2555, 0.405, 6.254),
            new THREE.Vector3(0, 0, 1),
            -inputs.rollInput * 0.40
          );
          rotateAroundHinge(
            aileronRNode,
            new THREE.Vector3(-0.252, 0.405, -6.254),
            new THREE.Vector3(0, 0, 1),
            inputs.rollInput * 0.40
          );

          // 4. Spoilers: Pop up from wings when deployed
          if (speedbrakeLNode && speedbrakeRNode && speedbrakeLNode.userData.basePos && speedbrakeRNode.userData.basePos) {
            const spOffset = (state.flaps / 30) * 0.18;
            speedbrakeLNode.position.copy(speedbrakeLNode.userData.basePos as THREE.Vector3).add(new THREE.Vector3(0, spOffset, 0));
            speedbrakeRNode.position.copy(speedbrakeRNode.userData.basePos as THREE.Vector3).add(new THREE.Vector3(0, spOffset, 0));
          }
        }

        // --- 3. CAMERA UPDATE ---
        if (cameraMode === 'cockpit') {
          // Pilot's Eye Cockpit View
          camera.position.set(state.x, state.y + 1.2, state.z);
          camera.rotation.order = 'YXZ';
          camera.rotation.y = state.yaw;
          camera.rotation.x = state.pitch;
          camera.rotation.z = state.roll;
        } else {
          // Dynamic Chase Camera behind aircraft
          const chaseDist = 18;
          const chaseHeight = 4.5;
          const targetCamX = state.x + Math.sin(state.yaw) * chaseDist;
          const targetCamY = state.y + chaseHeight;
          const targetCamZ = state.z + Math.cos(state.yaw) * chaseDist;

          chaseTargetVec.set(targetCamX, targetCamY, targetCamZ);
          camera.position.lerp(chaseTargetVec, 10 * dt);
          camera.lookAt(state.x, state.y + 1.5, state.z);
        }
      }

      renderer.render(scene, camera);
    };

    animationFrameId = requestAnimationFrame(animate);

    // Resize Handler
    const handleResize = () => {
      if (!containerRef.current) return;
      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };
    window.addEventListener('resize', handleResize);

    return () => {
      cancelAnimationFrame(animationFrameId);
      window.removeEventListener('resize', handleResize);
      soundManager.setStallHorn(false);
      renderer.dispose();
      if (containerRef.current && renderer.domElement) {
        containerRef.current.removeChild(renderer.domElement);
      }
    };
  }, [scenario, aircraftType, cameraMode, isSimRunning]);

  return (
    <div className="space-y-4 select-none">
      {/* Flight Sim Top Control Bar */}
      <div className="bg-slate-900/95 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-3">
        {/* Scenario & Aircraft Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-lg border border-slate-800">
            <button
              onClick={() => {
                setAircraftType('c172');
                resetToScenario(scenario, 'c172');
                soundManager.playClick();
              }}
              className={`px-3 py-1.5 rounded text-xs font-semibold font-mono transition ${
                aircraftType === 'c172' ? 'bg-rcac-blue text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              ✈️ Cessna 172 Skyhawk
            </button>
            <button
              onClick={() => {
                setAircraftType('glider');
                resetToScenario(scenario, 'glider');
                soundManager.playClick();
              }}
              className={`px-3 py-1.5 rounded text-xs font-semibold font-mono transition ${
                aircraftType === 'glider' ? 'bg-rcac-blue text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              🪂 ASK-21 Cadet Glider
            </button>
          </div>

          {/* Missions / Scenarios */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs font-mono">
            <button
              onClick={() => {
                setScenario('takeoff');
                resetToScenario('takeoff', aircraftType);
                soundManager.playClick();
              }}
              className={`px-2.5 py-1.5 rounded transition ${
                scenario === 'takeoff' ? 'bg-rcac-gold text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Takeoff
            </button>
            <button
              onClick={() => {
                setScenario('landing');
                resetToScenario('landing', aircraftType);
                soundManager.playClick();
              }}
              className={`px-2.5 py-1.5 rounded transition ${
                scenario === 'landing' ? 'bg-rcac-gold text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              3-Mile Final Landing
            </button>
            <button
              onClick={() => {
                setScenario('circuit');
                resetToScenario('circuit', aircraftType);
                soundManager.playClick();
              }}
              className={`px-2.5 py-1.5 rounded transition ${
                scenario === 'circuit' ? 'bg-rcac-gold text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Downwind Circuit
            </button>
            {aircraftType === 'glider' && (
              <button
                onClick={() => {
                  setScenario('glider-winch');
                  resetToScenario('glider-winch', aircraftType);
                  soundManager.playClick();
                }}
                className={`px-2.5 py-1.5 rounded transition ${
                  scenario === 'glider-winch' ? 'bg-rcac-gold text-slate-950 font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Winch Launch
              </button>
            )}
          </div>
        </div>

        {/* View & Reset Tools */}
        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              setCameraMode(cameraMode === 'chase' ? 'cockpit' : 'chase');
              soundManager.playClick();
            }}
            className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs font-mono border border-slate-700 transition flex items-center gap-1.5"
          >
            <Camera className="w-3.5 h-3.5 text-rcac-sky" />
            <span>View: {cameraMode === 'cockpit' ? 'Cockpit FPV' : 'Chase View'}</span>
          </button>

          <button
            onClick={() => {
              resetToScenario(scenario, aircraftType);
              soundManager.playClick();
            }}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg border border-slate-700 transition"
            title="Reset Flight (R)"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main 3D Simulator Viewport with Heads-Up Display (HUD) */}
      <div className="relative w-full h-[620px] bg-slate-950 rounded-2xl overflow-hidden border border-slate-800 shadow-2xl">
        {/* Three.js Canvas Container */}
        <div ref={containerRef} className="w-full h-full cursor-grab active:cursor-grabbing" />

        {/* Visible notice when the 3D model fails to load (procedural backup in use) */}
        {modelLoadError && (
          <div className="absolute top-0 inset-x-0 z-10 bg-amber-500/95 text-slate-950 text-[11px] font-mono font-semibold px-4 py-1.5 flex items-center justify-center gap-2">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{modelLoadError}</span>
          </div>
        )}

        {/* ======================================================== */}
        {/* HEADS-UP DISPLAY (HUD) FLIGHT OVERLAY */}
        {/* ======================================================== */}
        <div className="absolute inset-0 pointer-events-none p-4 flex flex-col justify-between">
          {/* Top Bar: Heading Compass & PAPI Lights Indicator */}
          <div className="flex items-start justify-between">
            {/* Airspeed Gauge Tape (Left) */}
            <div className="bg-slate-950/80 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700 text-center min-w-[90px]">
              <span className="text-[10px] text-slate-400 font-mono uppercase block">AIRSPEED</span>
              <span className="text-2xl font-bold font-mono text-emerald-400">
                {telemetry.airspeed}
              </span>
              <span className="text-[10px] text-slate-400 font-mono block">KIAS</span>
            </div>

            {/* Heading Tape & PAPI Lights (Center) */}
            <div className="flex flex-col items-center gap-1.5">
              <div className="bg-slate-950/80 backdrop-blur-md px-4 py-1.5 rounded-lg border border-slate-700 text-center font-mono">
                <span className="text-xs text-slate-400">HDG: </span>
                <span className="text-base font-bold text-white tracking-widest">
                  {String(telemetry.headingDeg).padStart(3, '0')}°
                </span>
              </div>

              {/* Working PAPI Lights Indicator (only shown when established on final) */}
              {papiVisible && (
              <div className="bg-slate-950/85 backdrop-blur-md px-3 py-1.5 rounded-lg border border-slate-700 flex items-center gap-2">
                <span className="text-[10px] text-slate-400 font-mono">PAPI GLIDE PATH:</span>
                <div className="flex items-center gap-1.5">
                  {papiLights.map((isWhite, idx) => (
                    <span
                      key={idx}
                      className={`w-3.5 h-3.5 rounded-full border border-black/40 shadow-sm transition-colors duration-200 ${
                        isWhite ? 'bg-white shadow-[0_0_8px_#ffffff]' : 'bg-red-600 shadow-[0_0_8px_#ef4444]'
                      }`}
                    />
                  ))}
                </div>
                <span className="text-[10px] font-mono text-slate-300">
                  {papiLights.filter(Boolean).length === 2 
                    ? '(3° ON PATH)' 
                    : papiLights.filter(Boolean).length > 2 
                    ? '(HIGH)' 
                    : '(LOW)'}
                </span>
              </div>
              )}
            </div>

            {/* Altimeter Gauge Tape (Right) */}
            <div className="bg-slate-950/80 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700 text-center min-w-[90px]">
              <span className="text-[10px] text-slate-400 font-mono uppercase block">ALTITUDE</span>
              <span className="text-2xl font-bold font-mono text-sky-400">
                {telemetry.altitudeFt}
              </span>
              <span className="text-[10px] text-slate-400 font-mono block">FT AGL</span>
            </div>
          </div>

          {/* Center Crosshairs & Pitch Ladder */}
          <div className="relative flex items-center justify-center">
            {/* Pitch Ladder Line */}
            <div className="w-32 h-0.5 bg-emerald-500/50 flex items-center justify-between">
              <div className="w-3 h-2 border-l-2 border-emerald-400" />
              <div className="w-3 h-3 rounded-full border border-emerald-400 flex items-center justify-center">
                <div className="w-1 h-1 bg-emerald-400 rounded-full" />
              </div>
              <div className="w-3 h-2 border-r-2 border-emerald-400" />
            </div>

            {/* Stall Warning Alert Banner */}
            {telemetry.stallWarning && (
              <div className="absolute -top-12 bg-rose-600/90 text-white font-mono font-bold px-4 py-1.5 rounded-lg border-2 border-white animate-bounce shadow-2xl flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-300" />
                <span>{aircraftType === 'glider' ? 'STALL WARNING! LOWER THE NOSE' : 'STALL WARNING! LOWER NOSE / FULL POWER'}</span>
              </div>
            )}

            {/* Touchdown Landing Score Banner */}
            {telemetry.landingFeedback && (
              <div className="absolute -top-16 bg-slate-950/95 border-2 border-rcac-gold px-5 py-2.5 rounded-xl shadow-2xl text-center">
                <p className="text-sm font-bold font-mono text-rcac-gold">
                  {telemetry.landingFeedback}
                </p>
                <span className="text-[10px] text-slate-400 font-mono">Press 'R' or click Reset to fly again</span>
              </div>
            )}
          </div>

          {/* Bottom Bar: Engine Throttle, Flaps, VSI & Brakes */}
          <div className="flex items-end justify-between">
            {/* Throttle & Flaps */}
            <div className="bg-slate-950/85 backdrop-blur-md p-3 rounded-xl border border-slate-700 flex items-center gap-4 font-mono text-xs">
              <div>
                <span className="text-[10px] text-slate-400 block">THROTTLE</span>
                <span className="font-bold text-amber-400">{telemetry.throttle}%</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <span className="text-[10px] text-slate-400 block">{aircraftType === 'glider' ? 'SPOILERS' : 'FLAPS'}</span>
                <span className="font-bold text-sky-400">{telemetry.flaps}°</span>
              </div>
              <div className="h-6 w-px bg-slate-800" />
              <div>
                <span className="text-[10px] text-slate-400 block">BRAKES</span>
                <span className={`font-bold ${telemetry.brakes ? 'text-rose-400' : 'text-slate-500'}`}>
                  {telemetry.brakes ? 'ON' : 'OFF'}
                </span>
              </div>
            </div>

            {/* VSI (Vertical Speed Indicator) */}
            <div className="bg-slate-950/85 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700 text-center font-mono">
              <span className="text-[10px] text-slate-400 block">VSI (VERTICAL SPEED)</span>
              <span className={`text-base font-bold ${telemetry.vsiFpm >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {telemetry.vsiFpm > 0 ? `+${telemetry.vsiFpm}` : telemetry.vsiFpm} fpm
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Flight Controls Dashboard (Keyboard Guide & Touch Controls) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* On-screen Flight Stick (Touch/Mouse) */}
        <div 
          className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col items-center select-none"
          style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
        >
          <div className="flex items-center justify-between w-full mb-2">
            <span className="text-xs font-semibold text-slate-300 font-mono">FLIGHT STICK</span>
            <span className="text-[10px] font-mono text-rcac-gold px-1.5 py-0.5 rounded bg-amber-950/60 border border-amber-800/40">
              {stickOffset.y > 6 
                ? `PULL BACK ${Math.round((stickOffset.y / 48) * 100)}%` 
                : stickOffset.y < -6 
                ? `PUSH DIVE ${Math.round((-stickOffset.y / 48) * 100)}%` 
                : 'NEUTRAL'}
            </span>
          </div>

          {/* Interactive Virtual Joystick Circle with Pointer Capture & No-Selection */}
          <div 
            className="w-36 h-36 bg-slate-950 rounded-full border-2 border-slate-700 relative flex items-center justify-center touch-none cursor-grab active:cursor-grabbing shadow-inner select-none"
            style={{ touchAction: 'none', userSelect: 'none', WebkitUserSelect: 'none' }}
            onPointerDown={handleStickPointerDown}
          >
            {/* Crosshair guide lines */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="w-full h-px bg-slate-800/80" />
            </div>
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="h-full w-px bg-slate-800/80" />
            </div>
            {/* Outer limit ring */}
            <div className="w-28 h-28 rounded-full border border-slate-800/60 pointer-events-none" />

            {/* Moving Stick Knob */}
            <div 
              className="w-12 h-12 rounded-full bg-gradient-to-b from-sky-400 to-rcac-blue border-2 border-rcac-gold shadow-lg flex items-center justify-center text-[10px] text-white font-bold pointer-events-none transition-transform duration-75"
              style={{
                transform: `translate(${stickOffset.x}px, ${stickOffset.y}px)`,
                boxShadow: '0 0 15px rgba(56, 189, 248, 0.5)'
              }}
            >
              STICK
            </div>
          </div>

          {/* Dedicated Directional Pitch & Roll Buttons */}
          <div className="w-full mt-3 space-y-1.5 font-mono text-xs select-none">
            {/* Pull Back (Climb / Rotate) Button */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                controlInputs.current.pitchInput = 1.0; // Positive = Nose UP (climb / rotate)
                setStickOffset((prev) => ({ ...prev, y: 44 }));
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                controlInputs.current.pitchInput = 0;
                setStickOffset((prev) => ({ ...prev, y: 0 }));
              }}
              onPointerLeave={() => {
                controlInputs.current.pitchInput = 0;
                setStickOffset((prev) => ({ ...prev, y: 0 }));
              }}
              className="w-full py-2 bg-gradient-to-r from-amber-600 to-amber-500 hover:from-amber-500 hover:to-amber-400 text-slate-950 font-bold rounded-lg border border-amber-400/60 shadow-md active:scale-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <span>▲ PULL BACK (CLIMB / ROTATE)</span>
            </button>

            {/* Left / Center / Right */}
            <div className="grid grid-cols-3 gap-1 text-[11px]">
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  controlInputs.current.rollInput = -1.0; // Bank Left
                  setStickOffset((prev) => ({ ...prev, x: -40 }));
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  controlInputs.current.rollInput = 0;
                  setStickOffset((prev) => ({ ...prev, x: 0 }));
                }}
                onPointerLeave={() => {
                  controlInputs.current.rollInput = 0;
                  setStickOffset((prev) => ({ ...prev, x: 0 }));
                }}
                className="py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 font-bold active:bg-rcac-blue active:text-white cursor-pointer"
              >
                ◀ Bank L
              </button>
              <button
                type="button"
                onClick={() => {
                  controlInputs.current.pitchInput = 0;
                  controlInputs.current.rollInput = 0;
                  setStickOffset({ x: 0, y: 0 });
                }}
                className="py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded text-slate-300 font-bold cursor-pointer"
              >
                Center
              </button>
              <button
                type="button"
                onPointerDown={(e) => {
                  e.preventDefault();
                  controlInputs.current.rollInput = 1.0; // Bank Right
                  setStickOffset((prev) => ({ ...prev, x: 40 }));
                }}
                onPointerUp={(e) => {
                  e.preventDefault();
                  controlInputs.current.rollInput = 0;
                  setStickOffset((prev) => ({ ...prev, x: 0 }));
                }}
                onPointerLeave={() => {
                  controlInputs.current.rollInput = 0;
                  setStickOffset((prev) => ({ ...prev, x: 0 }));
                }}
                className="py-1.5 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 font-bold active:bg-rcac-blue active:text-white cursor-pointer"
              >
                Bank R ▶
              </button>
            </div>

            {/* Push Forward (Dive) Button */}
            <button
              type="button"
              onPointerDown={(e) => {
                e.preventDefault();
                controlInputs.current.pitchInput = -1.0; // Negative = Nose DOWN (dive)
                setStickOffset((prev) => ({ ...prev, y: -44 }));
              }}
              onPointerUp={(e) => {
                e.preventDefault();
                controlInputs.current.pitchInput = 0;
                setStickOffset((prev) => ({ ...prev, y: 0 }));
              }}
              onPointerLeave={() => {
                controlInputs.current.pitchInput = 0;
                setStickOffset((prev) => ({ ...prev, y: 0 }));
              }}
              className="w-full py-1.5 bg-slate-950 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800 rounded-lg active:scale-95 transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>▼ PUSH FORWARD (DIVE)</span>
            </button>
          </div>
        </div>

        {/* Throttle & Rudder Pedals */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-col justify-between">
          <span className="text-xs font-semibold text-slate-300 font-mono mb-2">POWER & RUDDER</span>
          
          <div className="space-y-3">
            <div>
              <div className="flex justify-between text-xs font-mono text-slate-400 mb-1">
                <span>Throttle:</span>
                <span className="text-amber-400 font-bold">{telemetry.throttle}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={telemetry.throttle}
                onChange={(e) => {
                  controlInputs.current.throttleInput = Number(e.target.value);
                  setTelemetry((prev) => ({ ...prev, throttle: Number(e.target.value) }));
                }}
                className="w-full accent-amber-400"
              />
            </div>

            {/* Rudder Buttons */}
            <div>
              <span className="text-[11px] text-slate-400 font-mono block mb-1">Rudder Pedals (Yaw):</span>
              <div className="grid grid-cols-2 gap-2 font-mono text-xs">
                <button
                  type="button"
                  onPointerDown={(e) => { e.preventDefault(); controlInputs.current.yawInput = -1.0; }}
                  onPointerUp={(e) => { e.preventDefault(); controlInputs.current.yawInput = 0; }}
                  onPointerLeave={() => { controlInputs.current.yawInput = 0; }}
                  className="py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 font-bold active:bg-rcac-blue active:text-white cursor-pointer"
                >
                  ◀ Left Rudder (Q)
                </button>
                <button
                  type="button"
                  onPointerDown={(e) => { e.preventDefault(); controlInputs.current.yawInput = 1.0; }}
                  onPointerUp={(e) => { e.preventDefault(); controlInputs.current.yawInput = 0; }}
                  onPointerLeave={() => { controlInputs.current.yawInput = 0; }}
                  className="py-2 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded text-slate-300 font-bold active:bg-rcac-blue active:text-white cursor-pointer"
                >
                  Right Rudder (E) ▶
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 mt-3 font-mono text-xs">
            <button
              onClick={() => {
                const nextFlaps = telemetry.flaps >= 30 ? 0 : telemetry.flaps + 10;
                simState.current.flaps = nextFlaps;
                setTelemetry((p) => ({ ...p, flaps: nextFlaps }));
                soundManager.playClick();
              }}
              className="py-2 bg-slate-800 hover:bg-slate-700 text-sky-300 rounded border border-slate-700 font-bold"
            >
              Cycle Flaps (F): {telemetry.flaps}°
            </button>
            <button
              onPointerDown={() => {
                controlInputs.current.brakes = true;
                simState.current.brakes = true;
                setTelemetry((p) => ({ ...p, brakes: true }));
              }}
              onPointerUp={() => {
                controlInputs.current.brakes = false;
                simState.current.brakes = false;
                setTelemetry((p) => ({ ...p, brakes: false }));
              }}
              className={`py-2 rounded border font-bold transition ${
                telemetry.brakes 
                  ? 'bg-rose-600 text-white border-rose-500' 
                  : 'bg-slate-950 text-slate-300 border-slate-800'
              }`}
            >
              Wheel Brakes (B)
            </button>
          </div>
        </div>

        {/* Flight Keys Quick Reference Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
          <span className="text-xs font-semibold text-slate-300 font-mono mb-2 block flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-rcac-sky" />
            <span>CADET FLIGHT SIMULATOR CONTROLS</span>
          </span>

          <div className="space-y-1.5 text-[11px] font-mono text-slate-400">
            <div className="flex justify-between py-0.5 border-b border-slate-800/80">
              <span className="text-slate-300">Elevator (Pitch Up/Down):</span>
              <span className="text-rcac-gold font-bold">Arrow Up / Down (or W / S)</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-800/80">
              <span className="text-slate-300">Ailerons (Bank Left/Right):</span>
              <span className="text-rcac-gold font-bold">Arrow Left / Right (or A / D)</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-800/80">
              <span className="text-slate-300">Rudder (Yaw Left/Right):</span>
              <span className="text-rcac-gold font-bold">Q / E</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-800/80">
              <span className="text-slate-300">Throttle Up / Down:</span>
              <span className="text-rcac-gold font-bold">Shift / Ctrl</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-800/80">
              <span className="text-slate-300">Flaps / Airbrakes:</span>
              <span className="text-rcac-gold font-bold">F</span>
            </div>
            <div className="flex justify-between py-0.5 border-b border-slate-800/80">
              <span className="text-slate-300">Wheel Brakes:</span>
              <span className="text-rcac-gold font-bold">B or Spacebar</span>
            </div>
            <div className="flex justify-between py-0.5">
              <span className="text-slate-300">Switch Camera / Reset:</span>
              <span className="text-rcac-gold font-bold">C / R</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
export default FlightSimulator3D;
