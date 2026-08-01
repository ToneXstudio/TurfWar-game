export const NEON_COLORS = [
  { name: 'Neon Crimson', hex: '#ff003c', shadow: 'rgba(255, 0, 60, 0.5)' },
  { name: 'Electric Cyan', hex: '#00f0ff', shadow: 'rgba(0, 240, 255, 0.5)' },
  { name: 'Acid Lime', hex: '#39ff14', shadow: 'rgba(57, 255, 20, 0.5)' },
  { name: 'Cyber Cyberpink', hex: '#ff00ff', shadow: 'rgba(255, 0, 255, 0.5)' },
  { name: 'Danger Yellow', hex: '#ffea00', shadow: 'rgba(255, 234, 0, 0.5)' },
  { name: 'Purple Rain', hex: '#9d00ff', shadow: 'rgba(157, 0, 255, 0.5)' },
];

export const DISTRICT_PREFIXES = [
  "Lower", "Upper", "Seward", "East", "West", "Viper", "Neon", "Chrome",
  "Shadow", "Grit", "Rust", "Hollow", "Blackout", "Docks", "Toxic", "Slum",
  "South", "North", "Downtown", "Redlight", "Industrial", "Ghetto"
];

export const DISTRICT_NUCLEUS = [
  "Alley", "Heights", "Market", "Row", "Basin", "Sewer", "Terminal", "Slums",
  "Plaza", "Bay", "Ditch", "Sector", "Quarter", "Junction", "Warehouse", "Yard",
  "Harbor", "Docks", "Avenue", "Subway", "Bridge", "Depot", "Central"
];

export const DISTRICT_SUFFIXES = [
  "A", "B", "9", "District", "Sect", "III", "IV", "Zone", "Zero", "Gate", "Hub"
];

// Seeded pseudorandom 100 district names to keep them consistent across compiles
export function generateDistrictNames(): string[] {
  const names: string[] = [];
  
  for (let i = 0; i < 100; i++) {
    const p = DISTRICT_PREFIXES[i % DISTRICT_PREFIXES.length];
    const n = DISTRICT_NUCLEUS[(i * 3 + 2) % DISTRICT_NUCLEUS.length];
    const s = DISTRICT_SUFFIXES[(i * 7 + 1) % DISTRICT_SUFFIXES.length];
    
    names.push(`${p} ${n} ${s}`);
  }
  
  return names;
}

export const BOT_NAMES = [
  "Viper Boss",
  "Don Falcone",
  "Madame Vixen",
  "Chrome Cyberpunk",
  "Ghost Syndicate",
  "Iron Fist",
];
