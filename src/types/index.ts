export type NavModule = 
  | 'aerodynamics'
  | 'flight-controls'
  | 'instruments'
  | 'circuit-radio'
  | 'radio-comms'
  | 'weight-balance'
  | 'navigation-e6b'
  | 'flight-sim'
  | 'cadet-exam';

export interface AirfoilState {
  angleOfAttack: number; // in degrees (-5 to 25)
  airspeed: number; // in knots (30 to 140)
  camber: number; // 0 (symmetric) to 6 (high camber)
  flaps: number; // 0 to 40 degrees
  airDensity: number; // kg/m^3 (default 1.225)
  showStreamlines: boolean;
  showPressureVectors: boolean;
  aircraftType: 'glider' | 'cessna';
}

export interface ControlSurfacesState {
  pitch: number; // -1 to 1 (stick forward/aft)
  roll: number;  // -1 to 1 (stick left/right)
  yaw: number;   // -1 to 1 (rudder pedals)
  trimElevator: number; // -1 to 1
  showAxes: boolean;
  autoCenter: boolean;
  viewAngle: 'orbit' | 'cockpit' | 'tail' | 'wing';
  aircraftModel: 'glider' | 'trainer';
}

export interface InstrumentState {
  // --- INDICATED values: what the dials show (affected by pitot-static faults) ---
  indicatedAirspeed: number; // KIAS
  altitude: number; // feet (0 to 15000)
  verticalSpeed: number; // fpm (-2000 to +2000)
  // --- TRUE values: what the aircraft is actually doing (faults never change these) ---
  trueAirspeed: number; // KTAS-ish model speed
  trueAltitude: number; // feet
  trueVsi: number; // fpm
  pitchAngle: number; // degrees (-30 to +30)
  bankAngle: number; // degrees (-60 to +60)
  heading: number; // degrees (0 to 359)
  altimeterSetting: number; // inHg (e.g. 29.92)
  headingBug: number; // degrees
  engineRpm: number;
  flapSetting: number; // 0, 10, 20, 30, 40
  // --- Pitot-static faults ---
  // 'none' | 'ram' (ram blocked, drain open → ASI falls to zero)
  //        | 'ram-drain' (ram + drain blocked → trapped pitot pressure, ASI acts as altimeter)
  pitotFault: 'none' | 'ram' | 'ram-drain';
  staticBlocked: boolean;
  // References captured at the moment a fault is introduced
  blockRefAlt: number | null; // true altitude when static blocked or ram+drain blocked
  blockRefIas: number | null; // true airspeed when ram+drain blocked
  turnRate: number; // degrees/sec
  slipSkid: number; // -1 to +1 (ball position)
}

export interface WeightItem {
  id: string;
  name: string;
  weight: number; // lbs
  arm: number; // inches aft of datum
  maxWeight?: number;
}

export interface Question {
  id: number;
  category: 'Principles of Flight' | 'Airframes & Controls' | 'Flight Instruments' | 'Navigation & Weather';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  refGuide: string; // e.g., "From the Ground Up, Ch. 2" or "RCAC Level 3 Aviation"
}
