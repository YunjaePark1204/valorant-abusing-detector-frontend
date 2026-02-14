import React, { useState } from 'react';
import './App.css';

function App() {
  const [gameName, setGameName] = useState<string>('');
  const [tagLine, setTagLine] = useState<string>('');
  const [puuid, setPuuid] = useState<string>('');
  const [message, setMessage] = useState<string>('');
  const [matchesResult, setMatchesResult] = useState<any>(null);

  // 환경 변수 끝의 슬래시 유무에 관계없이 경로를 생성합니다.
  const getUrl = (path: string) => {
    const baseUrl = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || '';
    return `${baseUrl}${path}`;
  };

  const fetchAccountByRiotID = async () => {
    if (!gameName.trim() || !tagLine.trim()) {
      setMessage('이름과 태그를 입력해주세요.');
      return;
    }

    setMessage('플레이어 조회 중...');
    setPuuid('');
    setMatchesResult(null);

    try {
      const url = getUrl(`/api/account/riotid?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}`);
      console.log('요청 URL:', url);
      
      const response = await fetch(url);  
      const data = await response.json();

      console.log('응답 상태:', response.status);
      console.log('응답 데이터:', data);
      console.log('응답 전체:', JSON.stringify(data, null, 2));

      if (response.ok) {
        // 응답 구조 확인: data.puuid 또는 data.data.puuid
        const puuidValue = data.puuid || data.data?.puuid;
        if (puuidValue) {
          setPuuid(puuidValue);
          setMessage('조회 성공!');
        } else {
          console.error('PUUID를 찾을 수 없습니다. 응답:', data);
          setMessage('오류: PUUID 정보가 없습니다.');
        }
      } else {
        // 500 에러 등의 상세 정보 표시
        const errorMsg = data.error || data.message || '조회 실패';
        console.error('서버 에러 상세:', {
          status: response.status,
          statusText: response.statusText,
          error: data.error,
          message: data.message,
          data: data
        });
        setMessage(`오류 (${response.status}): ${errorMsg}`);
      }
    } catch (error) {
      console.error('네트워크 에러:', error);
      const errorMsg = error instanceof Error ? error.message : '알 수 없는 오류';
      setMessage(`네트워크 에러: ${errorMsg}`);
    }
  };

  const fetchMatchesByPuuid = async () => {
    if (!puuid) return;
    setMessage('어뷰징 탐지 분석 중...');
    setMatchesResult(null);

    try {
      const url = getUrl(`/api/player/matches/${puuid}`);
      console.log('매치 조회 URL:', url);
      
      const response = await fetch(url);
      const data = await response.json();

      console.log('매치 응답 상태:', response.status);
      console.log('매치 응답 데이터:', data);

      if (response.ok) {
        setMessage(`분석 완료! 최근 ${data.matchesCount}개 경기를 확인했습니다.`);
        setMatchesResult(data);
      } else {
        setMessage(`오류: ${data.error || '분석 실패'}`);
      }
    } catch (error) {
      console.error('매치 조회 에러:', error);
      setMessage(`데이터 조회 실패: ${error instanceof Error ? error.message : '알 수 없는 오류'}`);
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

        {message && <p className={`message ${message.includes('오류') ? 'error' : ''}`}>{message}</p>}

        {matchesResult && (
          <div className="results">
            <h3>분석 결과</h3>
            <p>총 경기 수: <strong>{matchesResult.matchesCount}</strong></p>
            <p>어뷰징 의심: <strong>{matchesResult.abusingDetected ? '있음' : '없음'}</strong></p>
            <hr />
            <h4>상세 결과</h4>
            {matchesResult.details && matchesResult.details.length > 0 ? (
              matchesResult.details.map((d: string, i: number) => <p key={i} style={{color: '#ff4655'}}>⚠️ {d}</p>)
            ) : (
              <p style={{color: '#00d084'}}>✓ 의심되는 어뷰징 패턴이 발견되지 않았습니다.</p>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

export default App;