import React, { useState } from 'react';
import './App.css'; // 기본 CSS는 필요하면 그대로 두거나 수정/삭제 가능

function App() {
  // 상태 변수 정의
  const [gameName, setGameName] = useState<string>(''); // 게임 이름
  const [tagLine, setTagLine] = useState<string>('');    // 태그라인 (예: KR1)
  const [puuid, setPuuid] = useState<string>('');         // 조회된 플레이어 PUUID
  const [message, setMessage] = useState<string>('');     // 사용자에게 보여줄 메시지 (성공/오류)
  const [matchesResult, setMatchesResult] = useState<any>(null); // 경기 조회 결과

  // 백엔드 URL을 환경 변수에서 가져옵니다.
  // 이 부분이 핵심입니다!
  const BACKEND_URL = import.meta.env.VITE_BACKEND_URL;

  // 만약 환경 변수가 제대로 설정되지 않았을 경우를 대비한 경고 (선택 사항)
  if (!BACKEND_URL) {
    console.warn("경고: VITE_BACKEND_URL 환경 변수가 설정되지 않았습니다! 로컬 개발 환경이 아니라면 문제가 발생할 수 있습니다.");
    // 실제 서비스에서는 여기에 더 강력한 오류 처리 로직을 추가할 수 있습니다.
  }

  // Riot ID로 계정 정보 조회 함수
  const fetchAccountByRiotID = async () => {
    setMessage('플레이어 정보 조회 중...');
    setPuuid(''); // 새로운 조회 시작 시 이전 PUUID 초기화
    setMatchesResult(null); // 새로운 조회 시작 시 이전 경기 결과 초기화

    try {
      // 백엔드 API 엔드포인트 호출 - 환경 변수 사용!
      const response = await fetch(`${BACKEND_URL}/account/riotid?gameName=${gameName}&tagLine=${tagLine}`);
      const data = await response.json();

      if (response.ok) {
        // 성공적으로 PUUID를 받아왔을 때
        setPuuid(data.puuid);
        setMessage(`계정 정보 조회 성공! PUUID: ${data.puuid}`);
      } else {
        // 오류 응답 처리
        setMessage(`오류: ${data.error || '알 수 없는 오류 발생'}`);
      }
    } catch (error) {
      // 네트워크 오류 등 예외 처리
      setMessage(`네트워크 오류: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  // PUUID로 경기 정보 조회 함수
  const fetchMatchesByPuuid = async () => {
    if (!puuid) {
      setMessage('PUUID가 없습니다. 먼저 Riot ID로 조회해주세요.');
      return;
    }
    setMessage('경기 정보 조회 중...');
    setMatchesResult(null); // 새로운 조회 시작 시 이전 결과 초기화
    try {
      // 백엔드 API 엔드포인트 호출 (경기 5개만 가져오도록 count=5 추가) - 환경 변수 사용!
      const response = await fetch(`${BACKEND_URL}/player/matches/${puuid}?count=5`);
      const data = await response.json();

      if (response.ok) {
        // 성공적으로 경기 정보를 받아왔을 때
        setMessage(`경기 정보 조회 성공! 총 ${data.matches_fetched_count}개 경기 수집.`);
        setMatchesResult(data); // 전체 데이터 저장
      } else {
        // 오류 응답 처리
        setMessage(`오류: ${data.error || '알 수 없는 오류 발생'}`);
      }
    } catch (error) {
      // 네트워크 오류 등 예외 처리
      setMessage(`네트워크 오류: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  return (
    <div className="App">
      <header className="App-header">
        <h1>발로란트 어뷰징 감지 시스템</h1>
      </header>
      <main style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', backgroundColor: '#282c34', color: 'white' }}>
        <section style={{ marginBottom: '30px', border: '1px solid #444', padding: '20px', borderRadius: '8px' }}>
          <h2>1. 플레이어 계정 정보 조회</h2>
          <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
            <input
              type="text"
              placeholder="게임 이름 (예: 홍길동)"
              value={gameName}
              onChange={(e) => setGameName(e.target.value)}
              style={inputStyle}
            />
            <input
              type="text"
              placeholder="태그라인 (예: KR1)"
              value={tagLine}
              onChange={(e) => setTagLine(e.target.value)}
              style={inputStyle}
            />
            <button onClick={fetchAccountByRiotID} style={buttonStyle}>
              PUUID 가져오기
            </button>
          </div>
          {puuid && (
            <p>
              **조회된 PUUID:** <code style={{ backgroundColor: '#444', padding: '3px 6px', borderRadius: '4px' }}>{puuid}</code>
            </p>
          )}
        </section>

        <section style={{ marginBottom: '30px', border: '1px solid #444', padding: '20px', borderRadius: '8px' }}>
          <h2>2. 플레이어 경기 정보 수집 및 어뷰징 감지</h2>
          <button onClick={fetchMatchesByPuuid} disabled={!puuid} style={buttonStyle}>
            {puuid ? '경기 정보 수집 및 감지 시작' : 'PUUID를 먼저 가져오세요'}
          </button>
        </section>

        {/* 메시지 표시 */}
        {message && (
          <p style={{ marginTop: '20px', padding: '10px', backgroundColor: '#333', borderRadius: '5px', color: message.startsWith('오류:') ? 'red' : 'lightgreen' }}>
            {message}
          </p>
        )}

        {/* 경기 조회 결과 표시 */}
        {matchesResult && (
          <section style={{ marginTop: '30px', border: '1px solid #444', padding: '20px', borderRadius: '8px' }}>
            <h2>경기 조회 결과</h2>
            <p>총 수집된 경기: **{matchesResult.matches_fetched_count}**개</p>
            {matchesResult.abusing_detection_result && (
              <div style={{ marginTop: '15px' }}>
                <h3>어뷰징 감지 결과:</h3>
                {matchesResult.abusing_detection_result.length > 0 ? (
                  matchesResult.abusing_detection_result.map((item: any, index: number) => (
                    <div key={index} style={{ marginBottom: '10px', borderBottom: '1px solid #555', paddingBottom: '10px' }}>
                      <p>상대방 PUUID: **{item.opponent_puuid}**</p>
                      <p>매칭 횟수: **{item.match_count}**회</p>
                      <p>평균 KDA: **{item.average_kda.toFixed(2)}**</p>
                      <p>승률: **{(item.win_rate * 100).toFixed(2)}**%</p>
                      {item.is_abusing && <p style={{ color: 'orange', fontWeight: 'bold' }}>⚠️ 어뷰징 의심 (패배율이 높습니다)</p>}
                    </div>
                  ))
                ) : (
                  <p>어뷰징 패턴이 감지되지 않았습니다.</p>
                )}
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

// 간단한 스타일 정의 (인라인 스타일 또는 App.css에 추가)
const inputStyle: React.CSSProperties = {
  padding: '10px',
  borderRadius: '4px',
  border: '1px solid #555',
  backgroundColor: '#333',
  color: 'white',
  flexGrow: 1,
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 15px',
  borderRadius: '4px',
  border: 'none',
  backgroundColor: '#007bff',
  color: 'white',
  cursor: 'pointer',
  fontWeight: 'bold',
};

export default App;