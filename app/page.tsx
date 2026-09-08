'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { 
  Trophy, Flame, ChevronDown, Lock, EyeOff, ShieldCheck, 
  KeyRound, LogOut, Sparkles, Medal, Calendar, HelpCircle, CheckCircle2, History
} from 'lucide-react';

interface Profile {
  id: string;
  username: string;
  pin: string | null;
  total_points: number;
  has_won_championship: boolean;
}

interface Match {
  id: number;
  week_number: number;
  home_team: string;
  away_team: string;
  match_date: string;
  multiplier: number;
  home_score: number | null;
  away_score: number | null;
  has_red_card: boolean | null;
  red_card_team: string;
  is_finished: boolean;
}

interface Prediction {
  id?: number;
  match_id: number;
  user_id: string;
  pred_home_score: number;
  pred_away_score: number;
  pred_red_card: boolean;
  pred_red_card_team: string;
  earned_points?: number;
}

// 38 TAKIMIN RESMİ CDN LOGO HARİTASI (Kısa ve uzun isim varyasyonlarıyla)
const TEAM_LOGOS: Record<string, string> = {
  // Türk Takımları
  'Galatasaray': 'https://crests.football-data.org/610.png',
  'Fenerbahçe': 'https://crests.football-data.org/613.png',
  'Beşiktaş': 'Beşiktaş': 'https://crests.football-data.org/600.png',

  // İspanya
  'Real Madrid': 'https://crests.football-data.org/86.png',
  'Barcelona': 'https://crests.football-data.org/81.png',
  'Atlético Madrid': 'https://crests.football-data.org/78.png',
  'Atlético': 'https://crests.football-data.org/78.png',
  'Villarreal': 'https://crests.football-data.org/94.png',
  'Real Betis': 'https://crests.football-data.org/90.png',

  // İngiltere
  'Man City': 'https://crests.football-data.org/65.png',
  'Liverpool': 'https://crests.football-data.org/64.png',
  'Arsenal': 'https://crests.football-data.org/57.png',
  'Aston Villa': 'https://crests.football-data.org/58.png',
  'Man United': 'https://crests.football-data.org/66.png',

  // Almanya
  'Bayern': 'https://crests.football-data.org/5.png',
  'Dortmund': 'https://crests.football-data.org/4.png',
  'Leipzig': 'https://crests.football-data.org/721.png',
  'Stuttgart': 'https://crests.football-data.org/10.png',

  // Fransa
  'PSG': 'https://crests.football-data.org/524.png',
  'Marseille': 'https://crests.football-data.org/516.png',
  'Lille': 'https://crests.football-data.org/521.png',
  'Lens': 'https://crests.football-data.org/546.png',

  // İtalya
  'Inter': 'https://crests.football-data.org/108.png',
  'Napoli': 'https://crests.football-data.org/113.png',
  'Roma': 'https://crests.football-data.org/100.png',
  'Como': 'https://crests.football-data.org/1077.png',

  // Portekiz
  'Porto': 'https://crests.football-data.org/503.png',
  'Sporting CP': 'https://crests.football-data.org/498.png',
  'Sporting': 'https://crests.football-data.org/498.png',

  // Hollanda
  'Feyenoord': 'https://crests.football-data.org/675.png',
  'PSV': 'https://crests.football-data.org/674.png',

  // Diğer Avrupa Kulüpleri
  'Club Brugge': 'https://crests.football-data.org/851.png',
  'Shakhtar': 'https://crests.football-data.org/1903.png',
  'Slavia Prague': 'https://crests.football-data.org/1900.png',
  'Slavia': 'https://crests.football-data.org/1900.png',
  'Bodø/Glimt': 'https://crests.football-data.org/2143.png',
  'LASK': 'https://crests.football-data.org/2016.png',
  'Slovan Bratislava': 'https://crests.football-data.org/2144.png',
  'Slovan': 'https://crests.football-data.org/2144.png',
  'AEK Athens': 'https://crests.football-data.org/600.png',
  'AEK': 'https://upload.wikimedia.org/wikipedia/en/thumb/3/36/AEK_Athens_FC_logo.svg/300px-AEK_Athens_FC_logo.svg.png',
  'Viking': 'https://crests.football-data.org/335.png',
  'Sabah': 'https://crests.football-data.org/8468.png',
};

