import React, { useState, useEffect } from 'react';
import { 
  Gauge, 
  RotateCcw, 
  Sliders, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle,
  ShieldAlert,
  Wind
} from 'lucide-react';
import { InstrumentState } from '../types';
import { soundManager } from '../utils/audio';

export const SixPackCockpit: React.FC = () => {
  const [instruments, setInstruments] = useState<InstrumentState>({
    indicatedAirspeed: 100,
    altitude: 2500,
    verticalSpeed: 0,
    trueAirspeed: 100,
    trueAltitude: 2500,
    trueVsi: 0,
    pitchAngle: 2,
    bankAngle: 0,
    heading: 360,
    altimeterSetting: 29.92,
    headingBug: 360,
    engineRpm: 2300,
    flapSetting: 0,
    pitotFault: 'none',
    staticBlocked: false,
    blockRefAlt: null,
    blockRefIas: null,
    turnRate: 0,
    slipSkid: 0,
  });

  const [activeScenario, setActiveScenario] = useState<string>('level');
  const [showGuideModal, setShowGuideModal] = useState<boolean>(false);

  // Compute flight physics loop.
  // Golden rule: the AIRCRAFT keeps flying on TRUE values; the DIALS show
  // INDICATED values, which lie when the pitot-static system is compromised.
  useEffect(() => {
    const timer = setInterval(() => {
      setInstruments((prev) => {
        // ---------- TRUE aircraft state (faults never touch this) ----------
        const targetVsi = (prev.pitchAngle - 2) * 220 + (prev.engineRpm - 2300) * 0.4;
        const trueVsi = prev.trueVsi + (targetVsi - prev.trueVsi) * 0.15;
        const trueAlt = Math.max(0, prev.trueAltitude + (trueVsi / 60) * 0.1);

        // Turn rate from the coordinated-turn formula: ω = g·tan(bank) / V
        const bankRad = (prev.bankAngle * Math.PI) / 180;
        const vFps = Math.max(40, prev.trueAirspeed * 1.68781);
        const targetTurnRate = ((32.2 * Math.tan(bankRad)) / vFps) * (180 / Math.PI); // deg/sec
        const newTurnRate = prev.turnRate + (targetTurnRate - prev.turnRate) * 0.2;
        let newHeading = (prev.heading + newTurnRate * 0.1) % 360;
        if (newHeading < 0) newHeading += 360;

        // TRUE airspeed seeks the trim speed for this pitch + power (like a real aircraft)
        const targetAsi = Math.max(
          0,
          110 - prev.pitchAngle * 4.5 + (prev.engineRpm - 2300) * 0.02 - (prev.flapSetting / 10) * 3
        );
        const trueAsi = prev.trueAirspeed + (targetAsi - prev.trueAirspeed) * 0.1;

        // ---------- Fault references (captured once, at the moment of failure) ----------
        const needRef = prev.staticBlocked || prev.pitotFault === 'ram-drain';
        let refAlt = prev.blockRefAlt;
        let refIas = prev.blockRefIas;
        if (needRef && refAlt === null) {
          refAlt = prev.trueAltitude;
          refIas = prev.trueAirspeed;
        } else if (!needRef) {
          refAlt = null;
          refIas = null;
        }

        // ---------- INDICATED values (what the dials show) ----------
        // Altimeter & VSI: frozen when the static port is blocked
        const indAlt = prev.staticBlocked && refAlt !== null ? refAlt : trueAlt;
        const indVsi = prev.staticBlocked ? 0 : trueVsi;

        // Airspeed indicator: pitot minus static, per the fault in play
        let indAsi: number;
        if (prev.pitotFault === 'ram') {
          // Ram blocked, drain OPEN: pressure leaks out the drain hole → ASI falls toward zero
          indAsi = prev.indicatedAirspeed * 0.93;
        } else if (prev.pitotFault === 'ram-drain' && refAlt !== null && refIas !== null) {
          if (prev.staticBlocked) {
            // Both sides trapped: needle frozen at the trapped value
            indAsi = refIas;
          } else {
            // Ram + drain blocked: trapped pitot pressure vs live static → ASI acts as an altimeter
            // (climb → over-reads, descent → under-reads)
            indAsi = Math.max(0, Math.min(220, refIas + (refAlt - trueAlt) * 0.06));
          }
        } else if (prev.staticBlocked && refAlt !== null) {
          // Static blocked, pitot normal: trapped static vs live pitot
          // (climb → under-reads, descent → over-reads)
          indAsi = Math.max(0, Math.min(220, trueAsi - (trueAlt - refAlt) * 0.06));
        } else {
          indAsi = trueAsi;
        }

        // Slip/skid ball: centered in a stabilized coordinated turn; deflects only
        // while the turn rate is catching up to the bank (adverse yaw / no rudder yet).
        // A steady banked turn does NOT hold the ball out — that was the old error.
        const slip = Math.max(-1, Math.min(1, (targetTurnRate - newTurnRate) * 0.35));

        return {
          ...prev,
          trueVsi,
          trueAltitude: trueAlt,
          trueAirspeed: trueAsi,
          blockRefAlt: refAlt,
          blockRefIas: refIas,
          verticalSpeed: indVsi,
          altitude: indAlt,
          turnRate: newTurnRate,
          heading: newHeading,
          indicatedAirspeed: indAsi,
          slipSkid: slip,
        };
      });
    }, 100);

    return () => clearInterval(timer);
  }, []);

  // Quick Flight Presets — each sets a pitch/power combo whose natural trim
  // speed matches the target, so the preset holds instead of drifting away.
  const applyScenario = (name: string) => {
    soundManager.playClick();
    setActiveScenario(name);
    if (name === 'level') {
      setInstruments((prev) => ({
        ...prev,
        pitchAngle: 2,
        bankAngle: 0,
        indicatedAirspeed: 100,
        trueAirspeed: 100,
        engineRpm: 2350,
        verticalSpeed: 0,
        trueVsi: 0,
      }));
    } else if (name === 'climb') {
      setInstruments((prev) => ({
        ...prev,
        pitchAngle: 8,
        bankAngle: 0,
        indicatedAirspeed: 78, // Vy best rate of climb
        trueAirspeed: 78,
        engineRpm: 2500,
      }));
    } else if (name === 'steep-turn') {
      setInstruments((prev) => ({
        ...prev,
        pitchAngle: 4,
        bankAngle: 45,
        indicatedAirspeed: 95,
        trueAirspeed: 95,
        engineRpm: 2450,
      }));
    } else if (name === 'approach') {
      setInstruments((prev) => ({
        ...prev,
        pitchAngle: 3,
        bankAngle: 0,
        indicatedAirspeed: 70,
        trueAirspeed: 70,
        engineRpm: 1450,
        flapSetting: 30,
      }));
    }
  };

  // Barometric pressure altimeter correction (Kollsman window)
  // 1 inch Hg = 1000 ft
  const kollsmanOffset = (instruments.altimeterSetting - 29.92) * 1000;
  const displayedAltitude = instruments.altitude + kollsmanOffset;

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 backdrop-blur shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-rcac-blue/60 border border-rcac-sky/40 rounded-lg text-rcac-sky">
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">
              Module 3: Cockpit Flight Instruments & The "Six-Pack"
            </h2>
            <p className="text-sm text-slate-400">
              Pitot-Static & Gyroscopic Systems • Kollsman Window Barometric Subscale • Instrument Cross-Check
            </p>
          </div>
        </div>

        {/* Flight Scenario Presets */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 font-mono mr-1">PRESETS:</span>
          {[
            { id: 'level', label: 'Straight & Level' },
            { id: 'climb', label: 'Vy Best Climb' },
            { id: 'steep-turn', label: '45° Steep Turn' },
            { id: 'approach', label: 'Glide / Final App' },
          ].map((sc) => (
            <button
              key={sc.id}
              onClick={() => applyScenario(sc.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition ${
                activeScenario === sc.id
                  ? 'bg-rcac-sky text-slate-950 border-rcac-sky shadow'
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }`}
            >
              {sc.label}
            </button>
          ))}
          <button
            onClick={() => setShowGuideModal(true)}
            className="p-1.5 bg-slate-800 hover:bg-slate-700 text-rcac-sky border border-slate-700 rounded-lg"
            title="Six Pack Guide"
          >
            <HelpCircle className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Cockpit Panel Grid (Six-Pack Display) */}
      <div className="bg-gradient-to-b from-slate-900 via-slate-950 to-slate-950 border-2 border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6">
        {/* Cockpit Instrument Six-Pack (2 Rows of 3 Instruments) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
          
          {/* 1. AIRSPEED INDICATOR (ASI) */}
          <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-4 flex flex-col items-center shadow-xl relative overflow-hidden">
            <div className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <span>AIRSPEED (KIAS)</span>
              {instruments.pitotFault !== 'none' && <span className="text-[9px] text-rose-400 bg-rose-950/60 px-1 rounded">PITOT FAULT</span>}
            </div>

            {/* SVG ASI Gauge */}
            <div className="relative w-48 h-48">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                {/* Gauge bezel */}
                <circle cx="100" cy="100" r="95" fill="#11141a" stroke="#334155" strokeWidth="6" />
                <circle cx="100" cy="100" r="88" fill="#090d16" stroke="#1e293b" strokeWidth="2" />

                {/* Color arcs: White Arc (Flaps 40-85), Green Arc (Normal 48-129), Yellow Arc (Caution 129-163), Red Radial (163) */}
                {/* 40 kts = ~220 deg, 85 kts = ~320 deg, 129 kts = ~60 deg, 163 kts = ~120 deg */}
                {/* White Arc (Flap range 40 - 85 kts) */}
                <path
                  d="M 40 145 A 76 76 0 0 1 125 28"
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth="6"
                  strokeLinecap="round"
                />
                {/* Green Arc (Normal operating 48 - 129 kts) */}
                <path
                  d="M 55 160 A 70 70 0 1 1 168 115"
                  fill="none"
                  stroke="#22c55e"
                  strokeWidth="6"
                />
                {/* Yellow Arc (Caution 129 - 163 kts) */}
                <path
                  d="M 168 115 A 70 70 0 0 1 138 165"
                  fill="none"
                  stroke="#eab308"
                  strokeWidth="6"
                />
                {/* Red line (Vne 163 kts) */}
                <line x1="100" y1="100" x2="138" y2="165" stroke="#ef4444" strokeWidth="4" />

                {/* Speed tick marks */}
                {[40, 60, 80, 100, 120, 140, 160].map((speed) => {
                  const angle = (speed / 160) * 280 - 140;
                  const rad = (angle * Math.PI) / 180;
                  const x1 = 100 + 72 * Math.cos(rad);
                  const y1 = 100 + 72 * Math.sin(rad);
                  const x2 = 100 + 82 * Math.cos(rad);
                  const y2 = 100 + 82 * Math.sin(rad);
                  const tx = 100 + 58 * Math.cos(rad);
                  const ty = 100 + 58 * Math.sin(rad) + 4;
                  return (
                    <g key={speed}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f8fafc" strokeWidth="2" />
                      <text x={tx} y={ty} fill="#94a3b8" fontSize="10" textAnchor="middle" fontFamily="monospace">
                        {speed}
                      </text>
                    </g>
                  );
                })}

                <text x="100" y="85" fill="#64748b" fontSize="9" textAnchor="middle" fontFamily="sans-serif">KNOTS</text>

                {/* Needle */}
                {(() => {
                  const needleSpeed = Math.max(0, Math.min(180, instruments.indicatedAirspeed));
                  const needleAngle = (needleSpeed / 160) * 280 - 140;
                  return (
                    <g transform={`rotate(${needleAngle} 100 100)`}>
                      <polygon points="100,26 96,100 104,100" fill="#f8fafc" />
                      <circle cx="100" cy="100" r="7" fill="#ef4444" />
                    </g>
                  );
                })()}
              </svg>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-950/90 px-2 py-0.5 rounded border border-slate-800 text-[11px] font-mono text-emerald-400 font-bold">
                {Math.round(instruments.indicatedAirspeed)} KIAS
              </div>
            </div>
            <span className="text-[10px] text-slate-500 mt-2 font-mono">Pitot-Static System</span>
          </div>

          {/* 2. ATTITUDE INDICATOR (AI / ARTIFICIAL HORIZON) */}
          <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-4 flex flex-col items-center shadow-xl relative overflow-hidden">
            <div className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-widest mb-2">
              ATTITUDE INDICATOR
            </div>

            {/* SVG AI Gauge */}
            <div className="relative w-48 h-48">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <defs>
                  <clipPath id="aiClip">
                    <circle cx="100" cy="100" r="82" />
                  </clipPath>
                </defs>

                {/* Outer Bezel */}
                <circle cx="100" cy="100" r="95" fill="#11141a" stroke="#334155" strokeWidth="6" />

                {/* Artificial Horizon Sphere masked by clipPath */}
                <g clipPath="url(#aiClip)">
                  {/* Rotates for Bank and Translates for Pitch */}
                  <g transform={`rotate(${-instruments.bankAngle} 100 100) translate(0, ${instruments.pitchAngle * 2.8})`}>
                    {/* Sky (Blue) */}
                    <rect x="-100" y="-150" width="400" height="250" fill="#0284c7" />
                    {/* Earth (Brown) */}
                    <rect x="-100" y="100" width="400" height="250" fill="#78350f" />
                    {/* Horizon line */}
                    <line x1="-100" y1="100" x2="300" y2="100" stroke="#ffffff" strokeWidth="3" />

                    {/* Pitch rungs: 10 deg, 20 deg nose up/down */}
                    {[-20, -10, 10, 20].map((deg) => (
                      <g key={deg}>
                        <line x1="80" y1={100 - deg * 2.8} x2="120" y2={100 - deg * 2.8} stroke="#ffffff" strokeWidth="2" />
                        <text x="72" y={104 - deg * 2.8} fill="#ffffff" fontSize="8" textAnchor="end">{Math.abs(deg)}</text>
                        <text x="128" y={104 - deg * 2.8} fill="#ffffff" fontSize="8">{Math.abs(deg)}</text>
                      </g>
                    ))}
                  </g>

                  {/* Fixed Miniature Airplane Symbol */}
                  <g>
                    <circle cx="100" cy="100" r="4" fill="#fbbf24" stroke="#000" strokeWidth="1" />
                    <line x1="50" y1="100" x2="86" y2="100" stroke="#fbbf24" strokeWidth="4" />
                    <line x1="86" y1="100" x2="86" y2="106" stroke="#fbbf24" strokeWidth="4" />
                    <line x1="114" y1="100" x2="150" y2="100" stroke="#fbbf24" strokeWidth="4" />
                    <line x1="114" y1="100" x2="114" y2="106" stroke="#fbbf24" strokeWidth="4" />
                  </g>
                </g>

                {/* Bank Angle Index Marks on upper bezel */}
                {[-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60].map((bAngle) => {
                  const rad = ((bAngle - 90) * Math.PI) / 180;
                  const x1 = 100 + 82 * Math.cos(rad);
                  const y1 = 100 + 82 * Math.sin(rad);
                  const x2 = 100 + (bAngle === 0 ? 70 : 75) * Math.cos(rad);
                  const y2 = 100 + (bAngle === 0 ? 70 : 75) * Math.sin(rad);
                  return (
                    <line key={bAngle} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f8fafc" strokeWidth={bAngle === 0 ? 3 : 2} />
                  );
                })}
              </svg>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-950/90 px-2 py-0.5 rounded border border-slate-800 text-[11px] font-mono text-sky-400 font-bold">
                {Math.round(instruments.bankAngle)}° / {instruments.pitchAngle.toFixed(1)}°
              </div>
            </div>
            <span className="text-[10px] text-slate-500 mt-2 font-mono">Gyroscopic (Rigidity)</span>
          </div>

          {/* 3. ALTIMETER (ALT) */}
          <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-4 flex flex-col items-center shadow-xl relative overflow-hidden">
            <div className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <span>ALTIMETER</span>
              {instruments.staticBlocked && <span className="text-[9px] text-rose-400 bg-rose-950/60 px-1 rounded">STATIC BLK</span>}
            </div>

            {/* SVG Altimeter Gauge */}
            <div className="relative w-48 h-48">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <circle cx="100" cy="100" r="95" fill="#11141a" stroke="#334155" strokeWidth="6" />
                <circle cx="100" cy="100" r="88" fill="#090d16" stroke="#1e293b" strokeWidth="2" />

                {/* Kollsman Window cutout */}
                <rect x="122" y="90" width="36" height="20" rx="3" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                <text x="140" y="104" fill="#38bdf8" fontSize="9" textAnchor="middle" fontFamily="monospace">
                  {instruments.altimeterSetting.toFixed(2)}
                </text>

                {/* Dial numbers 0 to 9 (hundreds of feet) */}
                {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
                  const angle = (num / 10) * 360 - 90;
                  const rad = (angle * Math.PI) / 180;
                  const tx = 100 + 64 * Math.cos(rad);
                  const ty = 100 + 64 * Math.sin(rad) + 4;
                  const x1 = 100 + 76 * Math.cos(rad);
                  const y1 = 100 + 76 * Math.sin(rad);
                  const x2 = 100 + 84 * Math.cos(rad);
                  const y2 = 100 + 84 * Math.sin(rad);
                  return (
                    <g key={num}>
                      <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f8fafc" strokeWidth="2.5" />
                      <text x={tx} y={ty} fill="#f8fafc" fontSize="13" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                        {num}
                      </text>
                    </g>
                  );
                })}

                {/* Sub-division ticks */}
                {Array.from({ length: 50 }).map((_, i) => {
                  if (i % 5 === 0) return null;
                  const angle = (i / 50) * 360 - 90;
                  const rad = (angle * Math.PI) / 180;
                  return (
                    <line
                      key={i}
                      x1={100 + 79 * Math.cos(rad)}
                      y1={100 + 79 * Math.sin(rad)}
                      x2={100 + 84 * Math.cos(rad)}
                      y2={100 + 84 * Math.sin(rad)}
                      stroke="#94a3b8"
                      strokeWidth="1"
                    />
                  );
                })}

                {/* Needles:
                    - 10,000 ft hand: Long thin with triangle end
                    - 1,000 ft hand: Short thick
                    - 100 ft hand: Long pointed
                */}
                {(() => {
                  const alt = Math.max(0, displayedAltitude);
                  const hundredAngle = ((alt % 1000) / 1000) * 360;
                  const thousandAngle = ((alt % 10000) / 10000) * 360;
                  const tenThousandAngle = (alt / 100000) * 360;

                  return (
                    <>
                      {/* 10,000 ft hand */}
                      <g transform={`rotate(${tenThousandAngle} 100 100)`}>
                        <line x1="100" y1="100" x2="100" y2="28" stroke="#f8fafc" strokeWidth="2" />
                        <polygon points="100,24 95,32 105,32" fill="#f8fafc" />
                      </g>

                      {/* 1,000 ft hand (Short, wide) */}
                      <g transform={`rotate(${thousandAngle} 100 100)`}>
                        <polygon points="100,50 94,100 106,100" fill="#f8fafc" />
                      </g>

                      {/* 100 ft hand (Long, pointed) */}
                      <g transform={`rotate(${hundredAngle} 100 100)`}>
                        <polygon points="100,26 97,100 103,100" fill="#f8fafc" />
                      </g>

                      <circle cx="100" cy="100" r="6" fill="#0284c7" />
                    </>
                  );
                })()}
              </svg>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-950/90 px-2 py-0.5 rounded border border-slate-800 text-[11px] font-mono text-rcac-gold font-bold">
                {Math.round(displayedAltitude)} FT
              </div>
            </div>
            <span className="text-[10px] text-slate-500 mt-2 font-mono">Static Aneroid System</span>
          </div>

          {/* 4. TURN COORDINATOR (TC) */}
          <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-4 flex flex-col items-center shadow-xl relative overflow-hidden">
            <div className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-widest mb-2">
              TURN COORDINATOR
            </div>

            {/* SVG Turn Coordinator */}
            <div className="relative w-48 h-48">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <circle cx="100" cy="100" r="95" fill="#11141a" stroke="#334155" strokeWidth="6" />
                <circle cx="100" cy="100" r="88" fill="#090d16" stroke="#1e293b" strokeWidth="2" />

                {/* Rate 1 markings (L and R index tabs) */}
                <text x="46" y="86" fill="#f8fafc" fontSize="12" fontWeight="bold">L</text>
                <text x="146" y="86" fill="#f8fafc" fontSize="12" fontWeight="bold">R</text>

                <line x1="40" y1="90" x2="60" y2="90" stroke="#f8fafc" strokeWidth="3" />
                <line x1="140" y1="90" x2="160" y2="90" stroke="#f8fafc" strokeWidth="3" />

                {/* Miniature airplane banking representation */}
                {(() => {
                  const bankDeflection = Math.max(-30, Math.min(30, (instruments.turnRate / 3) * 18));
                  return (
                    <g transform={`rotate(${bankDeflection} 100 90)`}>
                      <ellipse cx="100" cy="90" rx="6" ry="6" fill="#f8fafc" />
                      <line x1="55" y1="90" x2="145" y2="90" stroke="#f8fafc" strokeWidth="5" strokeLinecap="round" />
                      <polygon points="100,74 96,90 104,90" fill="#f8fafc" />
                    </g>
                  );
                })()}

                {/* Inclinometer (Slip/Skid ball tube) */}
                <path d="M 60 148 Q 100 156 140 148" fill="none" stroke="#334155" strokeWidth="14" strokeLinecap="round" />
                {/* Center reference lines */}
                <line x1="93" y1="142" x2="93" y2="154" stroke="#ffffff" strokeWidth="1.5" />
                <line x1="107" y1="142" x2="107" y2="154" stroke="#ffffff" strokeWidth="1.5" />

                {/* The Ball */}
                {(() => {
                  const ballX = 100 + instruments.slipSkid * 28;
                  return (
                    <circle cx={ballX} cy="148" r="6" fill="#10b981" stroke="#064e3b" strokeWidth="1.5" />
                  );
                })()}

                <text x="100" y="174" fill="#64748b" fontSize="8" textAnchor="middle">2 MIN TURN</text>
              </svg>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-950/90 px-2 py-0.5 rounded border border-slate-800 text-[11px] font-mono text-emerald-400 font-bold">
                {Math.abs(instruments.turnRate).toFixed(1)}°/SEC
              </div>
            </div>
            <span className="text-[10px] text-slate-500 mt-2 font-mono">Gyroscopic (Precession)</span>
          </div>

          {/* 5. HEADING INDICATOR (DIRECTIONAL GYRO / DG) */}
          <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-4 flex flex-col items-center shadow-xl relative overflow-hidden">
            <div className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-widest mb-2">
              HEADING INDICATOR
            </div>

            {/* SVG Heading Indicator */}
            <div className="relative w-48 h-48">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <circle cx="100" cy="100" r="95" fill="#11141a" stroke="#334155" strokeWidth="6" />
                <circle cx="100" cy="100" r="88" fill="#090d16" stroke="#1e293b" strokeWidth="2" />

                {/* Rotating Azimuth Compass Card */}
                <g transform={`rotate(${-instruments.heading} 100 100)`}>
                  {[
                    { label: 'N', deg: 0 },
                    { label: '3', deg: 30 },
                    { label: '6', deg: 60 },
                    { label: 'E', deg: 90 },
                    { label: '12', deg: 120 },
                    { label: '15', deg: 150 },
                    { label: 'S', deg: 180 },
                    { label: '21', deg: 210 },
                    { label: '24', deg: 240 },
                    { label: 'W', deg: 270 },
                    { label: '30', deg: 300 },
                    { label: '33', deg: 330 },
                  ].map((item) => {
                    const rad = ((item.deg - 90) * Math.PI) / 180;
                    const tx = 100 + 64 * Math.cos(rad);
                    const ty = 100 + 64 * Math.sin(rad) + 4;
                    const x1 = 100 + 76 * Math.cos(rad);
                    const y1 = 100 + 76 * Math.sin(rad);
                    const x2 = 100 + 84 * Math.cos(rad);
                    const y2 = 100 + 84 * Math.sin(rad);
                    const isCardinal = ['N', 'E', 'S', 'W'].includes(item.label);
                    return (
                      <g key={item.deg}>
                        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#f8fafc" strokeWidth={isCardinal ? 2.5 : 1.5} />
                        <text
                          x={tx}
                          y={ty}
                          fill={item.label === 'N' ? '#ef4444' : '#f8fafc'}
                          fontSize={isCardinal ? 13 : 11}
                          fontWeight="bold"
                          textAnchor="middle"
                          fontFamily="monospace"
                        >
                          {item.label}
                        </text>
                      </g>
                    );
                  })}
                </g>

                {/* Fixed Top Lubber Line Marker (Orange Index) */}
                <polygon points="100,16 94,26 106,26" fill="#f59e0b" />

                {/* Fixed Miniature Airplane in center */}
                <circle cx="100" cy="100" r="4" fill="#fbbf24" />
                <line x1="100" y1="78" x2="100" y2="122" stroke="#fbbf24" strokeWidth="3" />
                <line x1="78" y1="92" x2="122" y2="92" stroke="#fbbf24" strokeWidth="4" />
                <line x1="88" y1="116" x2="112" y2="116" stroke="#fbbf24" strokeWidth="3" />
              </svg>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-950/90 px-2 py-0.5 rounded border border-slate-800 text-[11px] font-mono text-amber-400 font-bold">
                HDG: {Math.round(instruments.heading).toString().padStart(3, '0')}°
              </div>
            </div>
            <span className="text-[10px] text-slate-500 mt-2 font-mono">Gyroscopic (Rigidity)</span>
          </div>

          {/* 6. VERTICAL SPEED INDICATOR (VSI) */}
          <div className="bg-slate-900 border-2 border-slate-700 rounded-2xl p-4 flex flex-col items-center shadow-xl relative overflow-hidden">
            <div className="text-[11px] font-mono font-bold text-slate-300 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <span>VERTICAL SPEED</span>
              {instruments.staticBlocked && <span className="text-[9px] text-rose-400 bg-rose-950/60 px-1 rounded">STATIC BLK</span>}
            </div>

            {/* SVG VSI Gauge */}
            <div className="relative w-48 h-48">
              <svg viewBox="0 0 200 200" className="w-full h-full">
                <circle cx="100" cy="100" r="95" fill="#11141a" stroke="#334155" strokeWidth="6" />
                <circle cx="100" cy="100" r="88" fill="#090d16" stroke="#1e293b" strokeWidth="2" />

                {/* 0 fpm is at 9 o'clock (180 deg) */}
                {/* UP numbers: 5, 10, 15, 20 (up to 2000 fpm) */}
                {/* DN numbers: 5, 10, 15, 20 */}
                <text x="32" y="104" fill="#f8fafc" fontSize="13" fontWeight="bold" fontFamily="monospace">0</text>
                <text x="60" y="58" fill="#f8fafc" fontSize="12" fontWeight="bold" fontFamily="monospace">5</text>
                <text x="100" y="44" fill="#f8fafc" fontSize="12" fontWeight="bold" fontFamily="monospace">10</text>
                <text x="140" y="58" fill="#f8fafc" fontSize="12" fontWeight="bold" fontFamily="monospace">15</text>
                <text x="160" y="104" fill="#f8fafc" fontSize="12" fontWeight="bold" fontFamily="monospace">20</text>

                <text x="60" y="148" fill="#f8fafc" fontSize="12" fontWeight="bold" fontFamily="monospace">5</text>
                <text x="100" y="164" fill="#f8fafc" fontSize="12" fontWeight="bold" fontFamily="monospace">10</text>
                <text x="140" y="148" fill="#f8fafc" fontSize="12" fontWeight="bold" fontFamily="monospace">15</text>

                <text x="100" y="80" fill="#64748b" fontSize="8" textAnchor="middle">UP</text>
                <text x="100" y="125" fill="#64748b" fontSize="8" textAnchor="middle">DN</text>
                <text x="100" y="102" fill="#64748b" fontSize="7" textAnchor="middle">100 FT/MIN</text>

                {/* Needle: 0 is horizontal (pointing left, angle = 180). UP rotates clockwise (+angle), DN counter-clockwise */}
                {(() => {
                  const clampedVsi = Math.max(-2000, Math.min(2000, instruments.verticalSpeed));
                  const needleAngle = (clampedVsi / 2000) * 155;
                  return (
                    <g transform={`rotate(${needleAngle} 100 100)`}>
                      <polygon points="26,100 100,97 100,103" fill="#f8fafc" />
                      <circle cx="100" cy="100" r="6" fill="#0284c7" />
                    </g>
                  );
                })()}
              </svg>

              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 bg-slate-950/90 px-2 py-0.5 rounded border border-slate-800 text-[11px] font-mono text-emerald-400 font-bold">
                {instruments.verticalSpeed > 0 ? `+${Math.round(instruments.verticalSpeed)}` : Math.round(instruments.verticalSpeed)} FPM
              </div>
            </div>
            <span className="text-[10px] text-slate-500 mt-2 font-mono">Static Calibrated Leak</span>
          </div>

        </div>

        {/* Flight Deck Controls & System Diagnostics */}
        <div className="border-t border-slate-800 pt-5 grid grid-cols-1 md:grid-cols-3 gap-6 text-xs">
          {/* Flight Attitude Controls */}
          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-white uppercase flex items-center justify-between">
              <span>Attitude & Pitch Controls</span>
              <span className="text-rcac-sky font-mono">PITCH & BANK</span>
            </h4>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Pitch Attitude</span>
                <span className="font-mono text-white">{instruments.pitchAngle.toFixed(1)}°</span>
              </div>
              <input
                type="range"
                min="-15"
                max="20"
                step="0.5"
                value={instruments.pitchAngle}
                onChange={(e) => setInstruments((prev) => ({ ...prev, pitchAngle: parseFloat(e.target.value) }))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rcac-sky"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Bank Angle</span>
                <span className="font-mono text-white">{instruments.bankAngle.toFixed(0)}°</span>
              </div>
              <input
                type="range"
                min="-50"
                max="50"
                step="1"
                value={instruments.bankAngle}
                onChange={(e) => setInstruments((prev) => ({ ...prev, bankAngle: parseFloat(e.target.value) }))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rcac-sky"
              />
            </div>
          </div>

          {/* Engine Power & Altimeter Kollsman Setting */}
          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-white uppercase flex items-center justify-between">
              <span>Engine Power & Baro</span>
              <span className="text-amber-400 font-mono">THROTTLE & QNH</span>
            </h4>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Engine Throttle (Tachometer)</span>
                <span className="font-mono text-amber-400">{instruments.engineRpm} RPM</span>
              </div>
              <input
                type="range"
                min="1000"
                max="2700"
                step="50"
                value={instruments.engineRpm}
                onChange={(e) => setInstruments((prev) => ({ ...prev, engineRpm: parseInt(e.target.value) }))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between">
                <span className="text-slate-400">Kollsman Baro Setting (inHg)</span>
                <span className="font-mono text-rcac-sky">{instruments.altimeterSetting.toFixed(2)} inHg</span>
              </div>
              <input
                type="range"
                min="28.50"
                max="31.00"
                step="0.01"
                value={instruments.altimeterSetting}
                onChange={(e) => setInstruments((prev) => ({ ...prev, altimeterSetting: parseFloat(e.target.value) }))}
                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rcac-sky"
              />
            </div>
          </div>

          {/* Pitot-Static Failure Mode Emergency Drills */}
          <div className="bg-slate-900/90 p-4 rounded-xl border border-slate-800 space-y-3">
            <h4 className="font-bold text-rose-400 uppercase flex items-center justify-between">
              <span>Emergency System Failures</span>
              <ShieldAlert className="w-4 h-4 text-rose-400" />
            </h4>
            <p className="text-slate-400 text-[11px]">
              Simulate icing or insect blockage as taught in Canadian ground school. <strong className="text-slate-300">The aircraft keeps flying — only the dials lie.</strong> Cross-check to survive.
            </p>

            {/* Pitot faults: three canonical signatures */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Pitot tube</p>
              {[
                { id: 'none' as const, label: 'Normal', hint: 'ASI reads true' },
                { id: 'ram' as const, label: 'Ram blocked, drain open', hint: 'ASI falls toward zero' },
                { id: 'ram-drain' as const, label: 'Ram + drain blocked', hint: 'ASI acts as an altimeter' },
              ].map((opt) => (
                <button
                  key={opt.id}
                  onClick={() => {
                    setInstruments((prev) => ({ ...prev, pitotFault: opt.id }));
                    soundManager.playClick();
                  }}
                  className={`w-full py-2 px-3 rounded-lg text-left border flex items-center justify-between transition ${
                    instruments.pitotFault === opt.id
                      ? opt.id === 'none'
                        ? 'bg-emerald-500/15 border-emerald-500 text-emerald-300'
                        : 'bg-rose-500/20 border-rose-500 text-rose-300'
                      : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                  }`}
                >
                  <span className="text-sm font-semibold">{opt.label}</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400">
                    {opt.hint}
                  </span>
                </button>
              ))}
            </div>

            {/* Static port fault */}
            <div className="space-y-1.5">
              <p className="text-[10px] font-mono text-slate-500 uppercase tracking-wider">Static port</p>
              <button
                onClick={() => {
                  setInstruments((prev) => ({ ...prev, staticBlocked: !prev.staticBlocked }));
                  soundManager.playClick();
                }}
                className={`w-full py-2 px-3 rounded-lg text-left font-semibold border flex items-center justify-between transition ${
                  instruments.staticBlocked
                    ? 'bg-rose-500/20 border-rose-500 text-rose-300'
                    : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
                }`}
              >
                <span className="text-sm">Static port blocked</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-950 text-slate-400">
                  {instruments.staticBlocked ? 'ALT & VSI FROZEN' : 'NORMAL'}
                </span>
              </button>
            </div>

            {/* Truth strip: true vs indicated while any fault is active */}
            {(instruments.pitotFault !== 'none' || instruments.staticBlocked) && (
              <div className="bg-amber-950/40 border border-amber-700/50 rounded-lg p-3 space-y-1">
                <p className="text-[10px] font-mono text-amber-400 uppercase tracking-wider font-bold">
                  ⚠ Truth check — what the aircraft is really doing
                </p>
                <div className="grid grid-cols-3 gap-2 text-center font-mono text-[11px]">
                  <div>
                    <p className="text-slate-500">TRUE ALT</p>
                    <p className="text-white font-bold">{Math.round(instruments.trueAltitude)} ft</p>
                    <p className="text-slate-500">DIAL: {Math.round(instruments.altitude)} ft</p>
                  </div>
                  <div>
                    <p className="text-slate-500">TRUE SPD</p>
                    <p className="text-white font-bold">{Math.round(instruments.trueAirspeed)} kt</p>
                    <p className="text-slate-500">DIAL: {Math.round(instruments.indicatedAirspeed)} kt</p>
                  </div>
                  <div>
                    <p className="text-slate-500">TRUE VSI</p>
                    <p className="text-white font-bold">
                      {instruments.trueVsi > 0 ? '+' : ''}{Math.round(instruments.trueVsi)} fpm
                    </p>
                    <p className="text-slate-500">DIAL: {Math.round(instruments.verticalSpeed)} fpm</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Six-Pack Ground School Explanatory Modal */}
      {showGuideModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Gauge className="w-5 h-5 text-rcac-sky" />
                <span>The Six-Pack: RCAC Flight Instruments Study Guide</span>
              </h3>
              <button
                onClick={() => setShowGuideModal(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <h4 className="font-bold text-rcac-sky mb-1">Pitot-Static System (Airspeed, Altimeter, VSI)</h4>
                <p>
                  • <strong>Airspeed Indicator:</strong> Connected to BOTH pitot tube (ram dynamic pressure) and static port (ambient pressure). Measures difference ($q = p_t - p_s$).
                  <br />• <strong>Altimeter:</strong> Contains sealed aneroid wafers referenced to standard pressure (29.92 inHg). Connected only to the static port.
                  <br />• <strong>Vertical Speed Indicator:</strong> Contains a diaphragm inside a casing with a calibrated capillary leak. During climb or descent, differential pressure moves the needle.
                </p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <h4 className="font-bold text-rose-400 mb-1">Pitot-Static Failures: Know the Three Signatures</h4>
                <p>
                  <strong>1. Ram blocked, drain open</strong> (ice over the pitot mouth): ram pressure leaks out the drain hole → the ASI falls toward <strong>zero</strong> and stays there.
                  <br /><strong>2. Ram + drain both blocked:</strong> pitot pressure is trapped at its last value while static pressure keeps changing → the ASI <strong>acts as an altimeter</strong>: it over-reads in a climb and under-reads in a descent.
                  <br /><strong>3. Static port blocked:</strong> the <strong>altimeter freezes</strong> at the blockage altitude and the <strong>VSI reads zero</strong>. The ASI's static side is trapped too, so it <strong>under-reads in a climb</strong> and <strong>over-reads in a descent</strong>.
                  <br />In every case the aircraft itself keeps flying normally — only the indications are wrong. That is why you cross-check: pitch + power + a second instrument.
                </p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <h4 className="font-bold text-emerald-400 mb-1">Gyroscopic System (Attitude, Heading, Turn Coordinator)</h4>
                <p>
                  Operates on two fundamental properties of spinning gyros:
                  <br />1. <strong>Rigidity in Space:</strong> Used in the Attitude Indicator and Heading Indicator to maintain fixed orientation relative to the universe.
                  <br />2. <strong>Precession:</strong> When a force is applied to a gyro, the reaction occurs 90° later in the direction of rotation. Used in the Turn Coordinator.
                  <br />The inclinometer <strong>ball stays centered in a stabilized coordinated turn</strong> — turn rate follows ω = g·tan(bank)/V. The ball only swings while the turn is uncoordinated (e.g. rolling in without rudder): step on the ball to re-coordinate.
                </p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <h4 className="font-bold text-rose-400 mb-1">The Altimeter Rhyme: "High to Low, Look Out Below!"</h4>
                <p>
                  If you fly from an area of high pressure into low pressure without adjusting your Kollsman subscale, the altimeter will read <strong>HIGHER</strong> than your actual true altitude, which is hazardous during low-visibility approaches!
                </p>
              </div>
            </div>

            <div className="text-right pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowGuideModal(false)}
                className="px-4 py-2 bg-rcac-sky text-slate-950 font-bold rounded-lg hover:bg-sky-400 transition"
              >
                Understood
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
