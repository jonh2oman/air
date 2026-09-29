import React from 'react';
import { 
  Wind, 
  Rotate3d, 
  Gauge, 
  Scale, 
  Compass, 
  Trophy, 
  Plane,
  Radio,
  Volume2,
  VolumeX
} from 'lucide-react';
import { NavModule } from '../types';
import { soundManager } from '../utils/audio';

interface HeaderProps {
  currentModule: NavModule;
  onSelectModule: (mod: NavModule) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentModule,
  onSelectModule,
  soundEnabled,
  onToggleSound,
}) => {
  const navItems: Array<{ id: NavModule; num: number; label: string; fullTitle: string; icon: React.ReactNode }> = [
    { id: 'aerodynamics', num: 1, label: 'Wind Tunnel', fullTitle: '1. Virtual Wind Tunnel & Aerodynamics', icon: <Wind className="w-3.5 h-3.5" /> },
    { id: 'flight-controls', num: 2, label: '3D Controls', fullTitle: '2. 3D Aircraft Primary Controls', icon: <Rotate3d className="w-3.5 h-3.5" /> },
    { id: 'instruments', num: 3, label: 'Six-Pack', fullTitle: '3. Cockpit Six-Pack Flight Instruments', icon: <Gauge className="w-3.5 h-3.5" /> },
    { id: 'circuit-radio', num: 4, label: 'Circuit & Radio', fullTitle: '4. Airport Circuit Pattern & Light Gun Signals', icon: <Radio className="w-3.5 h-3.5" /> },
    { id: 'weight-balance', num: 5, label: 'Weight & Bal', fullTitle: '5. Weight & Balance Loading Lab', icon: <Scale className="w-3.5 h-3.5" /> },
    { id: 'navigation-e6b', num: 6, label: 'E6B Computer', fullTitle: '6. E6B Flight Computer & Weather Calculator', icon: <Compass className="w-3.5 h-3.5" /> },
    { id: 'flight-sim', num: 7, label: 'Flight Sim', fullTitle: '7. 3D Interactive Flight Simulator', icon: <Plane className="w-3.5 h-3.5" /> },
    { id: 'cadet-exam', num: 8, label: 'Wings Exam', fullTitle: '8. Cadet Wings Challenge & PSTAR Exam', icon: <Trophy className="w-3.5 h-3.5" /> },
  ];

  return (
    <header className="bg-slate-900/95 border-b border-slate-800 sticky top-0 z-40 backdrop-blur shadow-2xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Top Branding Bar */}
        <div className="flex items-center justify-between py-3 border-b border-slate-800/80">
          <div className="flex items-center space-x-3">
            {/* Canadian Air Cadet Roundel Logo Badge */}
            <div className="w-10 h-10 rounded-full bg-rcac-blue border-2 border-rcac-gold flex items-center justify-center shadow-lg relative overflow-hidden flex-shrink-0">
              <div className="w-6 h-6 rounded-full bg-white flex items-center justify-center">
                <div className="w-3 h-3 rounded-full bg-red-600 flex items-center justify-center text-[8px] text-white font-bold">
                  🍁
                </div>
              </div>
            </div>

            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-white tracking-wider flex items-center gap-1.5 font-heading">
                  <span>AEROCADET STEM</span>
                  <span className="text-rcac-sky font-mono text-sm px-1.5 py-0.5 rounded bg-rcac-blue/80 border border-rcac-sky/40">
                    RCAC ACGP
                  </span>
                </h1>
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Royal Canadian Air Cadets • Aviation Ground School & Interactive Flight Physics
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Glider / Power Pilot Badge */}
            <div className="hidden md:flex items-center space-x-2 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-slate-300">GROUND SCHOOL SIMULATOR</span>
            </div>

            {/* Audio Toggle */}
            <button
              onClick={onToggleSound}
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition shadow-sm active:translate-y-0.5"
              title={soundEnabled ? 'Mute Audio' : 'Enable Audio'}
            >
              {soundEnabled ? (
                <Volume2 className="w-4 h-4 text-emerald-400" />
              ) : (
                <VolumeX className="w-4 h-4 text-rose-400" />
              )}
            </button>
          </div>
        </div>

        {/* Navigation Tabs - Responsive Grid fitting all buttons on screen without scrolling */}
        <nav className="grid grid-cols-4 md:grid-cols-8 gap-1.5 sm:gap-2 py-2.5 w-full">
          {navItems.map((item) => {
            const isActive = currentModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectModule(item.id);
                  soundManager.playClick();
                }}
                title={item.fullTitle}
                className={`group flex items-center justify-center gap-1.5 px-2 py-2 rounded-lg text-xs font-semibold transition-all duration-150 shadow-sm select-none active:translate-y-0.5 ${
                  isActive
                    ? 'bg-rcac-sky text-slate-950 border-2 border-white shadow-lg shadow-sky-500/25 ring-2 ring-sky-400/50 font-bold'
                    : 'bg-slate-800 hover:bg-slate-700 text-slate-200 hover:text-white border-2 border-slate-700/80 hover:border-rcac-sky/70 hover:shadow-md'
                }`}
              >
                {/* Number Badge */}
                <span
                  className={`w-4 h-4 sm:w-4.5 sm:h-4.5 rounded flex items-center justify-center font-mono text-[10px] font-bold shrink-0 transition-colors ${
                    isActive
                      ? 'bg-slate-950 text-rcac-gold border border-rcac-gold/60'
                      : 'bg-slate-900 text-rcac-sky border border-slate-700/90 group-hover:border-rcac-sky/60'
                  }`}
                >
                  {item.num}
                </span>

                {/* Icon */}
                <span className={`shrink-0 ${isActive ? 'text-slate-950' : 'text-rcac-sky group-hover:text-white'}`}>
                  {item.icon}
                </span>

                {/* Text Label */}
                <span className="truncate">{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
