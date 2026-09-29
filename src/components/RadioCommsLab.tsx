import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  Radio,
  Volume2,
  VolumeX,
  Play,
  Pause,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  HelpCircle,
  CloudSun,
  Flame,
  Award,
  BookOpen,
  Sparkles,
  ArrowRight,
  Headphones,
  Signal,
  RefreshCw,
  Sliders,
  Send,
  Check,
  X
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { soundManager } from '../utils/audio';

// ==========================================
// 1. DATA: PHONETIC ALPHABET & NUMBERS
// ==========================================
interface PhoneticItem {
  letter: string;
  word: string;
  pronunciation: string;
  morse: string;
  tip?: string;
}

const PHONETIC_ALPHABET: PhoneticItem[] = [
  { letter: 'A', word: 'Alpha', pronunciation: 'AL-FAH', morse: '· —' },
  { letter: 'B', word: 'Bravo', pronunciation: 'BRAH-VOH', morse: '— · · ·' },
  { letter: 'C', word: 'Charlie', pronunciation: 'CHAR-LEE', morse: '— · — ·' },
  { letter: 'D', word: 'Delta', pronunciation: 'DELL-TAH', morse: '— · ·' },
  { letter: 'E', word: 'Echo', pronunciation: 'EKK-OH', morse: '·' },
  { letter: 'F', word: 'Foxtrot', pronunciation: 'FOKS-TROT', morse: '· · — ·' },
  { letter: 'G', word: 'Golf', pronunciation: 'GOLF', morse: '— — ·' },
  { letter: 'H', word: 'Hotel', pronunciation: 'HOH-TELL', morse: '· · · ·' },
  { letter: 'I', word: 'India', pronunciation: 'IN-DEE-AH', morse: '· ·' },
  { letter: 'J', word: 'Juliet', pronunciation: 'JEW-LEE-ETT', morse: '· — — —' },
  { letter: 'K', word: 'Kilo', pronunciation: 'KEY-LOH', morse: '— · —' },
  { letter: 'L', word: 'Lima', pronunciation: 'LEE-MAH', morse: '· — · ·' },
  { letter: 'M', word: 'Mike', pronunciation: 'MIKE', morse: '— —' },
  { letter: 'N', word: 'November', pronunciation: 'NO-VEM-BER', morse: '— ·' },
  { letter: 'O', word: 'Oscar', pronunciation: 'OSS-CAH', morse: '— — —' },
  { letter: 'P', word: 'Papa', pronunciation: 'PAH-PAH', morse: '· — — ·' },
  { letter: 'Q', word: 'Quebec', pronunciation: 'KAY-BECK', morse: '— — · —' },
  { letter: 'R', word: 'Romeo', pronunciation: 'ROW-ME-OH', morse: '· — ·' },
  { letter: 'S', word: 'Sierra', pronunciation: 'SEE-AIR-RAH', morse: '· · ·' },
  { letter: 'T', word: 'Tango', pronunciation: 'TANG-GO', morse: '—' },
  { letter: 'U', word: 'Uniform', pronunciation: 'YOU-NEE-FORM', morse: '· · —' },
  { letter: 'V', word: 'Victor', pronunciation: 'VIK-TAH', morse: '· · · —' },
  { letter: 'W', word: 'Whiskey', pronunciation: 'WISS-KEY', morse: '· — —' },
  { letter: 'X', word: 'X-Ray', pronunciation: 'ECKS-RAY', morse: '— · · —' },
  { letter: 'Y', word: 'Yankee', pronunciation: 'YANG-KEY', morse: '— · — —' },
  { letter: 'Z', word: 'Zulu', pronunciation: 'ZOO-LOO', morse: '— — · ·' },
];

const PHONETIC_NUMBERS: { num: string; word: string; spoken: string; note: string }[] = [
  { num: '0', word: 'Zero', spoken: 'ZEE-RO', note: 'Standard zero' },
  { num: '1', word: 'One', spoken: 'WUN', note: 'Strong single syllable' },
  { num: '2', word: 'Two', spoken: 'TOO', note: 'Clear "oo" sound' },
  { num: '3', word: 'Three', spoken: 'TREE', note: 'No "th" to avoid confusion with "three" / "free"' },
  { num: '4', word: 'Four', spoken: 'FOW-ER', note: 'Two distinct syllables to avoid swallowing' },
  { num: '5', word: 'Five', spoken: 'FIFE', note: 'Ended with crisp "f" so it cannot be mistaken for "fire" or "nine"' },
  { num: '6', word: 'Six', spoken: 'SIX', note: 'Sharp consonant' },
  { num: '7', word: 'Seven', spoken: 'SEV-EN', note: 'Two distinct syllables' },
  { num: '8', word: 'Eight', spoken: 'AIT', note: 'Hard "t" ending' },
  { num: '9', word: 'Nine', spoken: 'NIN-ER', note: 'Two syllables to prevent confusion with German "nein" or "five"' },
];

// Presets for the Aviation Radio Stack
interface RadioPreset {
  name: string;
  callsign: string;
  freq: string;
  description: string;
  isAtis?: boolean;
}

const RADIO_PRESETS: RadioPreset[] = [
  { name: 'Gander ATIS', callsign: 'CYQX ATIS', freq: '128.45', description: 'Gander Intl Airport Live Weather & Runway Info', isAtis: true },
  { name: 'Gander Tower', callsign: 'Gander Tower', freq: '118.10', description: 'Gander Control Tower (Runway 03/21 & 13/31)' },
  { name: 'Gander Ground', callsign: 'Gander Ground', freq: '121.90', description: 'Apron & Taxiway Control at CYQX' },
  { name: 'Gander Terminal', callsign: 'Gander Terminal', freq: '119.70', description: 'Terminal Radar Control & Arrivals' },
  { name: 'Gander Radio (FSS)', callsign: 'Gander Radio', freq: '122.50', description: 'Flight Service Station & Weather Enroute' },
  { name: 'Enroute Common', callsign: 'Enroute FSS', freq: '126.70', description: 'Standard Canadian Enroute Broadcast Frequency' },
  { name: 'Cadet Gliding Ops', callsign: 'Cadet Gliding', freq: '123.40', description: 'Air Cadet Gliding Program (ACGP) Local Aerodrome Ops' },
  { name: 'Unicom / ATF', callsign: 'Traffic', freq: '122.80', description: 'Uncontrolled Aerodrome Common Frequency' },
  { name: 'Emergency Guard', callsign: 'VHF Guard', freq: '121.50', description: 'International Aeronautical Distress / Mayday' },
];

// ATC Game Scenarios
interface ATCScenario {
  id: number;
  title: string;
  location: string;
  atcCall: string;
  context: string;
  options: { text: string; correct: boolean; feedback: string }[];
  cadetAircraft: string;
}

