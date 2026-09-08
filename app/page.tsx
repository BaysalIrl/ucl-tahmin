'use client';

import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Trophy, Flame, ChevronDown, Lock, EyeOff, ShieldCheck } from 'lucide-react';

interface Profile {
  id: string;
  username: string;
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

// 1. HAFTA İÇİN İRLANDA SAATİYLE KİLİTLENME ZAMANI: 8 Eylül 2026 Salı 17:30 (UTC+1)
const DEADLINE = new Date('2026-09-08T17:30:00+01:00');

export default function Home() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [activeUser, setActiveUser] = useState<Profile | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [myPredictions, setMyPredictions] = useState<Record<number, Prediction>>({});
  const [allPredictions, setAllPredictions] = useState<Prediction[]>([]);
  const [activeWeek, setActiveWeek] = useState<number>(1);
  const [showAdmin, setShowAdmin] = useState(false);
  const [adminScores, setAdminScores] = useState<Record<number, any>>({});
  const [isLocked, setIsLocked] = useState(false);

  useEffect(() => {
    // Kilit kontrolü: Şu anki saat Salı 17:30'u geçti mi?
    const checkLock = () => {
      setIsLocked(new Date() >= DEADLINE);
    };
    checkLock();
    const interval = setInterval(checkLock, 10000); // 10 saniyede bir saati kontrol eder
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, [activeWeek]);

  useEffect(() => {
    if (activeUser) {
      localStorage.setItem('ucl_user_id', activeUser.id);
      fetchUserPredictions(activeUser.id);
    }
  }, [activeUser]);

  async function fetchInitialData() {
    const { data: profs } = await supabase
      .from('profiles')
      .select('*')
      .order('total_points', { ascending: false });

    if (profs && profs.length > 0) {
      setProfiles(profs);
      const savedUserId = localStorage.getItem('ucl_user_id');
      const found = profs.find((p) => p.id === savedUserId);
      setActiveUser(found || profs[0]);
    }

    const { data: mtchs } = await supabase
      .from('matches')
      .select('*')
      .eq('week_number', activeWeek)
      .order('match_date', { ascending: true });

    if (mtchs) setMatches(mtchs);

    // Tüm tahminleri çek (Kilitlendikten sonra rakipleri göstermek için)
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

  function handlePredChange(matchId: number, field: string, value: any) {
    if (isLocked) return;
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
    if (isLocked) {
      alert('Süre doldu! Salı 17:30 İrlanda saati itibarıyla tahminler kilitlenmiştir.');
      return;
    }
    if (!activeUser) return;
    const p = myPredictions[matchId];
    if (!p) return;

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
      alert('Tahmin başarıyla kaydedildi!');
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
    if (activeUser) fetchUserPredictions(activeUser.id);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-3 md:p-6 font-sans">
      <div className="max-w-4xl mx-auto space-y-6">
        
        {/* ÜST PANEL / OYUNCU SEÇİMİ */}
        <header className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-slate-900 border border-slate-800 p-4 rounded-2xl">
          <div>
            <h1 className="text-xl font-black text-white">⚽ UCL Tahmin Ligi</h1>
            <p className="text-xs text-slate-400">Şampiyonlar Ligi 2026/27</p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Sen Kimsin?</span>
            <div className="flex gap-1.5 bg-slate-950 p-1.5 rounded-xl border border-slate-800">
              {profiles.map((p) => (
                <button
                  key={p.id}
                  onClick={() => setActiveUser(p)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition ${
                    activeUser?.id === p.id ? 'bg-blue-600 text-white shadow' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.username}
                </button>
              ))}
            </div>
          </div>
        </header>

        {/* KİLİT DURUMU BİLGİLENDİRMESİ */}
        <div className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
          isLocked 
            ? 'bg-red-500/10 border-red-500/30 text-red-300' 
            : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
        }`}>
          <div className="flex items-center gap-2 font-bold">
            {isLocked ? <Lock className="w-4 h-4 text-red-400" /> : <ShieldCheck className="w-4 h-4 text-emerald-400" />}
            <span>
              {isLocked 
                ? 'Tahminler Kilitlendi! (Salı 17:30 İrlanda saati geçti)' 
                : 'Tahminler Açık — Kapanış: Salı 17:30 (İrlanda Saati)'}
            </span>
          </div>
          <span className="font-semibold text-[11px] opacity-80">
            {isLocked ? 'Herkesin tahminleri açıldı' : 'Tahminler gizli tutuluyor'}
          </span>
        </div>

        {/* PUAN DURUMU */}
        <section className="bg-slate-900/60 border border-slate-800 rounded-2xl p-4">
          <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-yellow-400" /> Puan Tablosu
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {profiles.map((p, idx) => (
              <div key={p.id} className="bg-slate-950 border border-slate-800 p-3.5 rounded-xl flex items-center justify-between">
                <div>
                  <span className="text-xs text-slate-500 font-bold mr-2">#{idx + 1}</span>
                  <span className="font-bold text-sm text-white">{p.username}</span>
                  {p.has_won_championship && <p className="text-[10px] text-red-400 font-bold">🏆 ŞAMPİYON</p>}
                </div>
                <span className="text-2xl font-black text-white">{p.total_points}</span>
              </div>
            ))}
          </div>
        </section>

        {/* MAÇLAR & TAHMİN KARTLARI */}
        <section className="space-y-3">
          <h2 className="text-sm font-bold text-white flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-400" /> 1. Hafta Maçları
          </h2>

          {matches.map((m) => {
            const pred = myPredictions[m.id] || {
              pred_home_score: 0,
              pred_away_score: 0,
              pred_red_card: false,
              pred_red_card_team: 'NONE',
            };

            return (
              <div key={m.id} className="bg-slate-900 border border-slate-800 p-4 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  {m.multiplier === 3 ? (
                    <span className="bg-red-500/20 text-red-400 border border-red-500/30 font-black px-2 py-0.5 rounded">
                      🔥 GALATASARAY (x3 PUAN)
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

                {/* Skor Tahmin Alanı */}
                <div className="grid grid-cols-3 items-center gap-2">
                  <span className="text-right font-bold text-sm text-white">{m.home_team}</span>
                  <div className="flex items-center justify-center gap-2">
                    <input
                      type="number"
                      min="0"
                      disabled={isLocked}
                      value={pred.pred_home_score}
                      onChange={(e) => handlePredChange(m.id, 'pred_home_score', e.target.value)}
                      className={`w-12 h-10 bg-slate-950 border border-slate-700 text-center font-black rounded-lg text-white outline-none ${
                        isLocked ? 'opacity-60 cursor-not-allowed' : 'focus:border-blue-500'
                      }`}
                    />
                    <span>-</span>
                    <input
                      type="number"
                      min="0"
                      disabled={isLocked}
                      value={pred.pred_away_score}
                      onChange={(e) => handlePredChange(m.id, 'pred_away_score', e.target.value)}
                      className={`w-12 h-10 bg-slate-950 border border-slate-700 text-center font-black rounded-lg text-white outline-none ${
                        isLocked ? 'opacity-60 cursor-not-allowed' : 'focus:border-blue-500'
                      }`}
                    />
                  </div>
                  <span className="text-left font-bold text-sm text-white">{m.away_team}</span>
                </div>

                {/* Kırmızı Kart ve Kaydetme */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                  <div className="flex items-center gap-2">
                    <label className="flex items-center gap-1.5 cursor-pointer text-slate-300">
                      <input
                        type="checkbox"
                        disabled={isLocked}
                        checked={pred.pred_red_card}
                        onChange={(e) => handlePredChange(m.id, 'pred_red_card', e.target.checked)}
                        className="w-3.5 h-3.5 accent-red-600"
                      />
                      🟥 Kırmızı Kart (+3P / -2P)
                    </label>
                    {pred.pred_red_card && (
                      <select
                        disabled={isLocked}
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
                    {pred.earned_points !== undefined && m.is_finished && (
                      <span className={`font-black px-2 py-0.5 rounded text-xs ${
                        pred.earned_points >= 0 ? 'bg-emerald-500/20 text-emerald-400' : 'bg-red-500/20 text-red-400'
                      }`}>
                        {pred.earned_points > 0 ? `+${pred.earned_points}` : pred.earned_points}P
                      </span>
                    )}

                    {!isLocked && (
                      <button
                        onClick={() => savePrediction(m.id)}
                        className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-3 py-1.5 rounded-lg transition"
                      >
                        Kaydet
                      </button>
                    )}
                  </div>
                </div>

                {/* RAKİP TAHMİNLERİ BÖLÜMÜ (KOPYA KORUMASI) */}
                <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between text-[11px]">
                  <span className="text-slate-500 font-medium">Diğer Oyuncular:</span>
                  {isLocked ? (
                    // Kilit açıldıktan sonra herkesinkini göster
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
                    // Kilit saatine kadar gizli tut
                    <span className="flex items-center gap-1 text-slate-500 italic">
                      <EyeOff className="w-3 h-3 text-slate-500" /> Tahminler Salı 17:30'a kadar gizlidir
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </section>

        {/* ADMIN MODU (GİZLİ YÖNETİM) */}
        <section className="border border-slate-800 rounded-xl p-3 bg-slate-900/30 text-xs">
          <button
            onClick={() => setShowAdmin(!showAdmin)}
            className="flex items-center justify-between w-full font-bold text-slate-400 hover:text-white"
          >
            <span>⚙️ Maç Sonucu Girişi (Admin)</span>
            <ChevronDown className={`w-4 h-4 transition ${showAdmin ? 'rotate-180' : ''}`} />
          </button>
          {showAdmin && (
            <div className="mt-3 space-y-2 pt-2 border-t border-slate-800">
              {matches.map((m) => (
                <div key={m.id} className="flex items-center justify-between gap-2 bg-slate-950 p-2 rounded-lg">
                  <span className="font-bold text-white w-40 truncate">{m.home_team} - {m.away_team}</span>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="Ev"
                      className="w-10 bg-slate-900 border border-slate-700 p-1 text-center rounded text-white"
                      onChange={(e) => setAdminScores(prev => ({ ...prev, [m.id]: { ...(prev[m.id] || {}), home_score: e.target.value } }))}
                    />
                    <span>-</span>
                    <input
                      type="number"
                      placeholder="Dep"
                      className="w-10 bg-slate-900 border border-slate-700 p-1 text-center rounded text-white"
                      onChange={(e) => setAdminScores(prev => ({ ...prev, [m.id]: { ...(prev[m.id] || {}), away_score: e.target.value } }))}
                    />
                    <label className="flex items-center gap-1 ml-2 text-[11px]">
                      <input
                        type="checkbox"
                        onChange={(e) => setAdminScores(prev => ({ ...prev, [m.id]: { ...(prev[m.id] || {}), has_red_card: e.target.checked } }))}
                      />
                      🟥
                    </label>
                  </div>
                  <button
                    onClick={() => submitMatchResult(m)}
                    className="bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 rounded font-bold text-[11px]"
                  >
                    Onayla
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}
