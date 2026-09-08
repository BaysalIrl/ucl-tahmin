'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Trophy, Flame, ChevronDown, Lock, EyeOff, ShieldCheck, KeyRound, LogOut, Sparkles, Medal, Calendar } from 'lucide-react';

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

// TURNUVA AŞAMALARI (1-8 Lig Aşaması, 9-13 Elemeler)
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

// 1. HAFTA KİLİTLENME ZAMANI: Salı 17:30 İrlanda Saati (UTC+1)
const DEADLINE = new Date('2026-09-08T17:30:00+01:00');

export default function Home() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeUser, setActiveUser] = useState<Profile | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [pinInput, setPinInput] = useState<string>('');
  const [pinError, setPinError] = useState<string>('');

  const [matches, setMatches] = useState<Match[]>([]);
  const [myPredictions, setMyPredictions] = useState<Record<number, Prediction>>({});
  const [allPredictions, setAllPredictions] = useState<Prediction[]>([]);
  const [activeWeek, setActiveWeek] = useState<number>(1);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminScores, setAdminScores] = useState<Record<number, any>>({});
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    const checkLock = () => {
      // Sadece 1. hafta için bu deadline geçerli, diğer haftalar maç saatine göre çalışır
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
        red_card_team: res.has_red_card ? res.red_card_team : 'NONE',
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

  // Puan Tablosu Sıralaması (En yüksekten en düşüğe)
  const sortedProfiles = [...profiles].sort((a, b) => b.total_points - a.total_points);
  const currentStageLabel = TOURNAMENT_STAGES.find((s) => s.id === activeWeek)?.label || `${activeWeek}. Hafta`;

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-3 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* ÜST PANEL / PROFİL SEÇİMİ */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-2xl shadow">
          <div>
            <h1 className="text-xl font-black text-white flex items-center gap-2">
              ⚽ UCL Tahmin Ligi
            </h1>
            <p className="text-xs text-slate-400">Şampiyonlar Ligi & Avrupa Ligi 2026/27</p>
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

        {/* PIN GİRİŞ / BELİRLEME UYARISI */}
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

        {/* TURNUVA SCHEDULE / HAFTA SEÇİCİ */}
        <div className="bg-slate-900 border border-slate-800 p-2.5 rounded-2xl">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none text-xs">
            <span className="text-slate-400 font-bold px-2 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-blue-400" /> Takvim:
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

        {/* 2 SÜTUNLU ANA DÜZEN (SOL: MAÇLAR, SAĞ: PUAN TABLOSU) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* SOL ALAN: MAÇLAR & ADMIN (lg:col-span-8) */}
          <div className="lg:col-span-8 space-y-4">
            
            {/* KİLİT BİLGİ BANDI */}
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

              {matches.length === 0 ? (
                <div className="bg-slate-900/50 border border-slate-800 p-8 rounded-2xl text-center space-y-2">
                  <p className="text-sm text-slate-300 font-bold">{currentStageLabel} için henüz fikstür girilmedi.</p>
                  <p className="text-xs text-slate-500">Maçlar yaklaştıkça fikstür buraya yüklenecektir.</p>
                </div>
              ) : (
                matches.map((m) => {
                  const pred = myPredictions[m.id] || {
                    pred_home_score: 0,
                    pred_away_score: 0,
                    pred_red_card: false,
                    pred_red_card_team: 'NONE',
                  };

                  const canEdit = isAuthenticated && !isLocked;

                  return (
                    <div key={m.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3 shadow-sm hover:border-slate-700 transition">
                      
                      {/* ÜST ETİKET */}
                      <div className="flex items-center justify-between text-xs">
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

                        {m.is_finished && (
                          <span className="bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded font-bold">
                            Skor: {m.home_score} - {m.away_score} {m.has_red_card ? '(🟥 Kırmızı Kart)' : ''}
                          </span>
                        )}
                      </div>

                      {/* SKOR TAHMİN KUTULARI */}
                      <div className="grid grid-cols-3 items-center gap-2">
                        <span className="text-right font-bold text-sm text-white truncate">{m.home_team}</span>
                        <div className="flex items-center justify-center gap-2">
                          <input
                            type="number"
                            min="0"
                            disabled={!canEdit}
                            value={isAuthenticated ? pred.pred_home_score : 0}
                            onChange={(e) => handlePredChange(m.id, 'pred_home_score', e.target.value)}
                            className={`w-12 h-10 bg-slate-950 border border-slate-700 text-center font-black rounded-lg text-white outline-none ${
                              !canEdit ? 'opacity-50 cursor-not-allowed' : 'focus:border-blue-500'
                            }`}
                          />
                          <span className="text-slate-500 font-bold">-</span>
                          <input
                            type="number"
                            min="0"
                            disabled={!canEdit}
                            value={isAuthenticated ? pred.pred_away_score : 0}
                            onChange={(e) => handlePredChange(m.id, 'pred_away_score', e.target.value)}
                            className={`w-12 h-10 bg-slate-950 border border-slate-700 text-center font-black rounded-lg text-white outline-none ${
                              !canEdit ? 'opacity-50 cursor-not-allowed' : 'focus:border-blue-500'
                            }`}
                          />
                        </div>
                        <span className="text-left font-bold text-sm text-white truncate">{m.away_team}</span>
                      </div>

                      {/* KIRMIZI KART & KAYDET */}
                      <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                        <div className="flex items-center gap-2">
                          <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                            <input
                              type="checkbox"
                              disabled={!canEdit}
                              checked={isAuthenticated ? pred.pred_red_card : false}
                              onChange={(e) => handlePredChange(m.id, 'pred_red_card', e.target.checked)}
                              className="w-3.5 h-3.5 accent-red-600"
                            />
                            🟥 Kırmızı Kart (+3P / -2P)
                          </label>
                          {pred.pred_red_card && isAuthenticated && (
                            <select
                              disabled={!canEdit}
                              value={pred.pred_red_card_team}
                              onChange={(e) => handlePredChange(m.id, 'pred_red_card_team', e.target.value)}
                              className="bg-slate-950 border border-slate-700 text-[11px] p-1 rounded text-slate-300"
                            >
                              <option value="NONE">Takım Önemsiz</option>
                              <option value="HOME">{m.home_team} (+6P)</option>
                              <option value="AWAY">{m.away_team} (+6P)</option>
                            </select>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          {pred.earned_points !== undefined && m.is_finished && isAuthenticated && (
                            <span className={`font-black px-2 py-0.5 rounded text-xs ${
                              pred.earned_points >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                            }`}>
                              {pred.earned_points > 0 ? `+${pred.earned_points}` : pred.earned_points}P
                            </span>
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
                        {isLocked ? (
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
                            <EyeOff className="w-3 h-3 text-slate-500" /> Tahminler Salı 17:30'a kadar gizlidir
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
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
                        Kaydet
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </section>

          </div>

          {/* SAĞ ALAN: PUAN TABLOSU (lg:col-span-4 - STICKY) */}
          <div className="lg:col-span-4 lg:sticky lg:top-6 space-y-4">
            <section className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 shadow-xl">
              
              <div className="flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  <Trophy className="w-4 h-4 text-yellow-400" /> Puan Tablosu
                </h2>
                <span className="text-[11px] bg-slate-800 text-slate-400 px-2 py-0.5 rounded font-semibold">
                  Canlı Sıralama
                </span>
              </div>

              {/* DİKEY LİSTE (EN ÇOK PUAN ALAN EN TEPEDE) */}
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

              {/* KURALLAR KÜÇÜK BİLGİ */}
              <div className="mt-4 pt-3 border-t border-slate-800 text-[11px] text-slate-400 space-y-1">
                <p className="font-semibold text-slate-300">Puanlama Özeti:</p>
                <p>• Tam Skor: <b className="text-emerald-400">+3 Puan</b></p>
                <p>• Maç Sonucu: <b className="text-blue-400">+1 Puan</b></p>
                <p>• Yanlış Tahmin: <b className="text-red-400">-1 Puan</b></p>
                <p>• Kırmızı Kart: <b className="text-amber-400">+3P / -2P / +6P</b></p>
              </div>

            </section>
          </div>

        </div>

      </div>
    </main>
  );
}
