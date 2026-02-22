import React, { useState } from 'react';
import './App.css';

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
  details: string[];
  players: PlayerStat[];
}

function App() {
  const [gameName, setGameName] = useState<string>('');
  const [tagLine, setTagLine] = useState<string>('');
  const [puuid, setPuuid] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [matchesResult, setMatchesResult] = useState<MatchResult | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  const getUrl = (path: string) => {
    const baseUrl = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || '';
    return `${baseUrl}${path}`;
  };

  const fetchAccountByRiotID = async () => {
    setIsLoading(true);
    setMessage('요원 데이터 동기화 중...');
    setPuuid('');
    setMatchesResult(null);

    try {
      const response = await fetch(getUrl(`/api/account/riotid?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}`));
      const data = await response.json();

      if (response.ok) {
        setPuuid(data.puuid);
        setMessage('✅ 요원 정보가 확인되었습니다.');
      } else {
        setMessage(`❌ 오류: ${data.error || '조회 실패'}`);
      }
    } catch (error) {
      setMessage('❌ 네트워크 에러가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchMatchesByPuuid = async () => {
    if (!puuid) return;
    setIsLoading(true);
    setMessage('최근 10경기 전투 기록 분석 중...');
    setMatchesResult(null);

    try {
      const response = await fetch(getUrl(`/api/player/matches/${puuid}`));
      const data = await response.json();

      if (response.ok) {
        setMessage(`✅ 분석 완료! 최근 ${data.matchesCount}개 경기의 데이터를 확보했습니다.`);
        setMatchesResult(data);
      } else {
        setMessage(`❌ 오류: ${data.error || '분석 실패'}`);
      }
    } catch (error) {
      setMessage('❌ 데이터를 가져오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="App">
      <header className="header">
        <div className="logo">VALORANT DETECTOR</div>
        <p className="subtitle">어뷰징 패턴 및 최근 매치 통계 분석기</p>
      </header>

      <main className="container">
        <section className="search-section">
          <div className="input-group">
            <input type="text" placeholder="플레이어 이름 (예: 홍길동)" value={gameName} onChange={(e) => setGameName(e.target.value)} />
            <span className="hash">#</span>
            <input type="text" placeholder="태그 (예: KR1)" value={tagLine} onChange={(e) => setTagLine(e.target.value)} />
            <button onClick={fetchAccountByRiotID} disabled={isLoading} className="btn-primary">
              {isLoading ? '검색 중...' : '검색'}
            </button>
          </div>
        </section>

        {message && <div className={`status-message ${message.includes('❌') ? 'error' : ''}`}>{message}</div>}

        {puuid && !matchesResult && (
          <div className="action-section">
            <button onClick={fetchMatchesByPuuid} disabled={isLoading} className="btn-danger analyze-btn">
              {isLoading ? '데이터 스캔 중...' : '매치 기록 및 어뷰저 스캔 시작'}
            </button>
          </div>
        )}

        {matchesResult && (
          <div className="dashboard">
            {matchesResult.abusingDetected && (
              <div className="alert-box">
                <h3>⚠️ 어뷰징 의심 패턴 감지</h3>
                <ul>
                  {matchesResult.details.map((d, i) => <li key={i}>{d}</li>)}
                </ul>
              </div>
            )}

            <div className="table-container">
              <h3 className="table-title">최근 조우한 플레이어 상세 분석</h3>
              <table className="stats-table">
                <thead>
                  <tr>
                    <th>요원명</th>
                    <th>조우 횟수</th>
                    <th>적/아군 비율</th>
                    <th>나의 패배율</th>
                    <th>평균 KDA</th>
                    <th>평균 점수</th>
                  </tr>
                </thead>
                <tbody>
                  {matchesResult.players.map((p, i) => {
                    const avgK = (p.kills / p.met).toFixed(1);
                    const avgD = (p.deaths / p.met).toFixed(1);
                    const avgA = (p.assists / p.met).toFixed(1);
                    const avgScore = Math.round(p.score / p.met);
                    const lossRate = ((p.targetLost / p.met) * 100).toFixed(0);
                    const isSuspect = p.asEnemy >= 3 && p.targetLost / p.met >= 0.75;

                    return (
                      <tr key={i} className={isSuspect ? 'suspect-row' : ''}>
                        <td className="player-name">{p.name} {isSuspect && '⚠️'}</td>
                        <td>{p.met}회</td>
                        <td>아군 {p.asAlly} / 적군 {p.asEnemy}</td>
                        <td className={parseInt(lossRate) >= 70 ? 'high-loss' : ''}>{lossRate}%</td>
                        <td className="kda-text">{avgK} / {avgD} / {avgA}</td>
                        <td>{avgScore}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

export default App;