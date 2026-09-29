import React, { useState, useEffect } from 'react';
import { 
  Compass, 
  Wind, 
  Radio, 
  ShieldAlert, 
  CheckCircle, 
  AlertTriangle, 
  Play, 
  Pause, 
  RotateCcw, 
  Volume2, 
  ChevronRight, 
  HelpCircle,
  Eye,
  Info
} from 'lucide-react';
import { soundManager } from '../utils/audio';

type CircuitLeg = 'upwind' | 'crosswind' | 'downwind' | 'base' | 'final';
type CircuitEntryType = '45-downwind' | 'overhead-cross' | 'straight-in';

interface LegDetail {
  id: CircuitLeg;
  name: string;
  altitude: string;
  speed: string;
  actions: string[];
  radioCall: string;
  keyCheck: string;
}

const CIRCUIT_LEGS: Record<CircuitLeg, LegDetail> = {
  upwind: {
    id: 'upwind',
    name: '1. Upwind (Departure / Climb)',
    altitude: '0 to 500 ft AGL',
    speed: 'Vy = 74 KIAS (Glider: 55 KIAS)',
    actions: [
      'Apply full takeoff power and maintain runway centerline with rudder',
      'Rotate at 55 KIAS and establish climb pitch attitude',
      'Climb straight ahead until reaching 500 ft AGL before initiating turn',
      'Scan left, clear airspace, and prepare for 90° crosswind turn'
    ],
    radioCall: '"Cadet Traffic, Glider 71 / Skyhawk 172 airborne runway 27, climbing to circuit altitude."',
    keyCheck: 'Wings level, full power, eyes outside scanning for traffic'
  },
  crosswind: {
    id: 'crosswind',
    name: '2. Crosswind Leg',
    altitude: '500 to 1,000 ft AGL',
    speed: 'Climb speed (70-74 KIAS)',
    actions: [
      'At 500 ft AGL, execute a standard rate 90° climbing turn perpendicular to runway',
      'Compensate for wind drift to maintain a track at 90° to the extended runway centerline',
      'Level off at circuit altitude (1,000 ft AGL) and adjust to cruise power (2,300 RPM)',
      'Look 45° aft to ensure safe spacing from the runway before turning downwind'
    ],
    radioCall: '"Cadet Traffic, Skyhawk 172 crosswind runway 27, climbing 1,000."',
    keyCheck: 'Level off at exactly 1,000 ft AGL, set cruise power & trim'
  },
  downwind: {
    id: 'downwind',
    name: '3. Downwind Leg',
    altitude: '1,000 ft AGL (Level)',
    speed: '85 - 90 KIAS (Glider: 55 KIAS)',
    actions: [
      'Fly parallel to runway in reciprocal direction (Heading 090 for Runway 27)',
      'Maintain spacing (approx. 0.5 to 1 nautical mile from runway)',
      'Perform BUMPFICH Pre-Landing Checks (Brakes, Undercarriage, Mixture, Prop, Fuel, Instruments, Carb Heat, Hatches/Harnesses)',
      'When abeam the runway numbers: reduce throttle to 1,500 RPM, carb heat ON, deploy 10° flaps'
    ],
    radioCall: '"Cadet Tower, Skyhawk 172 downwind runway 27, full stop / touch and go."',
    keyCheck: 'BUMPFICH checklist complete & radio call abeam touchdown point'
  },
  base: {
    id: 'base',
    name: '4. Base Leg',
    altitude: '1,000 down to 500 ft AGL',
    speed: '70 - 75 KIAS',
    actions: [
      'Initiate 90° turn toward final when the runway threshold is 45° behind your wingtip',
      'Establish a 500 fpm stabilized descent rate',
      'Select 20° flaps and trim elevator for 70 KIAS',
      'Visually scan straight-in final for any conflicting traffic'
    ],
    radioCall: '"Cadet Tower, Skyhawk 172 turning base runway 27."',
    keyCheck: 'Airspeed control is critical: maintain 70 KIAS with pitch, descent rate with throttle'
  },
  final: {
    id: 'final',
    name: '5. Final Approach & Flare',
    altitude: '500 ft AGL to Touchdown',
    speed: '60 - 65 KIAS over fence',
    actions: [
      'Roll out smoothly aligned with the extended runway centerline',
      'Check PAPI glide path lights: Aim for 2 White, 2 Red (3° glide path)',
      'Select full flaps (30°) or modulate glider airbrakes/spoilers as required',
      'Cross threshold at 10-15 ft, reduce throttle to idle, smoothly flare nose-up for main wheels first'
    ],
    radioCall: '"Cadet Tower, Skyhawk 172 final runway 27."',
    keyCheck: 'Stabilized approach: Centerline aligned, airspeed on target, 2 Red 2 White PAPI'
  }
};

interface LightGunSignal {
  id: string;
  name: string;
  colors: string[];
  animationType: 'steady' | 'flashing' | 'alternating';
  colorCss: string;
  inFlight: string;
  onGround: string;
}

