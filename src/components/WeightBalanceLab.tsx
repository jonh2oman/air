import React, { useState } from 'react';
import { 
  Scale, 
  AlertTriangle, 
  CheckCircle2, 
  HelpCircle, 
  RotateCcw,
  Plane,
  Info
} from 'lucide-react';
import { soundManager } from '../utils/audio';

interface AircraftProfile {
  name: string;
  type: 'glider' | 'power';
  emptyWeight: number; // lbs
  emptyArm: number; // inches
  maxGrossWeight: number; // lbs
  datumDescription: string;
  forwardCgLimit: number;
  aftCgLimit: number;
  stations: Array<{
    id: string;
    label: string;
    arm: number;
    defaultWeight: number;
    maxWeight: number;
    step: number;
    unit: string;
    conversionFactor?: number; // e.g. 6 lbs/gal
  }>;
}

const PROFILES: Record<string, AircraftProfile> = {
  glider: {
    name: 'Schweizer SGS 2-33A Glider',
    type: 'glider',
    emptyWeight: 600,
    emptyArm: 15.2,
    maxGrossWeight: 1040,
    datumDescription: 'Leading Edge of Wing at Root',
    forwardCgLimit: 10.5,
    aftCgLimit: 18.0,
    stations: [
      { id: 'frontPilot', label: 'Front Seat (Solo Cadet / Student)', arm: -14.0, defaultWeight: 165, maxWeight: 260, step: 5, unit: 'lbs' },
      { id: 'rearPilot', label: 'Rear Seat (Cadet Instructor / Passenger)', arm: 22.0, defaultWeight: 175, maxWeight: 260, step: 5, unit: 'lbs' },
      { id: 'removableBallast', label: 'Nose Removable Ballast Weight (for solo cadets < 154 lbs)', arm: -38.0, defaultWeight: 0, maxWeight: 30, step: 5, unit: 'lbs' },
    ],
  },
  cessna: {
    name: 'Cessna 172 Skyhawk',
    type: 'power',
    emptyWeight: 1650,
    emptyArm: 39.5,
    maxGrossWeight: 2550,
    datumDescription: 'Lower forward face of firewall',
    forwardCgLimit: 36.0,
    aftCgLimit: 47.3,
    stations: [
      { id: 'frontSeats', label: 'Pilot & Front Passenger', arm: 37.0, defaultWeight: 340, maxWeight: 440, step: 5, unit: 'lbs' },
      { id: 'rearSeats', label: 'Rear Passengers', arm: 73.0, defaultWeight: 170, maxWeight: 400, step: 5, unit: 'lbs' },
      { id: 'fuel', label: 'Aviation Gasoline (100LL Fuel @ 6 lbs/gal)', arm: 46.0, defaultWeight: 240, maxWeight: 318, step: 6, unit: 'lbs (gal)', conversionFactor: 6 },
      { id: 'baggage1', label: 'Baggage Area 1', arm: 95.0, defaultWeight: 30, maxWeight: 120, step: 5, unit: 'lbs' },
      { id: 'baggage2', label: 'Baggage Area 2', arm: 123.0, defaultWeight: 0, maxWeight: 50, step: 5, unit: 'lbs' },
    ],
  },
};

