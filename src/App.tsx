import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  Crown, 
  Swords, 
  Users, 
  Coins, 
  Plus, 
  Sparkles, 
  Send, 
  Terminal, 
  Settings, 
  Shuffle, 
  Volume2, 
  Wifi, 
  WifiOff, 
  Shield, 
  Activity,
  User,
  Zap,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, auth, isFirebaseConfigured, handleFirestoreError, OperationType } from './firebase';
import { 
  onSnapshot, 
  collection, 
  doc, 
  setDoc, 
  writeBatch, 
  getDocs 
} from 'firebase/firestore';
import { signInAnonymously } from 'firebase/auth';
import { Player, District, ActivityLog } from './types';
import { generateDistrictNames, NEON_COLORS, BOT_NAMES } from './districtsData';
import { sounds } from './sound';

const STORAGE_KEYS = {
  USER_ID: 'turfwar_userId',
  GANG_NAME: 'turfwar_gangName',
  GANG_COLOR: 'turfwar_gangColor',
  LOCAL_STATS: 'turfwar_localStats',
  LOCAL_DISTRICTS: 'turfwar_localDistricts',
};

export default function App() {
  // --- Core Game Configuration State ---
  const [firebaseActive, setFirebaseActive] = useState(isFirebaseConfigured);
  const [authLoading, setAuthLoading] = useState(true);
  const [myUserId, setMyUserId] = useState<string>('');
  
  // Customization Options
  const [gangName, setGangName] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.GANG_NAME) || `Apex Syndicate ${Math.floor(Math.random() * 900 + 100)}`;
  });
  const [gangColor, setGangColor] = useState<string>(() => {
    return localStorage.getItem(STORAGE_KEYS.GANG_COLOR) || NEON_COLORS[0].hex;
  });
  
  // Players and Districts list
  const [players, setPlayers] = useState<{ [id: string]: Player }>({});
  const [districts, setDistricts] = useState<District[]>([]);
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [selectedDistrictId, setSelectedDistrictId] = useState<string | null>("0");
  
  // Sound Settings
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Bot Settings (For offline mode or singleplayer actions)
  const [botsEnabled, setBotsEnabled] = useState(true);
  const [botAggressiveness, setBotAggressiveness] = useState<'chill' | 'active' | 'hardcore'>('active');

  // Input state for renaming
  const [editingName, setEditingName] = useState(false);
  const [tempName, setTempName] = useState(gangName);

  // Static list of 100 district names
  const districtNames = useMemo(() => generateDistrictNames(), []);

  // --- Initialize Players & Districts ---
  useEffect(() => {
    // Generate static default districts
    const initialDistricts: District[] = [];
    for (let i = 0; i < 100; i++) {
      initialDistricts.push({
        id: String(i),
        name: districtNames[i],
        ownerId: '',
        color: '#27272a', // gray neutral
      });
    }

    if (!firebaseActive) {
      // Local setup mode
      setAuthLoading(false);
      
      // Load user or create
      let localUid = localStorage.getItem(STORAGE_KEYS.USER_ID);
      if (!localUid) {
        localUid = `player_${Math.floor(Math.random() * 89999 + 10000)}`;
        localStorage.setItem(STORAGE_KEYS.USER_ID, localUid);
      }
      setMyUserId(localUid);

      // Load or build districts
      const cachedDistricts = localStorage.getItem(STORAGE_KEYS.LOCAL_DISTRICTS);
      if (cachedDistricts) {
        try {
          setDistricts(JSON.parse(cachedDistricts));
        } catch (e) {
          setDistricts(initialDistricts);
        }
      } else {
        setDistricts(initialDistricts);
      }

      // Load stats or build default
      const cachedStats = localStorage.getItem(STORAGE_KEYS.LOCAL_STATS);
      let localStats = { cash: 1000, muscle: 5 };
      if (cachedStats) {
        try {
          localStats = JSON.parse(cachedStats);
        } catch (e) {}
      }

      // Build initial visual list of local players
      setPlayers({
        [localUid]: {
          id: localUid,
          name: gangName,
          color: gangColor,
          cash: localStats.cash,
          muscle: localStats.muscle,
        },
        ...createLocalBots()
      });

      addLogEntry("Welcome to Turf War City! Capture districts to claim neon control.", "#00f0ff");
      addLogEntry("Firebase setup is pending. Running in Local Offline Mode.", "#ffea00");
    } else {
      // Firebase Online Authentication
      setAuthLoading(true);
      signInAnonymously(auth)
        .then((cred) => {
          const uid = cred.user.uid;
          setMyUserId(uid);
          
          // Seed & Listen to Districts realtime
          const districtsCol = collection(db, 'districts');
          
          // Check if districts are empty in firebase, if so seed them
          getDocs(districtsCol)
            .then((snap) => {
              if (snap.empty) {
                // Initialize the database with 100 neutral districts in batch increments!
                addLogEntry("🚨 Seeding neon metropolis database sectors...", "#9d00ff");
                const batch = writeBatch(db);
                for (let i = 0; i < 100; i++) {
                  const dDoc = doc(db, 'districts', String(i));
                  batch.set(dDoc, {
                    ownerId: '',
                    color: '#27272a'
                  });
                }
                batch.commit()
                  .then(() => {
                    addLogEntry("Metropolis online sectors fully initialized!", "#39ff14");
                  })
                  .catch((err) => handleFirestoreError(err, OperationType.WRITE, 'districts'));
              }
            })
            .catch((err) => handleFirestoreError(err, OperationType.LIST, 'districts'));

          // Listen to districts changes
          const unsubDistricts = onSnapshot(districtsCol, (snapshot) => {
            const updated: District[] = [...initialDistricts];
            snapshot.forEach((docSnap) => {
              const data = docSnap.data();
              const idVal = docSnap.id;
              const idxNum = parseInt(idVal, 10);
              if (idxNum >= 0 && idxNum < 100) {
                updated[idxNum] = {
                  id: idVal,
                  name: districtNames[idxNum],
                  ownerId: data.ownerId || '',
                  color: data.color || '#27272a',
                };
              }
            });
            setDistricts(updated);
          }, (err) => {
            handleFirestoreError(err, OperationType.LIST, 'districts');
          });

          // Create or Sync current crime boss profile on database
          const playerDoc = doc(db, 'players', uid);
          setDoc(playerDoc, {
            color: gangColor,
            cash: 1000,
            muscle: 5,
          }, { merge: true })
          .catch((err) => handleFirestoreError(err, OperationType.CREATE, `players/${uid}`));

          // Listen to player stats
          const unsubPlayers = onSnapshot(collection(db, 'players'), (snapshot) => {
            const list: { [id: string]: Player } = {};
            snapshot.forEach((docSnap) => {
              const pData = docSnap.data();
              // Assign a human gang name
              const pId = docSnap.id;
              const isMe = pId === uid;
              list[pId] = {
                id: pId,
                name: isMe ? gangName : `Ganglord-${pId.substring(0, 4).toUpperCase()}`,
                color: pData.color || '#ffffff',
                cash: pData.cash ?? 1000,
                muscle: pData.muscle ?? 5,
              };
            });
            setPlayers(list);
          }, (err) => {
            handleFirestoreError(err, OperationType.LIST, 'players');
          });

          setAuthLoading(false);
          addLogEntry("🚀 Realtime Firebase Connection Synced successfully!", "#39ff14");

          return () => {
            unsubDistricts();
            unsubPlayers();
          };
        })
        .catch((err) => {
          console.error("Auth failed:", err);
          setFirebaseActive(false);
          setAuthLoading(false);
          addLogEntry("⚠️ Remote sync failed. Switched to Local Client Mode.", "#ff003c");
        });
    }
  }, [firebaseActive]);

  // Help seed local rival bots
  function createLocalBots() {
    const list: { [id: string]: Player } = {};
    BOT_NAMES.forEach((name, idx) => {
      const bId = `bot_${idx}`;
      const color = NEON_COLORS[(idx + 1) % NEON_COLORS.length].hex;
      list[bId] = {
        id: bId,
        name: name,
        color: color,
        cash: 1200,
        muscle: 8,
        isBot: true,
      };
    });
    return list;
  }

  // Handle persistent Local Storage for Client States
  const saveLocalState = (pCash: number, pMuscle: number, currentDistrictsList?: District[]) => {
    if (!firebaseActive) {
      localStorage.setItem(STORAGE_KEYS.LOCAL_STATS, JSON.stringify({ cash: pCash, muscle: pMuscle }));
      if (currentDistrictsList) {
        localStorage.setItem(STORAGE_KEYS.LOCAL_DISTRICTS, JSON.stringify(currentDistrictsList));
      }
    }
  };

  // --- Dynamic Cash Earning Loop ---
  // Every 5 seconds, players earn $100 for every district they own
  useEffect(() => {
    const goldInterval = setInterval(() => {
      if (!myUserId || authLoading) return;

      setDistricts((prevDistricts) => {
        // Calculate owned sectors
        const mine = prevDistricts.filter(d => d.ownerId === myUserId);
        const earnAmount = mine.length * 100;

        if (earnAmount > 0) {
          // Play micro sound
          if (soundEnabled) sounds.playCash();

          setPlayers((prevPlayers) => {
            const me = prevPlayers[myUserId];
            if (!me) return prevPlayers;

            const newCash = me.cash + earnAmount;
            
            // Log the payout
            addLogEntry(`💵 Payday! Your crew collected $${earnAmount} dirty cash from ${mine.length} Turf zones.`, "#39ff14");

            // Sync with Firebase or Local State
            if (firebaseActive) {
              const myDoc = doc(db, 'players', myUserId);
              setDoc(myDoc, { cash: newCash }, { merge: true })
                .catch((e) => handleFirestoreError(e, OperationType.UPDATE, `players/${myUserId}`));
            } else {
              saveLocalState(newCash, me.muscle, prevDistricts);
            }

            return {
              ...prevPlayers,
              [myUserId]: {
                ...me,
                cash: newCash,
              }
            };
          });
        }
        return prevDistricts;
      });
    }, 5000);

    return () => clearInterval(goldInterval);
  }, [myUserId, firebaseActive, authLoading, soundEnabled]);

  // --- Bot Conquest Action Loop ---
  // If bots are enabled, they periodically attempt to claim random districts
  useEffect(() => {
    if (!botsEnabled) return;

    let delay = 3500;
    if (botAggressiveness === 'chill') delay = 6000;
    if (botAggressiveness === 'hardcore') delay = 1800;

    const botInterval = setInterval(() => {
      if (authLoading) return;

      // Select a random bot player
      const botCollection = (Object.values(players) as Player[]).filter(p => p.isBot || p.id.startsWith('bot_'));
      if (botCollection.length === 0) return;

      const randomBot = botCollection[Math.floor(Math.random() * botCollection.length)] as Player;
      
      // Select a target cell index
      const targetIndex = Math.floor(Math.random() * 100);

      setDistricts((prev) => {
        const currentZone = prev[targetIndex];
        // If unowned OR owned by someone else
        if (currentZone && currentZone.ownerId !== randomBot.id) {
          const updated = [...prev];
          
          updated[targetIndex] = {
            ...currentZone,
            ownerId: randomBot.id,
            color: randomBot.color,
          };

          // Post News alert
          const prevOwnerText = currentZone.ownerId === myUserId 
            ? "⚠️ YOUR GANG" 
            : currentZone.ownerId 
              ? players[currentZone.ownerId]?.name || "rivals" 
              : "Neutrals";

          addLogEntry(
            `💥 FAK NEWS: ${randomBot.name} deployed muscle & captured "${currentZone.name}" row from ${prevOwnerText}!`,
            randomBot.color
          );

          if (soundEnabled && currentZone.ownerId === myUserId) {
            // play failure buzz sounds as user lost territory!
            sounds.playBuzz();
          }

          // Update local storage
          if (!firebaseActive) {
            localStorage.setItem(STORAGE_KEYS.LOCAL_DISTRICTS, JSON.stringify(updated));
          }

          return updated;
        }
        return prev;
      });
    }, delay);

    return () => clearInterval(botInterval);
  }, [players, botsEnabled, botAggressiveness, firebaseActive, authLoading, soundEnabled, myUserId]);

  // --- Action Ticker Logging Helper ---
  const addLogEntry = (msg: string, colorCode: string) => {
    const entry: ActivityLog = {
      id: `log_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      text: msg,
      timestamp: Date.now(),
      color: colorCode,
    };
    setLogs((prev) => [entry, ...prev.slice(0, 40)]);
  };

  // --- Gang customizer commit ---
  const handleSaveGangInfo = () => {
    if (!tempName.trim()) return;
    setGangName(tempName);
    setEditingName(false);
    
    localStorage.setItem(STORAGE_KEYS.GANG_NAME, tempName);
    localStorage.setItem(STORAGE_KEYS.GANG_COLOR, gangColor);

    // Sync info to active visual roster list
    setPlayers((prev) => {
      const me = prev[myUserId];
      if (!me) return prev;
      return {
        ...prev,
        [myUserId]: {
          ...me,
          name: tempName,
          color: gangColor,
        }
      };
    });

    if (firebaseActive && myUserId) {
      const pDoc = doc(db, 'players', myUserId);
      setDoc(pDoc, { color: gangColor }, { merge: true })
        .catch((e) => handleFirestoreError(e, OperationType.UPDATE, `players/${myUserId}`));
    }

    addLogEntry(`🎨 Faction rebranded to "${tempName}" styled in Neon accent!`, gangColor);
    if (soundEnabled) sounds.playCash();
  };

  // randomize cosmetic gang details
  const triggerRandomizeGang = () => {
    const names = [
      "Tokyo Drifters", "Cyber Cobras", "Laser Serpents", "Shadow Syndicate", 
      "Neon Phantoms", "Chrome Cartel", "Warning Outlaws", "Grit Overlords"
    ];
    const pickedName = `${names[Math.floor(Math.random() * names.length)]} ${Math.floor(Math.random() * 90 + 10)}`;
    const pickedCol = NEON_COLORS[Math.floor(Math.random() * NEON_COLORS.length)].hex;
    
    setTempName(pickedName);
    setGangColor(pickedCol);
    
    setGangName(pickedName);
    localStorage.setItem(STORAGE_KEYS.GANG_NAME, pickedName);
    localStorage.setItem(STORAGE_KEYS.GANG_COLOR, pickedCol);

    setPlayers((prev) => {
      const me = prev[myUserId];
      if (!me) return prev;
      return {
        ...prev,
        [myUserId]: {
          ...me,
          name: pickedName,
          color: pickedCol,
        }
      };
    });

    if (firebaseActive && myUserId) {
      const pDoc = doc(db, 'players', myUserId);
      setDoc(pDoc, { color: pickedCol }, { merge: true })
        .catch((e) => handleFirestoreError(e, OperationType.UPDATE, `players/${myUserId}`));
    }
    
    addLogEntry(`🎲 Randomized cosmetic style: "${pickedName}"!`, pickedCol);
    if (soundEnabled) sounds.playCash();
  };

  // --- HIRE MUSCLE ACTION ---
  // Hiring 1 muscle costs $500
  const handleHireMuscle = () => {
    const me = players[myUserId];
    if (!me) return;

    if (me.cash < 500) {
      if (soundEnabled) sounds.playBuzz();
      addLogEntry("❌ LACK OF CAPITAL: Hiring muscle costs $500 cash!", "#ff003c");
      return;
    }

    const updatedCash = me.cash - 500;
    const updatedMuscle = me.muscle + 1;

    // Apply sounds
    if (soundEnabled) sounds.playCash();

    // Roster state update
    setPlayers((prev) => ({
      ...prev,
      [myUserId]: {
        ...me,
        cash: updatedCash,
        muscle: updatedMuscle,
      }
    }));

    addLogEntry(`💪 Mobilized 1 extra Muscle Enforcer block into your roster for $500 Cash!`, "#39ff14");

    // Sync
    if (firebaseActive && myUserId) {
      const pDoc = doc(db, 'players', myUserId);
      setDoc(pDoc, {
        cash: updatedCash,
        muscle: updatedMuscle
      }, { merge: true })
      .catch((e) => handleFirestoreError(e, OperationType.UPDATE, `players/${myUserId}`));
    } else {
      saveLocalState(updatedCash, updatedMuscle);
    }
  };

  // --- CAPTURE DISTRICT ACTION ---
  // Spend 1 muscle to capture district
  const handleCaptureDistrict = (districtId: string) => {
    const me = players[myUserId];
    if (!me) return;

    const targetZone = districts.find(d => d.id === districtId);
    if (!targetZone) return;

    // Guard: Prevent self claim spam
    if (targetZone.ownerId === myUserId) {
      addLogEntry(`ℹ️ "${targetZone.name}" is already under complete rule of your cartel.`, gangColor);
      return;
    }

    // Guard: Check muscle
    if (me.muscle < 1) {
      if (soundEnabled) sounds.playBuzz();
      addLogEntry("❌ INSUFFICIENT MUSCLE: Recruit muscle enforcers in the control panel first!", "#ff003c");
      return;
    }

    const updatedMuscle = me.muscle - 1;

    // Sound cue
    if (soundEnabled) sounds.playCapture();

    // Locally process district assignment
    setDistricts((prevDistricts) => {
      const updated = prevDistricts.map((d) => {
        if (d.id === districtId) {
          const alert = targetZone.ownerId 
            ? `⚔️ WAR ACTION: Captured "${targetZone.name}" from ${players[targetZone.ownerId]?.name || 'a rival cartel'}!`
            : `📍 SEGMENTATION: Declared authority over neutral sector "${targetZone.name}".`;
          addLogEntry(alert, gangColor);
          return {
            ...d,
            ownerId: myUserId,
            color: gangColor,
          };
        }
        return d;
      });

      // Update Local stats state
      setPlayers((prevPlayers) => ({
        ...prevPlayers,
        [myUserId]: {
          ...me,
          muscle: updatedMuscle
        }
      }));

      // Persist online or offline
      if (firebaseActive) {
        // Sync District document
        const zoneDoc = doc(db, 'districts', districtId);
        setDoc(zoneDoc, {
          ownerId: myUserId,
          color: gangColor,
        }, { merge: true })
        .catch((e) => handleFirestoreError(e, OperationType.UPDATE, `districts/${districtId}`));

        // Sync Player stats
        const playerDoc = doc(db, 'players', myUserId);
        setDoc(playerDoc, {
          muscle: updatedMuscle
        }, { merge: true })
        .catch((e) => handleFirestoreError(e, OperationType.UPDATE, `players/${myUserId}`));
      } else {
        localStorage.setItem(STORAGE_KEYS.LOCAL_DISTRICTS, JSON.stringify(updated));
        localStorage.setItem(STORAGE_KEYS.LOCAL_STATS, JSON.stringify({ cash: me.cash, muscle: updatedMuscle }));
      }

      return updated;
    });
  };

  // --- Dynamic Map Ratios Computation ---
  const controlStatistics = useMemo(() => {
    const stats: { [ownerId: string]: { count: number; name: string; color: string } } = {
      neutral: { count: 0, name: 'Neutral Turf', color: '#27272a' }
    };

    districts.forEach((d) => {
      if (!d.ownerId) {
        stats.neutral.count++;
      } else {
        if (!stats[d.ownerId]) {
          const foundGang = players[d.ownerId];
          stats[d.ownerId] = {
            count: 0,
            name: foundGang?.name || (d.ownerId === myUserId ? gangName : `Ganglord-${d.ownerId.substring(0,4)}`),
            color: d.color || '#ffffff'
          };
        }
        stats[d.ownerId].count++;
      }
    });

    return Object.entries(stats).map(([id, info]) => ({
      ownerId: id,
      percentage: Math.round((info.count / 100) * 100),
      count: info.count,
      ...info
    })).sort((a,b) => b.count - a.count);
  }, [districts, players, gangName, gangColor, myUserId]);

  const testStats = players[myUserId] || { cash: 0, muscle: 0 };
  const targetDistrictObj = districts.find(d => d.id === selectedDistrictId);

  return (
    <div className="min-h-screen bg-[#050505] text-[#e0e0e0] font-sans flex flex-col antialiased selection:bg-[#ff003c] selection:text-white relative overflow-x-hidden">
      
      {/* Immersive radial mesh background and digital scanlines */}
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[size:100%_4px] pointer-events-none z-1" />

      {/* Cyberpunk Header: height-16, border-[#333], bg-[#0a0a0a] */}
      <header className="h-16 border-b border-[#333] flex items-center justify-between px-6 bg-[#0a0a0a] shrink-0 sticky top-0 z-50 backdrop-blur-md">
        <div className="flex items-center gap-4">
          <div className="w-3 h-3 rounded-full bg-[#ff003c] animate-pulse shadow-[0_0_12px_#ff003c]" />
          <h1 className="text-xl md:text-2xl font-black tracking-tighter text-white italic uppercase">
            Turf War<span className="text-[#ff003c]">:</span> City of Crime
          </h1>
        </div>

        <div className="flex items-center gap-4 md:gap-6">
          <div className="hidden md:flex flex-col items-end border-r border-[#333] pr-4">
            <span className="text-[9px] uppercase tracking-widest text-zinc-500 font-bold">Node Stream Status</span>
            <span className="text-xs text-[#39ff14] font-mono flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-[#39ff14]" /> DOWNTOWN_NODE_04 // ACTIVE
            </span>
          </div>

          <div className="flex items-center gap-3">
            {/* Realtime database status */}
            <div className={`px-2.5 py-1 text-[10px] font-mono border uppercase tracking-wider ${
              firebaseActive 
                ? 'bg-emerald-950/20 text-emerald-400 border-emerald-800' 
                : 'bg-amber-950/20 text-[#ffea00] border-amber-900'
            }`}>
              {firebaseActive ? "STREAM: ACTIVE" : "DATABASE: SANDBOX"}
            </div>

            {/* Sound Synthesizer */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className="p-1.5 border border-[#333] bg-zinc-900/60 hover:bg-zinc-800 text-zinc-400 hover:text-white transition-all cursor-pointer"
              title={soundEnabled ? "Disable Synthesizer Sounds" : "Enable Synthesizer Sounds"}
            >
              <Volume2 className={`h-4 w-4 ${soundEnabled ? 'text-[#ff003c]' : 'text-zinc-600'}`} />
            </button>
          </div>
        </div>
      </header>

      {/* Main Container Dashboard */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 md:px-8 py-6 grid grid-cols-1 lg:grid-cols-4 gap-6 relative z-10">
        
        {/* ================= COLUMN 1: CONTROL SIDEBAR PANEL ================= */}
        <section className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Faction Boss Profile Setup */}
          <div className="border border-[#333] bg-[#0a0a0a] p-5 flex flex-col gap-4 relative overflow-hidden group">
            <div className="absolute top-0 right-0 p-4 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform">
              <Shield className="h-20 w-20 text-white" />
            </div>

            <div className="flex items-center justify-between border-b border-zinc-800 pb-2.5">
              <span className="text-[10px] font-mono tracking-[0.2em] text-[#00f3ff] uppercase font-black flex items-center gap-1.5">
                <Shield className="h-3 w-3 text-[#00f3ff]" /> Faction Profile
              </span>
              <span className="text-[9px] text-zinc-500 font-mono">RANK: CAPO_V1</span>
            </div>

            {/* Name Editor Input */}
            <div>
              {editingName ? (
                <div className="flex flex-col gap-2">
                  <input
                    type="text"
                    maxLength={20}
                    value={tempName}
                    onChange={(e) => setTempName(e.target.value)}
                    className="w-full text-xs rounded bg-black border border-[#333] p-2 text-white font-mono focus:border-[#ff003c] focus:outline-none"
                    placeholder="GANG_ID..."
                  />
                  <div className="flex gap-1.5">
                    <button
                      onClick={handleSaveGangInfo}
                      className="flex-1 text-[10px] font-bold uppercase bg-[#ff003c] text-white py-1 cursor-pointer hover:brightness-110"
                    >
                      Apply Rebrand
                    </button>
                    <button
                      onClick={() => {
                        setEditingName(false);
                        setTempName(gangName);
                      }}
                      className="text-[10px] uppercase bg-zinc-900 text-zinc-400 px-3 py-1 cursor-pointer hover:bg-zinc-800"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-baseline justify-between">
                  <h3 className="text-base font-black tracking-wide text-white uppercase italic truncate max-w-[150px]">
                    {gangName}
                  </h3>
                  <button
                    onClick={() => {
                      setTempName(gangName);
                      setEditingName(true);
                    }}
                    className="text-[10px] text-zinc-500 hover:text-[#ff003c] transition-colors underline uppercase font-mono cursor-pointer"
                  >
                    Rebrand
                  </button>
                </div>
              )}
            </div>

            {/* Color Palette Selector */}
            <div className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-mono text-zinc-400">Tactical Accent Color:</span>
                <button 
                  onClick={triggerRandomizeGang} 
                  className="text-zinc-500 hover:text-[#ff003c] transition-colors"
                  title="Randomize style parameters"
                >
                  <Shuffle className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-6 gap-2">
                {NEON_COLORS.map((nc) => (
                  <button
                    key={nc.hex}
                    onClick={() => {
                      setGangColor(nc.hex);
                      localStorage.setItem(STORAGE_KEYS.GANG_COLOR, nc.hex);
                      
                      setPlayers((prev) => {
                        const me = prev[myUserId];
                        if (!me) return prev;
                        return { ...prev, [myUserId]: { ...me, color: nc.hex } };
                      });

                      if (firebaseActive && myUserId) {
                        const pDoc = doc(db, 'players', myUserId);
                        setDoc(pDoc, { color: nc.hex }, { merge: true })
                          .catch((e) => handleFirestoreError(e, OperationType.UPDATE, `players/${myUserId}`));
                      }

                      addLogEntry(`🎨 Tactical stance updated to ${nc.name}!`, nc.hex);
                      if (soundEnabled) sounds.playCash();
                    }}
                    style={{ backgroundColor: nc.hex }}
                    className={`h-6 rounded-none border pointer-events-auto cursor-pointer transition-all hover:scale-115 ${
                      gangColor === nc.hex ? 'border-white scale-110 shadow-[0_0_8px_currentColor]' : 'border-zinc-800 hover:border-zinc-500'
                    }`}
                    title={nc.name}
                  />
                ))}
              </div>
            </div>
          </div>

          {/* Core Player Resources Vault */}
          <div className="border border-[#333] bg-[#0a0a0a] p-5 flex flex-col gap-4">
            
            {/* Liquid Assets section */}
            <div className="p-4 border-l-4 border-[#00f3ff] bg-[#111] relative overflow-hidden">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#00f3ff] font-bold">Liquid Assets</p>
              <h2 className="text-3xl font-black text-white mt-1 font-mono">
                ${testStats.cash.toLocaleString()}
              </h2>
              <p className="text-[10px] text-zinc-500 mt-2 font-mono">
                + ${districts.filter(d => d.ownerId === myUserId).length * 100} / 5S PAYDAY
              </p>
            </div>

            {/* Muscle Available section */}
            <div className="p-4 border-l-4 border-[#39ff14] bg-[#111] relative overflow-hidden">
              <p className="text-[10px] uppercase tracking-[0.2em] text-[#39ff14] font-bold">Muscle Available</p>
              <h2 className="text-3xl font-black text-white mt-1 font-mono">
                {testStats.muscle}
              </h2>
              <p className="text-[10px] text-zinc-500 mt-2 font-mono">DEPLOYMENT ENFORCERS</p>
            </div>

            {/* Recruit Muscle Button - big artistic red button */}
            <button
              onClick={handleHireMuscle}
              className="w-full py-4 bg-[#ff003c] text-white font-black uppercase tracking-widest text-xs cursor-pointer hover:brightness-110 active:scale-95 transition-all shadow-[0_4px_15px_rgba(255,0,60,0.3)] duration-200"
            >
              Hire Muscle ($500)
            </button>
          </div>

          {/* Game Rules Sheet Mini */}
          <div className="border border-[#333] bg-[#0a0a0a] p-4 text-xs flex flex-col gap-3">
            <span className="font-mono text-zinc-400 font-bold uppercase flex items-center gap-1.5">
              <Info className="h-3.5 w-3.5 text-zinc-500" /> System Directives:
            </span>
            <ul className="space-y-1.5 text-zinc-500 list-disc list-inside font-mono text-[10px]">
              <li>Claim unowned or enemy grid cells to expand authority.</li>
              <li>Expanding into a district zone spends <span className="text-[#ff003c] font-black">1 Muscle</span>.</li>
              <li>Every 5s: claim <span className="text-[#00f3ff] font-black">$100 Dirty Cash</span> from each zone owned.</li>
              <li>Consolidation triggers immediate client-side real-time stream.</li>
            </ul>
          </div>

        </section>

        {/* ================= COLUMN 2 & 3: CENTRAL MAP GRID & DETAILED CARD ================= */}
        <section className="lg:col-span-2 flex flex-col gap-6">
          
          {/* Active Sector Summary / Spotlight Detail Header */}
          <div className="border border-[#333] bg-[#0a0a0a] p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 relative overflow-hidden">
            <div className="absolute top-0 left-0 bg-[#ff003c]/10 text-[9px] font-mono px-2 py-0.5 uppercase tracking-widest text-[#ff003c] border-r border-b border-[#333]">
              ACTIVE_SECTOR_FOCUS
            </div>
            
            <div className="mt-3 text-zinc-300">
              {targetDistrictObj ? (
                <div>
                  <div className="flex items-center gap-2">
                    <span 
                      className="inline-block w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: targetDistrictObj.color, boxShadow: `0 0 8px ${targetDistrictObj.color}` }}
                    />
                    <h2 className="text-base font-black font-mono text-white tracking-wider uppercase italic">
                      {targetDistrictObj.name}
                    </h2>
                  </div>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">
                    COORDINATE: <span className="text-[#00f3ff] font-bold">#{targetDistrictObj.id.padStart(2, '0')}</span> • OWNER: {' '}
                    {targetDistrictObj.ownerId ? (
                      <span style={{ color: targetDistrictObj.color }} className="font-bold uppercase tracking-wider">
                        {players[targetDistrictObj.ownerId]?.name || `Boss-${targetDistrictObj.ownerId.substring(0,4)}`}
                      </span>
                    ) : (
                      <span className="text-zinc-600 uppercase font-bold tracking-wider">UNOWNED METROPOLIS LAND</span>
                    )}
                  </p>
                </div>
              ) : (
                <div>
                  <h2 className="text-base font-bold text-zinc-400 font-mono">SECTORS GRID IDLE</h2>
                  <p className="text-[10px] text-zinc-500 font-mono">Select any sector cell coordinate on the tactical grid.</p>
                </div>
              )}
            </div>

            <div>
              {targetDistrictObj && (
                <button
                  disabled={targetDistrictObj.ownerId === myUserId}
                  onClick={() => handleCaptureDistrict(targetDistrictObj.id)}
                  style={{
                    backgroundColor: targetDistrictObj.ownerId === myUserId ? 'transparent' : '#ff003c',
                    boxShadow: targetDistrictObj.ownerId === myUserId ? 'none' : '0 4px 10px rgba(255, 0, 60, 0.25)'
                  }}
                  className={`px-4 py-2 text-[10px] font-bold uppercase tracking-wider font-mono rounded-none cursor-pointer flex items-center gap-1.5 border transition-all ${
                    targetDistrictObj.ownerId === myUserId 
                      ? 'border-[#333] text-zinc-600 cursor-not-allowed bg-transparent'
                      : 'border-white/10 text-white hover:brightness-110'
                  }`}
                >
                  <Swords className="h-3.5 w-3.5" />
                  {targetDistrictObj.ownerId === myUserId ? "Already Ruled" : "Annex Sector (-1)"}
                </button>
              )}
            </div>
          </div>

          {/* THE 10x10 MAP CSS GRID - Styled according to "Artistic Flair" grid theme */}
          <div className="relative border border-[#333] bg-[#0a0a0a] p-4 md:p-6 shadow-2xl flex flex-col justify-between overflow-hidden">
            
            {/* Floating Top Coordinate Data overlay from mockup */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex gap-4 text-[9px] font-mono text-zinc-600 select-none z-20">
              <span className="tracking-wide">LAT: 40.7128 N</span>
              <span className="text-[#ff003c] font-black">//</span>
              <span className="tracking-wide">LNG: 74.0060 W</span>
            </div>

            {/* grid identifiers */}
            <div className="flex justify-between text-[9px] font-mono text-zinc-600 pt-5 pb-3 select-none">
              <span>METROPOLIS ROW 00</span>
              <span>NEON_LOBBY // ACTIVE</span>
              <span>METROPOLIS ROW 99</span>
            </div>

            <div className="grid grid-cols-10 gap-1 bg-[#1a1a1a] border-2 border-[#333] shadow-inner p-2 relative z-10 w-full aspect-square max-w-[550px] mx-auto">
              {districts.map((district) => {
                const isSelected = selectedDistrictId === district.id;
                const isUserOwned = district.ownerId === myUserId;
                const currentOwnerGang = players[district.ownerId];

                return (
                  <div
                    key={district.id}
                    id={`district-tile-${district.id}`}
                    onClick={() => {
                      setSelectedDistrictId(district.id);
                      handleCaptureDistrict(district.id);
                    }}
                    onMouseEnter={() => setSelectedDistrictId(district.id)}
                    style={{
                      backgroundColor: district.color === '#27272a' ? '#111111' : `${district.color}25`,
                      borderColor: isSelected 
                        ? '#ffffff' 
                        : district.color === '#27272a' 
                          ? '#050505' 
                          : `${district.color}40`,
                      boxShadow: isSelected 
                        ? `inset 0 0 10px #ffffff40, 0 0 8px #ffffff80` 
                        : district.color !== '#27272a' 
                          ? `inset 0 0 12px ${district.color}25` 
                          : 'none'
                    }}
                    className={`aspect-square border flex flex-col items-center justify-center p-0.5 transition-all duration-150 cursor-pointer relative overflow-hidden group hover:scale-105 hover:z-20 ${
                      isSelected ? 'ring-1 ring-white' : ''
                    }`}
                  >
                    {/* Inner neon glow line */}
                    {district.color !== '#27272a' && (
                      <div 
                        className="absolute inset-x-0 top-0 h-0.5 transition-all duration-300"
                        style={{ backgroundColor: district.color }}
                      />
                    )}

                    {/* Coordinates Monospace Display */}
                    <span className="text-[8px] font-mono text-zinc-500 block absolute bottom-0.5 left-0.5 pointer-events-none opacity-60">
                      {district.id.padStart(2, '0')}
                    </span>

                    {/* Compact tactical shorthand labels */}
                    {district.ownerId ? (
                      <span 
                        style={{ color: district.color }} 
                        className="text-[10px] font-black tracking-tighter uppercase font-mono truncate max-w-full scale-90"
                      >
                        {currentOwnerGang?.name?.substring(0, 2) || "R"}
                      </span>
                    ) : (
                      <div className="h-1 w-1 rounded-full bg-zinc-800 group-hover:bg-zinc-500" />
                    )}

                    {/* hover overlay */}
                    <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity" />
                  </div>
                );
              })}
            </div>

            <div className="flex justify-between items-center text-[9px] font-mono text-zinc-600 pt-3 select-none border-t border-zinc-900 mt-4">
              <span>EAST_TERRITORY // CALIBRATED</span>
              <span>GRID STRESS CAPACITY: 100/100</span>
            </div>
          </div>

          {/* Quick status bottom indicators explaining rewards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            
            <div className="bg-[#0a0a0a] border border-[#333] p-3 flex flex-col justify-center">
              <span className="text-zinc-500 text-[9px] uppercase font-mono tracking-wider block">Your Sectors</span>
              <p className="text-base font-black font-mono text-white mt-0.5">
                {districts.filter(d => d.ownerId === myUserId).length} / 100
              </p>
            </div>

            <div className="bg-[#0a0a0a] border border-[#333] p-3 flex flex-col justify-center">
              <span className="text-zinc-500 text-[9px] uppercase font-mono tracking-wider block">Income Projection</span>
              <p className="text-base font-black font-mono text-[#00f3ff] mt-0.5">
                +${districts.filter(d => d.ownerId === myUserId).length * 100} <span className="text-[10px] text-zinc-500">/5s</span>
              </p>
            </div>

            <div className="bg-[#0a0a0a] border border-[#333] p-3 flex flex-col justify-center">
              <span className="text-zinc-500 text-[9px] uppercase font-mono tracking-wider block">Neutral Zone</span>
              <p className="text-base font-black font-mono text-zinc-400 mt-0.5">
                {districts.filter(d => !d.ownerId).length}
              </p>
            </div>

            <div className="bg-[#0a0a0a] border border-[#333] p-3 flex flex-col justify-center">
              <span className="text-zinc-500 text-[9px] uppercase font-mono tracking-wider block">Rivals Dominating</span>
              <p className="text-base font-black font-mono text-[#ff003c] mt-0.5">
                {districts.filter(d => d.ownerId && d.ownerId !== myUserId).length}
              </p>
            </div>

          </div>

        </section>

        {/* ================= COLUMN 4: DOMINANCE LEADERBOARD & REALTIME EVENTS ================= */}
        <section className="lg:col-span-1 flex flex-col gap-6">
          
          {/* Faction Dominance Ratio Board */}
          <div className="border border-[#333] bg-[#0a0a0a] p-5 flex flex-col gap-4">
            <div className="border-b border-zinc-800 pb-2">
              <span className="text-[10px] font-mono tracking-[0.2em] text-[#ff003c] uppercase font-black flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5" /> Faction Power Dominance
              </span>
            </div>

            <div className="space-y-4">
              {controlStatistics.map((stat, idx) => (
                <div key={stat.ownerId} className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="text-zinc-300 font-bold truncate max-w-[140px] flex items-center gap-1.5">
                      <span 
                        className="inline-block h-2 w-2 rounded-full" 
                        style={{ backgroundColor: stat.color, boxShadow: `0 0 6px ${stat.color}` }}
                      />
                      {stat.name}
                    </span>
                    <span className="text-white font-bold">
                      {stat.percentage}% <span className="text-zinc-500 font-normal">({stat.count})</span>
                    </span>
                  </div>
                  
                  {/* Visual ratio loading bar */}
                  <div className="h-1 bg-[#1a1a1a] rounded-none overflow-hidden">
                    <div 
                      className="h-full transition-all duration-500"
                      style={{ 
                        width: `${stat.percentage}%`,
                        backgroundColor: stat.color,
                        boxShadow: `0 0 6px ${stat.color}`
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Sandbox Controls - Rival Bots Toggle */}
          <div className="border border-[#333] bg-[#0a0a0a] p-4 flex flex-col gap-3">
            <span className="text-[10px] font-mono tracking-[0.2em] text-[#39ff14] uppercase font-black flex items-center gap-1.5">
              <Settings className="h-3.5 w-3.5" /> Conflict Simulator
            </span>
            <p className="text-[10px] text-zinc-500 leading-relaxed font-mono">
              Toggle automated rival factions trying to claim city blocks. Used for offline testing or real-time pressure.
            </p>

            <div className="flex items-center justify-between border-t border-zinc-900 pt-2.5 text-xs font-mono">
              <span className="text-zinc-400 text-[10px]">Rival Bots Active:</span>
              <button
                onClick={() => {
                  setBotsEnabled(!botsEnabled);
                  addLogEntry(`🤖 Rival bot actions ${!botsEnabled ? 'activated' : 'offline'}.`, '#ffea00');
                }}
                className={`px-2.5 py-1 rounded-none text-[9px] uppercase font-bold cursor-pointer border transition-colors ${
                  botsEnabled 
                    ? 'bg-amber-950/20 text-[#ffea00] border-amber-800' 
                    : 'bg-zinc-900 border-zinc-800 text-zinc-500'
                }`}
              >
                {botsEnabled ? "ACTIVE" : "STANDBY"}
              </button>
            </div>

            {botsEnabled && (
              <div className="flex flex-col gap-2 mt-1">
                <span className="text-[9px] font-mono text-zinc-500">Conquest Attack Pace:</span>
                <div className="grid grid-cols-3 gap-1">
                  {(['chill', 'active', 'hardcore'] as const).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => {
                        setBotAggressiveness(mode);
                        addLogEntry(`🤖 Bot action speed swapped to: ${mode.toUpperCase()}!`, '#9d00ff');
                      }}
                      className={`py-1 text-[8px] font-bold font-mono uppercase bg-black rounded-none border cursor-pointer ${
                        botAggressiveness === mode 
                          ? 'border-white text-white' 
                          : 'border-zinc-900 text-zinc-600 hover:text-zinc-400'
                      }`}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Activity Logs rolling wire ticker */}
          <div className="border border-[#333] bg-[#0a0a0a] p-4 flex-1 flex flex-col gap-3 min-h-[200px] max-h-[300px]">
            <div className="border-b border-zinc-800 pb-2 flex items-center justify-between">
              <span className="text-[10px] font-mono tracking-[0.2em] text-[#ff003c] uppercase font-bold flex items-center gap-1.5">
                <Terminal className="h-3.5 w-3.5" /> City Scanner Log
              </span>
              <Activity className="h-3.5 w-3.5 text-zinc-600 animate-pulse" />
            </div>

            <div className="flex-1 overflow-y-auto space-y-2 pr-1 custom-scrollbar text-[10px] font-mono">
              <AnimatePresence initial={false}>
                {logs.length === 0 ? (
                  <p className="text-zinc-600 italic">[SYS] Listening in sector coordinate streams...</p>
                ) : (
                  logs.map((log) => (
                    <motion.div
                      key={log.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      className="leading-snug flex gap-2 border-b border-zinc-900 pb-1"
                    >
                      <span className="text-zinc-600 select-none text-[9px]">
                        {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </span>
                      <span style={{ color: log.color }} className="text-zinc-300">
                        {log.text}
                      </span>
                    </motion.div>
                  ))
                )}
              </AnimatePresence>
            </div>
          </div>

        </section>

      </main>

      {/* Cyberpunk Footer Info matching mock parameters exactly */}
      <footer className="h-12 bg-black border-t border-[#333] flex items-center px-4 md:px-8 text-[10px] text-zinc-500 font-mono mt-auto select-none gap-6 flex-wrap justify-between shrink-0">
        <div className="flex gap-4 md:gap-6 items-center flex-wrap">
          <span className="text-[#ff003c] animate-pulse flex items-center gap-1">
            <span className="inline-block w-2 h-2 rounded-full bg-[#ff003c]" /> LIVE_SYNC_ACTIVE
          </span>
          <span className="hidden sm:inline">LATENCY: 14ms</span>
          <span className="hidden sm:inline">PORT: 3000 // INGRESS_ROUTING</span>
          <span className="hidden lg:inline font-bold">DEVICE: CLOUD_CONTAINER</span>
        </div>
        <div className="italic text-zinc-600">
          V.1.0.4-BETA // DISTRIBUTED_CONQUEST_ENGINE
        </div>
      </footer>
    </div>
  );
}