// Takım Amblemi Bileşeni
function TeamLogo({ name }: { name: string }) {
  const logoUrl = TEAM_LOGOS[name] || TEAM_LOGOS[name.trim()];

  if (!logoUrl) {
    return (
      <div className="w-6 h-6 rounded-full bg-slate-800 flex items-center justify-center text-[10px] font-bold text-slate-400 shrink-0 border border-slate-700">
        {name.substring(0, 2).toUpperCase()}
      </div>
    );
  }

  return (
    <img
      src={logoUrl}
      alt={name}
      referrerPolicy="no-referrer"
      className="w-6 h-6 object-contain shrink-0 drop-shadow"
      onError={(e) => {
        e.currentTarget.style.display = 'none';
      }}
    />
  );
}

const TOURNAMENT_STAGES = [
  { id: 1, label: '1. Hafta' },
  { id: 2, label: '2. Hafta' },
  { id: 3, label: '3. Hafta' },
  { id: 4, label: '4. Hafta' },
  { id: 5, label: '5. Hafta' },
  { id: 6, label: '6. Hafta' },
  { id: 7, label: '7. Hafta' },
  { id: 8, label: '8. Hafta' },
  { id: 9, label: 'Play-off (Son 32)' },
  { id: 10, label: 'Son 16' },
  { id: 11, label: 'Çeyrek Final' },
  { id: 12, label: 'Yarı Final' },
  { id: 13, label: 'BÜYÜK FİNAL 🏆' },
];

const DEADLINE = new Date('2026-09-08T17:30:00+01:00');

