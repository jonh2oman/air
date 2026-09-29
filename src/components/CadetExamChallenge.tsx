import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { 
  Award, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  RotateCcw, 
  ArrowRight,
  Sparkles,
  BookOpen,
  Trophy,
  Compass
} from 'lucide-react';
import { Question } from '../types';
import { soundManager } from '../utils/audio';

export const CADET_QUESTIONS: Question[] = [
  {
    id: 1,
    category: 'Principles of Flight',
    question: 'According to Bernoulli’s Principle, what occurs as air accelerates over the cambered upper surface of an airfoil?',
    options: [
      'Velocity decreases and pressure increases',
      'Velocity increases and static pressure decreases, producing lift',
      'Both velocity and pressure remain unchanged',
      'Air temperature increases drastically, causing thermal expansion'
    ],
    correctIndex: 1,
    explanation: 'Bernoulli’s Principle states that in a fluid stream, an increase in velocity results in a simultaneous decrease in static pressure. The accelerated air over the curved upper surface creates lower pressure, generating upward lift.',
    refGuide: 'From the Ground Up, Chapter 2 (Theory of Flight)'
  },
  {
    id: 2,
    category: 'Principles of Flight',
    question: 'What is the definition of Angle of Attack (AoA)?',
    options: [
      'The angle between the aircraft longitudinal axis and the horizontal ground',
      'The angle between the wing chord line and the relative airflow',
      'The angle between the propeller spinner and the flight path',
      'The pitch angle shown on the Attitude Indicator'
    ],
    correctIndex: 1,
    explanation: 'Angle of Attack (AoA) is specifically the acute angle measured between the wing chord line (an imaginary straight line from the leading edge to trailing edge) and the oncoming relative airflow.',
    refGuide: 'RCAC Level 3 Aviation Syllabus & TC Flight Training Manual'
  },
  {
    id: 3,
    category: 'Principles of Flight',
    question: 'At what point does an aerodynamic stall occur on any fixed-wing aircraft?',
    options: [
      'Whenever the engine ceases producing thrust',
      'Whenever the indicated airspeed drops below 50 knots regardless of attitude',
      'Whenever the Critical Angle of Attack is exceeded, regardless of airspeed or pitch attitude',
      'Only when pulling into a vertical climb'
    ],
    correctIndex: 2,
    explanation: 'An aircraft can stall at ANY airspeed, ANY altitude, and ANY attitude if the pilot forces the wing to exceed its Critical Angle of Attack (typically ~16°), causing boundary layer flow separation.',
    refGuide: 'From the Ground Up, Chapter 2'
  },
  {
    id: 4,
    category: 'Airframes & Controls',
    question: 'When rolling into a turn to the left, which aileron deflects downward, and what secondary effect does this cause?',
    options: [
      'The left aileron goes down; creates positive yaw to the left',
      'The right aileron goes down; creates adverse yaw to the right due to induced drag',
      'Both ailerons move down simultaneously like flaps',
      'Neither aileron moves; roll is controlled solely by the rudder'
    ],
    correctIndex: 1,
    explanation: 'To bank left, the left aileron rises (reducing lift) and the right aileron drops (increasing lift and camber). The downward right aileron creates greater induced drag, yawing the nose opposite the turn (Adverse Yaw). Rudder is required to coordinate!',
    refGuide: 'From the Ground Up, Chapter 1 (Aircraft Controls)'
  },
  {
    id: 5,
    category: 'Airframes & Controls',
    question: 'On the Schweizer SGS 2-33A cadet training glider, what is the primary purpose of the dive spoilers / airbrakes?',
    options: [
      'To increase glider airspeed during thermal climbs',
      'To steepen the approach angle and increase descent rate without increasing forward airspeed',
      'To steer the glider on the runway like steering brakes',
      'To replace the elevator during landing flare'
    ],
    correctIndex: 1,
    explanation: 'Spoilers on the 2-33A glider destroy lift and drastically increase parasite drag. This allows the glider pilot to control glide path angle and land accurately on the runway without picking up dangerous excess airspeed.',
    refGuide: 'Air Cadet Gliding Program (ACGP) Flight Operating Instructions'
  },
  {
    id: 6,
    category: 'Flight Instruments',
    question: 'Which cockpit flight instruments are connected to the static pressure port?',
    options: [
      'Airspeed Indicator, Altimeter, and Vertical Speed Indicator (VSI)',
      'Heading Indicator and Attitude Indicator',
      'Turn Coordinator and Magnetic Compass',
      'Tachometer and Oil Temperature Gauge'
    ],
    correctIndex: 0,
    explanation: 'The static port supplies ambient atmospheric pressure to the three pitot-static instruments: the Altimeter, the Vertical Speed Indicator, and the Airspeed Indicator.',
    refGuide: 'From the Ground Up, Chapter 3 (Instruments)'
  },
  {
    id: 7,
    category: 'Flight Instruments',
    question: 'If you fly from an area of high barometric pressure into an area of low pressure without updating your altimeter subscale (Kollsman window), the altimeter will:',
    options: [
      'Read lower than your actual true altitude',
      'Read HIGHER than your actual true altitude ("High to Low, look out below!")',
      'Automatically recalibrate using GPS signals',
      'Freeze at zero feet'
    ],
    correctIndex: 1,
    explanation: 'The mnemonic is "From High to Low, look out below!" As ambient pressure drops, the aneroid wafers expand as if you had climbed to a higher altitude. Thus, the altimeter registers higher than your true altitude above ground.',
    refGuide: 'From the Ground Up, Chapter 3'
  },
  {
    id: 8,
    category: 'Flight Instruments',
    question: 'What does the miniature airplane on the Turn Coordinator indicate?',
    options: [
      'Rate of roll when first moved, then rate of turn once stabilised — never bank angle',
      'Direct pitch attitude relative to the natural horizon',
      'Angle of bank currently held in the turn',
      'True heading in degrees towards magnetic north'
    ],
    correctIndex: 0,
    explanation: 'The turn coordinator gyro is canted about 30°, so it senses both roll rate and yaw rate. It initially indicates rate of roll, then rate of turn once the turn is stabilised — it never indicates bank angle. When the miniature wing aligns with the index mark, it indicates a Standard Rate Turn (3° per second, 360° in 2 minutes).',
    refGuide: 'From the Ground Up, Chapter 3 (Instruments)'
  },
  {
    id: 9,
    category: 'Navigation & Weather',
    question: 'What is the danger of high Density Altitude during summer flight operations?',
    options: [
      'Engines produce more horsepower than the wings can handle',
      'Air is less dense: longer takeoff run required, reduced rate of climb, and higher true stall speed',
      'Altimeter aneroid capsules will burst from excess pressure',
      'Gliders can no longer glide in straight lines'
    ],
    correctIndex: 1,
    explanation: 'Hot temperatures and low atmospheric pressure create high density altitude (thin air). Propellers have less bite, engines ingest less oxygen, and wings require more airspeed to generate equivalent lift, severely penalizing takeoff and climb performance.',
    refGuide: 'From the Ground Up, Chapter 4 (Meteorology)'
  },
  {
    id: 10,
    category: 'Navigation & Weather',
    question: 'In a Canadian METAR, what does the code "FEW045 SCT220" signify?',
    options: [
      'Heavy fog with visibility less than 45 feet',
      '1 to 2 oktas cloud at 4,500 ft AGL, and 3 to 4 oktas cloud at 22,000 ft AGL',
      'Wind gusting 45 knots with 22 knots sustained',
      'Barometric pressure of 45.22 inches of mercury'
    ],
    correctIndex: 1,
    explanation: 'FEW represents 1-2 oktas (eighths) of cloud cover, and SCT represents 3-4 oktas. Heights are reported in hundreds of feet AGL: 045 = 4,500 ft AGL, 220 = 22,000 ft AGL.',
    refGuide: 'Transport Canada Aeronautical Information Manual (TC AIM) MET'
  }
];