const ATC_SCENARIOS: ATCScenario[] = [
  {
    id: 1,
    title: 'Gander Ground Taxi Request',
    location: 'Gander Intl (CYQX) — General Aviation Apron',
    cadetAircraft: 'Cessna 172 C-GABC',
    context: 'You have listened to Gander ATIS Information BRAVO. You are parked on the apron ready to taxi for Runway 21.',
    atcCall: '"Gander Ground, say intentions for Cessna Golf Alpha Bravo Charlie."',
    options: [
      {
        text: '"Gander Ground, Cessna Golf Alpha Bravo Charlie, at the flying club with Information Bravo, request taxi for Runway 21, VFR east."',
        correct: true,
        feedback: '🌟 Textbook Transport Canada transmission! States station called, aircraft type & callsign, position, current ATIS code, and request with intentions.'
      },
      {
        text: '"Hey ground, GABC wants to taxi over to runway 21 with Bravo."',
        correct: false,
        feedback: '❌ Incorrect. Non-standard slang, truncated callsign without phonetic alphabet, and missing aircraft type.'
      },
      {
        text: '"Gander Ground, Cessna GABC, request clearance to take off runway 21."',
        correct: false,
        feedback: '❌ Ground controllers do not issue takeoff clearances, only taxi instructions. You must also spell GABC phonetically and state ATIS code.'
      },
      {
        text: '"Cessna Golf Alpha Bravo Charlie taxiing to runway 21 now, thank you."',
        correct: false,
        feedback: '❌ You cannot taxi on a controlled airport without explicit clearance from ground control first!'
      }
    ]
  },
  {
    id: 2,
    title: 'Runway Hold Short Clearance',
    location: 'CYQX Taxiway Delta holding short of Runway 21',
    cadetAircraft: 'Cessna 172 C-GABC',
    context: 'You are taxiing toward Runway 21. Ground control transmits an instruction regarding Runway 21.',
    atcCall: '"Cessna Golf Alpha Bravo Charlie, Gander Ground, taxi via Delta, hold short of Runway 21."',
    options: [
      {
        text: '"Hold short of Runway 21 via Delta, Cessna Golf Alpha Bravo Charlie."',
        correct: true,
        feedback: '🌟 Mandatory readback! In Canada and ICAO, holding short instructions for any runway MUST be read back verbatim with runway designation and callsign.'
      },
      {
        text: '"Roger, will do, Charlie."',
        correct: false,
        feedback: '❌ Never use "Roger" for runway hold short clearances. Safety-critical hold short instructions demand a full verbatim readback.'
      },
      {
        text: '"Taxiing across Runway 21 on Delta, Golf Alpha Bravo Charlie."',
        correct: false,
        feedback: '❌ DANGER: ATC instructed you to HOLD SHORT, not cross! Crossing without clearance causes a runway incursion.'
      },
      {
        text: '"Cessna Golf Alpha Bravo Charlie, 10-4."',
        correct: false,
        feedback: '❌ Police 10-codes (like 10-4) are strictly prohibited in aviation radio communications.'
      }
    ]
  },
  {
    id: 3,
    title: 'Transponder Squawk & Altimeter',
    location: 'CYQX Tower Control Zone',
    cadetAircraft: 'Cessna 172 C-GABC',
    context: 'Approaching the control zone boundary, Gander Tower assigns your transponder code and altimeter setting.',
    atcCall: '"Cessna Golf Alpha Bravo Charlie, Gander Tower, squawk 4 2 1 5, altimeter 3 0 0 9."',
    options: [
      {
        text: '"Squawk fow-er too wun fife, altimeter tree zee-ro zee-ro nin-er, Cessna Golf Alpha Bravo Charlie."',
        correct: true,
        feedback: '🌟 Excellent! All digits spoken phonetically (fow-er, fife, tree, zee-ro, nin-er), reading back both squawk code and barometric pressure.'
      },
      {
        text: '"Squawk forty-two fifteen, altimeter thirty point zero nine, GABC."',
        correct: false,
        feedback: '❌ Grouping digits into tens or hundreds ("forty-two fifteen") is prohibited. Numbers must be recited individually.'
      },
      {
        text: '"Copy numbers, Golf Alpha Bravo Charlie."',
        correct: false,
        feedback: '❌ Altimeter and squawk codes require explicit readback so the controller can confirm your instruments are calibrated correctly.'
      },
      {
        text: '"Squawk 4 2 1 5, altimeter 30.09, over and out."',
        correct: false,
        feedback: '❌ "Over and out" is a Hollywood contradiction. "Over" means expecting reply; "Out" means conversation terminated. Never say both together.'
      }
    ]
  },
  {
    id: 4,
    title: 'Cadet Glider Tow Release & Circuit Entry',
    location: 'Air Cadet Gliding Field — ATF 123.40 MHz',
    cadetAircraft: 'Schweizer 2-33A Glider C-FPAA (Glider 71)',
    context: 'You are on aerotow at 2,000 ft AGL over the airfield. You have confirmed cable release and are entering left downwind for Runway 27.',
    atcCall: '"Towplane 1 released. Glider 71, announce your position on traffic frequency."',
    options: [
      {
        text: '"Cadet Traffic, Glider sev-en wun off tow at too tou-sand, entering left downwind Runway too sev-en, Cadet Traffic."',
        correct: true,
        feedback: '🌟 Standard Canadian uncontrolled aerodrome broadcast format! [Station] + [Callsign] + [Position & Altitude] + [Intentions] + [Station].'
      },
      {
        text: '"Hey anyone around, Glider 71 is coming in to land."',
        correct: false,
        feedback: '❌ Lacks structure, runway designation, pattern leg, and proper phonetics.'
      },
      {
        text: '"Tower, Glider Papa Alpha Alpha cleared to land runway 27."',
        correct: false,
        feedback: '❌ You are at an uncontrolled gliding site with traffic advisory, not a control tower. You cannot clear yourself to land.'
      },
      {
        text: '"Glider 71 downwind."',
        correct: false,
        feedback: '❌ Too abbreviated. Must identify aerodrome traffic at start and finish, altitude, and runway number.'
      }
    ]
  },
  {
    id: 5,
    title: 'Takeoff Clearance at Gander Tower',
    location: 'Gander Runway 21 Threshold',
    cadetAircraft: 'Cessna 172 C-GABC',
    context: 'Holding short Runway 21 at Taxiway Delta. Gander Tower clears you for departure.',
    atcCall: '"Cessna Golf Alpha Bravo Charlie, wind too tree zee-ro at ait, Runway too wun, cleared for takeoff."',
    options: [
      {
        text: '"Cleared for takeoff Runway too wun, Cessna Golf Alpha Bravo Charlie."',
        correct: true,
        feedback: '🌟 Perfect! A takeoff clearance must be read back immediately with the exact runway designation and aircraft callsign.'
      },
      {
        text: '"Rolling now, see you later, GABC."',
        correct: false,
        feedback: '❌ Non-standard, missing runway readback, and truncated callsign.'
      },
      {
        text: '"Wind 230 at 8, cleared for takeoff, Charlie."',
        correct: false,
        feedback: '❌ You must read back the RUNWAY NUMBER ("Runway too wun"), not just the wind.'
      },
      {
        text: '"Taking off, Golf Alpha Bravo Charlie."',
        correct: false,
        feedback: '❌ The words "takeoff" should only be used in verbatim response to an actual clearance with runway designation.'
      }
    ]
  }
];

