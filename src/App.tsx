import React, { useState } from 'react';
import './App.css';

interface MatchSummary {
  matchId: string;
  map: string;
  mode: string;
  agent: string;
  result: string;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
}

interface PlayerStat {
  puuid: string;
  name: string;
  met: number;
  asAlly: number;
  asEnemy: number;
  targetLost: number;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
}

interface MatchResult {
  matchesCount: number;
  abusingDetected: boolean;
  details: string[] | null;
  players: PlayerStat[] | null;
  history: MatchSummary[] | null;
}

function App() {
  const [gameName, setGameName] = useState<string>('');
  const [tagLine, setTagLine] = useState<string>('');
  const [puuid, setPuuid] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [matchesResult, setMatchesResult] = useState<MatchResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  
  // 탭 및 필터 상태
  const [activeTab, setActiveTab] = useState<'history' | 'abusing'>('history');
  const [filterMode, setFilterMode] = useState<string>('전체');

  const getUrl = (path: string) => {
    const baseUrl = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || '';
    return `${baseUrl}${path}`;
  };

  const fetchAccountByRiotID = async () => {
    setIsLoading(true);
    setMessage('플레이어 정보를 찾고 있어요 🔍');
    setPuuid('');
    setMatchesResult(null);

    try {
      const response = await fetch(getUrl(`/api/account/riotid?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}`));
      const data = await response.json();

      if (response.ok) {
        setPuuid(data.puuid);
        setMessage('✨ 성공적으로 플레이어를 찾았습니다!');
      } else {
        setMessage(`😥 오류: ${data.error || '조회에 실패했어요.'}`);
      }
    } catch (error) {
      setMessage('🔌 네트워크 에러가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMatchesByPuuid = async () => {
    if (!puuid) return;
    setIsLoading(true);
    setMessage('최근 10경기의 기록을 꼼꼼히 분석하고 있어요 📝...');
    setMatchesResult(null);
    setFilterMode('전체');

    try {
      const response = await fetch(getUrl(`/api/player/matches/${puuid}`));
      const data = await response.json();

      if (response.ok) {
        setMessage(`🎉 분석 완료! 최근 매치 데이터를 성공적으로 가져왔습니다.`);
        setMatchesResult(data);
      } else {
        setMessage(`😥 오류: ${data.error || '분석에 실패했어요.'}`);
      }
    } catch (error) {
      setMessage('🔌 데이터를 가져오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  // 모드 필터링 및 요약 계산 로직
  const getFilteredHistory = () => {
    if (!matchesResult?.history) return [];
    if (filterMode === '전체') return matchesResult.history;
    return matchesResult.history.filter(m => m.mode === filterMode);
  };

  const filteredHistory = getFilteredHistory();
  const availableModes = matchesResult?.history 
    ? ['전체', ...Array.from(new Set(matchesResult.history.map(m => m.mode)))] 
    : ['전체'];

  const calcSummary = () => {
    if (filteredHistory.length === 0) return null;
    let k = 0, d = 0, a = 0, wins = 0, losses = 0, draws = 0;
    filteredHistory.forEach(m => {
      k += m.kills; d += m.deaths; a += m.assists;
      if (m.result === '승리') wins++;
      else if (m.result === '패배') losses++;
      else draws++;
    });
    return { 
      kda: d === 0 ? k + a : ((k + a) / d).toFixed(2), 
      k: (k / filteredHistory.length).toFixed(1),
      d: (d / filteredHistory.length).toFixed(1),
      a: (a / filteredHistory.length).toFixed(1),
      wins, losses, draws, total: filteredHistory.length
    };
  };
  const summary = calcSummary();

  return (
    <div className="App">
      <header className="header">
        <h1 className="logo">Valorant Tracker</h1>
        <p className="subtitle">나의 발로란트 매치 전적 & 어뷰저 탐지기</p>
      </header>

      <main className="container">
        <section className="search-section card">
          <div className="input-group">
            <input type="text" placeholder="닉네임 (예: 홍길동)" value={gameName} onChange={(e) => setGameName(e.target.value)} />
            <span className="hash">#</span>
            <input type="text" placeholder="태그 (예: KR1)" value={tagLine} onChange={(e) => setTagLine(e.target.value)} />
            <button onClick={fetchAccountByRiotID} disabled={isLoading} className="btn-primary">
              {isLoading ? '검색 중...' : '전적 검색'}
            </button>
          </div>
        </section>

        {message && <div className={`status-message ${message.includes('😥') || message.includes('🔌') ? 'error' : 'success'}`}>{message}</div>}

        {puuid && !matchesResult && (
          <div className="action-section">
            <button onClick={fetchMatchesByPuuid} disabled={isLoading} className="btn-secondary analyze-btn">
              {isLoading ? '데이터 스캔 중...' : '✨ 전적 및 기록 갱신하기'}
            </button>
          </div>
        )}

        {matchesResult && (
          <div className="dashboard-wrapper">
            {/* 탭 네비게이션 */}
            <div className="tabs">
              <div className={`tab ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
                최근 전적 상세
              </div>
              <div className={`tab ${activeTab === 'abusing' ? 'active' : ''}`} onClick={() => setActiveTab('abusing')}>
                조우한 플레이어 / 어뷰징 분석
              </div>
            </div>

            {/* 탭 1: 매치 히스토리 (전적 검색 사이트 형태) */}
            {activeTab === 'history' && (
              <div className="tab-content">
                <div className="filter-row">
                  {availableModes.map(mode => (
                    <button 
                      key={mode} 
                      className={`filter-btn ${filterMode === mode ? 'active' : ''}`}
                      onClick={() => setFilterMode(mode)}
                    >
                      {mode}
                    </button>
                  ))}
                </div>

                {summary && (
                  <div className="summary-box">
                    <div className="summary-title">{filterMode} 전적 요약 ({summary.total}전)</div>
                    <div className="summary-stats">
                      <div className="record">{summary.wins}승 {summary.draws > 0 ? `${summary.draws}무 ` : ''}{summary.losses}패</div>
                      <div className="kda-info">
                        평균 평점 <span className="highlight">{summary.kda}</span> 
                        <span className="sub-kda"> ({summary.k} / {summary.d} / {summary.a})</span>
                      </div>
                    </div>
                  </div>
                )}

                <div className="match-list">
                  {filteredHistory.map((m, i) => (
                    <div key={i} className={`match-card ${m.result === '승리' ? 'win' : m.result === '패배' ? 'loss' : 'draw'}`}>
                      <div className="match-meta">
                        <div className="match-result-text">{m.result}</div>
                        <div className="match-mode">{m.mode}</div>
                        <div className="match-map">{m.map}</div>
                      </div>
                      <div className="match-agent">
                        <div className="agent-name">{m.agent || 'Unknown'}</div>
                      </div>
                      <div className="match-stats">
                        <div className="kda-line">
                          <span className="k">{m.kills}</span> / <span className="d">{m.deaths}</span> / <span className="a">{m.assists}</span>
                        </div>
                        <div className="score-line">점수: {m.score}</div>
                      </div>
                    </div>
                  ))}
                  {filteredHistory.length === 0 && <p className="empty-message">해당 모드의 전적이 없습니다.</p>}
                </div>
              </div>
            )}

            {/* 탭 2: 조우한 플레이어 및 어뷰징 분석 (기존 기능) */}
            {activeTab === 'abusing' && (
              <div className="tab-content">
                {matchesResult.abusingDetected && matchesResult.details && matchesResult.details.length > 0 && (
                  <div className="alert-box">
                    <h3>🚨 어뷰징 의심 패턴 감지!</h3>
                    <ul>{matchesResult.details.map((d, i) => <li key={i}>{d}</li>)}</ul>
                  </div>
                )}

                <div className="table-container card">
                  <h3 className="table-title">📊 최근 조우한 플레이어 분석 (모든 모드 합산)</h3>
                  {matchesResult.players && matchesResult.players.length > 0 ? (
                    <div className="table-responsive">
                      <table className="stats-table">
                        <thead>
                          <tr>
                            <th>플레이어명</th>
                            <th>만난 횟수</th>
                            <th>아군/적군</th>
                            <th>나의 패배율</th>
                            <th>평균 KDA</th>
                          </tr>
                        </thead>
                        <tbody>
                          {matchesResult.players.map((p, i) => {
                            const avgK = (p.kills / p.met).toFixed(1);
                            const avgD = (p.deaths / p.met).toFixed(1);
                            const avgA = (p.assists / p.met).toFixed(1);
                            const lossRate = ((p.targetLost / p.met) * 100).toFixed(0);
                            const isSuspect = p.asEnemy >= 3 && p.targetLost / p.met >= 0.75;

                            return (
                              <tr key={i} className={isSuspect ? 'suspect-row' : ''}>
                                <td className="player-name">{p.name} {isSuspect && <span className="warning-icon">⚠️</span>}</td>
                                <td>{p.met}회</td>
                                <td>
                                  <span className="badge ally">아군 {p.asAlly}</span>
                                  <span className="badge enemy">적군 {p.asEnemy}</span>
                                </td>
                                <td className={parseInt(lossRate) >= 70 ? 'high-loss' : 'normal-loss'}>{lossRate}%</td>
                                <td className="kda-text">{avgK} / {avgD} / {avgA}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p className="empty-message">분석할 플레이어 데이터가 없습니다.</p>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;