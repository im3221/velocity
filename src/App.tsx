/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Gauge, 
  Check, 
  Play, 
  Pause, 
  RefreshCcw, 
  Lightbulb, 
  User, 
  LayoutDashboard 
} from 'lucide-react';
import { collection, addDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './lib/firebase';

// --- 자동차 그래픽 ---
const ToyCar = ({ color, shadow }: { color: string; shadow?: boolean }) => (
  <svg viewBox="0 0 100 60" className={`w-full h-full ${shadow ? 'drop-shadow-lg' : ''}`} preserveAspectRatio="xMinYMid meet">
    <path d="M0 45 L5 25 Q10 15 30 15 L70 15 Q90 15 95 25 L100 45 Z" fill={color} />
    <rect x="0" y="40" width="100" height="12" rx="4" fill={color} />
    <path d="M15 20 Q25 18 48 18 L48 35 L12 35 Z" fill="#ffffff" fillOpacity="0.5" />
    <path d="M52 18 L85 18 Q90 19 88 35 L52 35 Z" fill="#ffffff" fillOpacity="0.5" />
    <circle cx="20" cy="50" r="8" fill="#1e293b" />
    <circle cx="20" cy="50" r="3" fill="#94a3b8" />
    <circle cx="80" cy="50" r="8" fill="#1e293b" />
    <circle cx="80" cy="50" r="3" fill="#94a3b8" />
  </svg>
);

export default function App() {
  // --- 상태 관리 ---
  const [student, setStudent] = useState({ id: '', name: '' });
  const [isStarted, setIsStarted] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [isPlaying, setIsPlaying] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const [intervalTime, setIntervalTime] = useState(1);
  const [flashes, setFlashes] = useState<any[]>([]);
  
  const [inputPos, setInputPos] = useState<{ A: any; B: any }>({ A: {}, B: {} });
  const [answers, setAnswers] = useState({ q1: '', q2: '', q3: '', q4: '', q5: '' });
  
  const [activeGraphTab, setActiveGraphTab] = useState<'dist' | 'speed'>('dist');
  const [plottedA, setPlottedA] = useState<any[]>([]);
  const [plottedB, setPlottedB] = useState<any[]>([]);
  const [hoverPoint, setHoverPoint] = useState<any>(null);
  const [selectedCar, setSelectedCar] = useState<'A' | 'B'>('A');

  const speedA = 4;
  const speedB = 8;
  const totalTime = 4;
  const timerRef = useRef<number | null>(null);

  // --- 시뮬레이션 로직 ---
  useEffect(() => {
    if (isPlaying) {
      const start = Date.now() - elapsedTime * 1000;
      const tick = () => {
        const current = (Date.now() - start) / 1000;
        if (current >= totalTime) {
          setElapsedTime(totalTime);
          setIsPlaying(false);
          return;
        }
        setElapsedTime(current);
        timerRef.current = requestAnimationFrame(tick);
      };
      timerRef.current = requestAnimationFrame(tick);
    } else if (timerRef.current) {
      cancelAnimationFrame(timerRef.current);
    }
    return () => {
      if (timerRef.current) cancelAnimationFrame(timerRef.current);
    };
  }, [isPlaying]);

  useEffect(() => {
    const count = Math.floor(elapsedTime / intervalTime);
    const newFlashes = [];
    for (let i = 0; i <= count; i++) {
      const t = i * intervalTime;
      newFlashes.push({ t, posA: t * speedA, posB: t * speedB });
    }
    setFlashes(newFlashes);
  }, [elapsedTime, intervalTime]);

  // --- Firebase 데이터 저장 ---
  const handleFinalSubmit = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    try {
      const finalData = {
        studentId: student.id,
        studentName: student.name,
        intervalTime,
        experimentData: {
          inputPos,
          plottedA,
          plottedB,
          answers
        },
        submittedAt: new Date().toISOString()
      };
      
      const path = 'results';
      await addDoc(collection(db, path), finalData);
      
      setIsSubmitted(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'results');
    } finally {
      setIsSubmitting(false);
    }
  };

  // --- 그래프 헬퍼 ---
  const maxX = 5;
  const maxY = activeGraphTab === 'dist' ? 40 : 10;
  
  const toSvgX = (x: number) => (x / maxX) * 75 + 15;
  const toSvgY = (y: number) => 85 - (y / maxY) * 75;
  
  const fromSvgX = (sx: number) => ((sx - 15) / 75) * maxX;
  const fromSvgY = (sy: number) => ((85 - sy) / 75) * maxY;

  const handleGraphClick = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * 100;
    const sy = ((e.clientY - rect.top) / rect.height) * 100;
    
    const dx = fromSvgX(sx);
    const dy = fromSvgY(sy);
    
    const sdx = Math.round(dx * 2) / 2;
    const sdy = activeGraphTab === 'dist' ? Math.round(dy) : Math.round(dy * 10) / 10;

    if (sdx < 0 || sdx > maxX || sdy < 0 || sdy > maxY) return;

    if (selectedCar === 'A') {
      if (!plottedA.find(p => p.x === sdx)) setPlottedA([...plottedA, { x: sdx, y: sdy }].sort((a,b)=>a.x-b.x));
      else setPlottedA(plottedA.filter(p => p.x !== sdx));
    } else {
      if (!plottedB.find(p => p.x === sdx)) setPlottedB([...plottedB, { x: sdx, y: sdy }].sort((a,b)=>a.x-b.x));
      else setPlottedB(plottedB.filter(p => p.x !== sdx));
    }
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const svg = e.currentTarget;
    const rect = svg.getBoundingClientRect();
    const sx = ((e.clientX - rect.left) / rect.width) * 100;
    const sy = ((e.clientY - rect.top) / rect.height) * 100;
    
    const dx = fromSvgX(sx);
    const dy = fromSvgY(sy);
    const sdx = Math.round(dx * 2) / 2;
    const sdy = activeGraphTab === 'dist' ? Math.round(dy) : Math.round(dy * 10) / 10;

    if (sdx >= 0 && sdx <= maxX && sdy >= 0 && sdy <= maxY) {
      setHoverPoint({ x: sdx, y: sdy });
    } else {
      setHoverPoint(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-100 selection:text-blue-900 pb-20">
      <AnimatePresence>
        {/* 입장 모달 */}
        {!isStarted && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            key="login-modal"
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-md p-4"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl"
            >
              <div className="flex justify-center mb-6">
                <div className="bg-blue-600 p-4 rounded-2xl shadow-lg shadow-blue-200">
                  <Gauge className="w-10 h-10 text-white" />
                </div>
              </div>
              <h2 className="text-3xl font-black text-slate-800 mb-2 text-center">과학 실험실 입장</h2>
              <p className="text-center text-slate-500 mb-8 font-medium">Ⅲ. 운동과 에너지 - 등속 운동 실험</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">학번</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-4 bg-slate-100 rounded-2xl outline-none focus:ring-4 ring-blue-500/10 border-2 border-transparent focus:border-blue-500 font-bold transition-all" 
                    value={student.id} 
                    onChange={e => setStudent({...student, id: e.target.value})} 
                    placeholder="예: 30101" 
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold text-slate-400 mb-1 ml-1">이름</label>
                  <input 
                    type="text" 
                    className="w-full px-5 py-4 bg-slate-100 rounded-2xl outline-none focus:ring-4 ring-blue-500/10 border-2 border-transparent focus:border-blue-500 font-bold transition-all" 
                    value={student.name} 
                    onChange={e => setStudent({...student, name: e.target.value})} 
                    placeholder="이름을 입력하세요" 
                  />
                </div>
                <button 
                  disabled={!student.id || !student.name} 
                  onClick={() => setIsStarted(true)}
                  className="w-full py-4 mt-4 bg-blue-600 text-white rounded-2xl font-bold text-lg shadow-lg shadow-blue-200 hover:bg-blue-700 disabled:opacity-50 transition-all active:scale-[0.98] cursor-pointer"
                >
                  실험 시작하기
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* 제출 완료 모달 */}
        {isSubmitted && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            key="success-modal"
            className="fixed inset-0 z-50 flex items-center justify-center bg-blue-600/90 backdrop-blur-xl p-4"
          >
            <motion.div 
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              className="bg-white rounded-3xl p-10 max-w-sm w-full text-center shadow-2xl"
            >
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                <Check className="w-10 h-10 text-green-600" />
              </div>
              <h3 className="text-2xl font-black mb-2">학습 완료!</h3>
              <p className="text-slate-500 mb-8">{student.name} 학생의 실험 결과가 실시간으로 수집되었습니다.</p>
              <button 
                onClick={() => window.location.reload()} 
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-bold hover:bg-slate-800 transition-colors cursor-pointer"
              >
                다시 실험하기
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 헤더 */}
      <header className="sticky top-0 z-40 bg-white/80 backdrop-blur-md px-6 py-4 flex justify-between items-center shadow-sm border-b border-slate-200">
        <div className="flex items-center gap-4">
          <div className="bg-blue-600 p-2.5 rounded-xl text-white shadow-lg shadow-blue-100">
            <Gauge className="w-6 h-6" />
          </div>
          <div>
            <h1 className="text-xl font-black text-slate-800 leading-tight">등속 운동 가상 실험실</h1>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">배곧라라중학교 3학년 과학</p>
          </div>
        </div>
        <div className="hidden sm:flex items-center gap-3 bg-slate-100 px-5 py-2.5 rounded-full border border-slate-200 shadow-inner">
          <User className="w-4 h-4 text-slate-400" />
          <span className="text-sm font-bold text-slate-600">{student.id} {student.name}</span>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 mt-10 space-y-12">
        {/* 1. 탐구: 운동 표현 및 분석 */}
        <section className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-8">
            <span className="bg-blue-100 text-blue-600 px-4 py-1.5 rounded-full text-xs font-black ring-4 ring-blue-50">STORY 01</span>
            <h2 className="text-2xl font-black text-slate-800">탐구: 운동을 표현하고 분석하기</h2>
          </div>

          <div className="flex flex-wrap gap-4 mb-10 items-end">
            <div className="flex-1 min-w-[200px] space-y-2">
              <label className="text-[10px] font-black text-slate-400 ml-2 uppercase tracking-tighter">시간 간격 설정 (s)</label>
              <div className="relative">
                <select 
                  className="w-full bg-slate-100 px-5 py-4 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 appearance-none cursor-pointer transition-all" 
                  value={intervalTime} 
                  onChange={e => setIntervalTime(Number(e.target.value))}
                >
                  <option value={1}>1.0초 간격으로 촬영</option>
                  <option value={2}>2.0초 간격으로 촬영</option>
                </select>
                <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                  <RefreshCcw className="w-4 h-4" />
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => setIsPlaying(!isPlaying)} 
                className={`px-10 py-4 rounded-2xl font-black flex items-center gap-3 transition-all cursor-pointer ${isPlaying ? 'bg-red-50 text-red-600 border-2 border-red-100' : 'bg-blue-600 text-white shadow-xl shadow-blue-200 hover:translate-y-[-2px] active:translate-y-0'}`}
              >
                {isPlaying ? <Pause className="w-5 h-5 fill-current" /> : <Play className="w-5 h-5 fill-current" />}
                {isPlaying ? '촬영 중지' : '다중섬광 촬영 시작'}
              </button>
              <button 
                onClick={() => {setElapsedTime(0); setFlashes([]); setIsPlaying(false);}} 
                className="p-4 bg-slate-100 text-slate-600 rounded-2xl hover:bg-slate-200 transition-colors cursor-pointer"
                title="초기화"
              >
                <RefreshCcw className="w-6 h-6" />
              </button>
            </div>
            <div className="ml-auto bg-slate-900 ring-8 ring-slate-100 text-white px-8 py-4 rounded-3xl font-mono text-3xl font-bold shadow-2xl">
              {elapsedTime.toFixed(2)}<span className="text-xl opacity-50 ml-1">s</span>
            </div>
          </div>

          {/* 시뮬레이션 트랙 */}
          <div className="bg-slate-50 rounded-[2rem] p-12 relative overflow-hidden border border-slate-100 shadow-inner mb-10 group">
            <div className="absolute inset-x-12 inset-y-0 flex justify-between pointer-events-none opacity-20 transition-opacity group-hover:opacity-30">
              {Array.from({length: 41}).map((_, i) => ( 
                <div key={i} className={`h-full w-px ${i % 5 === 0 ? 'bg-slate-900 w-[2px]' : 'bg-slate-400'}`}></div> 
              ))}
            </div>
            
            <div className="relative h-24 mb-16 flex items-center">
              <div className="absolute -left-8 flex flex-col items-center">
                <span className="text-[10px] font-black text-red-500 bg-red-50 px-2 py-1 rounded-md mb-1 border border-red-100">(가)</span>
                <div className="h-20 w-1 bg-red-200 rounded-full"></div>
              </div>
              {flashes.map((f, i) => (
                <div key={i} className="absolute h-12 opacity-30 pointer-events-none" style={{ left: `${(f.posA / 40) * 100}%`, width: '15%' }}>
                  <ToyCar color="#ef4444" />
                  <span className="absolute -top-8 left-0 text-[10px] font-black text-red-500/60 bg-white px-1.5 py-0.5 rounded shadow-sm border border-red-50">{f.t}s</span>
                </div>
              ))}
              <motion.div 
                className="absolute h-20 z-10" 
                style={{ left: `${(elapsedTime * speedA / 40) * 100}%`, width: '15%' }}
              >
                <ToyCar color="#ef4444" shadow />
              </motion.div>
            </div>

            <div className="relative h-24 mb-10 flex items-center">
              <div className="absolute -left-8 flex flex-col items-center">
                <span className="text-[10px] font-black text-green-500 bg-green-50 px-2 py-1 rounded-md mb-1 border border-green-100">(나)</span>
                <div className="h-20 w-1 bg-green-200 rounded-full"></div>
              </div>
              {flashes.map((f, i) => (
                <div key={i} className="absolute h-12 opacity-30 pointer-events-none" style={{ left: `${(f.posB / 40) * 100}%`, width: '15%' }}>
                  <ToyCar color="#22c55e" />
                  <span className="absolute -top-8 left-0 text-[10px] font-black text-green-500/60 bg-white px-1.5 py-0.5 rounded shadow-sm border border-green-50">{f.t}s</span>
                </div>
              ))}
              <motion.div 
                className="absolute h-20 z-10" 
                style={{ left: `${(elapsedTime * speedB / 40) * 100}%`, width: '15%' }}
              >
                <ToyCar color="#22c55e" shadow />
              </motion.div>
            </div>

            <div className="relative h-12 border-t-4 border-slate-800 pt-4">
              {Array.from({length: 41}).map((_, i) => (
                <div key={i} className="absolute top-0 w-px bg-slate-800" style={{ left: `${(i/40)*100}%`, height: i % 5 === 0 ? '1.5rem' : '0.8rem', opacity: i % 5 === 0 ? 1 : 0.3 }}>
                  {i % 5 === 0 && <span className="absolute top-6 left-1/2 -translate-x-1/2 text-[11px] font-black text-slate-800">{i}</span>}
                </div>
              ))}
              <span className="absolute right-0 top-8 text-[10px] font-bold text-slate-400">cm</span>
            </div>
          </div>

          {/* 데이터 테이블 */}
          <div className="overflow-x-auto rounded-3xl border border-slate-200">
            <table className="w-full text-center border-collapse text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="border-b border-r border-slate-200 p-4 font-black text-slate-500 uppercase tracking-widest text-[10px]" colSpan={2}>측정 항목</th>
                  <th className="border-b border-r border-slate-200 p-4 font-mono font-bold">0s</th>
                  <th className="border-b border-r border-slate-200 p-4 font-mono font-bold">1s</th>
                  <th className="border-b border-r border-slate-200 p-4 font-mono font-bold">2s</th>
                  <th className="border-b border-r border-slate-200 p-4 font-mono font-bold">3s</th>
                  <th className="border-b border-slate-200 p-4 font-mono font-bold">4s</th>
                </tr>
              </thead>
              <tbody>
                <tr className="group">
                  <td className="border-b border-r border-slate-200 p-4 font-black bg-red-50 text-red-600" rowSpan={2}>(가)</td>
                  <td className="border-b border-r border-slate-200 p-4 text-[11px] font-black bg-slate-50/50 text-slate-500">이동거리(cm)</td>
                  {[0,1,2,3,4].map(t => (
                    <td key={t} className="border-b border-r border-slate-200 p-2 group-hover:bg-red-50/20 transition-colors">
                      <input 
                        type="number" 
                        className="w-full p-3 text-center outline-none bg-transparent font-bold focus:text-blue-600" 
                        value={inputPos.A[t] || ''} 
                        onChange={e => setInputPos({...inputPos, A: {...inputPos.A, [t]: e.target.value}})} 
                      />
                    </td>
                  ))}
                </tr>
                <tr className="bg-red-50/10">
                  <td className="border-b border-r border-slate-200 p-4 text-[11px] font-black bg-slate-50/50 text-slate-500">속력(cm/s)</td>
                  <td className="border-b border-r border-slate-200 bg-slate-100 text-slate-400 font-bold">-</td>
                  {[1,2,3,4].map(t => (
                    <td key={t} className="border-b border-r border-slate-200 p-2">
                      <span className="text-red-500 font-mono font-black text-lg">
                        {inputPos.A[t] && inputPos.A[t-1] !== undefined ? (Number(inputPos.A[t]) - Number(inputPos.A[t-1] || 0)).toFixed(1) : '?'}
                      </span>
                    </td>
                  ))}
                </tr>
                <tr className="group">
                  <td className="border-b border-r border-slate-200 p-4 font-black bg-green-50 text-green-600" rowSpan={2}>(나)</td>
                  <td className="border-b border-r border-slate-200 p-4 text-[11px] font-black bg-slate-50/50 text-slate-500">이동거리(cm)</td>
                  {[0,1,2,3,4].map(t => (
                    <td key={t} className="border-b border-r border-slate-200 p-2 group-hover:bg-green-50/20 transition-colors">
                      <input 
                        type="number" 
                        className="w-full p-3 text-center outline-none bg-transparent font-bold focus:text-blue-600" 
                        value={inputPos.B[t] || ''} 
                        onChange={e => setInputPos({...inputPos, B: {...inputPos.B, [t]: e.target.value}})} 
                      />
                    </td>
                  ))}
                </tr>
                <tr className="bg-green-50/10">
                  <td className="border-r border-slate-200 p-4 text-[11px] font-black bg-slate-50/50 text-slate-500">속력(cm/s)</td>
                  <td className="border-r border-slate-200 bg-slate-100 text-slate-400 font-bold">-</td>
                  {[1,2,3,4].map(t => (
                    <td key={t} className="border-r border-slate-200 p-2">
                      <span className="text-green-500 font-mono font-black text-lg">
                        {inputPos.B[t] && inputPos.B[t-1] !== undefined ? (Number(inputPos.B[t]) - Number(inputPos.B[t-1] || 0)).toFixed(1) : '?'}
                      </span>
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        {/* 2. 그래프 그리기 */}
        <section className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-slate-200">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-10 gap-4">
            <div className="flex items-center gap-3">
              <span className="bg-purple-100 text-purple-600 px-4 py-1.5 rounded-full text-xs font-black ring-4 ring-purple-50">STORY 02</span>
              <h2 className="text-2xl font-black text-slate-800">그래프 그리기 및 해석</h2>
            </div>
            <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200">
              <button 
                onClick={()=>setActiveGraphTab('dist')} 
                className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${activeGraphTab === 'dist' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                시간-이동거리 그래프
              </button>
              <button 
                onClick={()=>setActiveGraphTab('speed')} 
                className={`px-6 py-2.5 rounded-xl text-xs font-black transition-all cursor-pointer ${activeGraphTab === 'speed' ? 'bg-white shadow-md text-blue-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                시간-속력 그래프
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-12">
            <div className="lg:col-span-3 relative aspect-[4/3] bg-white rounded-[2rem] border-4 border-slate-100 overflow-hidden cursor-crosshair shadow-2xl shadow-slate-100">
              <svg 
                viewBox="0 0 100 100" 
                className="w-full h-full" 
                onClick={handleGraphClick} 
                onMouseMove={handleMouseMove} 
                onMouseLeave={()=>setHoverPoint(null)}
              >
                {/* 배경 격자 */}
                {Array.from({length: 9}).map((_, i) => (
                  <line key={`gh${i}`} x1="15" y1={10 + i * 9.375} x2="90" y2={10 + i * 9.375} stroke="#f1f5f9" strokeWidth="0.5" />
                ))}
                {Array.from({length: 11}).map((_, i) => (
                  <line key={`gv${i}`} x1={15 + i * 7.5} y1="10" x2={15 + i * 7.5} y2="85" stroke="#f1f5f9" strokeWidth="0.5" />
                ))}

                {/* 가로 격자선 및 Y축 숫자 */}
                {Array.from({length: 5}).map((_, i) => {
                  const val = activeGraphTab === 'dist' ? i * 10 : i * 2.5;
                  const y = toSvgY(val);
                  return (
                    <g key={`h${i}`}>
                      <line x1="15" y1={y} x2="90" y2={y} stroke="#e2e8f0" strokeWidth="0.3" strokeDasharray="1,1" />
                      <text x="12" y={y} textAnchor="end" dominantBaseline="middle" className="text-[3px] font-black fill-slate-400 font-mono">{val}</text>
                    </g>
                  );
                })}
                <text x="12" y={toSvgY(maxY)} textAnchor="end" dominantBaseline="middle" className="text-[3px] font-black fill-slate-400 font-mono">{maxY}</text>

                {/* 세로 격자선 및 X축 숫자 */}
                {Array.from({length: 6}).map((_, i) => {
                  const x = toSvgX(i);
                  return (
                    <g key={`v${i}`}>
                      <line x1={x} y1="10" x2={x} y2="85" stroke="#e2e8f0" strokeWidth="0.3" strokeDasharray="1,1" />
                      <text x={x} y="92" textAnchor="middle" className="text-[3px] font-black fill-slate-400 font-mono">{i}</text>
                    </g>
                  );
                })}

                {/* 축 선 */}
                <line x1="15" y1="10" x2="15" y2="85" stroke="#1e293b" strokeWidth="0.8" strokeLinecap="round" />
                <line x1="15" y1="85" x2="90" y2="85" stroke="#1e293b" strokeWidth="0.8" strokeLinecap="round" />
                
                {/* 화살표 */}
                <path d="M14 12 L15 10 L16 12" fill="none" stroke="#1e293b" strokeWidth="0.8" />
                <path d="M88 84 L90 85 L88 86" fill="none" stroke="#1e293b" strokeWidth="0.8" />

                {/* 데이터 플로팅 (가) */}
                {plottedA.length > 1 && (
                  <motion.polyline 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    points={plottedA.map(p => `${toSvgX(p.x)},${toSvgY(p.y)}`).join(' ')} 
                    fill="none" 
                    stroke="#ef4444" 
                    strokeWidth="1" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />
                )}
                {plottedA.map((p, i) => (
                  <motion.circle 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    key={`pa${i}`} 
                    cx={toSvgX(p.x)} 
                    cy={toSvgY(p.y)} 
                    r="1.8" 
                    fill="#ef4444" 
                    className="drop-shadow-md" 
                  />
                ))}
                
                {/* 데이터 플로팅 (나) */}
                {plottedB.length > 1 && (
                  <motion.polyline 
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    points={plottedB.map(p => `${toSvgX(p.x)},${toSvgY(p.y)}`).join(' ')} 
                    fill="none" 
                    stroke="#22c55e" 
                    strokeWidth="1" 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                  />
                )}
                {plottedB.map((p, i) => (
                  <motion.circle 
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    key={`pb${i}`} 
                    cx={toSvgX(p.x)} 
                    cy={toSvgY(p.y)} 
                    r="1.8" 
                    fill="#22c55e" 
                    className="drop-shadow-md" 
                  />
                ))}

                {/* 호버 가이드 */}
                {hoverPoint && (
                  <g>
                    <line x1="15" y1={toSvgY(hoverPoint.y)} x2={toSvgX(hoverPoint.x)} y2={toSvgY(hoverPoint.y)} stroke={selectedCar === 'A' ? '#fee2e2' : '#dcfce7'} strokeWidth="0.5" strokeDasharray="1,1" />
                    <line x1={toSvgX(hoverPoint.x)} y1="85" x2={toSvgX(hoverPoint.x)} y2={toSvgY(hoverPoint.y)} stroke={selectedCar === 'A' ? '#fee2e2' : '#dcfce7'} strokeWidth="0.5" strokeDasharray="1,1" />
                    <circle cx={toSvgX(hoverPoint.x)} cy={toSvgY(hoverPoint.y)} r="3" fill={selectedCar === 'A' ? '#ef4444' : '#22c55e'} fillOpacity="0.3" />
                  </g>
                )}
              </svg>
              {/* 축 라벨 */}
              <div className="absolute left-3 top-8 text-[12px] font-black text-slate-800 flex items-center gap-2">
                <div className="w-1 h-3 bg-blue-500 rounded-full"></div>
                {activeGraphTab === 'dist' ? '이동거리 (cm)' : '속력 (cm/s)'}
              </div>
              <div className="absolute right-12 bottom-6 text-[12px] font-black text-slate-800 flex items-center gap-2">
                <div className="w-3 h-1 bg-blue-500 rounded-full"></div>
                시간 (s)
              </div>

              {/* 실시간 툴팁 */}
              {hoverPoint && (
                <div 
                  className="absolute pointer-events-none bg-slate-900 text-white px-3 py-1.5 rounded-lg text-[10px] font-bold shadow-xl flex items-center gap-2 border border-slate-700"
                  style={{ left: `${toSvgX(hoverPoint.x)}%`, top: `${toSvgY(hoverPoint.y) - 8}%`, transform: 'translateX(-50%)' }}
                >
                  <span className="opacity-50 font-mono">{hoverPoint.x}s</span>
                  <span className="w-px h-2 bg-slate-700"></span>
                  <span className="text-blue-400 font-mono">{hoverPoint.y}{activeGraphTab === 'dist' ? 'cm' : 'cm/s'}</span>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <div className="p-6 bg-slate-50 rounded-3xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2 mb-6">
                  <LayoutDashboard className="w-4 h-4 text-slate-400" />
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest">분석 도구</h4>
                </div>
                <div className="space-y-3">
                  <button 
                    onClick={()=>setSelectedCar('A')} 
                    className={`w-full py-4 rounded-2xl text-sm font-black border-2 transition-all flex items-center justify-center gap-3 cursor-pointer ${selectedCar === 'A' ? 'bg-red-500 border-red-500 text-white shadow-xl shadow-red-200' : 'bg-white border-red-100 text-red-500 hover:bg-red-50'}`}
                  >
                    <div className={`w-3 h-3 rounded-full ${selectedCar === 'A' ? 'bg-white' : 'bg-red-500'}`}></div>
                    (가) 데이터 기록
                  </button>
                  <button 
                    onClick={()=>setSelectedCar('B')} 
                    className={`w-full py-4 rounded-2xl text-sm font-black border-2 transition-all flex items-center justify-center gap-3 cursor-pointer ${selectedCar === 'B' ? 'bg-green-500 border-green-500 text-white shadow-xl shadow-green-200' : 'bg-white border-green-100 text-green-500 hover:bg-green-50'}`}
                  >
                    <div className={`w-3 h-3 rounded-full ${selectedCar === 'B' ? 'bg-white' : 'bg-green-500'}`}></div>
                    (나) 데이터 기록
                  </button>
                  <button 
                    onClick={()=>{setPlottedA([]); setPlottedB([]);}} 
                    className="w-full py-4 bg-slate-200 text-slate-600 rounded-2xl text-sm font-black hover:bg-slate-300 transition-colors flex items-center justify-center gap-2 cursor-pointer mt-4"
                  >
                    <RefreshCcw className="w-4 h-4" />
                    그래프 데이터 초기화
                  </button>
                </div>
              </div>
              
              <motion.div 
                animate={{ x: [0, 5, 0] }}
                transition={{ repeat: Infinity, duration: 2 }}
                className="p-6 bg-blue-50 rounded-3xl border border-blue-100"
              >
                <div className="flex gap-3">
                  <Lightbulb className="w-5 h-5 text-blue-600 flex-shrink-0 mt-1" />
                  <p className="text-[11px] text-blue-700 leading-relaxed font-bold">
                    <b>TIP</b><br/>
                    격자 위의 교차점을 클릭하여 데이터를 기록하세요. 기록된 점을 다시 클릭하면 삭제됩니다. 데이터가 2개 이상일 때 선으로 연결됩니다.
                  </p>
                </div>
              </motion.div>
            </div>
          </div>
        </section>

        {/* 3. 결론 정리 */}
        <section className="bg-white rounded-[2.5rem] p-8 md:p-12 shadow-sm border border-slate-200">
          <div className="flex items-center gap-3 mb-10">
            <span className="bg-green-100 text-green-600 px-4 py-1.5 rounded-full text-xs font-black ring-4 ring-green-50">STORY 03</span>
            <h2 className="text-2xl font-black text-slate-800">탐구 결과 정리</h2>
          </div>
          
          <div className="space-y-10">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="space-y-3">
                <label className="text-sm font-black text-slate-700 ml-1">① 물체의 이동 거리는 시간에 따라 어떻게 변하나요?</label>
                <input 
                  type="text" 
                  className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 ring-blue-500/10 focus:border-blue-500 font-medium transition-all" 
                  placeholder="실험 결과를 바탕으로 변화를 적어보세요" 
                  value={answers.q1} 
                  onChange={e => setAnswers({...answers, q1: e.target.value})} 
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-black text-slate-700 ml-1">② 물체의 속력은 시간과 어떤 관계가 있나요?</label>
                <input 
                  type="text" 
                  className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 ring-blue-500/10 focus:border-blue-500 font-medium transition-all" 
                  placeholder="시간이 지남에 따른 속력의 관계를 적어보세요" 
                  value={answers.q2} 
                  onChange={e => setAnswers({...answers, q2: e.target.value})} 
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-black text-slate-700 ml-1">③ 이와 같은 물체의 운동을 무엇이라고 하나요?</label>
                <input 
                  type="text" 
                  className="w-full p-5 bg-slate-50 border-2 border-blue-100 rounded-2xl outline-none focus:ring-4 ring-blue-500/10 focus:border-blue-600 font-black text-blue-600 placeholder:font-normal transition-all" 
                  placeholder="운동의 명칭을 입력하세요" 
                  value={answers.q3} 
                  onChange={e => setAnswers({...answers, q3: e.target.value})} 
                />
              </div>
              <div className="space-y-3">
                <label className="text-sm font-black text-slate-700 ml-1">④ 시간-이동거리 그래프에서 '기울기'는 무엇을 의미하나요?</label>
                <input 
                  type="text" 
                  className="w-full p-5 bg-slate-50 border-2 border-slate-100 rounded-2xl outline-none focus:ring-4 ring-blue-500/10 focus:border-blue-500 font-medium transition-all" 
                  placeholder="기울기가 나타내는 물리량을 적어보세요" 
                  value={answers.q4} 
                  onChange={e => setAnswers({...answers, q4: e.target.value})} 
                />
              </div>
            </div>

            <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-200 space-y-5">
              <div className="flex items-center gap-3">
                <div className="bg-yellow-100 p-2 rounded-lg"><Lightbulb className="w-5 h-5 text-yellow-600"/></div>
                <h4 className="font-black text-slate-800 text-lg">등속 운동의 예</h4>
              </div>
              <p className="text-sm text-slate-500 font-medium ml-1">우리 주변에서 볼 수 있는 등속 운동의 예를 2가지 이상 적어보세요.</p>
              <textarea 
                className="w-full h-32 p-6 bg-white border-2 border-slate-100 rounded-3xl outline-none focus:ring-4 ring-blue-500/10 focus:border-blue-500 font-medium transition-all resize-none" 
                placeholder="관찰할 수 있는 사례들을 자유롭게 입력하세요" 
                value={answers.q5} 
                onChange={e => setAnswers({...answers, q5: e.target.value})}
              ></textarea>
            </div>
          </div>

          <div className="mt-16 pt-10 border-t border-slate-100 text-center">
            <button 
              onClick={handleFinalSubmit}
              disabled={isSubmitting || !student.id}
              className={`px-16 py-6 rounded-full font-black text-xl shadow-2xl transition-all cursor-pointer flex items-center gap-3 mx-auto ${isSubmitting ? 'bg-slate-200 text-slate-400 shadow-none' : 'bg-blue-600 text-white shadow-blue-200 hover:bg-blue-700 hover:scale-105 active:scale-95'}`}
            >
              {isSubmitting ? (
                <>데이터 전송 중...</>
              ) : (
                <>
                  <Check className="w-6 h-6" />
                  실험 결과 및 결론 제출하기
                </>
              )}
            </button>
            <p className="mt-6 text-[10px] text-slate-400 font-black uppercase tracking-[0.3em]">Secure Submission to Cloud Firestore</p>
          </div>
        </section>
      </main>

      <footer className="mt-24 text-center pb-12 opacity-40 hover:opacity-100 transition-opacity">
        <p className="text-xs font-black uppercase tracking-widest text-slate-400 flex items-center justify-center gap-2">
          <span>Physics Virtual Lab</span>
          <span className="w-1 h-1 bg-slate-300 rounded-full"></span>
          <span>Baegot Lara Middle School Science</span>
        </p>
        <p className="text-[10px] font-bold text-slate-400 mt-2">© 2026 Developed for Real-time Education</p>
      </footer>
    </div>
  );
}
