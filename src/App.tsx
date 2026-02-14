import React, { useState } from 'react';
import './App.css';

function App() {
  const [gameName, setGameName] = useState<string>('');
  const [tagLine, setTagLine] = useState<string>('');
  const [puuid, setPuuid] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [matchesResult, setMatchesResult] = useState<any>(null);

  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

  const fetchAccountByRiotID = async () => {
    setMessage('플레이어 조회 중...');
    setPuuid('');
    setMatchesResult(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/account/riotid?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}`);
      const data = await response.json();

      if (response.ok) {
        setPuuid(data.puuid);
        setMessage('조회 성공!');
      } else {
        setMessage(`오류: ${data.error || '조회 실패'}`);
      }
    } catch (error) {
      setMessage('네트워크 에러');
    }
  };

  const fetchMatchesByPuuid = async () => {
    if (!puuid) return;
    setMessage('어뷰징 탐지 분석 중...');
    setMatchesResult(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/player/matches/${puuid}`);
      const data = await response.json();

      if (response.ok) {
        setMessage(`분석 완료! 총 ${data.matchesCount}개 경기 분석.`);
        setMatchesResult(data);
      } else {
        setMessage(`오류: ${data.error || '분석 실패'}`);
      }
    } catch (error) {
      setMessage('네트워크 에러');
    }
  };

  return (
    <div className="App">
      <header className="App-header"><h1>Valorant Detector</h1></header>
      <main style={{padding: '20px'}}>
        <div className="card">
          <input type="text" placeholder="이름" value={gameName} onChange={(e) => setGameName(e.target.value)} />
          <input type="text" placeholder="태그" value={tagLine} onChange={(e) => setTagLine(e.target.value)} />
          <button onClick={fetchAccountByRiotID}>계정 조회</button>
        </div>
        
        {puuid && (
          <div className="card">
            <button onClick={fetchMatchesByPuuid} style={{backgroundColor: '#ff4655', color: 'white'}}>어뷰징 탐지 시작</button>
          </div>
        )}

        {message && <p className="message">{message}</p>}

        {matchesResult && (
          <div className="results">
            <h3>상세 결과</h3>
            {matchesResult.details && matchesResult.details.length > 0 ? (
              matchesResult.details.map((d: string, i: number) => <p key={i} style={{color: 'red'}}>⚠️ {d}</p>)
            ) : (
              <p>의심되는 패턴이 없습니다.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;