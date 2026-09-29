import React, { useState } from 'react';
import { 
  Compass, 
  Wind, 
  Thermometer, 
  CloudRain, 
  MapPin, 
  Calculator, 
  CheckCircle2, 
  AlertTriangle,
  ArrowUpRight
} from 'lucide-react';
import { soundManager } from '../utils/audio';

interface MetarSample {
  station: string;
  name: string;
  category: 'VFR' | 'MVFR' | 'IFR';
  raw: string;
  decoded: {
    wind: string;
    visibility: string;
    sky: string;
    tempDew: string;
    altimeter: string;
    notes: string;
  };
}

const CADET_METAR_SAMPLES: MetarSample[] = [
  {
    station: 'CYTR',
    name: 'CFB Trenton (Cadet Central Gliding / Air Ops)',
    category: 'VFR',
    raw: 'CYTR 281800Z 24012G18KT 15SM FEW045 SCT220 21/11 A2994 RMK CU1CI1 SLP138',
    decoded: {
      wind: 'Wind from 240° at 12 knots, gusting to 18 knots',
      visibility: '15 Statute Miles (Excellent clear visibility)',
      sky: 'Few clouds at 4,500 ft AGL, Scattered high cirrus at 22,000 ft',
      tempDew: 'Temperature 21°C, Dew Point 11°C',
      altimeter: 'Altimeter Setting 29.94 inHg (1014 hPa)',
      notes: 'Ideal Canadian summer soaring conditions; cumulus cloud bases suggest active thermals!',
    },
  },
  {
    station: 'CYQQ',
    name: 'CFB Comox (Pacific Gliding & Flight Training)',
    category: 'VFR',
    raw: 'CYQQ 281900Z 29010KT 20SM SCT050 BKN080 18/12 A3002 RMK SC3AC2 SLP165',
    decoded: {
      wind: 'Wind from 290° at 10 knots',
      visibility: '20 Statute Miles',
      sky: 'Scattered clouds at 5,000 ft, Broken ceiling at 8,000 ft',
      tempDew: 'Temperature 18°C, Dew Point 12°C',
      altimeter: 'Altimeter Setting 30.02 inHg',
      notes: 'Suitable for cadet circuit training and local training area flights.',
    },
  },
  {
    station: 'CYAW',
    name: 'CFB Shearwater (Atlantic Region Cadet Aviation)',
    category: 'MVFR',
    raw: 'CYAW 282000Z 18015G22KT 4SM -RA BR BKN012 OVC025 14/13 A2978 RMK ST6SC2',
    decoded: {
      wind: 'Wind from 180° at 15 knots, gusting to 22 knots',
      visibility: '4 Statute Miles in light rain and mist',
      sky: 'Broken ceiling at 1,200 ft AGL, Overcast at 2,500 ft',
      tempDew: 'Temperature 14°C, Dew Point 13°C (high humidity)',
      altimeter: 'Altimeter Setting 29.78 inHg',
      notes: 'Marginal VFR (MVFR): Below standard cadet solo minimums. Glider flights suspended.',
    },
  },
  {
    station: 'CYWG',
    name: 'Winnipeg Richardson (Prairie Region Aviation Ops)',
    category: 'VFR',
    raw: 'CYWG 282100Z 35008KT 15SM SKC 24/09 A2988 RMK CI0 SLP118',
    decoded: {
      wind: 'Wind from 350° at 8 knots',
      visibility: '15 Statute Miles',
      sky: 'Sky Clear (SKC)',
      tempDew: 'Temperature 24°C, Dew Point 9°C',
      altimeter: 'Altimeter Setting 29.88 inHg',
      notes: 'Smooth, pristine soaring and power training conditions.',
    },
  },
];