const LIGHT_GUN_SIGNALS: LightGunSignal[] = [
  {
    id: 'steady-green',
    name: 'Steady Green',
    colors: ['#22c55e'],
    animationType: 'steady',
    colorCss: 'bg-emerald-500 shadow-emerald-500/80',
    inFlight: 'CLEARED TO LAND',
    onGround: 'CLEARED FOR TAKEOFF'
  },
  {
    id: 'flashing-green',
    name: 'Flashing Green',
    colors: ['#22c55e'],
    animationType: 'flashing',
    colorCss: 'bg-emerald-500 animate-pulse shadow-emerald-500/80',
    inFlight: 'RETURN FOR LANDING (Followed by steady green at proper time)',
    onGround: 'CLEARED TO TAXI'
  },
  {
    id: 'steady-red',
    name: 'Steady Red',
    colors: ['#ef4444'],
    animationType: 'steady',
    colorCss: 'bg-rose-500 shadow-rose-500/80',
    inFlight: 'GIVE WAY TO OTHER AIRCRAFT AND CONTINUE CIRCLING',
    onGround: 'STOP'
  },
  {
    id: 'flashing-red',
    name: 'Flashing Red',
    colors: ['#ef4444'],
    animationType: 'flashing',
    colorCss: 'bg-rose-500 animate-pulse shadow-rose-500/80',
    inFlight: 'AIRPORT UNSAFE — DO NOT LAND',
    onGround: 'TAXI CLEAR OF RUNWAY / LANDING AREA IN USE'
  },
  {
    id: 'flashing-white',
    name: 'Flashing White',
    colors: ['#ffffff'],
    animationType: 'flashing',
    colorCss: 'bg-white animate-pulse shadow-white/80',
    inFlight: 'No meaning in flight (in Canada/FAA, report to tower after landing)',
    onGround: 'RETURN TO STARTING POINT ON AIRPORT'
  },
  {
    id: 'alt-red-green',
    name: 'Alternating Red & Green',
    colors: ['#ef4444', '#22c55e'],
    animationType: 'alternating',
    colorCss: 'bg-gradient-to-r from-rose-500 to-emerald-500 animate-pulse',
    inFlight: 'DANGER / EXERCISE EXTREME CAUTION',
    onGround: 'DANGER / EXERCISE EXTREME CAUTION'
  }
];

