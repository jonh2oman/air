import React, { useState } from 'react';
import { NavModule } from './types';
import { Header } from './components/Header';
import { AerodynamicsLab } from './components/AerodynamicsLab';
import { FlightControls3D } from './components/FlightControls3D';
import { SixPackCockpit } from './components/SixPackCockpit';
import { WeightBalanceLab } from './components/WeightBalanceLab';
import { FlightComputerE6B } from './components/FlightComputerE6B';
import { AirportCircuitLab } from './components/AirportCircuitLab';
import { FlightSimulator3D } from './components/FlightSimulator3D';
import { CadetExamChallenge } from './components/CadetExamChallenge';
import { soundManager } from './utils/audio';

export const App: React.FC = () => {
  const [currentModule, setCurrentModule] = useState<NavModule>('aerodynamics');
  const [soundEnabled, setSoundEnabled] = useState(true);

  const toggleSound = () => {
    const next = !soundEnabled;
    setSoundEnabled(next);
    soundManager.enabled = next;
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col selection:bg-rcac-sky selection:text-slate-950">
      {/* Top Header & Navigation */}
      <Header
        currentModule={currentModule}
        onSelectModule={setCurrentModule}
        soundEnabled={soundEnabled}
        onToggleSound={toggleSound}
      />

      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {currentModule === 'aerodynamics' && <AerodynamicsLab />}
        {currentModule === 'flight-controls' && <FlightControls3D />}
        {currentModule === 'instruments' && <SixPackCockpit />}
        {currentModule === 'circuit-radio' && <AirportCircuitLab />}
        {currentModule === 'weight-balance' && <WeightBalanceLab />}
        {currentModule === 'navigation-e6b' && <FlightComputerE6B />}
        {currentModule === 'flight-sim' && <FlightSimulator3D />}
        {currentModule === 'cadet-exam' && <CadetExamChallenge />}
      </main>

      {/* Canadian Air Cadet Educational Footer */}
      <footer className="bg-slate-900 border-t border-slate-800 py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row items-center justify-between gap-4 text-xs text-slate-400">
          <div className="flex items-center space-x-3 text-center md:text-left">
            <span className="text-xl">🍁</span>
            <div>
              <p className="font-semibold text-slate-300">
                AeroCadet STEM — Royal Canadian Air Cadets (RCAC) Interactive Aviation Ground School
              </p>
              <p className="text-slate-500">
                Ground school concepts aligned with <em>From the Ground Up</em>, Transport Canada TP 11919 (PSTAR), and the Air Cadet Gliding Program (ACGP).
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4 font-mono">
            <button
              onClick={() => setCurrentModule('cadet-exam')}
              className="hover:text-rcac-gold transition flex items-center gap-1"
            >
              <span>Wings Challenge</span>
            </button>
            <span>•</span>
            <button
              onClick={() => setCurrentModule('instruments')}
              className="hover:text-rcac-sky transition"
            >
              Six-Pack Trainer
            </button>
            <span>•</span>
            <button
              onClick={() => setCurrentModule('aerodynamics')}
              className="hover:text-rcac-sky transition"
            >
              Virtual Wind Tunnel
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;