export const FlightComputerE6B: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'wind' | 'density' | 'crosswind' | 'weather'>('wind');

  // Wind Triangle state
  const [trueAirspeed, setTrueAirspeed] = useState<number>(90);
  const [trueCourse, setTrueCourse] = useState<number>(45);
  const [windDir, setWindDir] = useState<number>(270);
  const [windSpeed, setWindSpeed] = useState<number>(20);

  // Density altitude state
  const [elevation, setElevation] = useState<number>(800); // ft
  const [altimeter, setAltimeter] = useState<number>(29.80); // inHg
  const [oat, setOat] = useState<number>(28); // °C

  // Crosswind runway state
  const [runwayHeading, setRunwayHeading] = useState<number>(240); // Runway 24
  const [xwWindDir, setXwWindDir] = useState<number>(210);
  const [xwWindSpeed, setXwWindSpeed] = useState<number>(18);

  // Selected METAR
  const [selectedMetar, setSelectedMetar] = useState<MetarSample>(CADET_METAR_SAMPLES[0]);

  // Calculations:
  // 1. Wind Triangle (E6B Navigation)
  // Angle between Course and Wind Direction:
  const windAngleRad = ((windDir - trueCourse) * Math.PI) / 180;
  // Wind Correction Angle (WCA) = arcsin((WindSpeed / TAS) * sin(windAngle))
  const sinWca = (windSpeed / Math.max(1, trueAirspeed)) * Math.sin(windAngleRad);
  const wcaRad = Math.asin(Math.max(-1, Math.min(1, sinWca)));
  const wcaDeg = Math.round((wcaRad * 180) / Math.PI);
  const trueHeading = (trueCourse + wcaDeg + 360) % 360;
  // Groundspeed: GS = TAS * cos(WCA) - WindSpeed * cos(windAngle)
  const groundSpeed = Math.max(0, Math.round(trueAirspeed * Math.cos(wcaRad) - windSpeed * Math.cos(windAngleRad)));

  // 2. Density Altitude Calculation
  // Pressure Altitude = Elevation + (29.92 - Altimeter) * 1000
  const pressureAlt = Math.round(elevation + (29.92 - altimeter) * 1000);
  // Standard ISA temp at pressure alt: 15°C - 2°C per 1000 ft
  const isaTemp = 15 - (pressureAlt / 1000) * 2;
  // Density Alt = Pressure Alt + (120 * (OAT - ISA))
  const densityAlt = Math.round(pressureAlt + 120 * (oat - isaTemp));

  // 3. Crosswind & Headwind Component
  const crosswindAngleRad = ((xwWindDir - runwayHeading) * Math.PI) / 180;
  const crosswindComp = Math.round(Math.abs(xwWindSpeed * Math.sin(crosswindAngleRad)));
  const headwindComp = Math.round(xwWindSpeed * Math.cos(crosswindAngleRad));
  const isTailwind = headwindComp < 0;

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 backdrop-blur shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-rcac-blue/60 border border-rcac-sky/40 rounded-lg text-rcac-sky">
            <Calculator className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">
              Module 5: E6B Flight Computer & Canadian Aviation Weather
            </h2>
            <p className="text-sm text-slate-400">
              Wind Drift Triangle • Density Altitude & Performance • Crosswind Calculator • Live Canadian METAR Decoder
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex rounded-lg bg-slate-800 p-1 border border-slate-700">
          <button
            onClick={() => { setActiveTab('wind'); soundManager.playClick(); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              activeTab === 'wind' ? 'bg-rcac-sky text-slate-950 shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            Wind Triangle
          </button>
          <button
            onClick={() => { setActiveTab('density'); soundManager.playClick(); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              activeTab === 'density' ? 'bg-rcac-sky text-slate-950 shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            Density Altitude
          </button>
          <button
            onClick={() => { setActiveTab('crosswind'); soundManager.playClick(); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              activeTab === 'crosswind' ? 'bg-rcac-sky text-slate-950 shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            Runway Crosswind
          </button>
          <button
            onClick={() => { setActiveTab('weather'); soundManager.playClick(); }}
            className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
              activeTab === 'weather' ? 'bg-rcac-gold text-slate-950 shadow' : 'text-slate-300 hover:text-white'
            }`}
          >
            Cadet METAR Decoder
          </button>
        </div>
      </div>

      {/* Main Tab Content */}
      {activeTab === 'wind' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Controls (1 Column) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-2">
              <span>Flight Planning Inputs</span>
              <Compass className="w-4 h-4 text-rcac-sky" />
            </h3>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-300">True Airspeed (TAS)</span>
                  <span className="font-mono text-rcac-sky font-bold">{trueAirspeed} kts</span>
                </div>
                <input
                  type="range"
                  min="40"
                  max="160"
                  value={trueAirspeed}
                  onChange={(e) => setTrueAirspeed(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rcac-sky"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-300">Desired True Course (TC)</span>
                  <span className="font-mono text-white font-bold">{trueCourse.toString().padStart(3, '0')}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="359"
                  value={trueCourse}
                  onChange={(e) => setTrueCourse(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-300">Wind Direction (From)</span>
                  <span className="font-mono text-rose-400 font-bold">{windDir.toString().padStart(3, '0')}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="359"
                  value={windDir}
                  onChange={(e) => setWindDir(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-300">Wind Speed</span>
                  <span className="font-mono text-rose-400 font-bold">{windSpeed} kts</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="50"
                  value={windSpeed}
                  onChange={(e) => setWindSpeed(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rose-400"
                />
              </div>
            </div>

            {/* Results Output */}
            <div className="pt-3 border-t border-slate-800 space-y-2.5 font-mono">
              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400 text-xs">Wind Correction Angle (WCA):</span>
                <span className={`text-sm font-bold ${wcaDeg !== 0 ? 'text-amber-400' : 'text-slate-300'}`}>
                  {wcaDeg > 0 ? `+${wcaDeg}° (Right)` : wcaDeg < 0 ? `${wcaDeg}° (Left)` : '0°'}
                </span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400 text-xs">Required True Heading (TH):</span>
                <span className="text-sm font-bold text-rcac-sky">{trueHeading.toString().padStart(3, '0')}°</span>
              </div>

              <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 flex justify-between items-center">
                <span className="text-slate-400 text-xs">Groundspeed (GS):</span>
                <span className="text-base font-bold text-emerald-400">{groundSpeed} kts</span>
              </div>
            </div>
          </div>

          {/* Interactive Wind Vector Triangle Visualization (2 Columns) */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider mb-2 flex items-center justify-between">
                <span>Visual Wind Triangle Navigation Vectors</span>
                <span className="text-[10px] text-emerald-400 font-mono">GROUND TRACK & DRIFT</span>
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                Watch how the wind pushes the aircraft off heading. To track along the green path, your nose must crab into the wind along the blue vector!
              </p>
            </div>

            {/* SVG Vector Triangle */}
            <div className="w-full aspect-[16/10] bg-slate-950 rounded-xl border border-slate-800 relative flex items-center justify-center overflow-hidden">
              <svg viewBox="-180 -180 360 360" className="w-full h-full">
                {/* Compass rose circles */}
                <circle cx="0" cy="0" r="140" fill="none" stroke="#1e293b" strokeWidth="1.5" />
                <circle cx="0" cy="0" r="90" fill="none" stroke="#1e293b" strokeWidth="1" strokeDasharray="4,4" />
                <line x1="-160" y1="0" x2="160" y2="0" stroke="#1e293b" strokeWidth="1" />
                <line x1="0" y1="-160" x2="0" y2="160" stroke="#1e293b" strokeWidth="1" />

                {/* Cardinal directions */}
                <text x="0" y="-146" fill="#ef4444" fontSize="11" fontWeight="bold" textAnchor="middle">N (000°)</text>
                <text x="148" y="4" fill="#64748b" fontSize="10" textAnchor="start">E (090°)</text>
                <text x="0" y="156" fill="#64748b" fontSize="10" textAnchor="middle">S (180°)</text>
                <text x="-148" y="4" fill="#64748b" fontSize="10" textAnchor="end">W (270°)</text>

                {(() => {
                  const scale = 0.9;
                  // Desired Track / Ground Course Vector (Green)
                  const tcRad = ((trueCourse - 90) * Math.PI) / 180;
                  const trackX = groundSpeed * scale * Math.cos(tcRad);
                  const trackY = groundSpeed * scale * Math.sin(tcRad);

                  // Heading / True Airspeed Vector (Blue)
                  const thRad = ((trueHeading - 90) * Math.PI) / 180;
                  const headingX = trueAirspeed * scale * Math.cos(thRad);
                  const headingY = trueAirspeed * scale * Math.sin(thRad);

                  return (
                    <g>
                      {/* Desired Track Vector (Green) */}
                      <line x1="0" y1="0" x2={trackX} y2={trackY} stroke="#10b981" strokeWidth="3.5" />
                      <circle cx={trackX} cy={trackY} r="4" fill="#10b981" />

                      {/* Heading / Airspeed Vector (Blue) */}
                      <line x1="0" y1="0" x2={headingX} y2={headingY} stroke="#38bdf8" strokeWidth="3" strokeDasharray="6,3" />

                      {/* Wind Vector from tip of Heading to tip of Track (Red) */}
                      <line x1={headingX} y1={headingY} x2={trackX} y2={trackY} stroke="#ef4444" strokeWidth="3" />

                      {/* Labels on SVG */}
                      <text x={trackX * 0.7 + 8} y={trackY * 0.7 - 8} fill="#10b981" fontSize="10" fontWeight="bold">
                        Ground Track ({groundSpeed} kts)
                      </text>
                      <text x={headingX * 0.5 - 10} y={headingY * 0.5 + 16} fill="#38bdf8" fontSize="10">
                        Heading ({trueHeading}°)
                      </text>
                    </g>
                  );
                })()}
              </svg>
            </div>

            {/* Explanatory Legend */}
            <div className="flex flex-wrap gap-4 mt-3 text-xs justify-center font-mono">
              <span className="flex items-center gap-1.5 text-emerald-400">
                <span className="w-3 h-1 bg-emerald-400 rounded" /> Desired Track (Groundspeed)
              </span>
              <span className="flex items-center gap-1.5 text-sky-400">
                <span className="w-3 h-1 bg-sky-400 rounded" /> Aircraft Heading (TAS)
              </span>
              <span className="flex items-center gap-1.5 text-rose-400">
                <span className="w-3 h-1 bg-rose-400 rounded" /> Wind Vector ({windSpeed} kts from {windDir}°)
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Density Altitude Tab */}
      {activeTab === 'density' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-2">
              <span>Atmospheric Inputs</span>
              <Thermometer className="w-4 h-4 text-amber-400" />
            </h3>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-300">Aerodrome Elevation</span>
                  <span className="font-mono text-white font-bold">{elevation} ft MSL</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="6000"
                  step="50"
                  value={elevation}
                  onChange={(e) => setElevation(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rcac-sky"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-300">Altimeter Setting (QNH)</span>
                  <span className="font-mono text-rcac-sky font-bold">{altimeter.toFixed(2)} inHg</span>
                </div>
                <input
                  type="range"
                  min="28.50"
                  max="30.80"
                  step="0.02"
                  value={altimeter}
                  onChange={(e) => setAltimeter(parseFloat(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rcac-sky"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-300">Outside Air Temperature (OAT)</span>
                  <span className="font-mono text-amber-400 font-bold">{oat}°C</span>
                </div>
                <input
                  type="range"
                  min="-10"
                  max="42"
                  step="1"
                  value={oat}
                  onChange={(e) => setOat(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>-10°C (Cold/Dense)</span>
                  <span>Standard ISA: {isaTemp.toFixed(1)}°C</span>
                  <span>42°C (Hot/Thin)</span>
                </div>
              </div>
            </div>
          </div>

          {/* Density Altitude Output & Performance Warnings */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col justify-between space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">
              Density Altitude Flight Performance
            </h3>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">PRESSURE ALTITUDE</span>
                <span className="text-xl font-bold text-white">{pressureAlt.toLocaleString()} FT</span>
              </div>
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">DENSITY ALTITUDE</span>
                <span className={`text-xl font-bold ${densityAlt > elevation + 1200 ? 'text-amber-400' : 'text-emerald-400'}`}>
                  {densityAlt.toLocaleString()} FT
                </span>
              </div>
            </div>

            {/* Performance impact info */}
            <div className="p-3.5 bg-slate-950 rounded-xl border border-slate-800 text-xs space-y-2 text-slate-300">
              <div className="font-bold text-rcac-sky flex items-center gap-1.5">
                <ArrowUpRight className="w-4 h-4" />
                <span>What this means to an Air Cadet:</span>
              </div>
              <p>
                {densityAlt > elevation ? (
                  <>
                    Because the air is warm and less dense, your aircraft performs as though it is flying at{' '}
                    <strong className="text-amber-400">{densityAlt.toLocaleString()} feet</strong>!
                    <br />• <strong>Takeoff Distance:</strong> Increases by ~{Math.round(((densityAlt - elevation) / 1000) * 12)}%
                    <br />• <strong>Climb Rate:</strong> Significantly reduced (gliders need stronger thermals to gain altitude; towplanes climb slower).
                  </>
                ) : (
                  <>
                    Cold, dense air provides higher air density! Aircraft wings generate more lift at lower ground speeds, and engines produce more horsepower.
                  </>
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Runway Crosswind Tab */}
      {activeTab === 'crosswind' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider flex items-center justify-between border-b border-slate-800 pb-2">
              <span>Runway & Wind Setup</span>
              <Wind className="w-4 h-4 text-rcac-sky" />
            </h3>

            <div className="space-y-4 text-xs">
              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-300">Runway Orientation (Heading)</span>
                  <span className="font-mono text-white font-bold">
                    Runway {Math.round(runwayHeading / 10).toString().padStart(2, '0')} ({runwayHeading}°)
                  </span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="350"
                  step="10"
                  value={runwayHeading}
                  onChange={(e) => setRunwayHeading(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-white"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-300">Surface Wind Direction</span>
                  <span className="font-mono text-rcac-sky font-bold">{xwWindDir}°</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="359"
                  value={xwWindDir}
                  onChange={(e) => setXwWindDir(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rcac-sky"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between">
                  <span className="text-slate-300">Wind Velocity (Speed)</span>
                  <span className="font-mono text-rcac-gold font-bold">{xwWindSpeed} kts</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="40"
                  value={xwWindSpeed}
                  onChange={(e) => setXwWindSpeed(parseInt(e.target.value))}
                  className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-rcac-gold"
                />
              </div>
            </div>
          </div>

          {/* Crosswind Resolution Gauge */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <h3 className="text-sm font-bold text-white uppercase tracking-wider border-b border-slate-800 pb-2">
              Crosswind Components
            </h3>

            <div className="grid grid-cols-2 gap-3 font-mono">
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">CROSSWIND COMPONENT</span>
                <span className={`text-xl font-bold ${crosswindComp > 15 ? 'text-rose-400' : 'text-rcac-sky'}`}>
                  {crosswindComp} KTS
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">
                  {crosswindAngleRad > 0 ? 'From Right' : 'From Left'}
                </span>
              </div>

              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                <span className="text-slate-400 block text-[10px]">
                  {isTailwind ? 'TAILWIND COMPONENT' : 'HEADWIND COMPONENT'}
                </span>
                <span className={`text-xl font-bold ${isTailwind ? 'text-rose-400' : 'text-emerald-400'}`}>
                  {Math.abs(headwindComp)} KTS
                </span>
                <span className="text-[10px] text-slate-500 block mt-1">
                  {isTailwind ? '⚠️ Caution: Tailwind landing' : 'Direct into the wind'}
                </span>
              </div>
            </div>

            {/* Schweizer 2-33A & Cessna limits */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300 space-y-2">
              <div className="font-bold text-white">Cadet Aircraft Crosswind Limits:</div>
              <p>
                • <strong>Schweizer 2-33A Glider Max Crosswind:</strong> 12 kts (Cadet solo), 15 kts (Dual training).
                <br />• <strong>Cessna 172 Max Demonstrated:</strong> 15 kts.
              </p>
              {crosswindComp > 12 && (
                <div className="p-2 bg-rose-950/70 border border-rose-500 rounded text-rose-300 font-semibold">
                  ⚠️ Crosswind ({crosswindComp} kts) exceeds standard Cadet Gliding solo limits!
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Canadian Cadet METAR Decoder Tab */}
      {activeTab === 'weather' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Station Selector (1 Column) */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl space-y-3">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-2">
              Select Cadet Flight Base
            </h3>
            {CADET_METAR_SAMPLES.map((metar) => (
              <button
                key={metar.station}
                onClick={() => { setSelectedMetar(metar); soundManager.playClick(); }}
                className={`w-full p-3 rounded-xl border text-left transition ${
                  selectedMetar.station === metar.station
                    ? 'bg-rcac-blue/50 border-rcac-sky shadow-lg'
                    : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex justify-between items-center mb-1">
                  <span className="font-mono font-bold text-white text-sm">{metar.station}</span>
                  <span className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    metar.category === 'VFR' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {metar.category}
                  </span>
                </div>
                <p className="text-xs text-slate-400 line-clamp-1">{metar.name}</p>
              </button>
            ))}
          </div>

          {/* Raw and Decoded METAR Viewer (2 Columns) */}
          <div className="lg:col-span-2 bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <div>
              <div className="flex justify-between items-center mb-1">
                <h3 className="text-base font-bold text-white">{selectedMetar.name}</h3>
                <span className="text-xs font-mono text-rcac-sky">METAR REPORT</span>
              </div>
              {/* Raw Teletype Box */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 font-mono text-emerald-400 text-xs overflow-x-auto tracking-wide">
                {selectedMetar.raw}
              </div>
            </div>

            {/* Plain-English Cadet Translation */}
            <div className="space-y-2 text-xs">
              <h4 className="font-bold text-slate-300 uppercase tracking-wider">Ground School Translation:</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-500 text-[10px] block font-mono">SURFACE WIND</span>
                  <span className="text-white font-medium">{selectedMetar.decoded.wind}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-500 text-[10px] block font-mono">VISIBILITY</span>
                  <span className="text-white font-medium">{selectedMetar.decoded.visibility}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-500 text-[10px] block font-mono">CLOUD COVER & CEILING</span>
                  <span className="text-white font-medium">{selectedMetar.decoded.sky}</span>
                </div>
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <span className="text-slate-500 text-[10px] block font-mono">TEMPERATURE & ALTIMETER</span>
                  <span className="text-white font-medium">{selectedMetar.decoded.tempDew} • {selectedMetar.decoded.altimeter}</span>
                </div>
              </div>

              <div className="p-3 bg-rcac-blue/30 border border-rcac-sky/30 rounded-lg text-slate-200">
                <strong className="text-rcac-sky">Cadet Flight Safety Note:</strong> {selectedMetar.decoded.notes}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