export const AirportCircuitLab: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'circuit' | 'lightgun' | 'airspace'>('circuit');
  
  // Circuit Simulator State
  const [selectedLeg, setSelectedLeg] = useState<CircuitLeg>('downwind');
  const [isAnimating, setIsAnimating] = useState(false);
  const [animProgress, setAnimProgress] = useState(0.45); // 0 to 1 along circuit
  const [entryType, setEntryType] = useState<CircuitEntryType>('45-downwind');
  const [windDirection, setWindDirection] = useState(250); // Wind from 250 deg
  const [windSpeed, setWindSpeed] = useState(12); // 12 knots

  // Light Gun Simulator State
  const [selectedLight, setSelectedLight] = useState<LightGunSignal>(LIGHT_GUN_SIGNALS[0]);
  const [quizMode, setQuizMode] = useState(false);
  const [quizQuestion, setQuizQuestion] = useState<{
    signal: LightGunSignal;
    scenario: 'inFlight' | 'onGround';
    options: string[];
    correctAnswer: string;
  } | null>(null);
  const [quizSelectedAnswer, setQuizSelectedAnswer] = useState<string | null>(null);
  const [quizScore, setQuizScore] = useState({ correct: 0, total: 0 });

  // Runway 27 vs 09 math
  const runwayHeading = 270;
  const windAngleDiff = ((windDirection - runwayHeading + 540) % 360) - 180;
  const headwindComponent = Math.round(windSpeed * Math.cos((windAngleDiff * Math.PI) / 180));
  const crosswindComponent = Math.round(Math.abs(windSpeed * Math.sin((windAngleDiff * Math.PI) / 180)));
  const isRunway27Active = headwindComponent >= 0;

  // Circuit automatic flight animation loop
  useEffect(() => {
    if (!isAnimating) return;
    const interval = setInterval(() => {
      setAnimProgress((prev) => {
        const next = (prev + 0.005) % 1;
        // Determine leg from progress
        if (next < 0.20) setSelectedLeg('upwind');
        else if (next < 0.35) setSelectedLeg('crosswind');
        else if (next < 0.65) setSelectedLeg('downwind');
        else if (next < 0.80) setSelectedLeg('base');
        else setSelectedLeg('final');
        return next;
      });
    }, 80);
    return () => clearInterval(interval);
  }, [isAnimating]);

  // Quiz generator for Light Gun
  const generateQuiz = () => {
    const randomSignal = LIGHT_GUN_SIGNALS[Math.floor(Math.random() * LIGHT_GUN_SIGNALS.length)];
    const isFlight = Math.random() > 0.5;
    const scenario = isFlight ? 'inFlight' : 'onGround';
    const correctAnswer = isFlight ? randomSignal.inFlight : randomSignal.onGround;

    // Collect 3 distractor answers
    const allAnswers = LIGHT_GUN_SIGNALS.map(s => isFlight ? s.inFlight : s.onGround)
      .filter((v, i, a) => a.indexOf(v) === i && v !== correctAnswer);
    
    // Shuffle distractors
    const distractors = allAnswers.sort(() => 0.5 - Math.random()).slice(0, 3);
    const options = [correctAnswer, ...distractors].sort(() => 0.5 - Math.random());

    setQuizQuestion({
      signal: randomSignal,
      scenario,
      options,
      correctAnswer
    });
    setQuizSelectedAnswer(null);
  };

  const handleAnswerSelect = (option: string) => {
    if (quizSelectedAnswer !== null || !quizQuestion) return;
    setQuizSelectedAnswer(option);
    const isCorrect = option === quizQuestion.correctAnswer;
    if (isCorrect) {
      soundManager.playSuccessChime();
      setQuizScore(prev => ({ correct: prev.correct + 1, total: prev.total + 1 }));
    } else {
      soundManager.playClick();
      setQuizScore(prev => ({ ...prev, total: prev.total + 1 }));
    }
  };

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-1 rounded bg-rcac-blue/80 text-rcac-gold border border-rcac-gold/30 text-xs font-mono font-bold tracking-wider">
              GROUND SCHOOL MODULE 7
            </span>
            <span className="text-xs text-slate-400 font-mono">PSTAR & AIR CADET SYLLABUS</span>
          </div>
          <h2 className="text-2xl font-bold text-white mt-1 flex items-center gap-2">
            <Radio className="w-6 h-6 text-rcac-sky" />
            <span>Airport Traffic Circuit & Radio / Light Gun Trainer</span>
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Master the standard Canadian 1,000 ft traffic pattern, BUMPFICH pre-landing checks, crosswind landing math, and emergency tower light gun signals.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="flex bg-slate-950 p-1.5 rounded-lg border border-slate-800 self-stretch md:self-auto">
          <button
            onClick={() => { setActiveTab('circuit'); soundManager.playClick(); }}
            className={`flex-1 md:flex-none px-4 py-2 rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'circuit'
                ? 'bg-rcac-blue text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>Traffic Circuit</span>
          </button>
          <button
            onClick={() => { setActiveTab('lightgun'); soundManager.playClick(); }}
            className={`flex-1 md:flex-none px-4 py-2 rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'lightgun'
                ? 'bg-rcac-blue text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Light Gun (NORDO)</span>
          </button>
          <button
            onClick={() => { setActiveTab('airspace'); soundManager.playClick(); }}
            className={`flex-1 md:flex-none px-4 py-2 rounded-md text-xs font-semibold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'airspace'
                ? 'bg-rcac-blue text-white shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Info className="w-3.5 h-3.5" />
            <span>Airspace & Squawks</span>
          </button>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: AIRPORT TRAFFIC CIRCUIT SIMULATOR */}
      {/* ======================================================== */}
      {activeTab === 'circuit' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Interactive Aerial Circuit Canvas */}
          <div className="lg:col-span-8 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl relative overflow-hidden">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-white tracking-wide uppercase font-mono flex items-center gap-2">
                    <Compass className="w-4 h-4 text-rcac-sky" />
                    Standard Left-Hand Traffic Pattern (1,000' AGL)
                  </h3>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => {
                      setIsAnimating(!isAnimating);
                      soundManager.playClick();
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition flex items-center gap-1.5 ${
                      isAnimating 
                        ? 'bg-amber-600 text-white shadow-lg' 
                        : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                    }`}
                  >
                    {isAnimating ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    <span>{isAnimating ? 'Pause Flight' : 'Fly Circuit'}</span>
                  </button>
                  <button
                    onClick={() => {
                      setAnimProgress(0);
                      setSelectedLeg('upwind');
                      soundManager.playClick();
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
                    title="Reset to Takeoff"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* 2D Top-Down Aerial Circuit Display */}
              <div className="w-full bg-slate-950 rounded-lg border border-slate-800 relative p-4 flex items-center justify-center overflow-hidden">
                <svg viewBox="0 0 800 480" className="w-full h-auto max-h-[440px] select-none">
                  {/* Sky/Grass Grid Background */}
                  <defs>
                    <pattern id="airfieldGrid" width="40" height="40" patternUnits="userSpaceOnUse">
                      <path d="M 40 0 L 0 0 0 40" fill="none" stroke="#1e293b" strokeWidth="0.8" />
                    </pattern>
                    <marker id="arrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#38bdf8" />
                    </marker>
                    <marker id="entryArrow" viewBox="0 0 10 10" refX="5" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                      <path d="M 0 1 L 10 5 L 0 9 z" fill="#fbbf24" />
                    </marker>
                  </defs>
                  <rect width="800" height="480" fill="#090d16" />
                  <rect width="800" height="480" fill="url(#airfieldGrid)" opacity="0.6" />

                  {/* Airport Outer Boundary / Grass Runway Strip */}
                  <rect x="220" y="270" width="360" height="80" rx="12" fill="#13231b" stroke="#1f432e" strokeWidth="1.5" />

                  {/* Asphalt Runway 09 / 27 */}
                  <rect x="240" y="295" width="320" height="30" rx="3" fill="#1e293b" stroke="#475569" strokeWidth="1" />
                  {/* Runway Centerline dashes */}
                  <line x1="280" y1="310" x2="520" y2="310" stroke="#f8fafc" strokeWidth="2" strokeDasharray="14 10" />
                  {/* Threshold marks */}
                  <line x1="246" y1="298" x2="246" y2="322" stroke="#f8fafc" strokeWidth="3" />
                  <line x1="250" y1="298" x2="250" y2="322" stroke="#f8fafc" strokeWidth="3" />
                  <line x1="550" y1="298" x2="550" y2="322" stroke="#f8fafc" strokeWidth="3" />
                  <line x1="554" y1="298" x2="554" y2="322" stroke="#f8fafc" strokeWidth="3" />
                  {/* Runway Designation Numbers */}
                  <text x="265" y="314" fill="#f8fafc" fontSize="11" fontWeight="bold" fontFamily="monospace">09</text>
                  <text x="535" y="314" fill="#f8fafc" fontSize="11" fontWeight="bold" fontFamily="monospace">27</text>

                  {/* Active Runway Indicator */}
                  <circle cx={isRunway27Active ? 535 : 265} cy="310" r="14" fill="none" stroke="#22c55e" strokeWidth="2" strokeDasharray="3 3" />

                  {/* Control Tower & Windsock Position */}
                  <rect x="380" y="360" width="24" height="24" rx="4" fill="#334155" stroke="#64748b" strokeWidth="1.5" />
                  <text x="392" y="375" fill="#e2e8f0" fontSize="8" fontWeight="bold" textAnchor="middle">TWR</text>
                  
                  {/* Circuit Path: Rectangular Left-Hand Pattern for Runway 27 */}
                  {/* Leg 1: Upwind (Right to Left along runway from x=530 to x=140) */}
                  <path 
                    d="M 500 310 L 140 310" 
                    fill="none" 
                    stroke={selectedLeg === 'upwind' ? '#38bdf8' : '#334155'} 
                    strokeWidth={selectedLeg === 'upwind' ? 4 : 2} 
                    strokeDasharray={selectedLeg === 'upwind' ? 'none' : '6 4'}
                    markerEnd="url(#arrow)"
                    className="cursor-pointer"
                    onClick={() => { setSelectedLeg('upwind'); soundManager.playClick(); }}
                  />

                  {/* Leg 2: Crosswind (From x=140, y=310 down/north to x=140, y=100) */}
                  <path 
                    d="M 140 310 L 140 100" 
                    fill="none" 
                    stroke={selectedLeg === 'crosswind' ? '#38bdf8' : '#334155'} 
                    strokeWidth={selectedLeg === 'crosswind' ? 4 : 2} 
                    strokeDasharray={selectedLeg === 'crosswind' ? 'none' : '6 4'}
                    markerEnd="url(#arrow)"
                    className="cursor-pointer"
                    onClick={() => { setSelectedLeg('crosswind'); soundManager.playClick(); }}
                  />

                  {/* Leg 3: Downwind (From x=140, y=100 to x=660, y=100) */}
                  <path 
                    d="M 140 100 L 660 100" 
                    fill="none" 
                    stroke={selectedLeg === 'downwind' ? '#38bdf8' : '#334155'} 
                    strokeWidth={selectedLeg === 'downwind' ? 4 : 2} 
                    strokeDasharray={selectedLeg === 'downwind' ? 'none' : '6 4'}
                    markerEnd="url(#arrow)"
                    className="cursor-pointer"
                    onClick={() => { setSelectedLeg('downwind'); soundManager.playClick(); }}
                  />

                  {/* Leg 4: Base Leg (From x=660, y=100 down to x=660, y=310) */}
                  <path 
                    d="M 660 100 L 660 310" 
                    fill="none" 
                    stroke={selectedLeg === 'base' ? '#38bdf8' : '#334155'} 
                    strokeWidth={selectedLeg === 'base' ? 4 : 2} 
                    strokeDasharray={selectedLeg === 'base' ? 'none' : '6 4'}
                    markerEnd="url(#arrow)"
                    className="cursor-pointer"
                    onClick={() => { setSelectedLeg('base'); soundManager.playClick(); }}
                  />

                  {/* Leg 5: Final Approach (From x=660, y=310 to x=540, y=310) */}
                  <path 
                    d="M 660 310 L 535 310" 
                    fill="none" 
                    stroke={selectedLeg === 'final' ? '#38bdf8' : '#334155'} 
                    strokeWidth={selectedLeg === 'final' ? 4 : 2} 
                    strokeDasharray={selectedLeg === 'final' ? 'none' : '6 4'}
                    markerEnd="url(#arrow)"
                    className="cursor-pointer"
                    onClick={() => { setSelectedLeg('final'); soundManager.playClick(); }}
                  />

                  {/* Circuit Entry Path Overlays */}
                  {entryType === '45-downwind' && (
                    <path
                      d="M 320 20 L 400 100"
                      fill="none"
                      stroke="#fbbf24"
                      strokeWidth="2.5"
                      strokeDasharray="4 4"
                      markerEnd="url(#entryArrow)"
                    />
                  )}
                  {entryType === 'overhead-cross' && (
                    <path
                      d="M 400 420 L 400 100"
                      fill="none"
                      stroke="#f59e0b"
                      strokeWidth="2.5"
                      strokeDasharray="4 4"
                      markerEnd="url(#entryArrow)"
                    />
                  )}

                  {/* Leg Labels */}
                  <text 
                    x="300" y="338" 
                    fill={selectedLeg === 'upwind' ? '#38bdf8' : '#94a3b8'} 
                    fontSize="11" 
                    fontWeight="bold" 
                    className="cursor-pointer"
                    onClick={() => setSelectedLeg('upwind')}
                  >
                    1. UPWIND (CLIMB TO 500')
                  </text>
                  <text 
                    x="50" y="210" 
                    fill={selectedLeg === 'crosswind' ? '#38bdf8' : '#94a3b8'} 
                    fontSize="11" 
                    fontWeight="bold" 
                    className="cursor-pointer"
                    onClick={() => setSelectedLeg('crosswind')}
                  >
                    2. CROSSWIND
                  </text>
                  <text 
                    x="400" y="80" 
                    fill={selectedLeg === 'downwind' ? '#38bdf8' : '#94a3b8'} 
                    fontSize="11" 
                    fontWeight="bold" 
                    textAnchor="middle" 
                    className="cursor-pointer"
                    onClick={() => setSelectedLeg('downwind')}
                  >
                    3. DOWNWIND (1,000' AGL — BUMPFICH CHECK)
                  </text>
                  <text 
                    x="675" y="210" 
                    fill={selectedLeg === 'base' ? '#38bdf8' : '#94a3b8'} 
                    fontSize="11" 
                    fontWeight="bold" 
                    className="cursor-pointer"
                    onClick={() => setSelectedLeg('base')}
                  >
                    4. BASE
                  </text>
                  <text 
                    x="600" y="335" 
                    fill={selectedLeg === 'final' ? '#38bdf8' : '#94a3b8'} 
                    fontSize="11" 
                    fontWeight="bold" 
                    textAnchor="middle" 
                    className="cursor-pointer"
                    onClick={() => setSelectedLeg('final')}
                  >
                    5. FINAL (PAPI 2R / 2W)
                  </text>

                  {/* Animated Aircraft Position Icon */}
                  {(() => {
                    // Compute plane coordinates along rectangular path
                    let px = 500, py = 310, pRot = 180;
                    if (animProgress < 0.20) {
                      // Upwind: 500 -> 140 at y=310
                      const t = animProgress / 0.20;
                      px = 500 - t * (500 - 140);
                      py = 310;
                      pRot = 180;
                    } else if (animProgress < 0.35) {
                      // Crosswind: 140 at y=310 -> y=100
                      const t = (animProgress - 0.20) / 0.15;
                      px = 140;
                      py = 310 - t * (310 - 100);
                      pRot = 270;
                    } else if (animProgress < 0.65) {
                      // Downwind: 140 -> 660 at y=100
                      const t = (animProgress - 0.35) / 0.30;
                      px = 140 + t * (660 - 140);
                      py = 100;
                      pRot = 0;
                    } else if (animProgress < 0.80) {
                      // Base: 660 at y=100 -> y=310
                      const t = (animProgress - 0.65) / 0.15;
                      px = 660;
                      py = 100 + t * (310 - 100);
                      pRot = 90;
                    } else {
                      // Final: 660 -> 500 at y=310
                      const t = (animProgress - 0.80) / 0.20;
                      px = 660 - t * (660 - 500);
                      py = 310;
                      pRot = 180;
                    }

                    return (
                      <g transform={`translate(${px}, ${py}) rotate(${pRot})`}>
                        {/* Plane Shadow */}
                        <circle cx="2" cy="2" r="10" fill="#000000" opacity="0.4" />
                        {/* Plane Body */}
                        <path d="M 0 -12 L 3 -3 L 14 0 L 3 3 L 2 11 L 6 13 L 6 15 L 0 14 L -6 15 L -6 13 L -2 11 L -3 3 L -14 0 L -3 -3 z" fill="#38bdf8" stroke="#ffffff" strokeWidth="1" />
                        <circle cx="0" cy="0" r="3" fill="#fbbf24" />
                      </g>
                    );
                  })()}

                  {/* Windsock Widget on Canvas */}
                  <g transform="translate(680, 420)">
                    <circle cx="0" cy="0" r="35" fill="#0f172a" stroke="#334155" strokeWidth="1" />
                    {/* Compass North */}
                    <text x="0" y="-22" fill="#ef4444" fontSize="8" fontWeight="bold" textAnchor="middle">N</text>
                    <text x="25" y="3" fill="#94a3b8" fontSize="7" textAnchor="middle">E</text>
                    <text x="0" y="28" fill="#94a3b8" fontSize="7" textAnchor="middle">S</text>
                    <text x="-25" y="3" fill="#94a3b8" fontSize="7" textAnchor="middle">W</text>
                    {/* Windsock pointer (points in direction wind is blowing to = windDirection + 180) */}
                    <g transform={`rotate(${windDirection + 180})`}>
                      <line x1="0" y1="0" x2="0" y2="24" stroke="#f97316" strokeWidth="4" strokeLinecap="round" />
                      <line x1="0" y1="6" x2="0" y2="12" stroke="#ffffff" strokeWidth="4" strokeLinecap="butt" />
                      <line x1="0" y1="18" x2="0" y2="24" stroke="#ffffff" strokeWidth="4" strokeLinecap="butt" />
                    </g>
                    <text x="0" y="4" fill="#f8fafc" fontSize="8" fontWeight="bold" textAnchor="middle" fontFamily="monospace">
                      {windSpeed}k
                    </text>
                  </g>
                </svg>
              </div>

              {/* Circuit Controls & Entry Selection */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs font-mono">
                <div>
                  <label className="text-slate-400 font-semibold mb-1 block">Circuit Entry Procedure:</label>
                  <div className="grid grid-cols-3 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    <button
                      onClick={() => setEntryType('45-downwind')}
                      className={`py-1.5 px-2 rounded text-center transition ${
                        entryType === '45-downwind' ? 'bg-rcac-blue text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      45° Downwind
                    </button>
                    <button
                      onClick={() => setEntryType('overhead-cross')}
                      className={`py-1.5 px-2 rounded text-center transition ${
                        entryType === 'overhead-cross' ? 'bg-rcac-blue text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Midfield 1500'
                    </button>
                    <button
                      onClick={() => setEntryType('straight-in')}
                      className={`py-1.5 px-2 rounded text-center transition ${
                        entryType === 'straight-in' ? 'bg-rcac-blue text-white' : 'text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      Straight-in
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-slate-400 font-semibold mb-1 block">Interactive Leg Selector:</label>
                  <div className="grid grid-cols-5 gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
                    {(['upwind', 'crosswind', 'downwind', 'base', 'final'] as CircuitLeg[]).map((leg) => (
                      <button
                        key={leg}
                        onClick={() => {
                          setSelectedLeg(leg);
                          soundManager.playClick();
                          // Jump animation progress
                          if (leg === 'upwind') setAnimProgress(0.1);
                          if (leg === 'crosswind') setAnimProgress(0.27);
                          if (leg === 'downwind') setAnimProgress(0.5);
                          if (leg === 'base') setAnimProgress(0.72);
                          if (leg === 'final') setAnimProgress(0.9);
                        }}
                        className={`py-1.5 text-center capitalize rounded transition ${
                          selectedLeg === leg ? 'bg-rcac-gold text-slate-950 font-bold' : 'text-slate-400 hover:text-slate-200'
                        }`}
                      >
                        {leg}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Leg Guide, Pre-Landing Checklist & Crosswind Calculator */}
          <div className="lg:col-span-4 space-y-4">
            {/* Active Leg Detail Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3 mb-3">
                <h4 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-rcac-sky animate-ping" />
                  {CIRCUIT_LEGS[selectedLeg].name}
                </h4>
                <span className="text-xs font-mono text-rcac-gold px-2 py-0.5 rounded bg-amber-950/60 border border-amber-800/40">
                  {CIRCUIT_LEGS[selectedLeg].altitude}
                </span>
              </div>

              <div className="space-y-3 text-xs">
                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Target Speed:</span>
                  <p className="font-mono text-slate-200 bg-slate-950 px-2.5 py-1.5 rounded border border-slate-800">
                    {CIRCUIT_LEGS[selectedLeg].speed}
                  </p>
                </div>

                <div>
                  <span className="text-slate-400 font-semibold block mb-1">Cadet Pilot Actions:</span>
                  <ul className="space-y-1.5 text-slate-300">
                    {CIRCUIT_LEGS[selectedLeg].actions.map((act, i) => (
                      <li key={i} className="flex items-start gap-1.5">
                        <ChevronRight className="w-3.5 h-3.5 text-rcac-sky flex-shrink-0 mt-0.5" />
                        <span>{act}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Cadet Radio Call Box */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
                  <div className="flex items-center justify-between mb-1 text-[11px] text-rcac-sky font-mono font-bold">
                    <span className="flex items-center gap-1">
                      <Radio className="w-3 h-3" />
                      RADIO TRANSMISSION (ROC-A)
                    </span>
                    <button 
                      onClick={() => soundManager.playRadioClick()}
                      className="text-slate-400 hover:text-white"
                      title="Test Radio Squelch"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <p className="font-mono text-emerald-400 text-xs italic">
                    {CIRCUIT_LEGS[selectedLeg].radioCall}
                  </p>
                </div>
              </div>
            </div>

            {/* BUMPFICH Pre-Landing Checklist Card (Only for Downwind or General Reference) */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
              <h4 className="text-sm font-bold text-white mb-2 font-mono flex items-center justify-between">
                <span>DOWNWIND "BUMPFICH" CHECK</span>
                <span className="text-[10px] text-rcac-sky">ROYAL CANADIAN AIR CADETS</span>
              </h4>
              <p className="text-xs text-slate-400 mb-3">
                Mandatory mnemonic recited by cadet pilots on downwind abeam the runway threshold:
              </p>
              <div className="grid grid-cols-2 gap-1.5 text-[11px] font-mono">
                <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                  <span className="text-rcac-gold font-bold">B</span> - Brakes (Checked & Off)
                </div>
                <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                  <span className="text-rcac-gold font-bold">U</span> - Undercarriage (Down & Locked)
                </div>
                <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                  <span className="text-rcac-gold font-bold">M</span> - Mixture (Full Rich)
                </div>
                <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                  <span className="text-rcac-gold font-bold">P</span> - Propeller (High RPM / Fixed)
                </div>
                <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                  <span className="text-rcac-gold font-bold">F</span> - Fuel (Selector on BOTH/Full)
                </div>
                <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                  <span className="text-rcac-gold font-bold">I</span> - Instruments (Engine gauges green)
                </div>
                <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                  <span className="text-rcac-gold font-bold">C</span> - Carb Heat (HOT as required)
                </div>
                <div className="bg-slate-950 p-1.5 rounded border border-slate-800">
                  <span className="text-rcac-gold font-bold">H</span> - Hatches & Harnesses (Secure)
                </div>
              </div>
            </div>

            {/* Live Crosswind Calculator */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
              <h4 className="text-sm font-bold text-white mb-2 font-mono flex items-center justify-between">
                <span>WIND & RUNWAY SELECTOR</span>
                <Wind className="w-4 h-4 text-rcac-sky" />
              </h4>

              <div className="space-y-3 text-xs font-mono">
                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Wind Direction:</span>
                    <span className="text-white font-bold">{windDirection}° Magnetic</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="350"
                    step="10"
                    value={windDirection}
                    onChange={(e) => setWindDirection(Number(e.target.value))}
                    className="w-full accent-rcac-sky"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-slate-400 mb-1">
                    <span>Wind Velocity:</span>
                    <span className="text-white font-bold">{windSpeed} Knots</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="35"
                    step="1"
                    value={windSpeed}
                    onChange={(e) => setWindSpeed(Number(e.target.value))}
                    className="w-full accent-rcac-sky"
                  />
                </div>

                {/* Calculation Outputs */}
                <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1.5">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Active Runway:</span>
                    <span className="font-bold text-emerald-400">
                      Runway {isRunway27Active ? '27' : '09'} (Prefer Headwind)
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Headwind Component:</span>
                    <span className="font-bold text-white">
                      {Math.abs(headwindComponent)} kts {headwindComponent >= 0 ? '(Headwind)' : '(Tailwind ⚠️)'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Crosswind Component:</span>
                    <span className={`font-bold ${crosswindComponent > 15 ? 'text-rose-400' : 'text-slate-200'}`}>
                      {crosswindComponent} kts {crosswindComponent > 15 && '(Exceeds 15kt C172 max demonstrated!)'}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: TOWER LIGHT GUN SIGNALS (NORDO / EMERGENCY) */}
      {/* ======================================================== */}
      {activeTab === 'lightgun' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Interactive Tower Beacon Visualizer */}
          <div className="lg:col-span-6 space-y-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-2xl">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <ShieldAlert className="w-5 h-5 text-rcac-gold" />
                  <span>Tower Light Gun Simulator (NORDO)</span>
                </h3>
                <span className="text-xs font-mono bg-slate-950 px-2.5 py-1 rounded border border-slate-800 text-slate-400">
                  CAR 602.05 / PSTAR
                </span>
              </div>
              <p className="text-xs text-slate-400 mb-4">
                When an aircraft experiences a radio communications failure (NORDO), the control tower aims a high-intensity directional optical light gun at the cockpit. Cadets must recognize these instantly.
              </p>

              {/* Simulated Light Gun Beam Device */}
              <div className="bg-slate-950 rounded-xl border border-slate-800 p-8 flex flex-col items-center justify-center relative overflow-hidden min-h-[220px]">
                {/* Visual Tower Gun Spotlight Beam */}
                <div className="relative flex flex-col items-center">
                  <div className={`w-28 h-28 rounded-full flex items-center justify-center transition-all duration-300 shadow-[0_0_60px_rgba(255,255,255,0.4)] ${selectedLight.colorCss}`}>
                    <div className="w-20 h-20 rounded-full bg-white/30 backdrop-blur-sm flex items-center justify-center border border-white/50">
                      <span className="text-2xl">🔦</span>
                    </div>
                  </div>
                  {/* Projected Beam cone */}
                  <div className="w-48 h-16 bg-gradient-to-b from-white/10 to-transparent blur-md mt-2 rounded-full" />
                </div>

                <div className="mt-4 text-center">
                  <span className="text-lg font-bold text-white font-mono tracking-wider block">
                    {selectedLight.name.toUpperCase()}
                  </span>
                  <span className="text-xs text-slate-400 font-mono">
                    Mode: {selectedLight.animationType.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Light Signal Selector Buttons */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-4">
                {LIGHT_GUN_SIGNALS.map((sig) => (
                  <button
                    key={sig.id}
                    onClick={() => {
                      setSelectedLight(sig);
                      soundManager.playClick();
                    }}
                    className={`p-2.5 rounded-lg border text-left transition flex items-center gap-2 ${
                      selectedLight.id === sig.id
                        ? 'bg-slate-800 border-rcac-sky text-white shadow-lg'
                        : 'bg-slate-950/60 border-slate-800 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span 
                      className="w-3.5 h-3.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: sig.colors[0] }}
                    />
                    <span className="text-xs font-semibold truncate">{sig.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Meaning & Interactive Drill / Quiz */}
          <div className="lg:col-span-6 space-y-4">
            {/* Meaning Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
              <h4 className="text-sm font-bold text-white font-mono uppercase tracking-wider mb-3">
                Signal Meaning for: <span className="text-rcac-sky">{selectedLight.name}</span>
              </h4>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-sky-400 font-bold">
                    <span>✈️ IN FLIGHT</span>
                  </div>
                  <p className="text-sm font-bold text-white">
                    {selectedLight.inFlight}
                  </p>
                </div>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                  <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                    <span>🛞 ON GROUND</span>
                  </div>
                  <p className="text-sm font-bold text-white">
                    {selectedLight.onGround}
                  </p>
                </div>
              </div>

              {/* Pilot Acknowledgment instructions */}
              <div className="mt-4 p-3 bg-slate-950/80 rounded-lg border border-slate-800 text-xs text-slate-400">
                <p className="font-semibold text-slate-300 mb-1">
                  🍁 Transport Canada Pilot Acknowledgment Procedure:
                </p>
                <ul className="list-disc list-inside space-y-1 text-[11px]">
                  <li><strong>In Flight (Day):</strong> Rock wings (bank left and right).</li>
                  <li><strong>In Flight (Night):</strong> Flash landing light or navigation lights twice.</li>
                  <li><strong>On Ground (Day):</strong> Move ailerons or rudder back and forth.</li>
                  <li><strong>On Ground (Night):</strong> Flash landing lights or taxi lights twice.</li>
                </ul>
              </div>
            </div>

            {/* Interactive Light Gun Drill Challenge */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
              <div className="flex items-center justify-between mb-3">
                <h4 className="text-sm font-bold text-white font-mono flex items-center gap-2">
                  <HelpCircle className="w-4 h-4 text-rcac-gold" />
                  <span>Interactive Light Gun Drill</span>
                </h4>
                {quizMode && (
                  <span className="text-xs font-mono text-emerald-400">
                    Score: {quizScore.correct} / {quizScore.total}
                  </span>
                )}
              </div>

              {!quizMode ? (
                <div className="text-center py-4 space-y-3">
                  <p className="text-xs text-slate-400 max-w-md mx-auto">
                    Test your instant reaction time! The tower will flash an emergency signal. You must select the correct pilot action before time runs out.
                  </p>
                  <button
                    onClick={() => {
                      setQuizMode(true);
                      setQuizScore({ correct: 0, total: 0 });
                      generateQuiz();
                      soundManager.playClick();
                    }}
                    className="px-5 py-2.5 bg-rcac-blue hover:bg-sky-600 text-white font-bold rounded-lg text-xs font-mono shadow-lg transition"
                  >
                    Start Light Gun Quiz
                  </button>
                </div>
              ) : (
                quizQuestion && (
                  <div className="space-y-4">
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex-shrink-0 ${quizQuestion.signal.colorCss}`} />
                      <div>
                        <span className="text-xs text-rcac-gold font-mono block">
                          SCENARIO: AIRCRAFT {quizQuestion.scenario === 'inFlight' ? 'IN FLIGHT' : 'ON THE GROUND'}
                        </span>
                        <p className="text-sm font-bold text-white">
                          Tower directs a <span className="underline decoration-rcac-sky">{quizQuestion.signal.name}</span> beam at your cockpit. What is your required action?
                        </p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {quizQuestion.options.map((opt, idx) => {
                        const isSelected = quizSelectedAnswer === opt;
                        const isCorrect = opt === quizQuestion.correctAnswer;
                        let btnStyle = 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-700';

                        if (quizSelectedAnswer !== null) {
                          if (isCorrect) {
                            btnStyle = 'bg-emerald-950/80 border-emerald-500 text-emerald-200';
                          } else if (isSelected) {
                            btnStyle = 'bg-rose-950/80 border-rose-500 text-rose-200';
                          } else {
                            btnStyle = 'opacity-40 bg-slate-950 border-slate-800 text-slate-400';
                          }
                        }

                        return (
                          <button
                            key={idx}
                            onClick={() => handleAnswerSelect(opt)}
                            disabled={quizSelectedAnswer !== null}
                            className={`p-3 rounded-lg border text-left text-xs font-mono transition ${btnStyle}`}
                          >
                            {opt}
                          </button>
                        );
                      })}
                    </div>

                    {quizSelectedAnswer !== null && (
                      <div className="flex items-center justify-between pt-2">
                        <span className="text-xs font-mono text-slate-400">
                          {quizSelectedAnswer === quizQuestion.correctAnswer ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <CheckCircle className="w-3.5 h-3.5" /> Correct!
                            </span>
                          ) : (
                            <span className="text-rose-400 flex items-center gap-1">
                              <AlertTriangle className="w-3.5 h-3.5" /> Incorrect. Correct action: {quizQuestion.correctAnswer}
                            </span>
                          )}
                        </span>
                        <button
                          onClick={() => {
                            generateQuiz();
                            soundManager.playClick();
                          }}
                          className="px-4 py-1.5 bg-rcac-blue hover:bg-sky-600 text-white text-xs font-mono rounded font-bold transition"
                        >
                          Next Question ➔
                        </button>
                      </div>
                    )}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: CANADIAN AIRSPACE & TRANSPONDER SQUAWKS */}
      {/* ======================================================== */}
      {activeTab === 'airspace' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Squawk Codes Card */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl">
              <h4 className="text-sm font-bold text-white font-mono flex items-center gap-2 mb-3">
                <span className="text-lg">📡</span>
                <span>Transponder Squawk Codes</span>
              </h4>
              <div className="space-y-2 text-xs font-mono">
                <div className="p-2.5 rounded bg-rose-950/60 border border-rose-800/40">
                  <div className="text-rose-400 font-bold">7500 — HIJACK</div>
                  <p className="text-slate-400 text-[11px]">Unlawful interference ("Seven-Five, Man with a knife")</p>
                </div>
                <div className="p-2.5 rounded bg-amber-950/60 border border-amber-800/40">
                  <div className="text-amber-400 font-bold">7600 — NORDO / RADIO OUT</div>
                  <p className="text-slate-400 text-[11px]">Loss of communications ("Seven-Six, Hear no clicks")</p>
                </div>
                <div className="p-2.5 rounded bg-red-950/60 border border-red-800/40">
                  <div className="text-red-400 font-bold">7700 — GENERAL MAYDAY</div>
                  <p className="text-slate-400 text-[11px]">In-flight emergency ("Seven-Seven, Going to heaven")</p>
                </div>
                <div className="p-2.5 rounded bg-slate-950 border border-slate-800">
                  <div className="text-sky-400 font-bold">1200 / 1202 — VFR / GLIDER</div>
                  <p className="text-slate-400 text-[11px]">Standard VFR below 12,500' (1202 for soaring gliders in Canada)</p>
                </div>
              </div>
            </div>

            {/* Canadian Airspace Classes */}
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 shadow-xl lg:col-span-3">
              <h4 className="text-sm font-bold text-white font-mono flex items-center gap-2 mb-3">
                <span className="text-lg">🇨🇦</span>
                <span>Canadian Airspace Classification (Classes A through G)</span>
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 text-xs">
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="font-bold text-rcac-sky font-mono block">Class A (High Level)</span>
                  <p className="text-slate-400 text-[11px] mt-1">
                    FL 180 to FL 600. All operations IFR only. ATC clearance required. Altimeter set to standard 29.92 inHg.
                  </p>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="font-bold text-rcac-sky font-mono block">Class B (Low Level Controlled)</span>
                  <p className="text-slate-400 text-[11px] mt-1">
                    Above 12,500' ASL up to 18,000' ASL. VFR flights permitted with ATC clearance, transponder, and two-way radio.
                  </p>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="font-bold text-rcac-sky font-mono block">Class C (Controlled Terminal)</span>
                  <p className="text-slate-400 text-[11px] mt-1">
                    Around major aerodromes (e.g. Toronto, Vancouver). VFR requires ATC clearance before entering. Mode C transponder required.
                  </p>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="font-bold text-rcac-sky font-mono block">Class D (Dialogue Required)</span>
                  <p className="text-slate-400 text-[11px] mt-1">
                    Control zones around regional airports. VFR must establish two-way radio contact with tower before entering.
                  </p>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="font-bold text-rcac-sky font-mono block">Class E (Controlled Airway)</span>
                  <p className="text-slate-400 text-[11px] mt-1">
                    Controlled for IFR; VFR does not require ATC clearance or radio contact unless operating in specified mandatory frequency areas.
                  </p>
                </div>
                <div className="p-3 bg-slate-950 rounded-lg border border-slate-800">
                  <span className="font-bold text-emerald-400 font-mono block">Class G (Uncontrolled Airspace)</span>
                  <p className="text-slate-400 text-[11px] mt-1">
                    ATC has neither authority nor responsibility. Typical gliding and cadet grassroots flying. Cadets broadcast intentions on 123.4 or aerodrome traffic frequency (ATF).
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default AirportCircuitLab;