export const CadetExamChallenge: React.FC = () => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [userAnswers, setUserAnswers] = useState<Array<{ qId: number; selected: number; isCorrect: boolean }>>([]);
  const [isFinished, setIsFinished] = useState(false);

  const currentQ = CADET_QUESTIONS[currentIndex];

  const handleSelect = (idx: number) => {
    if (isAnswered) return;
    setSelectedOption(idx);
  };

  const handleConfirmAnswer = () => {
    if (selectedOption === null || isAnswered) return;
    const isCorrect = selectedOption === currentQ.correctIndex;
    setIsAnswered(true);

    if (isCorrect) {
      setScore((prev) => prev + 1);
      soundManager.playSuccessChime();
    } else {
      soundManager.playClick();
    }

    setUserAnswers((prev) => [
      ...prev,
      { qId: currentQ.id, selected: selectedOption, isCorrect },
    ]);
  };

  const handleNext = () => {
    if (currentIndex + 1 < CADET_QUESTIONS.length) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedOption(null);
      setIsAnswered(false);
    } else {
      setIsFinished(true);
      // Trigger celebration confetti
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#002B49', '#5CB4E5', '#FFB81C', '#ffffff'],
      });
    }
  };

  const restartQuiz = () => {
    setCurrentIndex(0);
    setSelectedOption(null);
    setIsAnswered(false);
    setScore(0);
    setUserAnswers([]);
    setIsFinished(false);
    soundManager.playClick();
  };

  // Unofficial practice score — a 10-question web quiz, never implies any real qualification
  const getPracticeResult = (scoreVal: number) => {
    const pct = (scoreVal / CADET_QUESTIONS.length) * 100;
    if (pct === 100) return { title: `Practice score ${scoreVal}/10 — perfect study session!`, badge: '⭐ PERFECT SCORE', color: 'text-rcac-gold' };
    if (pct >= 80) return { title: `Practice score ${scoreVal}/10 — great study session!`, badge: '✅ STRONG REVIEW', color: 'text-rcac-sky' };
    if (pct >= 60) return { title: `Practice score ${scoreVal}/10 — good review session`, badge: '📘 GOOD REVIEW', color: 'text-emerald-400' };
    if (pct >= 40) return { title: `Practice score ${scoreVal}/10 — keep studying`, badge: '📝 KEEP STUDYING', color: 'text-blue-400' };
    return { title: `Practice score ${scoreVal}/10 — review the notes and retake`, badge: '🔰 MORE STUDY NEEDED', color: 'text-slate-400' };
  };

  const resultInfo = getPracticeResult(score);

  return (
    <div className="space-y-6">
      {/* Title Bar */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 flex flex-wrap items-center justify-between gap-4 backdrop-blur shadow-lg">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-rcac-blue/60 border border-rcac-sky/40 rounded-lg text-rcac-sky">
            <Trophy className="w-6 h-6 text-rcac-gold" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-wide">
              Module 6: RCAC Ground School Practice Exam
            </h2>
            <p className="text-sm text-slate-400">
              Unofficial practice questions — not affiliated with Transport Canada or RCAC
            </p>
          </div>
        </div>

        {/* Live score pill */}
        <div className="flex items-center gap-3">
          <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 font-mono text-xs">
            <span className="text-slate-400">SCORE: </span>
            <strong className="text-rcac-gold font-bold">{score}</strong> / {CADET_QUESTIONS.length}
          </div>
        </div>
      </div>

      {/* Main Quiz Area */}
      {!isFinished ? (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl space-y-6 max-w-4xl mx-auto">
          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between text-xs font-mono text-slate-400">
              <span>QUESTION {currentIndex + 1} OF {CADET_QUESTIONS.length}</span>
              <span className="text-rcac-sky font-semibold">{currentQ.category}</span>
            </div>
            <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
              <div
                className="bg-gradient-to-r from-rcac-sky to-rcac-gold h-full rounded-full transition-all duration-300"
                style={{ width: `${((currentIndex + 1) / CADET_QUESTIONS.length) * 100}%` }}
              />
            </div>
          </div>

          {/* Question Text */}
          <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-2">
            <span className="text-[11px] font-mono font-bold text-rcac-sky uppercase tracking-wider">
              {currentQ.category}
            </span>
            <h3 className="text-lg font-bold text-white leading-relaxed">
              {currentQ.question}
            </h3>
          </div>

          {/* Multiple Choice Options */}
          <div className="space-y-3">
            {currentQ.options.map((option, idx) => {
              let btnStyle = 'bg-slate-950 border-slate-800 hover:border-slate-700 text-slate-200';
              if (selectedOption === idx) {
                btnStyle = 'bg-rcac-blue/50 border-rcac-sky text-white shadow-lg';
              }
              if (isAnswered) {
                if (idx === currentQ.correctIndex) {
                  btnStyle = 'bg-emerald-950/60 border-emerald-500 text-emerald-200 font-semibold';
                } else if (selectedOption === idx) {
                  btnStyle = 'bg-rose-950/60 border-rose-500 text-rose-200';
                } else {
                  btnStyle = 'opacity-50 bg-slate-950 border-slate-800 text-slate-400';
                }
              }

              return (
                <button
                  key={idx}
                  onClick={() => handleSelect(idx)}
                  disabled={isAnswered}
                  className={`w-full p-4 rounded-xl border text-left text-sm transition flex items-center justify-between gap-4 ${btnStyle}`}
                >
                  <div className="flex items-center gap-3">
                    <span className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-xs font-mono font-bold flex-shrink-0">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{option}</span>
                  </div>

                  {isAnswered && idx === currentQ.correctIndex && (
                    <CheckCircle2 className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  )}
                  {isAnswered && selectedOption === idx && idx !== currentQ.correctIndex && (
                    <XCircle className="w-5 h-5 text-rose-400 flex-shrink-0" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Explanation Box (Revealed after answer) */}
          {isAnswered && (
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2 text-xs leading-relaxed animate-fadeIn">
              <div className="flex items-center justify-between">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <BookOpen className="w-4 h-4 text-rcac-sky" />
                  <span>Cadet Ground School Explanation:</span>
                </span>
                <span className="text-slate-500 font-mono text-[10px]">{currentQ.refGuide}</span>
              </div>
              <p className="text-slate-300">{currentQ.explanation}</p>
            </div>
          )}

          {/* Footer Action Buttons */}
          <div className="flex justify-between items-center pt-2">
            <span className="text-xs text-slate-500 font-mono">
              Transport Canada PSTAR pass mark: 90% (45/50)
            </span>

            {!isAnswered ? (
              <button
                onClick={handleConfirmAnswer}
                disabled={selectedOption === null}
                className="px-6 py-2.5 bg-rcac-sky hover:bg-sky-400 disabled:opacity-40 disabled:hover:bg-rcac-sky text-slate-950 font-bold rounded-xl text-sm transition shadow-lg flex items-center gap-2"
              >
                <span>Submit Answer</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <button
                onClick={handleNext}
                className="px-6 py-2.5 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold rounded-xl text-sm transition shadow-lg flex items-center gap-2"
              >
                <span>{currentIndex + 1 === CADET_QUESTIONS.length ? 'View Results' : 'Next Question'}</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      ) : (
        /* Results View */
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl text-center space-y-6 max-w-2xl mx-auto">
          <div className="p-4 bg-rcac-blue/50 border border-rcac-sky/40 rounded-full w-24 h-24 mx-auto flex items-center justify-center text-rcac-gold shadow-2xl">
            <Award className="w-12 h-12" />
          </div>

          <div className="space-y-2">
            <span className="text-xs font-mono uppercase tracking-widest text-slate-400">
              Exam Debrief & Results
            </span>
            <h3 className="text-2xl font-bold text-white">
              Cadet Ground School Completed!
            </h3>
            <div className="text-4xl font-black font-mono text-rcac-gold">
              {score} / {CADET_QUESTIONS.length} ({Math.round((score / CADET_QUESTIONS.length) * 100)}%)
            </div>
          </div>

          {/* Practice Score Badge */}
          <div className="p-5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
            <span className={`text-sm font-bold font-mono ${resultInfo.color} block`}>
              {resultInfo.badge}
            </span>
            <div className="text-lg font-bold text-white">
              {resultInfo.title}
            </div>
            <p className="text-xs text-slate-400">
              {score >= 8
                ? 'Great practice session! Remember, this is a 10-question review — not a real exam.'
                : 'Good effort! Review the flight notes, wind tunnel simulations, and instruments, then re-take the practice exam.'}
            </p>
          </div>

          {/* Disclaimer */}
          <p className="text-[11px] text-slate-500 leading-relaxed">
            Unofficial study aid only — not affiliated with Transport Canada or the Royal Canadian Air Cadets.
            This app confers no qualification, rank, wings, or selection credit.
          </p>

          <div className="pt-2">
            <button
              onClick={restartQuiz}
              className="px-6 py-3 bg-rcac-sky hover:bg-sky-400 text-slate-950 font-bold rounded-xl text-sm transition flex items-center gap-2 mx-auto shadow-lg"
            >
              <RotateCcw className="w-4 h-4" />
              <span>Retake Practice Exam</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
