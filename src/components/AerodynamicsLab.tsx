import React, { useState, useEffect, useRef } from 'react';
import { 
  Wind, 
  AlertTriangle, 
  Sliders, 
  HelpCircle, 
  Compass, 
  Activity,
  Volume2,
  VolumeX,
  RotateCcw
} from 'lucide-react';
import { AirfoilState } from '../types';
import { soundManager } from '../utils/audio';

export const AerodynamicsLab: React.FC = () => {
  const [state, setState] = useState<AirfoilState>({
    angleOfAttack: 6, // degrees
    airspeed: 65, // knots
    camber: 3, // 0 to 6
    flaps: 0, // 0 to 40
    airDensity: 1.225, // sea level ISA
    showStreamlines: true,
    showPressureVectors: true,
    aircraftType: 'glider',
  });

  const [soundEnabled, setSoundEnabled] = useState(true);
  const [showTheoryModal, setShowTheoryModal] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Aerodynamic calculations
  // Stall angle is typically around 16 deg for clean wing, 14 deg with full flaps
  const criticalAoA = 16 - (state.flaps / 40) * 2;
  const isStalled = state.angleOfAttack > criticalAoA;
  const isNearStall = !isStalled && state.angleOfAttack >= criticalAoA - 3;

  // Cl calculation: linear slope ~0.11 per degree, with camber & flap offset
  const camberClOffset = (state.camber / 4) * 0.3;
  const flapClOffset = (state.flaps / 40) * 0.55;
  
  let cl = 0;
  if (state.angleOfAttack <= criticalAoA) {
    cl = 0.1 * (state.angleOfAttack + 2) + camberClOffset + flapClOffset;
  } else {
    // Post stall drop-off
    const postStallDiff = state.angleOfAttack - criticalAoA;
    cl = Math.max(0.2, (0.1 * (criticalAoA + 2) + camberClOffset + flapClOffset) * Math.exp(-postStallDiff * 0.15));
  }
  cl = Math.max(-0.5, Math.min(2.4, cl));

  // Cd calculation: parasitic drag + induced drag (Cl^2 / (pi * AR * e))
  const ar = state.aircraftType === 'glider' ? 15.0 : 7.5;
  const cd0 = 0.025 + (state.flaps / 40) * 0.06;
  const cdi = (cl * cl) / (Math.PI * ar * 0.85);
  let cd = cd0 + cdi;
  if (isStalled) {
    cd += (state.angleOfAttack - criticalAoA) * 0.08;
  }
  cd = Math.max(0.015, Math.min(1.8, cd));

  const ldRatio = cd > 0 ? (cl / cd).toFixed(1) : '0';

  // Dynamic Lift & Drag in lbs (assuming nominal wing area)
  // S = 214 sq ft for 2-33A glider, 174 sq ft for C172
  const wingArea = state.aircraftType === 'glider' ? 214 : 174;
  const vFps = state.airspeed * 1.68781; // knots to ft/s
  const rhoSlug = 0.0023769; // slugs/cu ft at sea level
  const dynamicPressure = 0.5 * rhoSlug * (vFps * vFps);
  const liftLbs = Math.round(dynamicPressure * wingArea * cl);
  const dragLbs = Math.round(dynamicPressure * wingArea * cd);

  // Audio stall horn trigger
  useEffect(() => {
    if (isStalled || (isNearStall && state.airspeed < 45)) {
      soundManager.setStallHorn(true);
    } else {
      soundManager.setStallHorn(false);
    }
    return () => {
      soundManager.setStallHorn(false);
    };
  }, [isStalled, isNearStall, state.airspeed]);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.enabled = next;
    if (!next) soundManager.setStallHorn(false);
  };

  // Canvas Wind Tunnel Simulation animation
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: Array<{ x: number; y: number; speed: number; age: number; maxAge: number }> = [];
    const numParticles = 140;

    for (let i = 0; i < numParticles; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        speed: 2 + Math.random() * 2,
        age: Math.random() * 200,
        maxAge: 150 + Math.random() * 100,
      });
    }

    const render = () => {
      ctx.fillStyle = '#060a12';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Grid background representing wind-tunnel test section
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      const gridSize = 40;
      for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
      }
      for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
      }

      // Airfoil coordinates and geometry
      const cx = canvas.width * 0.45;
      const cy = canvas.height * 0.52;
      const chord = 260; // chord length in pixels
      // Positive Angle of Attack rotates the leading edge UP (counter-clockwise on screen, i.e., positive pitch/climb attitude)
      const aoaRad = (state.angleOfAttack * Math.PI) / 180;
      const leX = -chord * 0.25;
      const teX = chord * 0.75;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(aoaRad);

      // Semi-transparent aircraft fuselage outline to clearly establish nose vs tail orientation
      ctx.save();
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.45)';
      ctx.lineWidth = 1.5;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.45)';
      ctx.beginPath();
      // Nose cone & cockpit on left (facing incoming relative wind)
      ctx.moveTo(leX, -10);
      ctx.quadraticCurveTo(leX - 70, -18, leX - 110, 4); // rounded nose cone
      ctx.quadraticCurveTo(leX - 60, 22, leX, 16);
      // Underbelly
      ctx.lineTo(teX + 60, 10);
      // Slender tail boom & empennage
      ctx.lineTo(teX + 130, -4);
      ctx.lineTo(teX + 135, -55); // vertical fin
      ctx.lineTo(teX + 115, -55);
      ctx.lineTo(teX + 100, -8);
      ctx.lineTo(teX, -5);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Canopy glass highlight (cockpit where cadet pilot sits)
      ctx.fillStyle = 'rgba(56, 189, 248, 0.3)';
      ctx.beginPath();
      ctx.moveTo(leX - 85, 2);
      ctx.quadraticCurveTo(leX - 50, -26, leX - 10, -12);
      ctx.lineTo(leX - 20, 2);
      ctx.closePath();
      ctx.fill();

      // Pilot helmet silhouette
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(leX - 45, -7, 6, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();

      // Clear Orientation Labels
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'right';
      ctx.fillText('◀ AIRCRAFT NOSE', leX - 15, -28);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#94a3b8';
      ctx.fillText('TAIL ▶', teX + 15, -16);

      // Draw Airfoil shape (NACA-style 4-digit parametric profile with camber)
      ctx.beginPath();
      const points = 60;
      const upperCoords: [number, number][] = [];
      const lowerCoords: [number, number][] = [];

      for (let i = 0; i <= points; i++) {
        const xPercent = i / points;
        const x = (xPercent - 0.25) * chord; // pivot at ~25% quarter chord
        // Thickness distribution
        const t = 0.14; // 14% max thickness
        const yt = 5 * t * chord * (
          0.2969 * Math.sqrt(Math.max(0, xPercent)) -
          0.1260 * xPercent -
          0.3516 * Math.pow(xPercent, 2) +
          0.2843 * Math.pow(xPercent, 3) -
          0.1015 * Math.pow(xPercent, 4)
        );
        // Camber line
        const m = (state.camber / 100) * 1.5; // maximum camber
        const p = 0.4; // location of max camber
        let yc = 0;
        if (xPercent < p) {
          yc = m * chord * (xPercent / (p * p)) * (2 * p - xPercent);
        } else {
          yc = m * chord * ((1 - xPercent) / ((1 - p) * (1 - p))) * (1 + xPercent - 2 * p);
        }

        // Flap deflection on aft 30% of chord
        let flapOffset = 0;
        if (xPercent > 0.7) {
          const flapFraction = (xPercent - 0.7) / 0.3;
          flapOffset = Math.sin((state.flaps * Math.PI) / 180) * flapFraction * 35;
        }

        upperCoords.push([x, -(yc + yt) + flapOffset]);
        lowerCoords.push([x, -(yc - yt) + flapOffset]);
      }

      // Draw closed airfoil path
      ctx.moveTo(upperCoords[0][0], upperCoords[0][1]);
      for (let i = 1; i < upperCoords.length; i++) {
        ctx.lineTo(upperCoords[i][0], upperCoords[i][1]);
      }
      for (let i = lowerCoords.length - 1; i >= 0; i--) {
        ctx.lineTo(lowerCoords[i][0], lowerCoords[i][1]);
      }
      ctx.closePath();

      // Wing fill and border
      const wingGrad = ctx.createLinearGradient(-chord * 0.25, 0, chord * 0.75, 0);
      wingGrad.addColorStop(0, '#38bdf8');
      wingGrad.addColorStop(0.5, '#0284c7');
      wingGrad.addColorStop(1, '#0369a1');
      ctx.fillStyle = wingGrad;
      ctx.fill();
      ctx.strokeStyle = '#e0f2fe';
      ctx.lineWidth = 2.5;
      ctx.stroke();

      // Chord line & Center of Pressure marker
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(-chord * 0.25, 0);
      ctx.lineTo(chord * 0.75, 0);
      ctx.stroke();
      ctx.setLineDash([]);

      // Center of Pressure marker (moves aft if stalled)
      const cpLocalX = -chord * 0.25 + chord * (isStalled ? 0.42 : 0.25);
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath();
      ctx.arc(cpLocalX, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.restore();

      // In Screen Space: Relative Wind Stream & Flight Attitude Banner
      ctx.save();
      // Relative Wind Stream banner at bottom-left
      ctx.fillStyle = 'rgba(125, 211, 252, 0.75)';
      ctx.font = 'bold 11px "JetBrains Mono", monospace';
      ctx.textAlign = 'left';
      ctx.fillText(`RELATIVE WIND ➔➔➔ (${state.airspeed} KIAS)`, 24, canvas.height - 24);

      // Pitch Attitude Indicator at top-left
      const pitchDesc = isStalled 
        ? '⚠️ CLIMBING STALL' 
        : state.angleOfAttack > 6 
        ? `▲ CLIMBING ATTITUDE (+${state.angleOfAttack}°)` 
        : state.angleOfAttack >= 1 
        ? `◆ LEVEL FLIGHT (+${state.angleOfAttack}°)` 
        : `▼ DIVING ATTITUDE (${state.angleOfAttack}°)`;
      const pitchBg = isStalled ? 'rgba(220, 38, 38, 0.85)' : state.angleOfAttack > 6 ? 'rgba(2, 132, 199, 0.85)' : state.angleOfAttack < 0 ? 'rgba(217, 119, 6, 0.85)' : 'rgba(16, 185, 129, 0.85)';
      
      ctx.fillStyle = pitchBg;
      ctx.fillRect(24, 24, 240, 28);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1;
      ctx.strokeRect(24, 24, 240, 28);
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 12px "JetBrains Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(pitchDesc, 144, 42);
      ctx.restore();

      // Flow streamlines / particle trails
      const flowSpeedBase = (state.airspeed / 60) * 3.8;
      const cosA = Math.cos(aoaRad);
      const sinA = Math.sin(aoaRad);

      particles.forEach((p) => {
        p.age += 1;
        if (p.age > p.maxAge || p.x > canvas.width) {
          p.x = 0;
          p.y = Math.random() * canvas.height;
          p.age = 0;
          p.speed = 2 + Math.random() * 2;
        }

        // Compute flow deflection around airfoil in local coordinate frame
        const dx = p.x - cx;
        const dy = p.y - cy;
        const localX = dx * cosA + dy * sinA;
        const localY = -dx * sinA + dy * cosA;
        const distToCenter = Math.sqrt(dx * dx + dy * dy);

        let vyDeflect = 0;
        let vxLocal = flowSpeedBase;

        if (distToCenter < 200) {
          const influence = (1 - distToCenter / 200);

          if (localY < 0) {
            // Upper surface (suction): accelerated flow curving along upper boundary
            vxLocal += influence * (cl * 2.2);
            vyDeflect += influence * (state.angleOfAttack * 0.16);

            if (isStalled && localX > -chord * 0.1) {
              // Turbulent stall separation eddies!
              vyDeflect += (Math.random() - 0.5) * (state.angleOfAttack * 0.65);
              vxLocal *= 0.45; // drastic flow deceleration in stall wake
            }
          } else {
            // Lower surface (pressure): compression stagnation and downwash push
            vxLocal -= influence * 0.35;
            vyDeflect += influence * (Math.max(0, state.angleOfAttack) * 0.22);
          }
        }

        // Downwash effect behind wing
        if (p.x > cx + 60) {
          const downwashInfluence = Math.max(0, 1 - (p.x - cx) / 550);
          vyDeflect += downwashInfluence * (cl * 1.6);
        }

        p.x += vxLocal;
        p.y += vyDeflect;

        // Render particle with streak
        const alpha = Math.min(1, p.age / 20) * Math.max(0, 1 - p.age / p.maxAge);
        let strokeColor = `rgba(125, 211, 252, ${alpha * 0.65})`;
        if (isStalled && localX > -chord * 0.1 && localY < 25 && p.x > cx - 30) {
          // Red turbulence smoke during stall
          strokeColor = `rgba(239, 68, 68, ${alpha * 0.85})`;
        }

        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 1.8;
        ctx.beginPath();
        ctx.moveTo(p.x - vxLocal * 3, p.y - vyDeflect * 3);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
      });

      // Pressure Vectors / Aerodynamic Force Arrows
      if (state.showPressureVectors) {
        // Lift Vector (perpendicular to relative airflow, drawn upwards)
        const liftArrowLength = Math.min(180, Math.max(0, cl * 85));
        // Screen position of Center of Pressure dot
        const cpScreenX = cx + cpLocalX * cosA;
        const cpScreenY = cy + cpLocalX * sinA;

        // Lift arrow (Green / Cyan)
        ctx.strokeStyle = '#22c55e';
        ctx.fillStyle = '#22c55e';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(cpScreenX, cpScreenY);
        ctx.lineTo(cpScreenX, cpScreenY - liftArrowLength);
        ctx.stroke();

        // Lift Arrowhead
        ctx.beginPath();
        ctx.moveTo(cpScreenX, cpScreenY - liftArrowLength);
        ctx.lineTo(cpScreenX - 8, cpScreenY - liftArrowLength + 14);
        ctx.lineTo(cpScreenX + 8, cpScreenY - liftArrowLength + 14);
        ctx.fill();

        ctx.font = 'bold 12px "JetBrains Mono", monospace';
        ctx.fillText(`LIFT: ${liftLbs} lbs`, cpScreenX + 12, cpScreenY - liftArrowLength + 10);

        // Drag Vector (parallel to relative airflow, drawn backwards to the right)
        const dragArrowLength = Math.min(160, cd * 120);
        ctx.strokeStyle = '#ef4444';
        ctx.fillStyle = '#ef4444';
        ctx.lineWidth = 3.5;
        ctx.beginPath();
        ctx.moveTo(cpScreenX, cpScreenY);
        ctx.lineTo(cpScreenX + dragArrowLength, cpScreenY);
        ctx.stroke();

        // Drag Arrowhead
        ctx.beginPath();
        ctx.moveTo(cpScreenX + dragArrowLength, cpScreenY);
        ctx.lineTo(cpScreenX + dragArrowLength - 14, cpScreenY - 8);
        ctx.lineTo(cpScreenX + dragArrowLength - 14, cpScreenY + 8);
        ctx.fill();

        ctx.fillText(`DRAG: ${dragLbs} lbs`, cpScreenX + dragArrowLength + 10, cpScreenY + 4);

        // Bernoulli Pressure Differential indicators
        const labelDist = 90;
        const lowPresX = cx + sinA * labelDist;
        const lowPresY = cy - cosA * labelDist;
        const highPresX = cx - sinA * labelDist;
        const highPresY = cy + cosA * labelDist;

        ctx.fillStyle = 'rgba(56, 189, 248, 0.9)';
        ctx.font = '11px "Chakra Petch", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('LOW PRESSURE (High Speed Flow - Bernoulli)', lowPresX, lowPresY);

        ctx.fillStyle = 'rgba(251, 146, 60, 0.9)';
        ctx.fillText('HIGH PRESSURE (Stagnation & Downwash - Newton)', highPresX, highPresY);
        ctx.textAlign = 'start';
      }

      // Stall Warning Banner overlay on Canvas
      if (isStalled) {
        ctx.save();
        ctx.fillStyle = 'rgba(220, 38, 38, 0.85)';
        ctx.fillRect(canvas.width / 2 - 210, 24, 420, 50);
        ctx.strokeStyle = '#fee2e2';
        ctx.lineWidth = 2;
        ctx.strokeRect(canvas.width / 2 - 210, 24, 420, 50);

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 20px "Chakra Petch", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ AERODYNAMIC STALL DETECTED ⚠️', canvas.width / 2, 48);
        ctx.font = '12px "JetBrains Mono", monospace';
        ctx.fillText(`Angle of Attack (${state.angleOfAttack}°) exceeded Critical Angle (${criticalAoA.toFixed(1)}°)`, canvas.width / 2, 65);
        ctx.restore();
      } else if (isNearStall) {
        ctx.save();
        ctx.fillStyle = 'rgba(234, 88, 12, 0.85)';
        ctx.fillRect(canvas.width / 2 - 180, 24, 360, 42);
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 16px "Chakra Petch", sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('⚠️ STALL WARNING HORN ACTIVE', canvas.width / 2, 45);
        ctx.font = '11px "JetBrains Mono", monospace';
        ctx.fillText('Approaching boundary of boundary layer separation', canvas.width / 2, 60);
        ctx.restore();
      }

      animId = requestAnimationFrame(render);
    };

    render();

    return () => {
      cancelAnimationFrame(animId);
    };
  }, [state, isStalled, isNearStall, criticalAoA, cl, cd, liftLbs, dragLbs]);

  return (
    <div className="space-y-6">
      {/* Top Banner & RCAC Aircraft Selection */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 backdrop-blur shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-rcac-blue/60 border border-rcac-sky/40 rounded-lg text-rcac-sky">
            <Wind className="w-6 h-6 animate-pulse" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">
              Module 1: Principles of Flight & Virtual Wind Tunnel
            </h2>
            <p className="text-sm text-slate-400">
              Interactive 2D Aerodynamic Fluid Flow • Bernoulli vs Newton • Air Cadet Glider (SGS 2-33A) & Power Trainer
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex rounded-lg bg-slate-800 p-1 border border-slate-700">
            <button
              onClick={() => {
                setState((prev) => ({ ...prev, aircraftType: 'glider', camber: 4, airspeed: 48 }));
                soundManager.playClick();
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                state.aircraftType === 'glider'
                  ? 'bg-rcac-sky text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🇨🇦 RCAC Schweizer 2-33A Glider
            </button>
            <button
              onClick={() => {
                setState((prev) => ({ ...prev, aircraftType: 'cessna', camber: 2, airspeed: 85 }));
                soundManager.playClick();
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                state.aircraftType === 'cessna'
                  ? 'bg-rcac-gold text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🛩️ Cessna 172 Skyhawk
            </button>
          </div>

          <button
            onClick={toggleSound}
            title={soundEnabled ? 'Mute Audio' : 'Unmute Audio'}
            className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
          >
            {soundEnabled ? <Volume2 className="w-4 h-4 text-emerald-400" /> : <VolumeX className="w-4 h-4 text-rose-400" />}
          </button>

          <button
            onClick={() => setShowTheoryModal(true)}
            className="flex items-center space-x-1.5 px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600/50 text-blue-200 border border-blue-500/40 rounded-lg text-xs font-medium"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Flight Notes</span>
          </button>
        </div>
      </div>

      {/* Main Simulation Viewport & Side Control Telemetry */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Wind Tunnel Canvas (3 Columns) */}
        <div className="lg:col-span-3 flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-2xl relative">
          {/* Canvas Header bar */}
          <div className="bg-slate-950/80 px-4 py-2.5 border-b border-slate-800 flex items-center justify-between text-xs">
            <div className="flex items-center space-x-4">
              <span className="flex items-center space-x-1.5 font-mono text-emerald-400">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-ping" />
                <span>TUNNEL ACTIVE</span>
              </span>
              <span className="text-slate-400 font-mono">
                AIR DENSITY: <strong className="text-slate-200">{state.airDensity} kg/m³</strong> (ISA MSL)
              </span>
            </div>

            <div className="flex items-center space-x-4 font-mono text-slate-300">
              <span>AoA: <strong className={isStalled ? 'text-rose-400' : 'text-rcac-sky'}>{state.angleOfAttack}°</strong></span>
              <span>AIRSPEED: <strong className="text-amber-400">{state.airspeed} KIAS</strong></span>
              <span>L/D RATIO: <strong className="text-emerald-400">{ldRatio}:1</strong></span>
            </div>
          </div>

          {/* Interactive Wind Tunnel Canvas */}
          <div className="relative w-full aspect-[16/9] min-h-[380px] bg-slate-950 flex items-center justify-center">
            <canvas
              ref={canvasRef}
              width={960}
              height={540}
              className="w-full h-full object-contain cursor-crosshair"
            />

            {/* Quick reset button */}
            <button
              onClick={() => {
                setState((prev) => ({ ...prev, angleOfAttack: 6, flaps: 0, airspeed: prev.aircraftType === 'glider' ? 48 : 75 }));
                soundManager.playClick();
              }}
              className="absolute bottom-3 right-3 p-2 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white rounded-lg border border-slate-700 text-xs flex items-center gap-1.5 shadow"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Reset Trim</span>
            </button>
          </div>

          {/* Quick Attitude Presets & Demonstrations */}
          <div className="bg-slate-950 px-4 py-2.5 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] font-mono text-slate-400 font-semibold flex items-center gap-1.5">
              <span>✈️ ATTITUDE CONTROLS & PRESETS:</span>
            </span>
            <div className="flex flex-wrap items-center gap-1.5 text-xs font-mono">
              <button
                type="button"
                onClick={() => {
                  setState((prev) => ({ ...prev, angleOfAttack: Math.min(26, prev.angleOfAttack + 2) }));
                  soundManager.playClick();
                }}
                className="px-2.5 py-1 rounded bg-sky-950/70 hover:bg-sky-900 border border-sky-600/50 text-sky-200 font-bold active:scale-95 transition cursor-pointer"
                title="Pitch nose up to increase Angle of Attack"
              >
                ▲ Pitch Up (+2°)
              </button>
              <button
                type="button"
                onClick={() => {
                  setState((prev) => ({ ...prev, angleOfAttack: Math.max(-8, prev.angleOfAttack - 2) }));
                  soundManager.playClick();
                }}
                className="px-2.5 py-1 rounded bg-amber-950/70 hover:bg-amber-900 border border-amber-600/50 text-amber-200 font-bold active:scale-95 transition cursor-pointer"
                title="Pitch nose down to decrease Angle of Attack"
              >
                ▼ Pitch Down (-2°)
              </button>
              <div className="w-px h-5 bg-slate-800 mx-1" />
              <button
                type="button"
                onClick={() => {
                  setState((prev) => ({ ...prev, angleOfAttack: 4, flaps: 0, airspeed: 85 }));
                  soundManager.playClick();
                }}
                className={`px-2.5 py-1 rounded transition border cursor-pointer ${
                  state.angleOfAttack === 4 ? 'bg-rcac-blue border-rcac-sky text-white font-bold' : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                Level Flight (4°)
              </button>
              <button
                type="button"
                onClick={() => {
                  setState((prev) => ({ ...prev, angleOfAttack: 10, flaps: 0, airspeed: 75 }));
                  soundManager.playClick();
                }}
                className={`px-2.5 py-1 rounded transition border cursor-pointer ${
                  state.angleOfAttack === 10 ? 'bg-rcac-blue border-rcac-sky text-white font-bold' : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                Climbing Attitude (10°)
              </button>
              <button
                type="button"
                onClick={() => {
                  setState((prev) => ({ ...prev, angleOfAttack: 20, flaps: 0, airspeed: 55 }));
                  soundManager.playClick();
                }}
                className={`px-2.5 py-1 rounded transition border cursor-pointer ${
                  state.angleOfAttack === 20 ? 'bg-rose-600 border-rose-400 text-white shadow-lg animate-pulse font-bold' : 'bg-rose-950/60 border-rose-800/60 text-rose-300 hover:text-white'
                }`}
              >
                ⚠️ Demonstrate Climbing Stall (20°)
              </button>
              <button
                type="button"
                onClick={() => {
                  setState((prev) => ({ ...prev, angleOfAttack: -6, flaps: 0, airspeed: 110 }));
                  soundManager.playClick();
                }}
                className={`px-2.5 py-1 rounded transition border cursor-pointer ${
                  state.angleOfAttack === -6 ? 'bg-amber-600 border-amber-400 text-slate-950 font-bold' : 'bg-slate-900 border-slate-800 text-slate-300 hover:text-white'
                }`}
              >
                Diving Attitude (-6°)
              </button>
            </div>
          </div>

          {/* Interactive Aerodynamic Parameter Sliders */}
          <div className="bg-slate-950/90 p-5 border-t border-slate-800 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
            {/* Angle of Attack */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Compass className="w-3.5 h-3.5 text-rcac-sky" /> Angle of Attack (α)
                </span>
                <span className={`font-mono font-bold px-1.5 py-0.5 rounded ${isStalled ? 'bg-rose-500/20 text-rose-400' : 'bg-slate-800 text-rcac-sky'}`}>
                  {state.angleOfAttack}° {state.angleOfAttack > 0 ? '(Pitch Up / Climb)' : state.angleOfAttack < 0 ? '(Pitch Down / Dive)' : '(Level)'}
                </span>
              </div>
              <input
                type="range"
                min="-8"
                max="26"
                step="0.5"
                value={state.angleOfAttack}
                onChange={(e) => setState((prev) => ({ ...prev, angleOfAttack: parseFloat(e.target.value) }))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rcac-sky"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>-8° (Dive)</span>
                <span>0°</span>
                <span className="text-sky-400">10° (Climb)</span>
                <span className="text-amber-500">{criticalAoA.toFixed(0)}° (Stall)</span>
                <span>26°</span>
              </div>
            </div>

            {/* Indicated Airspeed */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Activity className="w-3.5 h-3.5 text-amber-400" /> Airspeed (KIAS)
                </span>
                <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-amber-400">
                  {state.airspeed} kts
                </span>
              </div>
              <input
                type="range"
                min="25"
                max="140"
                step="1"
                value={state.airspeed}
                onChange={(e) => setState((prev) => ({ ...prev, airspeed: parseInt(e.target.value) }))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>25 (Min)</span>
                <span>Best L/D: {state.aircraftType === 'glider' ? '45' : '65'}</span>
                <span>140 (Vne)</span>
              </div>
            </div>

            {/* Flap Setting */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Flaps / Airbrakes
                </span>
                <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-emerald-400">
                  {state.flaps}°
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="40"
                step="10"
                value={state.flaps}
                onChange={(e) => {
                  setState((prev) => ({ ...prev, flaps: parseInt(e.target.value) }));
                  soundManager.playClick();
                }}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0° (UP)</span>
                <span>10°</span>
                <span>20°</span>
                <span>40° (FULL)</span>
              </div>
            </div>

            {/* Airfoil Camber Slider */}
            <div className="space-y-2">
              <div className="flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-300 flex items-center gap-1.5">
                  <Sliders className="w-3.5 h-3.5 text-purple-400" /> Upper Camber
                </span>
                <span className="font-mono font-bold px-1.5 py-0.5 rounded bg-slate-800 text-purple-400">
                  {state.camber}%
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="6"
                step="0.5"
                value={state.camber}
                onChange={(e) => setState((prev) => ({ ...prev, camber: parseFloat(e.target.value) }))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-400"
              />
              <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                <span>0% (Symmetric)</span>
                <span>3% (Clark Y)</span>
                <span>6% (High Lift)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Aerodynamic Telemetry, Polar and Four Forces Panel (1 Column) */}
        <div className="flex flex-col space-y-4">
          {/* Live Flight Telemetry Gauge Box */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-3 flex items-center justify-between border-b border-slate-800 pb-2">
              <span>Flight Force Telemetry</span>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full ${
                isStalled ? 'bg-rose-500/20 text-rose-400 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
              }`}>
                {isStalled ? 'STALL CRITICAL' : 'LAMINAR / ATTACHED'}
              </span>
            </h3>

            <div className="space-y-3 font-mono">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Lift Coefficient (CL)</span>
                  <span className="text-emerald-400 font-bold">{cl.toFixed(3)}</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-emerald-400 h-full rounded-full transition-all duration-150"
                    style={{ width: `${Math.min(100, Math.max(0, (cl / 2.2) * 100))}%` }}
                  />
                </div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80">
                <div className="flex justify-between text-xs text-slate-400 mb-1">
                  <span>Drag Coefficient (CD)</span>
                  <span className="text-rose-400 font-bold">{cd.toFixed(3)}</span>
                </div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                  <div
                    className="bg-rose-400 h-full rounded-full transition-all duration-150"
                    style={{ width: `${Math.min(100, Math.max(0, (cd / 1.5) * 100))}%` }}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">TOTAL LIFT</span>
                  <span className="text-base font-bold text-emerald-400">{liftLbs.toLocaleString()} lbs</span>
                </div>
                <div className="bg-slate-950 p-2 rounded-lg border border-slate-800">
                  <span className="text-slate-400 block text-[10px]">TOTAL DRAG</span>
                  <span className="text-base font-bold text-rose-400">{dragLbs.toLocaleString()} lbs</span>
                </div>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800">
                <div className="flex justify-between text-xs text-slate-400">
                  <span>Glide Ratio (L/D)</span>
                  <span className="text-rcac-sky font-bold">{ldRatio} : 1</span>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">
                  {state.aircraftType === 'glider'
                    ? 'Glides 23 feet forward for every 1 foot of altitude lost.'
                    : 'Glides 9 feet forward for every 1 foot of altitude lost.'}
                </p>
              </div>
            </div>
          </div>

          {/* Four Forces Diagram Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl text-xs space-y-3">
            <h4 className="font-bold text-white flex items-center justify-between">
              <span>The Four Forces of Flight</span>
              <span className="text-[10px] text-rcac-gold font-mono">RCAC LEVEL 3/4</span>
            </h4>
            <div className="space-y-1.5 text-slate-300">
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 mt-1 flex-shrink-0" />
                <div>
                  <strong className="text-emerald-400">LIFT:</strong> Overcomes weight; created by pressure differential (Bernoulli) and downwash deflection (Newton).
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400 mt-1 flex-shrink-0" />
                <div>
                  <strong className="text-amber-400">WEIGHT:</strong> Gravitational pull toward Earth acting downward through the Center of Gravity (C of G).
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-400 mt-1 flex-shrink-0" />
                <div>
                  <strong className="text-blue-400">THRUST:</strong> Overcomes drag. In a glider, gravity pulling down the glide path provides forward drive.
                </div>
              </div>
              <div className="flex items-start gap-2">
                <span className="w-2 h-2 rounded-full bg-rose-400 mt-1 flex-shrink-0" />
                <div>
                  <strong className="text-rose-400">DRAG:</strong> Resistance to airflow. Includes Parasite Drag (form/skin friction) and Induced Drag (by-product of lift).
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Theory & Cadet Ground School Reference Modal */}
      {showTheoryModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Compass className="w-5 h-5 text-rcac-sky" />
                <span>Royal Canadian Air Cadets: Theory of Flight</span>
              </h3>
              <button
                onClick={() => setShowTheoryModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-sm text-slate-300 leading-relaxed">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="font-bold text-rcac-sky mb-1">1. Bernoulli’s Principle of Pressure</h4>
                <p>
                  As the velocity of a fluid (or air) increases, the internal pressure decreases. Because the upper camber of an airfoil is curved, oncoming air accelerates over the top surface compared to the lower surface. This creates a low-pressure area above the wing, producing upward suction (Lift).
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="font-bold text-emerald-400 mb-1">2. Newton’s Third Law of Motion</h4>
                <p>
                  For every action, there is an equal and opposite reaction. As the wing moves through the air with a positive angle of attack, it deflects oncoming air downward (downwash). The reaction force pushes the wing upward and backward.
                </p>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="font-bold text-rose-400 mb-1">3. The Critical Angle of Attack & Stall</h4>
                <p>
                  A stall is NOT an engine failure—it occurs when the <strong>Angle of Attack exceeds the critical angle</strong> (~16° for most trainer airfoils). Beyond this angle, the airflow can no longer adhere smoothly to the upper surface; the boundary layer separates violently into turbulent vortices, lift rapidly collapses, and induced drag spikes.
                </p>
                <div className="mt-2 text-xs text-amber-300 flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>Cadet Rule: An aircraft can stall at ANY airspeed and ANY attitude if the critical angle of attack is exceeded!</span>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800">
                <h4 className="font-bold text-rcac-gold mb-1">4. Schweizer SGS 2-33A Cadet Glider Operations</h4>
                <p>
                  The workhorse of the Air Cadet Gliding Program (ACGP). Made of welded steel-tube fuselage with aluminum-skinned wings. Cadets practice thermal soaring, tow launch behind the Bellanca Scout towplane, circuit planning, and steep slip approaches using upper/lower wing dive spoilers.
                </p>
              </div>
            </div>

            <div className="text-right pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowTheoryModal(false)}
                className="px-4 py-2 bg-rcac-sky text-slate-950 font-bold rounded-lg hover:bg-sky-400 transition"
              >
                Close Notes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