export const RadioCommsLab: React.FC = () => {
  // Navigation Tabs within Radio Comms
  const [activeTab, setActiveTab] = useState<'phonetics' | 'radio-stack' | 'game'>('phonetics');

  // Phonetics Lesson State
  const [selectedLetter, setSelectedLetter] = useState<PhoneticItem>(PHONETIC_ALPHABET[0]);
  const [customSpellerText, setCustomSpellerText] = useState<string>('AIR CADET');
  const [isPlayingSpeller, setIsPlayingSpeller] = useState<boolean>(false);

  // Radio Stack State
  const [comm1Active, setComm1Active] = useState<string>('128.45'); // Default to Gander ATIS
  const [comm1Standby, setComm1Standby] = useState<string>('118.10'); // Default to Gander Tower
  const [comm2Active, setComm2Active] = useState<string>('121.90'); // Gander Ground
  const [comm2Standby, setComm2Standby] = useState<string>('121.50'); // Guard
  const [isPttPressed, setIsPttPressed] = useState<boolean>(false);
  const [isMonitoringAtis, setIsMonitoringAtis] = useState<boolean>(false);

  // Real-time CYQX ATIS State
  const [atisData, setAtisData] = useState<{
    code: string;
    zuluTime: string;
    windStr: string;
    visStr: string;
    skyStr: string;
    tempDewpStr: string;
    altimeterStr: string;
    runwayStr: string;
    rawMetar: string;
    fullSpeech: string;
    isLoading: boolean;
    lastUpdated: string;
  }>({
    code: 'BRAVO',
    zuluTime: '1600Z',
    windStr: 'Wind 230° at 8 knots',
    visStr: 'Visibility 20 statute miles',
    skyStr: 'Few clouds at 1,500 ft, broken at 15,000 ft',
    tempDewpStr: 'Temperature 13°C, dewpoint 6°C',
    altimeterStr: 'Altimeter 30.09 inHg (1019 hPa)',
    runwayStr: 'Active Runways 21 and 27 in use. VFR circuits right-hand Runway 21.',
    rawMetar: 'METAR CYQX 291600Z 23008KT 20SM FEW015 BKN150 BKN240 13/06 A3009 RMK CF1AC5CC2',
    fullSpeech:
      'Gander International Airport Information BRAVO recorded at 1600 Zulu. Wind too tree zee-ro at ait knots. Visibility too zee-ro statute miles. Few clouds at wun tou-sand fife hun-dred, broken at wun fife tou-sand. Temperature wun tree, dewpoint six. Altimeter tree zee-ro zee-ro nin-er. Active runways too wun and too sev-en. VFR traffic advise controller on initial contact you have information BRAVO.',
    isLoading: false,
    lastUpdated: 'Live from NOAA'
  });

  // ATC Game State
  const [currentScenarioIdx, setCurrentScenarioIdx] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [scenarioAnswered, setScenarioAnswered] = useState<boolean>(false);
  const [gameScore, setGameScore] = useState<number>(0);
  const [gameStreak, setGameStreak] = useState<number>(0);
  const [totalAttempted, setTotalAttempted] = useState<number>(0);
  const [hasCompletedAll, setHasCompletedAll] = useState<boolean>(false);

  // Fetch Live NOAA METAR for Gander (CYQX)
  const fetchLiveCYQXAtis = async () => {
    setAtisData((prev) => ({ ...prev, isLoading: true }));
    try {
      const res = await fetch('https://aviationweather.gov/api/data/metar?ids=CYQX&format=json');
      if (!res.ok) throw new Error('Network error');
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const ob = data[0];
        const raw = ob.rawOb || 'METAR CYQX';
        const windDir = ob.wdir !== undefined ? String(ob.wdir).padStart(3, '0') : '230';
        const windSpd = ob.wspd !== undefined ? ob.wspd : 8;
        const vis = ob.visib !== undefined ? ob.visib : 20;
        const temp = ob.temp !== undefined ? ob.temp : 13;
        const dewp = ob.dewp !== undefined ? ob.dewp : 6;
        const altimInHg = ob.altim ? (ob.altim * 0.02953).toFixed(2) : '30.09';
        const now = new Date();
        const zuluHour = String(now.getUTCHours()).padStart(2, '0');
        const zuluMin = String(now.getUTCMinutes()).padStart(2, '0');

        // Letter rotates based on UTC hour
        const letterCodes = ['ALPHA', 'BRAVO', 'CHARLIE', 'DELTA', 'ECHO', 'FOXTROT', 'GOLF', 'HOTEL', 'INDIA', 'JULIET', 'KILO', 'LIMA'];
        const atisLetter = letterCodes[now.getUTCHours() % letterCodes.length];

        const speech = `Gander International Airport Information ${atisLetter} recorded at ${zuluHour}${zuluMin} Zulu. Wind ${windDir} at ${windSpd} knots. Visibility ${vis} statute miles. Temperature ${temp}, dewpoint ${dewp}. Altimeter ${altimInHg.replace('.', ' day-see-mal ')}. Arriving and departing Runway 21 and Runway 27. Advise controller on initial contact you have information ${atisLetter}.`;

        setAtisData({
          code: atisLetter,
          zuluTime: `${zuluHour}${zuluMin}Z`,
          windStr: `Wind ${windDir}° at ${windSpd} knots`,
          visStr: `Visibility ${vis} statute miles`,
          skyStr: ob.cover ? `Sky condition: ${ob.cover}` : 'Few clouds at 1,500 ft, broken at 15,000 ft',
          tempDewpStr: `Temperature ${temp}°C, dewpoint ${dewp}°C`,
          altimeterStr: `Altimeter ${altimInHg} inHg (${ob.altim || 1019} hPa)`,
          runwayStr: 'Active Runways 21 and 27 in use. VFR circuits right-hand Runway 21.',
          rawMetar: raw,
          fullSpeech: speech,
          isLoading: false,
          lastUpdated: `Live at ${now.toLocaleTimeString()}`
        });
      }
    } catch {
      // Fallback to high-accuracy offline simulator METAR
      setAtisData((prev) => ({
        ...prev,
        isLoading: false,
        lastUpdated: 'Simulated Canadian Weather (Offline)'
      }));
    }
  };

  useEffect(() => {
    fetchLiveCYQXAtis();
  }, []);

  // Keyboard Spacebar PTT support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && activeTab === 'radio-stack' && !isPttPressed) {
        if (document.activeElement?.tagName === 'INPUT') return;
        e.preventDefault();
        triggerPttDown();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && activeTab === 'radio-stack' && isPttPressed) {
        e.preventDefault();
        triggerPttUp();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [isPttPressed, activeTab]);

  // Audio helpers
  const triggerPttDown = () => {
    setIsPttPressed(true);
    soundManager.playPttDown();
  };

  const triggerPttUp = () => {
    setIsPttPressed(false);
    soundManager.playPttUp();
  };

  // Play Morse code sequence
  const playMorse = (code: string) => {
    let delay = 0;
    const dit = 0.08;
    const dah = dit * 3;
    const intra = dit;

    for (const char of code) {
      if (char === '·') {
        setTimeout(() => soundManager.playMorseTone(750, dit), delay * 1000);
        delay += dit + intra;
      } else if (char === '—') {
        setTimeout(() => soundManager.playMorseTone(750, dah), delay * 1000);
        delay += dah + intra;
      } else if (char === ' ') {
        delay += dit * 2;
      }
    }
  };

  // Convert string to phonetic words array
  const textToPhonetic = (input: string): { original: string; phonetic: string; spoken: string }[] => {
    return input
      .toUpperCase()
      .split('')
      .map((ch) => {
        const foundLetter = PHONETIC_ALPHABET.find((p) => p.letter === ch);
        if (foundLetter) return { original: ch, phonetic: foundLetter.word, spoken: foundLetter.pronunciation };
        const foundNum = PHONETIC_NUMBERS.find((n) => n.num === ch);
        if (foundNum) return { original: ch, phonetic: foundNum.word, spoken: foundNum.spoken };
        if (ch === ' ') return { original: ' ', phonetic: '— [SPACE] —', spoken: '' };
        if (ch === '-') return { original: '-', phonetic: '— [DASH] —', spoken: '' };
        if (ch === '.') return { original: '.', phonetic: 'Decimal', spoken: 'DAY-SEE-MAL' };
        return { original: ch, phonetic: ch, spoken: ch };
      });
  };

  // Recite phonetic speller aloud
  const handleReciteSpeller = () => {
    if (isPlayingSpeller) {
      soundManager.stopSpeaking();
      setIsPlayingSpeller(false);
      return;
    }

    const items = textToPhonetic(customSpellerText);
    const spokenPhrase = items
      .filter((i) => i.spoken)
      .map((i) => i.phonetic)
      .join(', ');

    setIsPlayingSpeller(true);
    soundManager.playRadioClick();
    soundManager.speak(spokenPhrase, () => {
      setIsPlayingSpeller(false);
      soundManager.playPttUp();
    });
  };

  // Toggle Gander ATIS broadcast audio
  const handleToggleAtisBroadcast = () => {
    if (isMonitoringAtis) {
      soundManager.stopSpeaking();
      setIsMonitoringAtis(false);
    } else {
      setIsMonitoringAtis(true);
      soundManager.playRadioClick();
      soundManager.speak(atisData.fullSpeech, () => {
        setIsMonitoringAtis(false);
        soundManager.playRadioClick();
      });
    }
  };

  // Frequency Swap (Flip-Flop)
  const handleSwapComm1 = () => {
    soundManager.playRadioClick();
    const temp = comm1Active;
    setComm1Active(comm1Standby);
    setComm1Standby(temp);
    if (isMonitoringAtis) {
      soundManager.stopSpeaking();
      setIsMonitoringAtis(false);
    }
  };

  // Select Preset Channel
  const handleSelectPreset = (preset: RadioPreset) => {
    soundManager.playRadioClick();
    setComm1Standby(preset.freq);
  };

  // Game Option Selected
  const handleSelectOption = (idx: number) => {
    if (scenarioAnswered) return;
    setSelectedOption(idx);
    setScenarioAnswered(true);
    setTotalAttempted((prev) => prev + 1);

    const isCorrect = ATC_SCENARIOS[currentScenarioIdx].options[idx].correct;
    if (isCorrect) {
      soundManager.playSuccessChime();
      setGameScore((prev) => prev + 100);
      setGameStreak((prev) => prev + 1);
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.6 }
      });
    } else {
      soundManager.playBuzzer();
      setGameStreak(0);
    }
  };

  const handleNextScenario = () => {
    if (currentScenarioIdx < ATC_SCENARIOS.length - 1) {
      setCurrentScenarioIdx((prev) => prev + 1);
      setSelectedOption(null);
      setScenarioAnswered(false);
    } else {
      setHasCompletedAll(true);
      confetti({
        particleCount: 150,
        spread: 100,
        origin: { y: 0.5 }
      });
    }
  };

  const handleResetGame = () => {
    setCurrentScenarioIdx(0);
    setSelectedOption(null);
    setScenarioAnswered(false);
    setGameScore(0);
    setGameStreak(0);
    setTotalAttempted(0);
    setHasCompletedAll(false);
  };

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* TOP BANNER: RCAC LEVEL 1 EO M129.01 */}
      {/* ======================================================== */}
      <div className="bg-gradient-to-r from-slate-900 via-rcac-blue to-slate-900 border border-rcac-sky/30 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-80 h-80 bg-rcac-sky/10 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-rcac-gold text-slate-950 uppercase tracking-wider">
                RCAC Aviation Training • Level 1
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-semibold bg-slate-800 text-rcac-sky border border-slate-700">
                EO M129.01
              </span>
            </div>
            <h2 className="text-2xl font-bold text-white tracking-wide flex items-center gap-2 font-heading">
              <span>RADIO COMMUNICATIONS & PHONETICS</span>
            </h2>
            <p className="text-xs sm:text-sm text-slate-300 max-w-3xl">
              Learn the standard NATO/ICAO phonetic alphabet and numbers, operate an authentic VHF aviation radio stack, monitor live Gander (CYQX) ATIS, and master Canadian Air Traffic Control phraseology.
            </p>
          </div>

          {/* Module Sub-Tabs Navigation */}
          <div className="flex items-center gap-1.5 bg-slate-950/90 p-1.5 rounded-xl border border-slate-700/80 shrink-0 shadow-lg">
            <button
              onClick={() => {
                setActiveTab('phonetics');
                soundManager.playClick();
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'phonetics'
                  ? 'bg-rcac-sky text-slate-950 font-bold shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>Phonetics & Numbers</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('radio-stack');
                soundManager.playClick();
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'radio-stack'
                  ? 'bg-rcac-sky text-slate-950 font-bold shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Radio className="w-3.5 h-3.5" />
              <span>Radio Stack & ATIS</span>
            </button>

            <button
              onClick={() => {
                setActiveTab('game');
                soundManager.playClick();
              }}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all ${
                activeTab === 'game'
                  ? 'bg-rcac-sky text-slate-950 font-bold shadow-md'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/80'
              }`}
            >
              <Award className="w-3.5 h-3.5 text-rcac-gold" />
              <span>ATC Comms Game</span>
            </button>
          </div>
        </div>
      </div>

      {/* ======================================================== */}
      {/* TAB 1: PHONETICS & NUMBERS GROUND SCHOOL */}
      {/* ======================================================== */}
      {activeTab === 'phonetics' && (
        <div className="space-y-6">
          {/* Theory Explainer Banner */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1.5 shadow-lg">
              <div className="flex items-center gap-2 text-rcac-sky text-xs font-mono font-bold uppercase">
                <HelpCircle className="w-4 h-4" />
                <span>WHAT IS IT?</span>
              </div>
              <p className="text-xs text-slate-300">
                A globally standardized phonetic code word assigned to each letter (A–Z) and number (0–9) adopted by ICAO, NATO, Transport Canada, and the Canadian Armed Forces.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1.5 shadow-lg">
              <div className="flex items-center gap-2 text-rcac-gold text-xs font-mono font-bold uppercase">
                <Signal className="w-4 h-4" />
                <span>WHY DO WE USE IT?</span>
              </div>
              <p className="text-xs text-slate-300">
                To prevent dangerous confusion between letters and numbers that sound alike (such as <strong>B, C, D, E, G, P, T, V, Z</strong> or <strong>M and N</strong>) over static-filled VHF aviation frequencies.
              </p>
            </div>

            <div className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-1.5 shadow-lg">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-mono font-bold uppercase">
                <Headphones className="w-4 h-4" />
                <span>WHERE IS IT USED?</span>
              </div>
              <p className="text-xs text-slate-300">
                During familiarization flights, Air Cadet gliding operations, air-to-ground communications, flight plans, search and rescue, and navigational position reports.
              </p>
            </div>
          </div>

          {/* Interactive Phonetic Alphabet 26 Letters */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-rcac-sky" />
                  <span>The 26 Phonetic Alphabet Code Words</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Click any letter card to hear the official aviation transmission and Morse code tone.
                </p>
              </div>

              <div className="hidden sm:flex items-center gap-2 text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                <span>Selected:</span>
                <span className="text-rcac-gold font-bold">
                  {selectedLetter.letter} — {selectedLetter.word} ({selectedLetter.pronunciation})
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-9 gap-2">
              {PHONETIC_ALPHABET.map((item) => {
                const isSelected = selectedLetter.letter === item.letter;
                return (
                  <button
                    key={item.letter}
                    onClick={() => {
                      setSelectedLetter(item);
                      soundManager.playRadioClick();
                      soundManager.speak(item.word);
                    }}
                    className={`p-2.5 rounded-xl border flex flex-col items-center justify-center gap-1 transition-all select-none group text-left ${
                      isSelected
                        ? 'bg-rcac-sky text-slate-950 border-white shadow-lg shadow-sky-500/20 font-bold scale-105 z-10'
                        : 'bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 border-slate-700/80 hover:border-rcac-sky/70'
                    }`}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-lg font-black font-mono leading-none">{item.letter}</span>
                      <Volume2 className={`w-3.5 h-3.5 transition-transform group-hover:scale-110 ${isSelected ? 'text-slate-950' : 'text-rcac-sky'}`} />
                    </div>
                    <span className="text-xs font-bold truncate w-full">{item.word}</span>
                    <span className={`text-[10px] font-mono leading-none ${isSelected ? 'text-slate-900' : 'text-slate-400'}`}>
                      {item.pronunciation}
                    </span>
                    <span className={`text-[9px] font-mono opacity-75 mt-0.5 ${isSelected ? 'text-slate-950' : 'text-slate-400'}`}>
                      {item.morse}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Selected Card Deep Dive */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rcac-sky to-blue-700 text-slate-950 flex items-center justify-center font-black text-3xl font-mono shadow-lg">
                  {selectedLetter.letter}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-lg font-black text-white">{selectedLetter.word}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-rcac-gold">
                      Pronounced: {selectedLetter.pronunciation}
                    </span>
                  </div>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">
                    International Morse Code: <strong className="text-white tracking-widest">{selectedLetter.morse}</strong>
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    soundManager.playRadioClick();
                    soundManager.speak(selectedLetter.word);
                  }}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition shadow"
                >
                  <Volume2 className="w-3.5 h-3.5 text-rcac-sky" />
                  <span>Speak Word</span>
                </button>

                <button
                  onClick={() => playMorse(selectedLetter.morse)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold border border-slate-700 transition shadow"
                >
                  <Radio className="w-3.5 h-3.5 text-rcac-gold" />
                  <span>Play Morse Tone</span>
                </button>
              </div>
            </div>
          </div>

          {/* Phonetic Numbers Section */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-rcac-gold" />
                <span>The 10 Aviation Phonetic Numbers (0–9) & Rules</span>
              </h3>
              <p className="text-xs text-slate-400">
                Certain numbers are modified with extra syllables or altered consonants to be clearly understood over cockpit noise.
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {PHONETIC_NUMBERS.map((n) => (
                <div
                  key={n.num}
                  className="bg-slate-950 border border-slate-800 p-3 rounded-xl space-y-1 relative group hover:border-slate-700 transition"
                >
                  <div className="flex items-center justify-between">
                    <span className="w-7 h-7 rounded-lg bg-slate-900 text-rcac-gold border border-slate-800 font-mono font-bold flex items-center justify-center text-sm">
                      {n.num}
                    </span>
                    <button
                      onClick={() => {
                        soundManager.playRadioClick();
                        soundManager.speak(n.spoken);
                      }}
                      className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition"
                      title="Speak number"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                  <div className="font-bold text-sm text-white">{n.word}</div>
                  <div className="text-xs font-mono text-rcac-sky font-semibold">{n.spoken}</div>
                  <p className="text-[10px] text-slate-400 leading-tight pt-1 border-t border-slate-800/80">
                    {n.note}
                  </p>
                </div>
              ))}
            </div>

            {/* Aviation Number Transmission Rules Banner */}
            <div className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-2 text-xs">
              <h4 className="font-bold text-rcac-gold uppercase tracking-wider text-[11px] font-mono flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Transport Canada Rules for Transmitting Numbers:</span>
              </h4>
              <ul className="grid grid-cols-1 md:grid-cols-2 gap-2 text-slate-300">
                <li className="flex items-start gap-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-rcac-sky font-bold">•</span>
                  <div>
                    <strong className="text-white">Individual Digits:</strong> Numbers are always spoken as single digits. Heading 270 is spoken <em>"heading too sev-en zee-ro"</em> (never "two seventy").
                  </div>
                </li>
                <li className="flex items-start gap-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-rcac-sky font-bold">•</span>
                  <div>
                    <strong className="text-white">Whole Thousands:</strong> Whole thousands are pronounced with the word "TOU-SAND". 5,000 ft is <em>"fife tou-sand"</em>; 12,000 ft is <em>"wun too tou-sand"</em>.
                  </div>
                </li>
                <li className="flex items-start gap-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-rcac-sky font-bold">•</span>
                  <div>
                    <strong className="text-white">Mixed Thousands & Hundreds:</strong> Pronounced digit by digit. 5,280 ft is spoken <em>"fife too ait zee-ro"</em>.
                  </div>
                </li>
                <li className="flex items-start gap-2 bg-slate-900/60 p-2.5 rounded-lg border border-slate-800">
                  <span className="text-rcac-sky font-bold">•</span>
                  <div>
                    <strong className="text-white">Frequencies & Decimals:</strong> The decimal point is always pronounced <em>"DAY-SEE-MAL"</em>. 121.90 is <em>"wun too wun day-see-mal nin-er zee-ro"</em>.
                  </div>
                </li>
              </ul>
            </div>
          </div>

          {/* Interactive Cadet Name & Call-Sign Speller (Game 1 from Lesson Plan) */}
          <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-rcac-gold" />
                  <span>Cadet Name & Aircraft Callsign Converter</span>
                </h3>
                <p className="text-xs text-slate-400">
                  Lesson Plan Game One activity: Type your name, squadron callsign, or aircraft registration to see and hear it converted phonetically.
                </p>
              </div>

              {/* Sample quick buttons */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] font-mono text-slate-400">Samples:</span>
                {['C-GABC', 'CF-PAA', '515 SQUADRON', 'GANDER TOWER'].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setCustomSpellerText(s);
                      soundManager.playClick();
                    }}
                    className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-mono text-rcac-sky border border-slate-700 transition"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            {/* Input & Convert Bar */}
            <div className="flex flex-col sm:flex-row gap-3">
              <input
                type="text"
                value={customSpellerText}
                onChange={(e) => setCustomSpellerText(e.target.value.toUpperCase())}
                placeholder="TYPE NAME OR CALLSIGN (E.G. C-GABC)"
                maxLength={24}
                className="flex-1 bg-slate-950 border-2 border-slate-700 focus:border-rcac-sky rounded-xl px-4 py-2.5 text-white font-mono font-bold tracking-widest text-base uppercase focus:outline-none shadow-inner"
              />

              <button
                onClick={handleReciteSpeller}
                className={`flex items-center justify-center gap-2 px-6 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all shadow-lg active:translate-y-0.5 ${
                  isPlayingSpeller
                    ? 'bg-rose-600 text-white animate-pulse'
                    : 'bg-rcac-sky hover:bg-sky-400 text-slate-950'
                }`}
              >
                {isPlayingSpeller ? (
                  <>
                    <Pause className="w-4 h-4" />
                    <span>Stop Radio</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-4 h-4" />
                    <span>Recite Phonetically</span>
                  </>
                )}
              </button>
            </div>

            {/* Phonetic Output Badges */}
            <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 min-h-[90px] flex flex-wrap items-center gap-2">
              {textToPhonetic(customSpellerText).map((item, idx) => {
                if (item.original === ' ') {
                  return (
                    <div key={idx} className="w-4 h-8 flex items-center justify-center text-slate-600">
                      •
                    </div>
                  );
                }
                return (
                  <div
                    key={idx}
                    className="flex flex-col items-center bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg shadow-sm group hover:border-rcac-sky transition"
                  >
                    <span className="text-sm font-black font-mono text-rcac-gold">{item.original}</span>
                    <span className="text-xs font-bold text-white">{item.phonetic}</span>
                    {item.spoken && (
                      <span className="text-[9px] font-mono text-slate-400 leading-none mt-0.5">
                        {item.spoken}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 2: AVIONICS RADIO STACK & LIVE GANDER ATIS */}
      {/* ======================================================== */}
      {activeTab === 'radio-stack' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* LEFT: Authentic Cockpit Avionics Radio Stack */}
          <div className="lg:col-span-7 space-y-4">
            <div className="bg-slate-900/95 border-2 border-slate-800 rounded-2xl p-5 shadow-2xl space-y-5">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse shadow-md" />
                  <h3 className="font-heading text-lg font-bold text-white tracking-wider">
                    VHF AVIONICS RADIO STACK
                  </h3>
                </div>
                <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-slate-400">
                  BENDIX/KING KX-155A STYLE
                </span>
              </div>

              {/* COMM 1 TRANSCEIVER CHASSIS */}
              <div className="bg-gradient-to-b from-slate-950 to-slate-900 border-2 border-slate-700 rounded-xl p-4 shadow-2xl relative">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 uppercase tracking-wider mb-2">
                  <span className="font-bold text-rcac-sky flex items-center gap-1.5">
                    <Radio className="w-3 h-3" />
                    <span>COMM 1 VHF TRANSCEIVER</span>
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${isPttPressed ? 'bg-rose-500 shadow-lg shadow-rose-500/50 animate-ping' : 'bg-slate-800'}`} />
                      <span className={isPttPressed ? 'text-rose-400 font-bold' : 'text-slate-500'}>TX</span>
                    </span>
                    <span className="flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${isMonitoringAtis ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50' : 'bg-slate-800'}`} />
                      <span className={isMonitoringAtis ? 'text-emerald-400 font-bold' : 'text-slate-500'}>RX</span>
                    </span>
                  </div>
                </div>

                {/* Digital LED 7-Segment Dual Freq Displays */}
                <div className="grid grid-cols-2 gap-3 bg-black/90 p-3 rounded-lg border-2 border-slate-800 shadow-inner font-mono">
                  {/* Active Frequency */}
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-amber-500/70 font-bold tracking-widest uppercase">ACTIVE</span>
                    <div className="text-3xl sm:text-4xl font-black text-amber-400 tracking-wider drop-shadow-[0_0_8px_rgba(251,191,36,0.6)]">
                      {comm1Active}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      {RADIO_PRESETS.find((p) => p.freq === comm1Active)?.name || 'Custom VHF'}
                    </span>
                  </div>

                  {/* Standby Frequency */}
                  <div className="flex flex-col items-center border-l border-slate-800">
                    <span className="text-[10px] text-cyan-500/70 font-bold tracking-widest uppercase">STANDBY</span>
                    <div className="text-3xl sm:text-4xl font-black text-cyan-400 tracking-wider drop-shadow-[0_0_8px_rgba(34,211,238,0.5)]">
                      {comm1Standby}
                    </div>
                    <span className="text-[10px] text-slate-500 mt-0.5">
                      {RADIO_PRESETS.find((p) => p.freq === comm1Standby)?.name || 'Custom VHF'}
                    </span>
                  </div>
                </div>

                {/* Controls Bar: Flip-Flop TFR button + Tuning Knobs */}
                <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800/80">
                  {/* Frequency Transfer Flip-Flop Button */}
                  <button
                    onClick={handleSwapComm1}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gradient-to-b from-slate-700 to-slate-800 hover:from-slate-600 hover:to-slate-700 text-white font-mono text-xs font-bold border border-slate-600 shadow-md active:translate-y-0.5 transition"
                  >
                    <span>⇄</span>
                    <span>TFR (SWAP)</span>
                  </button>

                  {/* Manual Frequency Knobs */}
                  <div className="flex items-center gap-2">
                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-mono text-slate-400">MHz TUNE</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            soundManager.playRadioClick();
                            const cur = parseFloat(comm1Standby);
                            const next = (cur - 1.0 < 118 ? 136.975 : cur - 1.0).toFixed(2);
                            setComm1Standby(next);
                          }}
                          className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono font-bold flex items-center justify-center text-xs"
                        >
                          -
                        </button>
                        <button
                          onClick={() => {
                            soundManager.playRadioClick();
                            const cur = parseFloat(comm1Standby);
                            const next = (cur + 1.0 > 136.975 ? 118.0 : cur + 1.0).toFixed(2);
                            setComm1Standby(next);
                          }}
                          className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono font-bold flex items-center justify-center text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>

                    <div className="flex flex-col items-center">
                      <span className="text-[9px] font-mono text-slate-400">kHz TUNE</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => {
                            soundManager.playRadioClick();
                            const cur = parseFloat(comm1Standby);
                            const next = (cur - 0.05).toFixed(2);
                            setComm1Standby(next);
                          }}
                          className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono font-bold flex items-center justify-center text-xs"
                        >
                          -
                        </button>
                        <button
                          onClick={() => {
                            soundManager.playRadioClick();
                            const cur = parseFloat(comm1Standby);
                            const next = (cur + 0.05).toFixed(2);
                            setComm1Standby(next);
                          }}
                          className="w-7 h-7 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-mono font-bold flex items-center justify-center text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* QUICK PRESET CHANNELS SELECTOR */}
              <div className="space-y-2">
                <span className="text-xs font-mono font-bold text-slate-400 uppercase tracking-wider">
                  Quick Frequency Presets (Click to load into Standby):
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {RADIO_PRESETS.map((preset) => {
                    const isLoaded = comm1Active === preset.freq || comm1Standby === preset.freq;
                    return (
                      <button
                        key={preset.freq}
                        onClick={() => handleSelectPreset(preset)}
                        className={`p-2 rounded-lg border text-left flex flex-col justify-between transition-all select-none ${
                          isLoaded
                            ? 'bg-slate-800 border-rcac-sky text-white'
                            : 'bg-slate-950/80 hover:bg-slate-800/80 border-slate-800 text-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between w-full">
                          <span className="font-bold text-xs truncate">{preset.name}</span>
                          <span className="text-[11px] font-mono text-rcac-gold font-bold">{preset.freq}</span>
                        </div>
                        <span className="text-[10px] text-slate-400 truncate mt-0.5">{preset.description}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* TACTILE ANIMATED PTT (PUSH-TO-TALK) FLIGHT YOKE BUTTON */}
              <div className="bg-slate-950 border-2 border-slate-800 rounded-xl p-4 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="space-y-1 text-center sm:text-left">
                  <div className="flex items-center gap-2 justify-center sm:justify-start">
                    <Mic className={`w-4 h-4 ${isPttPressed ? 'text-rose-500 animate-bounce' : 'text-slate-400'}`} />
                    <span className="text-sm font-bold text-white uppercase tracking-wider font-mono">
                      PTT (PUSH-TO-TALK) CONTROL
                    </span>
                  </div>
                  <p className="text-xs text-slate-400">
                    Click & hold the red trigger button (or hold <strong>SPACEBAR</strong>) to key your microphone transmitter.
                  </p>
                </div>

                {/* Tactile PTT Button */}
                <button
                  onMouseDown={triggerPttDown}
                  onMouseUp={triggerPttUp}
                  onTouchStart={triggerPttDown}
                  onTouchEnd={triggerPttUp}
                  className={`relative px-8 py-4 rounded-2xl font-black font-mono text-sm tracking-widest uppercase transition-all duration-75 select-none shadow-2xl active:translate-y-1 ${
                    isPttPressed
                      ? 'bg-gradient-to-b from-rose-600 to-red-800 text-white border-2 border-rose-300 shadow-[0_0_25px_rgba(244,63,94,0.7)] scale-95'
                      : 'bg-gradient-to-b from-rose-700 to-red-950 hover:from-rose-600 hover:to-red-900 text-rose-100 border-2 border-rose-600/80 shadow-[0_5px_0_#4c0519]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${isPttPressed ? 'bg-white animate-ping' : 'bg-rose-400'}`} />
                    <span>{isPttPressed ? 'TRANSMITTING...' : 'PRESS & HOLD PTT'}</span>
                  </div>
                </button>
              </div>
            </div>
          </div>

          {/* RIGHT: Live Gander (CYQX) ATIS Broadcast Station */}
          <div className="lg:col-span-5 space-y-4">
            <div className="bg-slate-900/95 border-2 border-slate-800 rounded-2xl p-5 shadow-2xl space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <CloudSun className="w-5 h-5 text-rcac-gold" />
                  <div>
                    <h3 className="font-heading text-base font-bold text-white">
                      GANDER INTL (CYQX) ATIS
                    </h3>
                    <p className="text-[10px] text-slate-400 font-mono">AUTOMATIC TERMINAL INFORMATION SERVICE</p>
                  </div>
                </div>

                <button
                  onClick={fetchLiveCYQXAtis}
                  disabled={atisData.isLoading}
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-rcac-sky text-xs font-mono border border-slate-700 transition"
                  title="Fetch latest weather"
                >
                  <RefreshCw className={`w-3 h-3 ${atisData.isLoading ? 'animate-spin' : ''}`} />
                  <span>Update</span>
                </button>
              </div>

              {/* ATIS Information Code Badge & Frequency Tuning check */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono text-slate-400">INFO CODE:</span>
                    <span className="w-8 h-8 rounded-lg bg-rcac-gold text-slate-950 font-black font-mono text-base flex items-center justify-center shadow">
                      {atisData.code[0]}
                    </span>
                    <span className="font-bold text-sm text-white">"{atisData.code}"</span>
                  </div>

                  <span className="text-xs font-mono text-emerald-400 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-800">
                    {atisData.zuluTime}
                  </span>
                </div>

                {/* Broadcast Audio Player Button */}
                <button
                  onClick={handleToggleAtisBroadcast}
                  className={`w-full py-3 px-4 rounded-xl font-bold font-mono text-xs uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg active:translate-y-0.5 ${
                    isMonitoringAtis
                      ? 'bg-emerald-500 text-slate-950 border-2 border-white shadow-emerald-500/30 animate-pulse'
                      : 'bg-rcac-sky hover:bg-sky-400 text-slate-950 border-2 border-rcac-sky'
                  }`}
                >
                  {isMonitoringAtis ? (
                    <>
                      <Pause className="w-4 h-4" />
                      <span>Stop Listening to ATIS Broadcast</span>
                    </>
                  ) : (
                    <>
                      <Headphones className="w-4 h-4" />
                      <span>Listen to Live Gander ATIS (128.45 MHz)</span>
                    </>
                  )}
                </button>
              </div>

              {/* Decoded ATIS Elements */}
              <div className="space-y-2 text-xs">
                <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400 font-mono">Surface Wind:</span>
                  <strong className="text-white font-mono">{atisData.windStr}</strong>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400 font-mono">Visibility:</span>
                  <strong className="text-white font-mono">{atisData.visStr}</strong>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400 font-mono">Sky / Clouds:</span>
                  <strong className="text-white font-mono">{atisData.skyStr}</strong>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400 font-mono">Temp / Dewpoint:</span>
                  <strong className="text-white font-mono">{atisData.tempDewpStr}</strong>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400 font-mono">Altimeter Setting:</span>
                  <strong className="text-rcac-gold font-mono">{atisData.altimeterStr}</strong>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-lg border border-slate-800 flex justify-between items-center">
                  <span className="text-slate-400 font-mono">Active Runways:</span>
                  <strong className="text-rcac-sky font-mono">{atisData.runwayStr}</strong>
                </div>
              </div>

              {/* Raw METAR for Ground School Practice */}
              <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 space-y-1">
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>RAW CANADIAN METAR:</span>
                  <span>{atisData.lastUpdated}</span>
                </div>
                <div className="font-mono text-xs text-slate-300 break-all bg-black/50 p-2 rounded border border-slate-800">
                  {atisData.rawMetar}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* TAB 3: CADET ATC COMMUNICATIONS GAME */}
      {/* ======================================================== */}
      {activeTab === 'game' && (
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Game Stats & Progress Bar */}
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-xl flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-rcac-blue border border-rcac-sky/40 flex items-center justify-center text-rcac-gold font-bold text-xl shadow">
                <Award className="w-6 h-6" />
              </div>
              <div>
                <h3 className="font-bold text-white text-base font-heading">
                  AIR TRAFFIC CONTROL PHRASEOLOGY CHALLENGE
                </h3>
                <p className="text-xs text-slate-400">
                  Listen to the air traffic controller and transmit the correct standard Canadian readback.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-4 font-mono text-xs">
              <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400">Scenario: </span>
                <span className="text-rcac-sky font-bold">
                  {currentScenarioIdx + 1} / {ATC_SCENARIOS.length}
                </span>
              </div>

              <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400">Score: </span>
                <span className="text-rcac-gold font-bold">{gameScore} pts</span>
              </div>

              <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800">
                <span className="text-slate-400">Streak: </span>
                <span className="text-emerald-400 font-bold">{gameStreak} 🔥</span>
              </div>
            </div>
          </div>

          {!hasCompletedAll ? (
            /* Current Scenario Question Card */
            <div className="bg-slate-900/95 border-2 border-slate-800 rounded-2xl p-6 shadow-2xl space-y-5">
              {/* Scenario Context Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                <div className="space-y-0.5">
                  <span className="text-[11px] font-mono text-rcac-gold font-bold uppercase tracking-wider">
                    {ATC_SCENARIOS[currentScenarioIdx].location}
                  </span>
                  <h4 className="text-lg font-bold text-white">
                    {ATC_SCENARIOS[currentScenarioIdx].title}
                  </h4>
                </div>

                <div className="text-xs font-mono bg-slate-950 px-3 py-1 rounded-lg border border-slate-800 text-rcac-sky">
                  Aircraft: <strong>{ATC_SCENARIOS[currentScenarioIdx].cadetAircraft}</strong>
                </div>
              </div>

              {/* Context Story */}
              <div className="bg-slate-950/70 p-3.5 rounded-xl border border-slate-800 text-xs text-slate-300">
                <strong>Situation:</strong> {ATC_SCENARIOS[currentScenarioIdx].context}
              </div>

              {/* ATC Incoming Radio Transmission Card */}
              <div className="bg-gradient-to-r from-blue-950/60 to-slate-950 p-4 rounded-xl border-2 border-rcac-sky/40 space-y-2 relative">
                <div className="flex items-center justify-between text-xs font-mono text-rcac-sky">
                  <span className="flex items-center gap-1.5 font-bold">
                    <Radio className="w-4 h-4 text-emerald-400 animate-pulse" />
                    <span>INCOMING AIR TRAFFIC TRANSMISSION (VHF)</span>
                  </span>
                  <button
                    onClick={() => {
                      soundManager.playRadioClick();
                      soundManager.speak(ATC_SCENARIOS[currentScenarioIdx].atcCall);
                    }}
                    className="flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-white transition text-[11px]"
                  >
                    <Volume2 className="w-3.5 h-3.5 text-rcac-sky" />
                    <span>Play Audio</span>
                  </button>
                </div>

                <div className="text-base sm:text-lg font-bold text-white font-mono tracking-wide py-1">
                  {ATC_SCENARIOS[currentScenarioIdx].atcCall}
                </div>
              </div>

              {/* Multiple Choice Readback Options */}
              <div className="space-y-3 pt-2">
                <span className="text-xs font-mono font-bold text-slate-300 uppercase tracking-wider">
                  Select your pilot transmission readback:
                </span>

                <div className="grid grid-cols-1 gap-2.5">
                  {ATC_SCENARIOS[currentScenarioIdx].options.map((opt, idx) => {
                    const isSelected = selectedOption === idx;
                    let btnStyle = 'bg-slate-950 hover:bg-slate-800/80 border-slate-800 text-slate-200';
                    if (scenarioAnswered) {
                      if (opt.correct) {
                        btnStyle = 'bg-emerald-950/90 border-emerald-500 text-emerald-100 font-bold shadow-lg';
                      } else if (isSelected && !opt.correct) {
                        btnStyle = 'bg-rose-950/90 border-rose-500 text-rose-100';
                      } else {
                        btnStyle = 'bg-slate-950/40 border-slate-900 text-slate-600 opacity-60';
                      }
                    } else if (isSelected) {
                      btnStyle = 'bg-slate-800 border-rcac-sky text-white';
                    }

                    return (
                      <button
                        key={idx}
                        disabled={scenarioAnswered}
                        onClick={() => handleSelectOption(idx)}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all flex items-start gap-3 select-none ${btnStyle}`}
                      >
                        <span className="w-6 h-6 rounded-full bg-slate-900 border border-slate-700 text-xs font-mono font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {String.fromCharCode(65 + idx)}
                        </span>
                        <div className="flex-1">
                          <p className="text-xs sm:text-sm leading-relaxed">{opt.text}</p>
                          {scenarioAnswered && isSelected && (
                            <p className="text-xs mt-2 pt-2 border-t border-slate-800/80 font-mono text-slate-300">
                              {opt.feedback}
                            </p>
                          )}
                          {scenarioAnswered && !isSelected && opt.correct && (
                            <p className="text-xs mt-2 pt-2 border-t border-slate-800/80 font-mono text-emerald-300">
                              {opt.feedback}
                            </p>
                          )}
                        </div>
                        {scenarioAnswered && opt.correct && (
                          <Check className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                        )}
                        {scenarioAnswered && isSelected && !opt.correct && (
                          <X className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Next Button */}
              {scenarioAnswered && (
                <div className="flex justify-end pt-3">
                  <button
                    onClick={handleNextScenario}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-rcac-sky hover:bg-sky-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg"
                  >
                    <span>Next ATC Interaction</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          ) : (
            /* Game Completion Card */
            <div className="bg-slate-900 border-2 border-rcac-gold rounded-2xl p-8 text-center space-y-5 shadow-2xl">
              <div className="w-20 h-20 rounded-full bg-rcac-gold/20 border-2 border-rcac-gold flex items-center justify-center text-4xl mx-auto shadow-xl">
                🏆
              </div>

              <div className="space-y-2">
                <span className="text-xs font-mono font-bold text-rcac-gold tracking-widest uppercase">
                  ROYAL CANADIAN AIR CADETS • QUALIFIED
                </span>
                <h3 className="text-2xl font-black text-white">
                  RADIO TELEPHONY CHALLENGE COMPLETED!
                </h3>
                <p className="text-sm text-slate-300 max-w-lg mx-auto">
                  You scored <strong>{gameScore} points</strong> with standard Transport Canada phraseology, correct phonetic alphabet recitation, and runway hold-short procedures.
                </p>
              </div>

              <div className="flex items-center justify-center gap-4 pt-2">
                <button
                  onClick={handleResetGame}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-rcac-sky hover:bg-sky-400 text-slate-950 font-bold text-xs uppercase tracking-wider transition shadow-lg"
                >
                  <RotateCcw className="w-4 h-4" />
                  <span>Play Again</span>
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default RadioCommsLab;
