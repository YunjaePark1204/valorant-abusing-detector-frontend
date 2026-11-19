import type { AgentAsset, PlayerStat, TierAsset, ValorantAssetMap } from '../types';

const ASSETS_CACHE_KEY = 'val_tracker_assets_v1';
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CachedAssets {
  savedAt: number;
  data: ValorantAssetMap;
}

export async function loadValorantAssets(): Promise<ValorantAssetMap> {
  const empty: ValorantAssetMap = { agentsById: {}, agentsByName: {}, tiersById: {} };

  try {
    const raw = localStorage.getItem(ASSETS_CACHE_KEY);
    if (raw) {
      const parsed: CachedAssets = JSON.parse(raw);
      if (Date.now() - parsed.savedAt < CACHE_TTL_MS && Object.keys(parsed.data.agentsById).length > 0) {
        return parsed.data;
      }
    }
  } catch {
    // ignore cache errors
  }

  try {
    const [koAgentsRes, enAgentsRes, tiersRes] = await Promise.all([
      fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=ko-KR'),
      fetch('https://valorant-api.com/v1/agents?isPlayableCharacter=true&language=en-US'),
      fetch('https://valorant-api.com/v1/competitivetiers?language=ko-KR'),
    ]);

    const agentsById: Record<string, AgentAsset> = {};
    const agentsByName: Record<string, AgentAsset> = {};
    const tiersById: Record<number, TierAsset> = {};

    const enNames: Record<string, string> = {};
    if (enAgentsRes.ok) {
      const enJson = await enAgentsRes.json();
      for (const a of enJson.data || []) {
        enNames[a.uuid] = a.displayName;
      }
    }

    if (koAgentsRes.ok) {
      const koJson = await koAgentsRes.json();
      for (const a of koJson.data || []) {
        const asset: AgentAsset = {
          uuid: a.uuid,
          displayName: a.displayName,
          englishName: enNames[a.uuid] || a.displayName,
          icon: a.displayIconSmall || a.displayIcon,
        };
        agentsById[a.uuid.toLowerCase()] = asset;
        agentsByName[a.displayName.toLowerCase()] = asset;
        if (asset.englishName) {
          agentsByName[asset.englishName.toLowerCase()] = asset;
        }
      }
    }

    if (tiersRes.ok) {
      const tiersJson = await tiersRes.json();
      const episodes = tiersJson.data || [];
      const latest = episodes[episodes.length - 1];
      if (latest?.tiers) {
        for (const t of latest.tiers) {
          if (!t.smallIcon) continue;
          tiersById[t.tier] = {
            tier: t.tier,
            name: t.tierName,
            icon: t.smallIcon,
          };
        }
      }
    }

    const result: ValorantAssetMap = { agentsById, agentsByName, tiersById };
    if (Object.keys(agentsById).length > 0) {
      try {
        localStorage.setItem(ASSETS_CACHE_KEY, JSON.stringify({ savedAt: Date.now(), data: result }));
      } catch {
        // ignore storage quota errors
      }
    }
    return result;
  } catch {
    return empty;
  }
}

export function resolveAgent(assets: ValorantAssetMap, agentId?: string, agentName?: string): { name: string; icon?: string } {
  if (agentId) {
    const byId = assets.agentsById[agentId.toLowerCase()];
    if (byId) return { name: byId.displayName, icon: byId.icon };
  }
  if (agentName) {
    const byName = assets.agentsByName[agentName.toLowerCase()];
    if (byName) return { name: byName.displayName, icon: byName.icon };
  }
  return { name: agentName || 'Unknown' };
}

export function resolveTier(assets: ValorantAssetMap, tierId?: number, fallbackName?: string): { name: string; icon?: string } {
  if (tierId && tierId > 0) {
    const found = assets.tiersById[tierId];
    if (found) return { name: found.name, icon: found.icon };
  }
  return { name: fallbackName || 'Unranked' };
}

export function formatRelativeTime(unixSec: number): string {
  if (!unixSec) return '';
  const diffSec = Math.max(0, Math.floor(Date.now() / 1000) - unixSec);
  if (diffSec < 60) return '방금 전';
  const min = Math.floor(diffSec / 60);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const days = Math.floor(hr / 24);
  if (days < 30) return `${days}일 전`;
  const d = new Date(unixSec * 1000);
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

export function formatDateTime(unixSec: number): string {
  if (!unixSec) return '-';
  const d = new Date(unixSec * 1000);
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mi = String(d.getMinutes()).padStart(2, '0');
  return `${mm}/${dd} ${hh}:${mi}`;
}

export function buildReportText(targetLabel: string, player: PlayerStat): string {
  const lines = [
    `[발로란트 어뷰징 의심 제보 요약]`,
    `대상 검색 유저: ${targetLabel}`,
    `의심 플레이어: ${player.name} (의심 점수: ${player.suspicionScore}/100)`,
    `총 조우: ${player.met}회 (비파티 ${player.soloMet}회 | 아군 ${player.asAlly} / 적군 ${player.asEnemy})`,
  ];
  if (player.suspicionReasons?.length) {
    lines.push(`감지 사유: ${player.suspicionReasons.join(', ')}`);
  }
  if (player.encounters?.length) {
    lines.push('--- 관련 매치 ---');
    for (const enc of player.encounters.slice(0, 10)) {
      lines.push(
        `• ${formatDateTime(enc.gameStart)} | ${enc.map} (${enc.roundsWon}:${enc.roundsLost}) | ${enc.relation} | 결과: ${enc.targetResult} | 상대 KDA: ${enc.theirKills}/${enc.theirDeaths}/${enc.theirAssists} (ACS ${enc.theirAcs}) | MatchID: ${enc.matchId}`
      );
    }
  }
  return lines.join('\n');
}
