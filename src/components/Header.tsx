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
  const navItems: Array<{ id: NavModule; label: string; icon: React.ReactNode; short: string }> = [
    { id: 'aerodynamics', label: '1. Wind Tunnel & Aerodynamics', short: 'Wind Tunnel', icon: <Wind className="w-4 h-4" /> },
    { id: 'flight-controls', label: '2. 3D Aircraft Controls', short: '3D Controls', icon: <Rotate3d className="w-4 h-4" /> },
    { id: 'instruments', label: '3. Cockpit Six-Pack', short: 'Six-Pack', icon: <Gauge className="w-4 h-4" /> },
    { id: 'circuit-radio', label: '4. Airport Circuit & Light Gun', short: 'Circuit & Radio', icon: <Radio className="w-4 h-4" /> },
    { id: 'weight-balance', label: '5. Weight & Balance', short: 'Weight & Bal', icon: <Scale className="w-4 h-4" /> },
    { id: 'navigation-e6b', label: '6. E6B & Weather', short: 'E6B & Weather', icon: <Compass className="w-4 h-4" /> },
    { id: 'flight-sim', label: '7. 3D Flight Simulator', short: 'Flight Sim', icon: <Plane className="w-4 h-4" /> },
    { id: 'cadet-exam', label: '8. Wings Exam Challenge', short: 'Wings Exam', icon: <Trophy className="w-4 h-4" /> },
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
              className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg border border-slate-700 transition"
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

        {/* Navigation Tabs */}
        <nav className="flex space-x-1 sm:space-x-2 py-2 overflow-x-auto no-scrollbar">
          {navItems.map((item) => {
            const isActive = currentModule === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  onSelectModule(item.id);
                  soundManager.playClick();
                }}
                className={`flex items-center space-x-2 px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                  isActive
                    ? 'bg-rcac-sky text-slate-950 shadow-md font-bold'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/80'
                }`}
              >
                <span>{item.icon}</span>
                <span className="hidden sm:inline">{item.label}</span>
                <span className="inline sm:hidden">{item.short}</span>
              </button>
            );
          })}
        </nav>
      </div>
    </header>
  );
};
