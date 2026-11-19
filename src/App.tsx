import React, { useCallback, useEffect, useMemo, useState } from 'react';
import './App.css';
import type {
  AccountInfo,
  MatchResult,
  MatchSummary,
  PlayerStat,
  ValorantAssetMap,
} from './types';
import {
  buildReportText,
  formatDateTime,
  formatRelativeTime,
  loadValorantAssets,
  resolveAgent,
  resolveTier,
} from './utils/valorantAssets';

const RECENT_SEARCHES_KEY = 'val_tracker_recent_v1';
const PAGE_BATCH = 2; // 2 pages * 10 = 20 matches per fetch

interface RecentSearch {
  name: string;
  tag: string;
}

function App() {
  const [gameName, setGameName] = useState<string>('');
  const [tagLine, setTagLine] = useState<string>('');
  const [account, setAccount] = useState<AccountInfo | null>(null);
  const [modeFilter, setModeFilter] = useState<'competitive' | 'all'>('competitive');
  const [matchesResult, setMatchesResult] = useState<MatchResult | null>(null);

  const [statusMessage, setStatusMessage] = useState<string>('');
  const [statusType, setStatusType] = useState<'info' | 'success' | 'error' | 'warning'>('info');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [isLoadingMore, setIsLoadingMore] = useState<boolean>(false);

  const [activeTab, setActiveTab] = useState<'tracker' | 'players' | 'stats'>('tracker');
  const [expandedMatches, setExpandedMatches] = useState<Record<string, boolean>>({});
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [highlightedPuuid, setHighlightedPuuid] = useState<string | null>(null);

  // Players tab filters
  const [onlyRepeats, setOnlyRepeats] = useState<boolean>(true);
  const [excludeParty, setExcludeParty] = useState<boolean>(true);
  const [playerSearch, setPlayerSearch] = useState<string>('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [recentSearches, setRecentSearches] = useState<RecentSearch[]>(() => {
    try {
      const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  });

  const [assets, setAssets] = useState<ValorantAssetMap>({
    agentsById: {},
    agentsByName: {},
    tiersById: {},
  });

  useEffect(() => {
    loadValorantAssets().then(setAssets);
  }, []);

  const getUrl = (path: string) => {
    const baseUrl = import.meta.env.VITE_BACKEND_URL?.replace(/\/$/, '') || '';
    return `${baseUrl}${path}`;
  };

  const saveRecentSearch = useCallback((name: string, tag: string) => {
    setRecentSearches((prev) => {
      const filtered = prev.filter(
        (item) => !(item.name.toLowerCase() === name.toLowerCase() && item.tag.toLowerCase() === tag.toLowerCase())
      );
      const updated = [{ name, tag }, ...filtered].slice(0, 6);
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  const removeRecentSearch = useCallback((name: string, tag: string) => {
    setRecentSearches((prev) => {
      const updated = prev.filter(
        (item) => !(item.name.toLowerCase() === name.toLowerCase() && item.tag.toLowerCase() === tag.toLowerCase())
      );
      try {
        localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
      } catch {
        // ignore
      }
      return updated;
    });
  }, []);

  const clearRecentSearches = useCallback(() => {
    setRecentSearches([]);
    try {
      localStorage.removeItem(RECENT_SEARCHES_KEY);
    } catch {
      // ignore
    }
  }, []);

  const fetchMatches = useCallback(
    async (
      targetAccount: AccountInfo,
      mode: 'competitive' | 'all',
      start = 0,
      limit = 60,
      appendMode = false
    ) => {
      const region = (targetAccount.region || 'kr').toLowerCase();
      if (appendMode) {
        setIsLoadingMore(true);
      } else {
        setIsLoading(true);
        setStatusType('info');
        setStatusMessage(
          `${targetAccount.name}#${targetAccount.tag} (${region.toUpperCase()})의 ${
            mode === 'competitive' ? '경쟁전' : '전체'
          } 매치를 불러오고 있어요...`
        );
      }

      try {
        const res = await fetch(
          getUrl(
            `/api/player/matches/${encodeURIComponent(
              targetAccount.puuid
            )}?region=${encodeURIComponent(region)}&mode=${mode}&start=${start}&pages=${PAGE_BATCH}&limit=${limit}`
          )
        );
        const data = await res.json();

        if (!res.ok) {
          setStatusType('error');
          setStatusMessage(data.error || '매치 분석에 실패했습니다.');
          return;
        }

        setMatchesResult(data);
        setHighlightedPuuid(null);

        // Auto-expand the most recent match so users immediately see who they played with
        if (!appendMode && data.history && data.history.length > 0) {
          setExpandedMatches({ [data.history[0].matchId]: true });
        }

        if (data.warning) {
          setStatusType('warning');
          setStatusMessage(data.warning);
        } else {
          setStatusType('success');
          const modeLabel = mode === 'competitive' ? '경쟁전' : '전체(데스매치 제외 분석)';
          setStatusMessage(
            appendMode
              ? `${targetAccount.name}#${targetAccount.tag} — 이전 전적 포함 누적 ${data.matchesCount}경기 기준으로 어뷰징 · 조우 분석 완료`
              : `${targetAccount.name}#${targetAccount.tag} — ${modeLabel} ${data.matchesCount}경기 분석 완료`
          );
        }
      } catch {
        setStatusType('error');
        setStatusMessage('서버와 통신하는 중 오류가 발생했습니다.');
      } finally {
        setIsLoading(false);
        setIsLoadingMore(false);
      }
    },
    []
  );

  const searchPlayer = useCallback(
    async (rawName: string, rawTag: string, modeOverride?: 'competitive' | 'all') => {
      const cleanName = rawName.trim();
      const cleanTag = rawTag.trim();
      const activeMode = modeOverride || modeFilter;

      if (!cleanName || !cleanTag) {
        setStatusType('error');
        setStatusMessage('닉네임과 태그(# 뒷부분)를 모두 입력해주세요.');
        return;
      }

      setGameName(cleanName);
      setTagLine(cleanTag);
      setIsLoading(true);
      setStatusType('info');
      setStatusMessage(`${cleanName}#${cleanTag} 계정 정보를 조회하고 있어요...`);
      setMatchesResult(null);
      setExpandedMatches({});
      setExpandedPlayer(null);
      setHighlightedPuuid(null);

      try {
        const accRes = await fetch(
          getUrl(
            `/api/account/riotid?gameName=${encodeURIComponent(cleanName)}&tagLine=${encodeURIComponent(
              cleanTag
            )}`
          )
        );
        const accData = await accRes.json();

        if (!accRes.ok) {
          setStatusType('error');
          setStatusMessage(accData.error || '플레이어 조회에 실패했습니다.');
          setIsLoading(false);
          return;
        }

        const loadedAccount: AccountInfo = {
          puuid: accData.puuid,
          name: accData.name || cleanName,
          tag: accData.tag || cleanTag,
          region: accData.region || 'kr',
          account_level: accData.account_level,
        };
        setAccount(loadedAccount);
        saveRecentSearch(loadedAccount.name, loadedAccount.tag);

        // Sync URL query parameters for shareability
        const params = new URLSearchParams(window.location.search);
        params.set('riotId', `${loadedAccount.name}-${loadedAccount.tag}`);
        params.set('mode', activeMode);
        window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);

        await fetchMatches(loadedAccount, activeMode, 0, 60, false);
      } catch {
        setStatusType('error');
        setStatusMessage('네트워크 에러가 발생했습니다. 잠시 후 다시 시도해주세요.');
        setIsLoading(false);
      }
    },
    [fetchMatches, modeFilter, saveRecentSearch]
  );

  // Auto-load from URL (?riotId=Name-Tag&mode=competitive) on initial page load
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const riotId = params.get('riotId');
    const urlMode = params.get('mode') === 'all' ? 'all' : 'competitive';
    if (params.get('mode')) {
      setModeFilter(urlMode);
    }
    if (riotId) {
      const sepIdx = riotId.lastIndexOf('#') !== -1 ? riotId.lastIndexOf('#') : riotId.lastIndexOf('-');
      if (sepIdx > 0 && sepIdx < riotId.length - 1) {
        const n = riotId.slice(0, sepIdx);
        const t = riotId.slice(sepIdx + 1);
        searchPlayer(n, t, urlMode);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleNameInputChange = (val: string) => {
    if (val.includes('#')) {
      const [n, ...rest] = val.split('#');
      setGameName(n);
      setTagLine(rest.join('#'));
    } else {
      setGameName(val);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    searchPlayer(gameName, tagLine);
  };

  const handleModeChange = (nextMode: 'competitive' | 'all') => {
    if (nextMode === modeFilter) return;
    setModeFilter(nextMode);
    if (account) {
      const params = new URLSearchParams(window.location.search);
      params.set('mode', nextMode);
      window.history.replaceState(null, '', `${window.location.pathname}?${params.toString()}`);
      fetchMatches(account, nextMode, 0, 60, false);
    }
  };

  const handleLoadMore = () => {
    if (!account || !matchesResult || isLoadingMore) return;
    const nextStart = matchesResult.nextStart ?? matchesResult.matchesCount;
    const nextLimit = Math.min(200, Math.max(80, matchesResult.matchesCount + 40));
    fetchMatches(account, modeFilter, nextStart, nextLimit, true);
  };

  const toggleMatch = (matchId: string) => {
    setExpandedMatches((prev) => ({ ...prev, [matchId]: !prev[matchId] }));
  };

  const handleCopyReport = async (player: PlayerStat) => {
    if (!account) return;
    const text = buildReportText(`${account.name}#${account.tag}`, player);
    try {
      await navigator.clipboard.writeText(text);
      setCopiedId(player.puuid);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // fallback ignored
    }
  };

  const jumpToPlayerDetail = (puuid: string) => {
    setActiveTab('players');
    setOnlyRepeats(false);
    setExcludeParty(false);
    setExpandedPlayer(puuid);
  };

  // Highlighted repeat players (non-party met 2+ times) for quick Tracker strip
  const frequentNonPartyPlayers = useMemo(() => {
    if (!matchesResult?.players) return [];
    return matchesResult.players.filter((p) => p.soloMet >= 2).slice(0, 10);
  }, [matchesResult]);

  const suspiciousPlayers = useMemo(() => {
    if (!matchesResult?.players) return [];
    return matchesResult.players.filter((p) => p.suspicionLevel !== 'none');
  }, [matchesResult]);

  const filteredPlayers = useMemo(() => {
    if (!matchesResult?.players) return [];
    const q = playerSearch.trim().toLowerCase();
    return matchesResult.players.filter((p) => {
      if (excludeParty && p.soloMet === 0) return false;
      if (onlyRepeats && (excludeParty ? p.soloMet < 2 : p.met < 2)) return false;
      if (q && !p.name.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [matchesResult, excludeParty, onlyRepeats, playerSearch]);

  const filteredMatches = useMemo(() => {
    if (!matchesResult?.history) return [];
    if (!highlightedPuuid) return matchesResult.history;
    return matchesResult.history.filter((m) =>
      m.participants?.some((p) => p.puuid === highlightedPuuid)
    );
  }, [matchesResult, highlightedPuuid]);

  // Agent & Map breakdown for Stats tab
  const { agentStats, mapStats } = useMemo(() => {
    const history = matchesResult?.history || [];
    const byAgent: Record<string, { agent: string; agentId?: string; games: number; wins: number; k: number; d: number; a: number }> = {};
    const byMap: Record<string, { map: string; games: number; wins: number; losses: number }> = {};

    for (const m of history) {
      const aKey = m.agent || 'Unknown';
      if (!byAgent[aKey]) {
        byAgent[aKey] = { agent: aKey, agentId: m.agentId, games: 0, wins: 0, k: 0, d: 0, a: 0 };
      }
      byAgent[aKey].games++;
      if (m.result === '승리') byAgent[aKey].wins++;
      byAgent[aKey].k += m.kills;
      byAgent[aKey].d += m.deaths;
      byAgent[aKey].a += m.assists;

      const mKey = m.map || 'Unknown';
      if (!byMap[mKey]) {
        byMap[mKey] = { map: mKey, games: 0, wins: 0, losses: 0 };
      }
      byMap[mKey].games++;
      if (m.result === '승리') byMap[mKey].wins++;
      else if (m.result === '패배') byMap[mKey].losses++;
    }

    return {
      agentStats: Object.values(byAgent).sort((a, b) => b.games - a.games),
      mapStats: Object.values(byMap).sort((a, b) => b.games - a.games),
    };
  }, [matchesResult]);

  const renderEncounterDetails = (p: PlayerStat) => {
    if (!p.encounters) return null;
    return (
      <div className="encounter-list-box">
        <div className="encounter-list-title">
          <span>
            <strong>{p.name}</strong>님과 만난 게임 ({p.encounters.length}경기)
            {p.suspicionReasons && p.suspicionReasons.length > 0 && (
              <span className="reason-inline"> — {p.suspicionReasons.join(' · ')}</span>
            )}
          </span>
          <button
            type="button"
            className="mini-btn"
            onClick={(e) => {
              e.stopPropagation();
              handleCopyReport(p);
            }}
          >
            {copiedId === p.puuid ? '복사됨 ✓' : '매치 내역 복사'}
          </button>
        </div>

        <div className="encounter-grid">
          {p.encounters.map((enc) => {
            const theirAgent = resolveAgent(assets, enc.theirAgentId, enc.theirAgent);
            return (
              <div
                key={enc.matchId}
                className={`encounter-card ${
                  enc.targetResult === '승리'
                    ? 'win'
                    : enc.targetResult === '패배'
                    ? 'loss'
                    : 'draw'
                }`}
              >
                <div className="enc-date">{formatDateTime(enc.gameStart)}</div>
                <div className="enc-map">
                  <strong>{enc.map}</strong> ({enc.roundsWon}:{enc.roundsLost})
                </div>
                <div className="enc-rel">
                  <span className={`badge ${enc.relation === '아군' ? 'ally' : 'enemy'}`}>
                    {enc.relation}
                  </span>
                  {enc.sameParty && <span className="party-pill">파티</span>}
                </div>
                <div className="enc-their">
                  {theirAgent.icon && (
                    <img src={theirAgent.icon} alt={theirAgent.name} className="agent-avatar-xs" />
                  )}
                  <span>
                    {theirAgent.name} · {enc.theirKills}/{enc.theirDeaths}/{enc.theirAssists} (ACS{' '}
                    {enc.theirAcs.toFixed(0)})
                  </span>
                </div>
                <div className="enc-result">내 결과: {enc.targetResult}</div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderMatchCard = (m: MatchSummary) => {
    const isExpanded = !!expandedMatches[m.matchId];
    const agentInfo = resolveAgent(assets, m.agentId, m.agent);
    const tierInfo = resolveTier(assets, m.tier, m.tierName);
    const friendlyTeam = m.participants?.filter((p) => p.isTarget || p.isAlly) || [];
    const enemyTeam = m.participants?.filter((p) => !p.isTarget && !p.isAlly) || [];

    return (
      <div
        key={m.matchId}
        className={`match-wrapper ${m.result === '승리' ? 'win' : m.result === '패배' ? 'loss' : 'draw'}`}
      >
        <div
          className="match-card"
          onClick={() => toggleMatch(m.matchId)}
          role="button"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              toggleMatch(m.matchId);
            }
          }}
        >
          <div className="match-meta">
            <div className="match-result-row">
              <span className="match-result-text">{m.result}</span>
              {(m.roundsWon > 0 || m.roundsLost > 0) && (
                <span className="match-score-pill">
                  {m.roundsWon} : {m.roundsLost}
                </span>
              )}
            </div>
            <div className="match-mode">
              {m.mode} · {m.map}
            </div>
            <div className="match-time">{formatRelativeTime(m.gameStart)}</div>
          </div>

          <div className="match-agent">
            {agentInfo.icon ? (
              <img src={agentInfo.icon} alt={agentInfo.name} className="agent-avatar" />
            ) : (
              <div className="agent-avatar placeholder">{agentInfo.name.slice(0, 1)}</div>
            )}
            <div className="agent-text">
              <div className="agent-name">{agentInfo.name}</div>
              <div className="tier-mini">
                {tierInfo.icon && <img src={tierInfo.icon} alt={tierInfo.name} className="tier-icon-sm" />}
                <span>{tierInfo.name}</span>
              </div>
            </div>
          </div>

          <div className="match-stats">
            <div className="kda-line">
              {m.kills} / {m.deaths} / {m.assists}
            </div>
            <div className="score-line">ACS {m.acs.toFixed(0)}</div>
          </div>

          <div className="match-encounter-badges">
            {m.suspectCount > 0 && <span className="badge suspect">🚨 의심 {m.suspectCount}명</span>}
            {m.repeatCount > 0 && <span className="badge repeat">🔁 재조우 {m.repeatCount}명</span>}
            {m.repeatCount === 0 && m.suspectCount === 0 && (
              <span className="badge neutral">전원 초면</span>
            )}
            <span className="expand-chevron">{isExpanded ? '▲' : '▼'}</span>
          </div>
        </div>

        {isExpanded && m.participants && m.participants.length > 0 && (
          <div className="scoreboard-panel">
            {[
              { title: '아군 팀', list: friendlyTeam, teamClass: 'ally-board' },
              { title: '적군 팀', list: enemyTeam, teamClass: 'enemy-board' },
            ].map((group) => (
              <div key={group.title} className={`team-board ${group.teamClass}`}>
                <div className="team-board-header">
                  <span>{group.title}</span>
                  <span>티어</span>
                  <span>ACS</span>
                  <span>K / D / A</span>
                  <span>조우</span>
                </div>
                {group.list.map((p) => {
                  const pAgent = resolveAgent(assets, p.agentId, p.agent);
                  const pTier = resolveTier(assets, p.tier, p.tierName);
                  const isHighlighted = highlightedPuuid === p.puuid;
                  const isRepeat = !p.isTarget && !p.sameParty && p.metCount >= 2;

                  return (
                    <div
                      key={p.puuid}
                      className={`scoreboard-row ${p.isTarget ? 'is-target' : ''} ${
                        isRepeat ? 'is-repeat' : ''
                      } ${isHighlighted ? 'is-highlighted' : ''}`}
                    >
                      <div className="sb-player">
                        {pAgent.icon ? (
                          <img src={pAgent.icon} alt={pAgent.name} className="agent-avatar-sm" />
                        ) : (
                          <span className="agent-dot">{pAgent.name.slice(0, 1)}</span>
                        )}
                        <div className="sb-name-wrap">
                          {p.isTarget || !p.name ? (
                            <span className="sb-name">
                              {p.fullName} {p.isTarget && <span className="me-pill">나</span>}
                            </span>
                          ) : (
                            <button
                              type="button"
                              className="player-link-btn"
                              title={`${p.fullName} 전적 검색하기`}
                              onClick={(e) => {
                                e.stopPropagation();
                                searchPlayer(p.name, p.tag);
                              }}
                            >
                              {p.fullName}
                            </button>
                          )}
                          <span className="sb-agent-sub">
                            {pAgent.name}
                            {p.sameParty && <span className="party-pill">파티</span>}
                          </span>
                        </div>
                      </div>

                      <div className="sb-tier" title={pTier.name}>
                        {pTier.icon ? (
                          <img src={pTier.icon} alt={pTier.name} className="tier-icon-sm" />
                        ) : (
                          <span className="tier-text-sm">{pTier.name}</span>
                        )}
                      </div>

                      <div className="sb-acs">{p.acs.toFixed(0)}</div>
                      <div className="sb-kda">
                        {p.kills}/{p.deaths}/{p.assists}
                      </div>

                      <div className="sb-met">
                        {p.isTarget ? (
                          <span className="met-dash">-</span>
                        ) : p.metCount >= 2 ? (
                          <button
                            type="button"
                            className={`met-pill ${p.sameParty ? 'party' : 'repeat'}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              jumpToPlayerDetail(p.puuid);
                            }}
                          >
                            {p.metCount}회
                          </button>
                        ) : (
                          <span className="met-once">1회</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="App">
      <header className="header">
        <h1 className="logo">Valorant Tracker</h1>
        <p className="subtitle">게임별 조우 플레이어 추적 · 경쟁전 어뷰징 정밀 탐지기</p>
      </header>

      <main className="container">
        <section className="search-section card">
          <form className="input-group" onSubmit={handleSubmit}>
            <input
              type="text"
              placeholder="닉네임 또는 닉네임#태그 붙여넣기"
              value={gameName}
              onChange={(e) => handleNameInputChange(e.target.value)}
            />
            <span className="hash">#</span>
            <input
              type="text"
              className="tag-input"
              placeholder="태그 (예: KR1)"
              value={tagLine}
              onChange={(e) => setTagLine(e.target.value)}
            />
            <button type="submit" disabled={isLoading} className="btn-primary">
              {isLoading ? '분석 중...' : '전적 검색'}
            </button>
          </form>

          {recentSearches.length > 0 && (
            <div className="recent-row">
              <span className="recent-label">최근 검색:</span>
              {recentSearches.map((item) => (
                <div key={`${item.name}#${item.tag}`} className="recent-chip-group">
                  <button
                    type="button"
                    className="recent-chip"
                    disabled={isLoading}
                    onClick={() => searchPlayer(item.name, item.tag)}
                  >
                    {item.name}#{item.tag}
                  </button>
                  <button
                    type="button"
                    className="recent-remove-btn"
                    title="검색 기록 삭제"
                    aria-label={`${item.name}#${item.tag} 삭제`}
                    onClick={() => removeRecentSearch(item.name, item.tag)}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button type="button" className="recent-clear-btn" onClick={clearRecentSearches}>
                전체 삭제
              </button>
            </div>
          )}
        </section>

        {statusMessage && <div className={`status-message ${statusType}`}>{statusMessage}</div>}

        {account && matchesResult && (
          <div className="dashboard-wrapper">
            {/* Top Mode Controls + Profile Banner */}
            <section className="profile-banner card">
              <div className="profile-top">
                <div>
                  <div className="profile-name">
                    {account.name}
                    <span className="profile-tag">#{account.tag}</span>
                    <span className="region-badge">{(account.region || 'kr').toUpperCase()}</span>
                  </div>
                  <div className="profile-sub">
                    분석 범위: <strong>{matchesResult.matchesCount}경기</strong>
                    {' · '}반복 조우(비파티) <strong>{matchesResult.summary.repeatPlayersCount}명</strong>
                    {' · '}의심 유저{' '}
                    <strong className={matchesResult.summary.suspiciousCount > 0 ? 'text-danger' : ''}>
                      {matchesResult.summary.suspiciousCount}명
                    </strong>
                  </div>
                </div>

                <div className="mode-switcher">
                  <button
                    type="button"
                    disabled={isLoading}
                    className={`mode-btn ${modeFilter === 'competitive' ? 'active' : ''}`}
                    onClick={() => handleModeChange('competitive')}
                  >
                    경쟁전만 (추천)
                  </button>
                  <button
                    type="button"
                    disabled={isLoading}
                    className={`mode-btn ${modeFilter === 'all' ? 'active' : ''}`}
                    onClick={() => handleModeChange('all')}
                  >
                    전체 모드
                  </button>
                </div>
              </div>

              <div className="kpi-grid">
                <div className="kpi-card">
                  <span className="kpi-label">전적 / 승률</span>
                  <span className="kpi-value">
                    {matchesResult.summary.wins}승 {matchesResult.summary.losses}패
                    {matchesResult.summary.draws > 0 ? ` ${matchesResult.summary.draws}무` : ''}
                  </span>
                  <span className="kpi-sub">승률 {matchesResult.summary.winRate}%</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">평균 KDA</span>
                  <span className="kpi-value">{matchesResult.summary.kda}</span>
                  <span className="kpi-sub">
                    {matchesResult.summary.avgKills} / {matchesResult.summary.avgDeaths} /{' '}
                    {matchesResult.summary.avgAssists}
                  </span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">평균 ACS</span>
                  <span className="kpi-value">{matchesResult.summary.avgAcs}</span>
                  <span className="kpi-sub">라운드당 전투 점수</span>
                </div>
                <div className="kpi-card">
                  <span className="kpi-label">동일 큐 반복 조우</span>
                  <span className="kpi-value">{matchesResult.summary.repeatPlayersCount}명</span>
                  <span className="kpi-sub">비파티 2회 이상 만남</span>
                </div>
              </div>
            </section>

            {/* Suspicious Alert Box */}
            {suspiciousPlayers.length > 0 && (
              <section className="alert-box">
                <div className="alert-header">
                  <h3>🚨 어뷰징 · 동시큐 의심 플레이어 감지 ({suspiciousPlayers.length}명)</h3>
                </div>
                <div className="suspect-cards">
                  {suspiciousPlayers.map((sp) => (
                    <div key={sp.puuid} className={`suspect-item level-${sp.suspicionLevel}`}>
                      <div className="suspect-main">
                        <button
                          type="button"
                          className="player-link-btn strong"
                          onClick={() => sp.gameName && sp.tagLine && searchPlayer(sp.gameName, sp.tagLine)}
                        >
                          {sp.name}
                        </button>
                        <span className={`risk-badge ${sp.suspicionLevel}`}>
                          {sp.suspicionLevel === 'high' ? '높음' : '주의'} ({sp.suspicionScore}점)
                        </span>
                        <span className="suspect-counts">
                          총 {sp.met}회 (아군 {sp.asAlly} / 적군 {sp.asEnemy})
                        </span>
                      </div>
                      <div className="suspect-reasons">
                        {sp.suspicionReasons?.join(' · ') || '반복 조우 패턴'}
                      </div>
                      <div className="suspect-actions">
                        <button
                          type="button"
                          className="mini-btn"
                          onClick={() => jumpToPlayerDetail(sp.puuid)}
                        >
                          만난 게임 보기
                        </button>
                        <button
                          type="button"
                          className="mini-btn"
                          onClick={() => handleCopyReport(sp)}
                        >
                          {copiedId === sp.puuid ? '복사됨 ✓' : '신고 요약 복사'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Main Navigation Tabs */}
            <div className="tabs">
              <button
                type="button"
                className={`tab ${activeTab === 'tracker' ? 'active' : ''}`}
                onClick={() => setActiveTab('tracker')}
              >
                🎯 게임별 조우 현황 ({matchesResult.matchesCount}전)
              </button>
              <button
                type="button"
                className={`tab ${activeTab === 'players' ? 'active' : ''}`}
                onClick={() => setActiveTab('players')}
              >
                🕵️ 조우 플레이어 상세 ({matchesResult.players?.length || 0}명)
              </button>
              <button
                type="button"
                className={`tab ${activeTab === 'stats' ? 'active' : ''}`}
                onClick={() => setActiveTab('stats')}
              >
                📊 요원 · 맵 통계
              </button>
            </div>

            {/* TAB 1: Tracker Match-by-Match View (Default) */}
            {activeTab === 'tracker' && (
              <div className="tab-content">
                {frequentNonPartyPlayers.length > 0 && (
                  <div className="frequent-strip">
                    <div className="strip-header">
                      <span>🔁 자주 만난 비파티 플레이어 (클릭 시 해당 경기 필터)</span>
                      {highlightedPuuid && (
                        <button
                          type="button"
                          className="clear-filter-btn"
                          onClick={() => setHighlightedPuuid(null)}
                        >
                          필터 해제
                        </button>
                      )}
                    </div>
                    <div className="frequent-chips">
                      {frequentNonPartyPlayers.map((fp) => {
                        const active = highlightedPuuid === fp.puuid;
                        return (
                          <button
                            key={fp.puuid}
                            type="button"
                            className={`freq-chip ${active ? 'active' : ''} ${
                              fp.suspicionLevel !== 'none' ? `risk-${fp.suspicionLevel}` : ''
                            }`}
                            onClick={() => {
                              const next = active ? null : fp.puuid;
                              setHighlightedPuuid(next);
                              if (next && matchesResult.history) {
                                const autoOpen: Record<string, boolean> = {};
                                for (const m of matchesResult.history) {
                                  if (m.participants?.some((p) => p.puuid === next)) {
                                    autoOpen[m.matchId] = true;
                                  }
                                }
                                setExpandedMatches(autoOpen);
                              }
                            }}
                          >
                            <span className="freq-name">{fp.name}</span>
                            <span className="freq-meta">
                              {fp.soloMet}회 (아{fp.asAlly}/적{fp.asEnemy})
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                <div className="match-list">
                  {filteredMatches.map(renderMatchCard)}
                  {filteredMatches.length === 0 && (
                    <p className="empty-message">조건에 해당하는 매치 기록이 없습니다.</p>
                  )}
                </div>

                {matchesResult.hasMore && !highlightedPuuid && (
                  <div className="load-more-wrap">
                    <button
                      type="button"
                      className="btn-secondary load-more-btn"
                      disabled={isLoadingMore}
                      onClick={handleLoadMore}
                    >
                      {isLoadingMore
                        ? '추가 매치 불러오는 중...'
                        : `이전 전적 더 불러오기 (현재 ${matchesResult.matchesCount}경기)`}
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TAB 2: Players & Abusing Analysis Table with Per-Match Drilldown */}
            {activeTab === 'players' && (
              <div className="tab-content">
                <div className="players-toolbar">
                  <div className="toolbar-checks">
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={onlyRepeats}
                        onChange={(e) => setOnlyRepeats(e.target.checked)}
                      />
                      <span>2회 이상 조우만 보기</span>
                    </label>
                    <label className="check-label">
                      <input
                        type="checkbox"
                        checked={excludeParty}
                        onChange={(e) => setExcludeParty(e.target.checked)}
                      />
                      <span>파티원 제외</span>
                    </label>
                  </div>
                  <input
                    type="text"
                    className="player-filter-input"
                    placeholder="플레이어 닉네임 검색..."
                    value={playerSearch}
                    onChange={(e) => setPlayerSearch(e.target.value)}
                  />
                </div>

                {filteredPlayers.length > 0 ? (
                  <>
                    <div className="table-responsive desktop-only">
                      <table className="stats-table">
                        <thead>
                          <tr>
                            <th>플레이어 (클릭 시 경기 상세)</th>
                            <th>만남</th>
                            <th>적군 전적 (승/패율)</th>
                            <th>아군 전적</th>
                            <th>평균 ACS (아/적)</th>
                            <th>의심도</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredPlayers.map((p) => {
                            const isOpen = expandedPlayer === p.puuid;
                            const decidedEnemy = p.enemyWon + p.enemyLost;
                            const enemyLossRate =
                              decidedEnemy > 0 ? Math.round((p.enemyLost / decidedEnemy) * 100) : 0;
                            const enemyWinRate =
                              decidedEnemy > 0 ? Math.round((p.enemyWon / decidedEnemy) * 100) : 0;
                            const isSkewedWin = decidedEnemy >= 2 && enemyWinRate >= 70;
                            const isSkewedLoss = decidedEnemy >= 2 && enemyLossRate >= 70;

                            return (
                              <React.Fragment key={p.puuid}>
                                <tr
                                  className={`player-row ${
                                    p.suspicionLevel === 'high' ? 'suspect-row' : ''
                                  } ${isOpen ? 'open-row' : ''}`}
                                  onClick={() => setExpandedPlayer(isOpen ? null : p.puuid)}
                                >
                                  <td className="player-name-cell">
                                    <div className="player-cell-top">
                                      <button
                                        type="button"
                                        className="player-link-btn"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          if (p.gameName && p.tagLine) {
                                            searchPlayer(p.gameName, p.tagLine);
                                          }
                                        }}
                                        title="이 플레이어 전적 검색"
                                      >
                                        {p.name}
                                      </button>
                                      {p.samePartyCount > 0 && (
                                        <span className="party-pill">파티 {p.samePartyCount}</span>
                                      )}
                                    </div>
                                    <div className="player-tier-sub">{p.latestTier}</div>
                                  </td>

                                  <td>
                                    <strong>{p.met}회</strong>
                                    <div className="sub-cell">
                                      아군 {p.asAlly} / 적군 {p.asEnemy}
                                    </div>
                                  </td>

                                  <td>
                                    {p.asEnemy > 0 ? (
                                      <>
                                        <span>
                                          {p.enemyWon}승 {p.enemyLost}패
                                        </span>
                                        <div
                                          className={`sub-cell ${
                                            isSkewedLoss || isSkewedWin ? 'high-loss' : ''
                                          }`}
                                        >
                                          {enemyWinRate >= enemyLossRate
                                            ? `승률 ${enemyWinRate}%`
                                            : `패배율 ${enemyLossRate}%`}
                                        </div>
                                      </>
                                    ) : (
                                      <span className="muted">-</span>
                                    )}
                                  </td>

                                  <td>
                                    {p.asAlly > 0 ? (
                                      <span>
                                        {p.allyWon}승 {p.allyLost}패
                                      </span>
                                    ) : (
                                      <span className="muted">-</span>
                                    )}
                                  </td>

                                  <td>
                                    <strong>{p.avgAcs.toFixed(0)}</strong>
                                    <div className="sub-cell">
                                      {p.asAlly > 0 ? p.acsAsAlly.toFixed(0) : '-'} /{' '}
                                      {p.asEnemy > 0 ? p.acsAsEnemy.toFixed(0) : '-'}
                                    </div>
                                  </td>

                                  <td>
                                    {p.suspicionLevel !== 'none' ? (
                                      <span className={`risk-badge ${p.suspicionLevel}`}>
                                        {p.suspicionLevel === 'high' ? '의심' : '주의'} {p.suspicionScore}
                                      </span>
                                    ) : (
                                      <span className="muted">정상</span>
                                    )}
                                  </td>
                                </tr>

                                {isOpen && p.encounters && (
                                  <tr className="encounter-detail-row">
                                    <td colSpan={6}>{renderEncounterDetails(p)}</td>
                                  </tr>
                                )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    <div className="mobile-player-list mobile-only">
                      {filteredPlayers.map((p) => {
                        const isOpen = expandedPlayer === p.puuid;
                        const decidedEnemy = p.enemyWon + p.enemyLost;
                        const enemyLossRate =
                          decidedEnemy > 0 ? Math.round((p.enemyLost / decidedEnemy) * 100) : 0;
                        const enemyWinRate =
                          decidedEnemy > 0 ? Math.round((p.enemyWon / decidedEnemy) * 100) : 0;
                        const isSkewed = decidedEnemy >= 2 && (enemyWinRate >= 70 || enemyLossRate >= 70);

                        return (
                          <div
                            key={p.puuid}
                            className={`mobile-player-card ${
                              p.suspicionLevel === 'high' ? 'suspect-row' : ''
                            } ${isOpen ? 'open-card' : ''}`}
                          >
                            <div
                              className="mobile-player-summary"
                              onClick={() => setExpandedPlayer(isOpen ? null : p.puuid)}
                            >
                              <div className="mobile-player-top">
                                <div className="player-cell-top">
                                  <button
                                    type="button"
                                    className="player-link-btn"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (p.gameName && p.tagLine) {
                                        searchPlayer(p.gameName, p.tagLine);
                                      }
                                    }}
                                  >
                                    {p.name}
                                  </button>
                                  {p.samePartyCount > 0 && (
                                    <span className="party-pill">파티 {p.samePartyCount}</span>
                                  )}
                                </div>
                                <div className="mobile-player-badges">
                                  {p.suspicionLevel !== 'none' ? (
                                    <span className={`risk-badge ${p.suspicionLevel}`}>
                                      {p.suspicionLevel === 'high' ? '의심' : '주의'} {p.suspicionScore}
                                    </span>
                                  ) : (
                                    <span className="met-pill repeat">{p.met}회 조우</span>
                                  )}
                                  <span className="expand-chevron">{isOpen ? '▲' : '▼'}</span>
                                </div>
                              </div>

                              <div className="mobile-player-metrics">
                                <span>
                                  아군 {p.asAlly} ({p.allyWon}승{p.allyLost}패)
                                </span>
                                <span className={isSkewed ? 'high-loss' : ''}>
                                  적군 {p.asEnemy} ({p.enemyWon}승{p.enemyLost}패
                                  {decidedEnemy > 0 &&
                                    ` · ${
                                      enemyWinRate >= enemyLossRate
                                        ? `승${enemyWinRate}%`
                                        : `패${enemyLossRate}%`
                                    }`}
                                  )
                                </span>
                                <span>ACS {p.avgAcs.toFixed(0)}</span>
                              </div>
                            </div>

                            {isOpen && p.encounters && (
                              <div className="mobile-encounter-wrap">{renderEncounterDetails(p)}</div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </>
                ) : (
                  <p className="empty-message">
                    {onlyRepeats
                      ? '2회 이상 만난 플레이어가 없습니다. 상단 "더 불러오기"로 더 많은 경기를 분석해보세요!'
                      : '조건에 맞는 플레이어가 없습니다.'}
                  </p>
                )}
              </div>
            )}

            {/* TAB 3: Agent & Map Breakdown */}
            {activeTab === 'stats' && (
              <div className="tab-content stats-grid-two">
                <div className="mini-panel">
                  <h3 className="panel-title">요원별 성적</h3>
                  <div className="breakdown-list">
                    {agentStats.map((st) => {
                      const info = resolveAgent(assets, st.agentId, st.agent);
                      const wr = st.games > 0 ? Math.round((st.wins / st.games) * 100) : 0;
                      const kda =
                        st.d === 0 ? (st.k + st.a).toFixed(2) : ((st.k + st.a) / st.d).toFixed(2);
                      return (
                        <div key={st.agent} className="breakdown-row">
                          <div className="bd-left">
                            {info.icon && <img src={info.icon} alt={info.name} className="agent-avatar-sm" />}
                            <span>{info.name}</span>
                          </div>
                          <div className="bd-right">
                            <span>
                              {st.games}전 {st.wins}승 ({wr}%)
                            </span>
                            <span className="muted">KDA {kda}</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="mini-panel">
                  <h3 className="panel-title">맵별 승률</h3>
                  <div className="breakdown-list">
                    {mapStats.map((ms) => {
                      const wr = ms.games > 0 ? Math.round((ms.wins / ms.games) * 100) : 0;
                      return (
                        <div key={ms.map} className="breakdown-row">
                          <div className="bd-left">
                            <strong>{ms.map}</strong>
                          </div>
                          <div className="bd-right">
                            <span>
                              {ms.wins}승 {ms.losses}패 ({ms.games}전)
                            </span>
                            <span className={wr >= 50 ? 'text-win' : 'text-loss'}>{wr}%</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
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