export const WeightBalanceLab: React.FC = () => {
  const [selectedAircraft, setSelectedAircraft] = useState<'glider' | 'cessna'>('glider');
  const [weights, setWeights] = useState<Record<string, number>>({
    frontPilot: 165,
    rearPilot: 175,
    removableBallast: 0,
    frontSeats: 340,
    rearSeats: 170,
    fuel: 240,
    baggage1: 30,
    baggage2: 0,
  });

  const [showTheory, setShowTheory] = useState(false);

  const profile = PROFILES[selectedAircraft];

  // Calculate Weight, Moment, and CG
  const emptyMoment = profile.emptyWeight * profile.emptyArm;
  let totalWeight = profile.emptyWeight;
  let totalMoment = emptyMoment;

  const stationRows = profile.stations.map((st) => {
    const w = weights[st.id] || 0;
    const m = w * st.arm;
    totalWeight += w;
    totalMoment += m;
    return {
      ...st,
      currentWeight: w,
      moment: m,
    };
  });

  const calculatedCg = totalWeight > 0 ? totalMoment / totalWeight : 0;
  const isOverweight = totalWeight > profile.maxGrossWeight;
  const isForwardCg = calculatedCg < profile.forwardCgLimit;
  const isAftCg = calculatedCg > profile.aftCgLimit;
  const isCgSafe = !isOverweight && !isForwardCg && !isAftCg;

  // Glider solo pilot minimum weight check (SGS 2-33A rule)
  const isSoloGlider = selectedAircraft === 'glider' && (weights.rearPilot || 0) === 0;
  const needsBallastGlider = isSoloGlider && ((weights.frontPilot || 0) + (weights.removableBallast || 0) < 154);

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 backdrop-blur shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-rcac-blue/60 border border-rcac-sky/40 rounded-lg text-rcac-sky">
            <Scale className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">
              Module 4: Weight & Balance / Center of Gravity (C of G)
            </h2>
            <p className="text-sm text-slate-400">
              Calculate Datum, Arm & Moments • CG Envelope Boundaries • Stability & Control Authority
            </p>
          </div>
        </div>

        {/* Aircraft Type Switch */}
        <div className="flex items-center gap-3">
          <div className="flex rounded-lg bg-slate-800 p-1 border border-slate-700">
            <button
              onClick={() => {
                setSelectedAircraft('glider');
                soundManager.playClick();
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                selectedAircraft === 'glider'
                  ? 'bg-rcac-sky text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🇨🇦 SGS 2-33A Glider
            </button>
            <button
              onClick={() => {
                setSelectedAircraft('cessna');
                soundManager.playClick();
              }}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all ${
                selectedAircraft === 'cessna'
                  ? 'bg-rcac-gold text-slate-950 shadow'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              🛩️ Cessna 172 Skyhawk
            </button>
          </div>

          <button
            onClick={() => setShowTheory(true)}
            className="flex items-center space-x-1 px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-rcac-sky border border-slate-700 rounded-lg text-xs font-medium"
          >
            <HelpCircle className="w-4 h-4" />
            <span>Theory</span>
          </button>
        </div>
      </div>

      {/* Main Grid: Loading Stations vs. CG Envelope Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Loading Stations & Sliders (2 Columns) */}
        <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-5">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plane className="w-5 h-5 text-rcac-sky" />
                <span>{profile.name} — Loading Schedule</span>
              </h3>
              <p className="text-xs text-slate-400">
                Datum Reference: <strong>{profile.datumDescription}</strong>
              </p>
            </div>

            <button
              onClick={() => {
                const defaults: Record<string, number> = {};
                profile.stations.forEach((s) => {
                  defaults[s.id] = s.defaultWeight;
                });
                setWeights((prev) => ({ ...prev, ...defaults }));
                soundManager.playClick();
              }}
              className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded text-xs flex items-center gap-1 border border-slate-700"
            >
              <RotateCcw className="w-3 h-3" /> Reset
            </button>
          </div>

          {/* Interactive Loading Sliders */}
          <div className="space-y-4">
            {profile.stations.map((st) => (
              <div key={st.id} className="bg-slate-950 p-3.5 rounded-xl border border-slate-800/80 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <div className="space-y-0.5">
                    <span className="font-semibold text-slate-200">{st.label}</span>
                    <span className="block text-[11px] text-slate-500 font-mono">
                      Arm: <strong className={st.arm < 0 ? 'text-amber-400' : 'text-slate-300'}>{st.arm > 0 ? `+${st.arm}` : st.arm}"</strong> aft of datum
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="font-mono text-sm font-bold text-rcac-sky">
                      {weights[st.id] || 0} lbs
                    </span>
                    {st.conversionFactor && (
                      <span className="block text-[10px] text-slate-500 font-mono">
                        ({((weights[st.id] || 0) / st.conversionFactor).toFixed(1)} gal)
                      </span>
                    )}
                  </div>
                </div>

                <input
                  type="range"
                  min="0"
                  max={st.maxWeight}
                  step={st.step}
                  value={weights[st.id] || 0}
                  onChange={(e) => setWeights((prev) => ({ ...prev, [st.id]: parseInt(e.target.value) }))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rcac-sky"
                />

                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0 lbs</span>
                  <span>Max: {st.maxWeight} lbs</span>
                </div>
              </div>
            ))}
          </div>

          {/* Weight & Moment Table */}
          <div className="border border-slate-800 rounded-xl overflow-hidden text-xs font-mono">
            <table className="w-full text-left">
              <thead className="bg-slate-950 text-slate-400 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Item / Station</th>
                  <th className="py-2.5 px-3 text-right">Weight (lbs)</th>
                  <th className="py-2.5 px-3 text-right">Arm (in)</th>
                  <th className="py-2.5 px-3 text-right">Moment (lb-in)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                <tr className="bg-slate-900/40 text-slate-300">
                  <td className="py-2 px-3 font-semibold">Basic Empty Aircraft</td>
                  <td className="py-2 px-3 text-right">{profile.emptyWeight}</td>
                  <td className="py-2 px-3 text-right">{profile.emptyArm.toFixed(1)}</td>
                  <td className="py-2 px-3 text-right">{Math.round(emptyMoment).toLocaleString()}</td>
                </tr>
                {stationRows.map((row) => (
                  <tr key={row.id} className="text-slate-300 hover:bg-slate-800/30">
                    <td className="py-2 px-3">{row.label}</td>
                    <td className="py-2 px-3 text-right text-rcac-sky">{row.currentWeight}</td>
                    <td className="py-2 px-3 text-right">{row.arm.toFixed(1)}</td>
                    <td className="py-2 px-3 text-right">{Math.round(row.moment).toLocaleString()}</td>
                  </tr>
                ))}
                <tr className="bg-slate-950 font-bold text-white text-sm">
                  <td className="py-3 px-3">TOTAL GROSS</td>
                  <td className={`py-3 px-3 text-right ${isOverweight ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {totalWeight.toLocaleString()} lbs
                  </td>
                  <td className="py-3 px-3 text-right text-rcac-sky">
                    CG: {calculatedCg.toFixed(2)}"
                  </td>
                  <td className="py-3 px-3 text-right text-slate-300">
                    {Math.round(totalMoment).toLocaleString()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* CG Safety Envelope Visualizer & Aerodynamic Stability Alerts (1 Column) */}
        <div className="flex flex-col space-y-4">
          {/* Status Box */}
          <div className={`p-4 rounded-xl border-2 shadow-xl ${
            isCgSafe
              ? 'bg-emerald-950/30 border-emerald-500/50 text-emerald-300'
              : 'bg-rose-950/40 border-rose-500/60 text-rose-300'
          }`}>
            <div className="flex items-center space-x-2.5 mb-2">
              {isCgSafe ? (
                <CheckCircle2 className="w-6 h-6 text-emerald-400 flex-shrink-0" />
              ) : (
                <AlertTriangle className="w-6 h-6 text-rose-400 flex-shrink-0 animate-bounce" />
              )}
              <h3 className="font-bold text-base">
                {isCgSafe ? 'WEIGHT & BALANCE APPROVED' : 'OUT OF LIMITS — UNSAFE FOR FLIGHT'}
              </h3>
            </div>

            <div className="space-y-1.5 text-xs">
              <div className="flex justify-between">
                <span>Total Weight:</span>
                <strong className={isOverweight ? 'text-rose-400 underline' : 'text-emerald-400'}>
                  {totalWeight} / {profile.maxGrossWeight} lbs
                </strong>
              </div>
              <div className="flex justify-between">
                <span>Calculated CG:</span>
                <strong className={!isForwardCg && !isAftCg ? 'text-emerald-400' : 'text-rose-400 underline'}>
                  {calculatedCg.toFixed(2)}" (Limits: {profile.forwardCgLimit}" – {profile.aftCgLimit}")
                </strong>
              </div>
            </div>

            {/* Warning Details */}
            {isOverweight && (
              <div className="mt-3 p-2 bg-rose-900/60 rounded border border-rose-600 text-xs text-rose-200">
                ⚠️ Aircraft exceeds Maximum Gross Takeoff Weight! Increased takeoff roll, decreased climb rate, higher stall speed.
              </div>
            )}
            {isForwardCg && (
              <div className="mt-2 p-2 bg-amber-900/60 rounded border border-amber-600 text-xs text-amber-200">
                ⚠️ Forward CG Limit Exceeded! Heavy nose, excessive forward stick force required, danger of running out of elevator flare during landing!
              </div>
            )}
            {isAftCg && (
              <div className="mt-2 p-2 bg-rose-900/60 rounded border border-rose-600 text-xs text-rose-200">
                ⚠️ Aft CG Limit Exceeded! Extremely dangerous: severe reduction in longitudinal pitch stability, high risk of unrecoverable flat spin!
              </div>
            )}
            {needsBallastGlider && (
              <div className="mt-2 p-2 bg-sky-950 rounded border border-sky-600 text-xs text-sky-200">
                ℹ️ Schweizer 2-33A Solo Rule: Front pilot is under 154 lbs minimum solo weight. Add nose ballast weights!
              </div>
            )}
          </div>

          {/* Graphical CG Envelope Graph */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl">
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-2 flex items-center justify-between">
              <span>CG Envelope Graph</span>
              <span className="text-[10px] text-slate-400 font-mono">DATUM: {profile.datumDescription}</span>
            </h4>

            {/* SVG Envelope Chart */}
            <div className="w-full aspect-[4/3] bg-slate-950 rounded-lg p-2 relative flex items-center justify-center">
              <svg viewBox="0 0 280 200" className="w-full h-full">
                {/* Axes */}
                <line x1="40" y1="20" x2="40" y2="170" stroke="#475569" strokeWidth="1.5" />
                <line x1="40" y1="170" x2="260" y2="170" stroke="#475569" strokeWidth="1.5" />

                {/* Grid markings */}
                <text x="35" y="25" fill="#94a3b8" fontSize="8" textAnchor="end">{profile.maxGrossWeight}</text>
                <text x="35" y="165" fill="#94a3b8" fontSize="8" textAnchor="end">{profile.emptyWeight}</text>

                {/* Safe CG Envelope Polygon */}
                {(() => {
                  const minW = profile.emptyWeight;
                  const maxW = profile.maxGrossWeight;
                  const minCg = profile.forwardCgLimit - 2;
                  const maxCg = profile.aftCgLimit + 2;

                  const mapX = (cg: number) => 40 + ((cg - minCg) / (maxCg - minCg)) * 210;
                  const mapY = (w: number) => 170 - ((w - minW) / (maxW - minW)) * 140;

                  // Polygon coordinates for envelope
                  const p1 = `${mapX(profile.forwardCgLimit)},${mapY(minW)}`;
                  const p2 = `${mapX(profile.forwardCgLimit)},${mapY(maxW)}`;
                  const p3 = `${mapX(profile.aftCgLimit)},${mapY(maxW)}`;
                  const p4 = `${mapX(profile.aftCgLimit)},${mapY(minW)}`;

                  const currentX = mapX(calculatedCg);
                  const currentY = mapY(totalWeight);

                  return (
                    <>
                      {/* Envelope area */}
                      <polygon
                        points={`${p1} ${p2} ${p3} ${p4}`}
                        fill="rgba(16, 185, 129, 0.15)"
                        stroke="#10b981"
                        strokeWidth="2"
                      />

                      {/* Envelope labels */}
                      <text x={mapX(profile.forwardCgLimit)} y="185" fill="#94a3b8" fontSize="8" textAnchor="middle">
                        {profile.forwardCgLimit}"
                      </text>
                      <text x={mapX(profile.aftCgLimit)} y="185" fill="#94a3b8" fontSize="8" textAnchor="middle">
                        {profile.aftCgLimit}"
                      </text>

                      {/* Current Aircraft Point */}
                      <circle
                        cx={Math.max(40, Math.min(260, currentX))}
                        cy={Math.max(20, Math.min(170, currentY))}
                        r="6"
                        fill={isCgSafe ? '#38bdf8' : '#ef4444'}
                        stroke="#ffffff"
                        strokeWidth="2"
                      />

                      <line
                        x1={currentX}
                        y1="20"
                        x2={currentX}
                        y2="170"
                        stroke={isCgSafe ? 'rgba(56, 189, 248, 0.4)' : 'rgba(239, 68, 68, 0.4)'}
                        strokeDasharray="2,2"
                      />
                    </>
                  );
                })()}
              </svg>
            </div>
            <p className="text-[11px] text-slate-400 mt-2 text-center">
              The blue dot shows your current load. Keep it centered within the green polygon!
            </p>
          </div>
        </div>
      </div>

      {/* Weight & Balance Theory Modal */}
      {showTheory && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-2xl w-full p-6 max-h-[85vh] overflow-y-auto space-y-4 shadow-2xl">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h3 className="text-lg font-bold text-white flex items-center gap-2">
                <Scale className="w-5 h-5 text-rcac-sky" />
                <span>Weight & Balance: Cadet Ground School Handbook</span>
              </h3>
              <button
                onClick={() => setShowTheory(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 text-xs text-slate-300 leading-relaxed">
              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <h4 className="font-bold text-rcac-sky mb-1">Key Definitions:</h4>
                <p>
                  • <strong>Datum:</strong> An imaginary vertical plane or line from which all horizontal distances are measured for balance purposes.
                  <br />• <strong>Arm:</strong> The horizontal distance in inches from the reference datum to the center of gravity of an item.
                  <br />• <strong>Moment:</strong> The rotational tendency of a weight around the datum: <code>Moment = Weight × Arm</code> (lb-in).
                  <br />• <strong>Center of Gravity:</strong> The point over which an aircraft would balance if suspended: <code>CG = Total Moment ÷ Total Weight</code>.
                </p>
              </div>

              <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800">
                <h4 className="font-bold text-rose-400 mb-1">Flight Effects of an Aft C of G</h4>
                <p>
                  An aft CG moves closer to the wing's aerodynamic center, reducing the stabilizing down-force of the horizontal tail.
                  <br />• Light stick forces (feels touchy and sensitive).
                  <br />• <strong>Extremely dangerous stall recovery:</strong> Elevator may lack the downward force needed to push the nose down, converting into an unrecoverable flat spin.
                </p>
              </div>
            </div>

            <div className="text-right pt-2 border-t border-slate-800">
              <button
                onClick={() => setShowTheory(false)}
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
