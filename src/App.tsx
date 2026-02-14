import React, { useState } from 'react';
import './App.css';

function App() {
  const [gameName, setGameName] = useState<string>('');
  const [tagLine, setTagLine] = useState<string>('');
  const [puuid, setPuuid] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [matchesResult, setMatchesResult] = useState<any>(null);

  // 백엔드 URL (Vercel 배포 주소 또는 로컬 주소)
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || '';

  // 1. 계정 정보 조회 (경로에 /api 추가)
  const fetchAccountByRiotID = async () => {
    setMessage('플레이어 정보 조회 중...');
    setPuuid('');
    setMatchesResult(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/account/riotid?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}`);
      const data = await response.json();

      if (response.ok) {
        setPuuid(data.puuid);
        setMessage(`계정 정보 조회 성공!`);
      } else {
        setMessage(`오류: ${data.error || '조회 실패'}`);
      }
    } catch (error) {
      setMessage(`네트워크 오류 발생`);
    }
  };

  // 2. 경기 정보 조회 (경로 및 결과 키 수정)
  const fetchMatchesByPuuid = async () => {
    if (!puuid) return;
    setMessage('경기 데이터 분석 중...');
    setMatchesResult(null);

    try {
      const response = await fetch(`${BACKEND_URL}/api/player/matches/${puuid}`);
      const data = await response.json();

      if (response.ok) {
        // 백엔드 반환 키인 matchesCount와 details 사용
        setMessage(`분석 완료! 총 ${data.matchesCount}개의 최근 경기를 확인했습니다.`);
        setMatchesResult(data);
      } else {
        setMessage(`오류: ${data.error || '분석 실패'}`);
      }
    } catch (error) {
      setMessage(`네트워크 오류 발생`);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>발로란트 어뷰징 탐지기</h1>
      </header>
      <main style={mainContainerStyle}>
        <section style={cardStyle}>
          <h2>플레이어 조회</h2>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input type="text" placeholder="이름" value={gameName} onChange={(e) => setGameName(e.target.value)} style={inputStyle} />
            <input type="text" placeholder="태그" value={tagLine} onChange={(e) => setTagLine(e.target.value)} style={inputStyle} />
            <button onClick={fetchAccountByRiotID} style={buttonStyle}>조회</button>
          </div>
          {puuid && <p style={{marginTop: '10px'}}>PUUID: <code>{puuid}</code></p>}
        </section>

        <section style={cardStyle}>
          <button onClick={fetchMatchesByPuuid} disabled={!puuid} style={{...buttonStyle, width: '100%', backgroundColor: puuid ? '#ff4655' : '#666'}}>
            어뷰징 탐지 시작
          </button>
        </section>

        {message && <div style={messageStyle(message)}>{message}</div>}

        {matchesResult && (
          <section style={cardStyle}>
            <h3>탐지 상세 결과</h3>
            {matchesResult.details && matchesResult.details.length > 0 ? (
              matchesResult.details.map((desc: string, i: number) => (
                <div key={i} style={findingStyle}>⚠️ {desc}</div>
              ))
            ) : (
              <p>최근 경기에서 의심되는 어뷰징 패턴이 발견되지 않았습니다.</p>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

// 스타일 정의 (생략 가능 또는 App.css로 이동)
const mainContainerStyle: React.CSSProperties = { padding: '20px', maxWidth: '600px', margin: '0 auto' };
const cardStyle: React.CSSProperties = { background: '#1f2326', padding: '20px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #333' };
const inputStyle: React.CSSProperties = { padding: '10px', flex: 1, borderRadius: '4px', border: 'none', background: '#333', color: 'white' };
const buttonStyle: React.CSSProperties = { padding: '10px 20px', borderRadius: '4px', border: 'none', background: '#ff4655', color: 'white', fontWeight: 'bold', cursor: 'pointer' };
const findingStyle: React.CSSProperties = { color: '#ff4655', fontWeight: 'bold', padding: '10px 0', borderBottom: '1px solid #333' };
const messageStyle = (msg: string): React.CSSProperties => ({ padding: '15px', borderRadius: '8px', background: msg.includes('오류') ? '#442222' : '#224422', marginBottom: '20px' });

export default App;