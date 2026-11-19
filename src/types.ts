export interface AccountInfo {
  puuid: string;
  name: string;
  tag: string;
  region?: string;
  account_level?: number;
}

export interface MatchParticipant {
  puuid: string;
  name: string;
  tag: string;
  fullName: string;
  team: string;
  isTarget: boolean;
  isAlly: boolean;
  sameParty: boolean;
  partyId?: string;
  agent: string;
  agentId?: string;
  tier: number;
  tierName: string;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  acs: number;
  damage: number;
  metCount: number;
}

export interface MatchSummary {
  matchId: string;
  map: string;
  mode: string;
  modeId: string;
  gameStart: number;
  gameLength: number;
  roundsPlayed: number;
  roundsWon: number;
  roundsLost: number;
  agent: string;
  agentId?: string;
  tier: number;
  tierName: string;
  result: string;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  acs: number;
  repeatCount: number;
  suspectCount: number;
  participants: MatchParticipant[];
}

export interface PlayerEncounter {
  matchId: string;
  map: string;
  mode: string;
  gameStart: number;
  roundsWon: number;
  roundsLost: number;
  targetResult: string;
  relation: '아군' | '적군';
  sameParty: boolean;
  theirAgent: string;
  theirAgentId?: string;
  theirTier: string;
  theirKills: number;
  theirDeaths: number;
  theirAssists: number;
  theirAcs: number;
  targetAgent: string;
  targetKda: string;
}

export interface PlayerStat {
  puuid: string;
  name: string;
  gameName: string;
  tagLine: string;
  latestTier: string;
  met: number;
  soloMet: number;
  samePartyCount: number;
  asAlly: number;
  soloAsAlly: number;
  soloAllyLost: number;
  allyWon: number;
  allyLost: number;
  allyDraw: number;
  asEnemy: number;
  enemyWon: number;
  enemyLost: number;
  enemyDraw: number;
  targetLost: number;
  kills: number;
  deaths: number;
  assists: number;
  score: number;
  avgAcs: number;
  acsAsAlly: number;
  acsAsEnemy: number;
  quickRequeueCount: number;
  suspicionScore: number;
  suspicionLevel: 'none' | 'watch' | 'high';
  suspicionReasons: string[] | null;
  encounters: PlayerEncounter[] | null;
}

export interface OverallSummary {
  totalMatches: number;
  wins: number;
  losses: number;
  draws: number;
  winRate: number;
  avgKills: number;
  avgDeaths: number;
  avgAssists: number;
  kda: number;
  avgAcs: number;
  repeatPlayersCount: number;
  suspiciousCount: number;
}

export interface MatchResult {
  matchesCount: number;
  modeFilter: string;
  abusingDetected: boolean;
  summary: OverallSummary;
  details: string[] | null;
  players: PlayerStat[] | null;
  history: MatchSummary[] | null;
  fetchedNewCount?: number;
  nextStart?: number;
  hasMore?: boolean;
  rateLimited?: boolean;
  warning?: string;
}

export interface AgentAsset {
  uuid: string;
  displayName: string;
  englishName: string;
  icon: string;
}

export interface TierAsset {
  tier: number;
  name: string;
  icon: string;
}

export interface ValorantAssetMap {
  agentsById: Record<string, AgentAsset>;
  agentsByName: Record<string, AgentAsset>;
  tiersById: Record<number, TierAsset>;
}