export default function Home() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeUser, setActiveUser] = useState<Profile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  const [matches, setMatches] = useState<Match[]>([]);
  const [allFinishedMatches, setAllFinishedMatches] = useState<Match[]>([]);
  const [expandedMatches, setExpandedMatches] = useState<Record<number, boolean>>({});

  const [myPredictions, setMyPredictions] = useState<Record<number, Prediction>>({});
  const [allPredictions, setAllPredictions] = useState<Prediction[]>([]);
  const [activeWeek, setActiveWeek] = useState<number>(1);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminScores, setAdminScores] = useState<Record<number, any>>({});
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const checkLock = () => {
      if (activeWeek === 1) {
        setIsLocked(new Date() >= DEADLINE);
      } else {
        setIsLocked(false);
      }
    };
    checkLock();
    const interval = setInterval(checkLock, 10000);
    return () => clearInterval(interval);
  }, [activeWeek]);

  useEffect(() => {
    fetchInitialData();
  }, [activeWeek]);

  async function fetchInitialData() {
    const { data: profs } = await supabase
      .from('profiles')
      .select('*')
      .order('total_points', { ascending: false });

    if (profs && profs.length > 0) {
      setProfiles(profs);

      const savedUserId = localStorage.getItem('ucl_user_id');
      const savedPin = localStorage.getItem('ucl_user_pin');
      const matched = profs.find((p) => p.id === savedUserId);

      if (matched && matched.pin && savedPin === matched.pin) {
        setActiveUser(matched);
        setIsAuthenticated(true);
        fetchUserPredictions(matched.id);
      } else if (!activeUser) {
        setActiveUser(matched || profs[0]);
        setIsAuthenticated(false);
      }
    }

    const { data: mtchs } = await supabase
      .from('matches')
      .select('*')
      .eq('week_number', activeWeek)
      .order('match_date', { ascending: true });

    if (mtchs) setMatches(mtchs);

    const { data: finished } = await supabase
      .from('matches')
      .select('*')
      .eq('is_finished', true)
      .order('match_date', { ascending: false });

    if (finished) setAllFinishedMatches(finished);

    const { data: allPreds } = await supabase.from('predictions').select('*');
    if (allPreds) setAllPredictions(allPreds);
  }

  async function fetchUserPredictions(userId: string) {
    const { data: preds } = await supabase.from('predictions').select('*').eq('user_id', userId);
    if (preds) {
      const map: Record<number, Prediction> = {};
      preds.forEach((p) => {
        map[p.match_id] = p;
      });
      setMyPredictions(map);
    }
  }

  function handleSelectUser(user: Profile) {
    setActiveUser(user);
    const savedUserId = localStorage.getItem('ucl_user_id');
    const savedPin = localStorage.getItem('ucl_user_pin');

    if (user.pin && savedUserId === user.id && savedPin === user.pin) {
      setIsAuthenticated(true);
      fetchUserPredictions(user.id);
    } else {
      setIsAuthenticated(false);
      setPinInput('');
      setPinError('');
    }
  }

  async function handlePinAction() {
    if (!activeUser) return;
    if (pinInput.trim().length !== 4) {
      setPinError('PIN kodu 4 haneli olmalıdır!');
      return;
    }

    if (!activeUser.pin) {
      const { error } = await supabase
        .from('profiles')
        .update({ pin: pinInput.trim() })
        .eq('id', activeUser.id);

      if (error) {
        setPinError('PIN kaydedilemedi: ' + error.message);
        return;
      }

      localStorage.setItem('ucl_user_id', activeUser.id);
      localStorage.setItem('ucl_user_pin', pinInput.trim());
      setIsAuthenticated(true);
      setPinError('');
      alert(`PIN kodun "${pinInput.trim()}" olarak kaydedildi!`);
      fetchInitialData();
      return;
    }

    if (pinInput.trim() === activeUser.pin) {
      localStorage.setItem('ucl_user_id', activeUser.id);
      localStorage.setItem('ucl_user_pin', activeUser.pin);
      setIsAuthenticated(true);
      setPinError('');
      fetchUserPredictions(activeUser.id);
    } else {
      setPinError('Hatalı PIN kodu! Tekrar deneyin.');
    }
  }

  function handleLogout() {
    localStorage.removeItem('ucl_user_id');
    localStorage.removeItem('ucl_user_pin');
    setIsAuthenticated(false);
    setPinInput('');
  }

  function handlePredChange(matchId: number, field: string, value: any) {
    if (isLocked || !isAuthenticated) return;
    setMyPredictions((prev) => ({
      ...prev,
      [matchId]: {
        ...(prev[matchId] || {
          match_id: matchId,
          user_id: activeUser!.id,
          pred_home_score: 0,
          pred_away_score: 0,
          pred_red_card: false,
          pred_red_card_team: 'NONE',
        }),
        [field]: value,
      },
    }));
  }

  async function savePrediction(matchId: number) {
    if (!isAuthenticated) {
      alert('Tahmin kaydetmek için önce PIN kodunuzu girmelisiniz!');
      return;
    }
    if (isLocked) {
      alert('Süre doldu! Tahminler kilitlenmiştir.');
      return;
    }
    const p = myPredictions[matchId];
    if (!p || !activeUser) return;

    const payload = {
      user_id: activeUser.id,
      match_id: matchId,
      pred_home_score: Number(p.pred_home_score),
      pred_away_score: Number(p.pred_away_score),
      pred_red_card: Boolean(p.pred_red_card),
      pred_red_card_team: p.pred_red_card ? p.pred_red_card_team : 'NONE',
    };

    const { error } = await supabase.from('predictions').upsert(payload, { onConflict: 'user_id,match_id' });
    if (!error) {
      alert('Tahmin kaydedildi!');
      fetchUserPredictions(activeUser.id);
      fetchInitialData();
    } else {
      alert('Hata: ' + error.message);
    }
  }

  async function submitMatchResult(match: Match) {
    const res = adminScores[match.id];
    if (!res) return;

    const { error } = await supabase
      .from('matches')
      .update({
        home_score: Number(res.home_score),
        away_score: Number(res.away_score),
        has_red_card: Boolean(res.has_red_card),
        red_card_team: res.has_red_card ? (res.red_card_team || 'NONE') : 'NONE',
        is_finished: true,
      })
      .eq('id', match.id);

    if (error) {
      alert('Hata: ' + error.message);
      return;
    }

    await supabase.rpc('calculate_week_points', { target_week: activeWeek });
    alert(`${match.home_team} - ${match.away_team} maçı sonuçlandı!`);
    fetchInitialData();
    if (activeUser && isAuthenticated) fetchUserPredictions(activeUser.id);
  }

  function toggleAccordion(matchId: number) {
    setExpandedMatches(prev => ({
      ...prev,
      [matchId]: !prev[matchId]
    }));
  }

  function getTeamPastMatches(teamName: string, currentMatchId: number) {
    return allFinishedMatches
      .filter(m => m.id !== currentMatchId && (m.home_team === teamName || m.away_team === teamName))
      .sort((a, b) => new Date(b.match_date).getTime() - new Date(a.match_date).getTime());
  }

  function getMatchOutcomeBadge(teamName: string, m: Match) {
    if (m.home_score === null || m.away_score === null) return null;
    const isHome = m.home_team === teamName;
    const teamGoals = isHome ? m.home_score : m.away_score;
    const opponentGoals = isHome ? m.away_score : m.home_score;

    if (teamGoals > opponentGoals) {
      return <span className="bg-emerald-500/20 text-emerald-400 font-black text-[10px] px-1.5 py-0.2 rounded border border-emerald-500/30">G</span>;
    } else if (teamGoals < opponentGoals) {
      return <span className="bg-red-500/20 text-red-400 font-black text-[10px] px-1.5 py-0.2 rounded border border-red-500/30">M</span>;
    } else {
      return <span className="bg-amber-500/20 text-amber-300 font-black text-[10px] px-1.5 py-0.2 rounded border border-amber-500/30">B</span>;
    }
  }

  const sortedProfiles = [...profiles].sort((a, b) => b.total_points - a.total_points);
  const currentStageLabel = TOURNAMENT_STAGES.find((s) => s.id === activeWeek)?.label || `${activeWeek}. Hafta`;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-3 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ÜST PANEL / RESMİ UCL LOGOLU BAŞLIK */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow">
          <div className="flex items-center gap-3">
            <img
              src="https://crests.football-data.org/CL.png"
              alt="UCL Starball"
              referrerPolicy="no-referrer"
              className="w-10 h-10 object-contain drop-shadow-md brightness-110"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
            <div>
              <h1 className="text-xl font-black text-white tracking-tight flex items-center gap-2">
                Guess to Win
              </h1>
              <p className="text-xs text-slate-400">Şampiyonlar Ligi & Avrupa Ligi 2026/27</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400 font-medium mr-1">Profil:</span>
            <div className="flex gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectUser(p)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    activeUser?.id === p.id ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.username}
                </button>
              ))}
            </div>

            {isAuthenticated && (
              <button
                onClick={handleLogout}
                title="PIN Çıkışı Yap"
                className="p-2 text-slate-400 hover:text-red-400 bg-slate-950 rounded-xl border border-slate-800 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </header>

        {/* PIN GİRİŞ KARTI */}
        {!isAuthenticated && activeUser && (
          <div className={`p-4 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-4 ${
            !activeUser.pin 
              ? 'bg-amber-950/40 border-amber-800/60' 
              : 'bg-blue-950/40 border-blue-800/60'
          }`}>
            <div className="flex items-center gap-3">
              {!activeUser.pin ? <Sparkles className="w-6 h-6 text-amber-400" /> : <KeyRound className="w-6 h-6 text-blue-400" />}
              <div>
                <h3 className="text-sm font-bold text-white">
                  {!activeUser.pin 
                    ? `Hoş geldin ${activeUser.username}! İlk Girişin İçin PIN Belirle` 
                    : `${activeUser.username} Olarak Giriş Yap`}
                </h3>
                <p className="text-xs text-slate-400">
                  {!activeUser.pin 
                    ? '4 haneli bir şifre belirleyin. Sonraki tüm girişlerinizde bu PIN geçerli olacak.' 
                    : 'Tahmin kaydetmek veya değiştirmek için 4 haneli PIN kodunuzu girin.'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <input
                type="password"
                maxLength={4}
                placeholder="PIN"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="w-20 bg-slate-950 border border-slate-700 text-center font-black rounded-xl p-2 text-white outline-none tracking-widest text-sm"
              />
              <button
                onClick={handlePinAction}
                className={`text-xs font-bold px-4 py-2.5 rounded-xl transition text-white ${
                  !activeUser.pin ? 'bg-amber-600 hover:bg-amber-500' : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                {!activeUser.pin ? 'Kaydet' : 'Giriş'}
              </button>
            </div>
          </div>
        )}
        {pinError && <p className="text-xs text-red-400 font-semibold text-center">{pinError}</p>}

        {/* HAFTA SEÇİCİ */}
        <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-2xl">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-slate-400 font-bold px-2 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-400" /> Hafta Seç:
            </span>
            {TOURNAMENT_STAGES.map((stg) => (
              <button
                key={stg.id}
                onClick={() => setActiveWeek(stg.id)}
                className={`px-3 py-2 rounded-xl font-bold whitespace-nowrap transition text-xs ${
                  activeWeek === stg.id
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-slate-950/60 text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800/80'
                }`}
              >
                {stg.label}
              </button>
            ))}
          </div>
        </div>

        {/* 2 SÜTUNLU ALAN */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* SOL: MAÇLAR */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* KİLİT BANDI */}
            <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
              isLocked ? 'bg-red-500/10 border-red-500/30 text-red-300' : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}>
              <div className="flex items-center gap-2 font-bold">
                {isLocked ? <Lock className="w-4 h-4 text-red-400" /> : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
                <span>{isLocked ? `${currentStageLabel} Kilitlendi` : `${currentStageLabel} Tahminleri Açık`}</span>
              </div>
              <span className="font-semibold text-[11px] opacity-80">
                {isLocked ? 'Tahminler Açıklandı' : 'Salı 17:30 İrlanda Saatine Kadar Gizli'}
              </span>
            </div>

            {/* MAÇ LİSTESİ */}
            <section className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Flame className="w-4 h-4 text-orange-400" /> {currentStageLabel} Karşılaşmaları
                </h2>
                <span className="text-xs text-slate-500">{matches.length} Maç</span>
              </div>

              {matches.map((m) => {
                const pred = myPredictions[m.id];
                const canEdit = isAuthenticated && !isLocked && !m.is_finished;
                const isExpanded = Boolean(expandedMatches[m.id]);

                const homePast = getTeamPastMatches(m.home_team, m.id);
                const awayPast = getTeamPastMatches(m.away_team, m.id);

                return (
                  <div key={m.id} className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm hover:border-slate-700 transition">
                    
                    <div className="p-4 space-y-3">
                      {/* ÜST BİLGİ */}
                      <div className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          {m.multiplier === 3 ? (
                            <span className="bg-red-500/20 text-red-400 border border-red-500/30 font-black px-2 py-0.5 rounded">
                              🔥 GALATASARAY (x3 PUAN)
                            </span>
                          ) : m.multiplier > 1 ? (
                            <span className="bg-amber-500/20 text-amber-400 border border-amber-500/30 font-black px-2 py-0.5 rounded">
                              ⭐ x{m.multiplier} PUAN MAÇI
                            </span>
                          ) : (
                            <span className="text-slate-500">Standart Maç</span>
                          )}

                          {m.is_finished ? (
                            <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded font-bold flex items-center gap-1">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Sonuçlandı
                            </span>
                          ) : (
                            <span className="text-slate-500 text-[11px]">
                              {new Date(m.match_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                        </div>

                        <button
                          onClick={() => toggleAccordion(m.id)}
                          className="flex items-center gap-1 bg-slate-950 hover:bg-slate-800 border border-slate-800 px-2 py-1 rounded-lg text-slate-300 transition text-[11px] font-semibold"
                          title="Takımların son maçlarını gör"
                        >
                          <History className="w-3 h-3 text-blue-400" />
                          <span>Son Maçlar</span>
                          <ChevronDown className={`w-3.5 h-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-180 text-blue-400' : 'text-slate-400'}`} />
                        </button>
                      </div>

                      {/* MAÇ ORTA ALANI: [SEMBOL GS] - [PSG SEMBOL] */}
                      <div className="grid grid-cols-3 items-center gap-2">
                        
                        {/* EV SAHİBİ: SEMBOL + İSİM */}
                        <div className="flex items-center justify-end gap-2 min-w-0">
                          <TeamLogo name={m.home_team} />
                          <span className="font-bold text-xs sm:text-sm text-white truncate text-right">
                            {m.home_team}
                          </span>
                        </div>
                        
                        {/* SKOR VEYA TAHMİN KUTUSU */}
                        {m.is_finished ? (
                          <div className="flex flex-col items-center justify-center">
                            <div className="text-xl font-black text-white tracking-widest bg-slate-950 px-4 py-1 rounded-xl border border-slate-700 shadow-inner">
                              {m.home_score} - {m.away_score}
                            </div>
                            <div className="mt-1 flex items-center gap-1 text-[11px] text-slate-400">
                              <span>Tahminin:</span>
                              <b className="text-white font-mono bg-slate-800 px-1.5 py-0.2 rounded">
                                {pred ? `${pred.pred_home_score} - ${pred.pred_away_score}` : 'Yok'}
                              </b>
                              {pred?.pred_red_card && <span title="Kırmızı Kart Tahmini">🟥</span>}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5 sm:gap-2">
                            <input
                              type="number"
                              min="0"
                              disabled={!canEdit}
                              value={pred?.pred_home_score ?? 0}
                              onChange={(e) => handlePredChange(m.id, 'pred_home_score', e.target.value)}
                              className={`w-11 sm:w-12 h-10 bg-slate-950 border border-slate-700 text-center font-black rounded-lg text-white outline-none ${
                                !canEdit ? 'opacity-50 cursor-not-allowed' : 'focus:border-blue-500'
                              }`}
                            />
                            <span className="text-slate-500 font-bold">-</span>
                            <input
                              type="number"
                              min="0"
                              disabled={!canEdit}
                              value={pred?.pred_away_score ?? 0}
                              onChange={(e) => handlePredChange(m.id, 'pred_away_score', e.target.value)}
                              className={`w-11 sm:w-12 h-10 bg-slate-950 border border-slate-700 text-center font-black rounded-lg text-white outline-none ${
                                !canEdit ? 'opacity-50 cursor-not-allowed' : 'focus:border-blue-500'
                              }`}
                            />
                          </div>
                        )}

                        {/* DEPLASMAN: İSİM + SEMBOL */}
                        <div className="flex items-center justify-start gap-2 min-w-0">
                          <span className="font-bold text-xs sm:text-sm text-white truncate text-left">
                            {m.away_team}
                          </span>
                          <TeamLogo name={m.away_team} />
                        </div>
                      </div>

                      {/* KIRMIZI KART / PUAN DURUMU */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                        {!m.is_finished ? (
                          <div className="flex items-center gap-2">
                            <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                              <input
                                type="checkbox"
                                disabled={!canEdit}
                                checked={pred?.pred_red_card ?? false}
                                onChange={(e) => handlePredChange(m.id, 'pred_red_card', e.target.checked)}
                                className="w-3.5 h-3.5 accent-red-600"
                              />
                              🟥 Kırmızı Kart (+3P / -2P)
                            </label>
                            {pred?.pred_red_card && isAuthenticated && (
                              <select
                                disabled={!canEdit}
                                value={pred?.pred_red_card_team ?? 'NONE'}
                                onChange={(e) => handlePredChange(m.id, 'pred_red_card_team', e.target.value)}
                                className="bg-slate-950 border border-slate-700 text-[11px] p-1 rounded text-slate-300"
                              >
                                <option value="NONE">Takım Önemsiz (+3P)</option>
                                <option value="HOME">{m.home_team} Görür (+6P)</option>
                                <option value="AWAY">{m.away_team} Görür (+6P)</option>
                              </select>
                            )}
                          </div>
                        ) : (
                          <div className="text-[11px] text-slate-400">
                            Kırmızı Kart: {m.has_red_card ? <b className="text-red-400">VAR (🟥)</b> : <b className="text-slate-500">YOK</b>}
                          </div>
                        )}

                        <div className="flex items-center gap-2">
                          {m.is_finished && pred?.earned_points !== undefined && (
                            <div className="flex items-center gap-1.5">
                              <span className="text-[11px] text-slate-400">Kazanılan:</span>
                              <span className={`font-black px-2.5 py-0.5 rounded text-xs ${
                                pred.earned_points > 0 
                                  ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' 
                                  : pred.earned_points < 0 
                                  ? 'bg-red-500/20 text-red-400 border border-red-500/30' 
                                  : 'bg-slate-800 text-slate-400'
                              }`}>
                                {pred.earned_points > 0 ? `+${pred.earned_points}` : pred.earned_points} PUAN
                              </span>
                            </div>
                          )}

                          {canEdit && (
                            <button
                              onClick={() => savePrediction(m.id)}
                              className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg transition"
                            >
                              Kaydet
                            </button>
                          )}
                        </div>
                      </div>

                      {/* DİĞER OYUNCULAR (KOPYA KORUMASI) */}
                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500 font-medium">Diğer Oyuncular:</span>
                        {isLocked || m.is_finished ? (
                          <div className="flex gap-2">
                            {profiles
                              .filter((p) => p.id !== activeUser?.id)
                              .map((otherUser) => {
                                const otherPred = allPredictions.find(
                                  (p) => p.match_id === m.id && p.user_id === otherUser.id
                                );
                                return (
                                  <span key={otherUser.id} className="bg-slate-950 px-2 py-0.5 rounded border border-slate-800 text-slate-300">
                                    <b className="text-slate-400">{otherUser.username}:</b>{' '}
                                    {otherPred ? `${otherPred.pred_home_score}-${otherPred.pred_away_score}` : '-'}
                                    {otherPred?.pred_red_card ? ' 🟥' : ''}
                                  </span>
                                );
                              })}
                          </div>
                        ) : (
                          <span className="flex items-center gap-1 text-slate-500 italic">
                            <EyeOff className="w-3 h-3 text-slate-500" /> Kilitlenene kadar gizli
                          </span>
                        )}
                      </div>
                    </div>

                    {/* AÇILIR PANEL: FORM DURUMU */}
                    {isExpanded && (
                      <div className="bg-slate-950 border-t border-slate-800 p-3.5 space-y-3 text-xs animate-in fade-in duration-200">
                        <div className="text-[11px] font-bold text-slate-400 flex items-center gap-1.5 pb-1 border-b border-slate-800/60">
                          <History className="w-3.5 h-3.5 text-blue-400" />
                          <span>Turnuva Performans Geçmişi (En son oynanan maç en üsttedir)</span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                          <div className="space-y-1.5">
                            <span className="font-bold text-white text-[11px] block">{m.home_team} — Son Maçlar:</span>
                            {homePast.length === 0 ? (
                              <p className="text-[11px] text-slate-500 italic">Henüz tamamlanan maç kaydı yok.</p>
                            ) : (
                              homePast.map((pm) => (
                                <div key={pm.id} className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80 text-[11px]">
                                  <div className="flex items-center gap-1.5 truncate">
                                    {getMatchOutcomeBadge(m.home_team, pm)}
                                    <span className="text-slate-400 truncate">
                                      {pm.home_team} <b className="text-white">{pm.home_score}-{pm.away_score}</b> {pm.away_team}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 ml-1 whitespace-nowrap">{pm.week_number}. Hafta</span>
                                </div>
                              ))
                            )}
                          </div>

                          <div className="space-y-1.5">
                            <span className="font-bold text-white text-[11px] block">{m.away_team} — Son Maçlar:</span>
                            {awayPast.length === 0 ? (
                              <p className="text-[11px] text-slate-500 italic">Henüz tamamlanan maç kaydı yok.</p>
                            ) : (
                              awayPast.map((pm) => (
                                <div key={pm.id} className="flex items-center justify-between bg-slate-900/80 p-1.5 rounded-lg border border-slate-800/80 text-[11px]">
                                  <div className="flex items-center gap-1.5 truncate">
                                    {getMatchOutcomeBadge(m.away_team, pm)}
                                    <span className="text-slate-400 truncate">
                                      {pm.home_team} <b className="text-white">{pm.home_score}-{pm.away_score}</b> {pm.away_team}
                                    </span>
                                  </div>
                                  <span className="text-[10px] text-slate-500 ml-1 whitespace-nowrap">{pm.week_number}. Hafta</span>
                                </div>
                              ))
                            )}
                          </div>
                        </div>
                      </div>
                    )}

                  </div>
                );
              })}
            </section>

            {/* ADMIN PANELİ */}
            <section className="border border-slate-800 rounded-2xl p-4 bg-slate-900/40 text-xs">
              <button
                onClick={() => setShowAdmin(!showAdmin)}
                className="flex items-center justify-between w-full font-bold text-slate-400 hover:text-white"
              >
                <span>⚙️ {currentStageLabel} Maç Sonucu Girişi (Admin)</span>
                <ChevronDown className={`w-4 h-4 transition ${showAdmin ? 'rotate-180' : ''}`} />
              </button>
              {showAdmin && (
                <div className="mt-3 space-y-2 pt-2 border-t border-slate-800">
                  {matches.map((m) => (
                    <div key={m.id} className="flex items-center justify-between gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
                      <span className="font-bold text-white w-44 truncate">{m.home_team} - {m.away_team}</span>
                      <div className="flex items-center gap-1">
                        <input
                          type="number"
                          placeholder="Ev"
                          className="w-10 bg-slate-900 border border-slate-700 p-1 text-center rounded text-white font-bold"
                          onChange={(e) => setAdminScores(prev => ({ ...prev, [m.id]: { ...(prev[m.id] || {}), home_score: e.target.value } }))}
                        />
                        <span>-</span>
                        <input
                          type="number"
                          placeholder="Dep"
                          className="w-10 bg-slate-900 border border-slate-700 p-1 text-center rounded text-white font-bold"
                          onChange={(e) => setAdminScores(prev => ({ ...prev, [m.id]: { ...(prev[m.id] || {}), away_score: e.target.value } }))}
                        />
                        <label className="flex items-center gap-1 ml-2 text-[11px] cursor-pointer">
                          <input
                            type="checkbox"
                            onChange={(e) => setAdminScores(prev => ({ ...prev, [m.id]: { ...(prev[m.id] || {}), has_red_card: e.target.checked } }))}
                          />
                          🟥
                        </label>
                      </div>
                      <button
                        onClick={() => submitMatchResult(m)}
                        className="bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded-lg font-bold text-[11px] transition"
                      >
                        Onayla
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>

          {/* SAĞ: PUAN TABLOSU & RESMİ KURALLAR */}
          <div className="lg:col-span-4 lg:sticky lg:top-6 space-y-4">
            
            <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" /> Puan Tablosu
                </h2>
                <span className="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-semibold">
                  Canlı
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                {sortedProfiles.map((p, idx) => {
                  const isLeader = idx === 0;
                  const isSecond = idx === 1;
                  const isThird = idx === 2;

                  return (
                    <div
                      key={p.id}
                      className={`p-3.5 rounded-xl border flex items-center justify-between transition ${
                        isLeader
                          ? 'bg-amber-500/10 border-amber-500/40 shadow-sm'
                          : 'bg-slate-950 border-slate-800/90'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-6 text-center">
                          {isLeader && <Medal className="w-5 h-5 text-amber-400 inline" />}
                          {isSecond && <Medal className="w-5 h-5 text-slate-300 inline" />}
                          {isThird && <Medal className="w-5 h-5 text-amber-700 inline" />}
                          {idx > 2 && <span className="text-xs text-slate-500 font-bold">#{idx + 1}</span>}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-bold text-sm text-white">{p.username}</span>
                            {activeUser?.id === p.id && (
                              <span className="text-[10px] bg-blue-600/30 text-blue-300 border border-blue-500/40 px-1.5 py-0.2 rounded font-bold">
                                Sen
                              </span>
                            )}
                          </div>
                          {p.has_won_championship && (
                            <p className="text-[10px] text-amber-400 font-bold">🏆 ÖNCEKİ ŞAMPİYON</p>
                          )}
                        </div>
                      </div>

                      <div className="text-right">
                        <span className={`text-2xl font-black ${
                          p.total_points > 0 ? 'text-emerald-400' : p.total_points < 0 ? 'text-red-400' : 'text-white'
                        }`}>
                          {p.total_points}
                        </span>
                        <span className="text-[10px] text-slate-500 block font-semibold">PUAN</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {/* RESMİ KURALLAR */}
            <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4 text-xs space-y-3">
              <h3 className="font-bold text-white flex items-center gap-2 border-b border-slate-800 pb-2">
                <HelpCircle className="w-4 h-4 text-blue-400" /> Resmi Lig Puanlama Kuralları
              </h3>

              <div className="space-y-2 text-slate-300 leading-relaxed">
                <div>
                  <b className="text-white block mb-1">1. Taraf ve Skor Puanları:</b>
                  <ul className="space-y-1 pl-1 text-[11px]">
                    <li className="flex items-center justify-between">
                      <span>• Kazanan Taraf / Beraberlik:</span>
                      <b className="text-blue-400 font-bold">+3 Puan</b>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>• Tam Skor İsabeti:</span>
                      <b className="text-emerald-400 font-bold">+6 Puan</b>
                    </li>
                  </ul>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <b className="text-red-400 block mb-1 font-bold">2. Ölümcül -10P Kuralı:</b>
                  <p className="text-[11px] text-slate-300">
                    Bir oyuncu <b className="text-white">Tam Skor</b> bildiğinde; kazanan tarafı dahi bilemeyen rakipler <b className="text-red-400 font-bold">-10 Puan</b> ceza alır!
                  </p>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    *(Rakip en azından kazanan tarafı bildiyse ceza almaz, +3P kazanır).*
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <b className="text-white block mb-1">3. Kırmızı Kart Bahsi:</b>
                  <ul className="space-y-1 pl-1 text-[11px]">
                    <li className="flex items-center justify-between">
                      <span>• Kırmızı Çıkar Bildi:</span>
                      <b className="text-emerald-400 font-bold">+3 Puan</b>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>• Gören Takımı da Bildi:</span>
                      <b className="text-emerald-400 font-bold">+6 Puan</b>
                    </li>
                    <li className="flex items-center justify-between">
                      <span>• Kırmızı Dedi Ama Çıkmadı:</span>
                      <b className="text-red-400 font-bold">-2 Puan</b>
                    </li>
                  </ul>
                </div>

                <div className="pt-2 border-t border-slate-800/80">
                  <b className="text-white block mb-0.5">4. Galatasaray Çarpanı:</b>
                  <p className="text-[11px] text-slate-400">
                    • <b className="text-red-400 font-bold">Galatasaray</b> maçlarında tüm puanlar <b className="text-white font-bold">x3</b> ile katlanır (Tam Skor: +18P / Ceza: -30P).
                  </p>
                  <p className="text-[11px] text-slate-400 mt-1">
                    • Kapanış: <b className="text-white">Salı 17:30 (İrlanda Saati)</b>.
                  </p>
                </div>
              </div>
            </section>

          </div>

        </div>

      </div>
    </main>
  );
}