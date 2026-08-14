import { useEffect, useRef, useState } from 'react';
import { Trophy } from 'lucide-react';
import Page from '../components/Page';
import DataTable, { Column } from '../components/DataTable';
import { api, errMsg } from '../api/client';
import { toast } from '../components/Toast';
import { useAuth } from '../store/auth';
import { useTranslation } from 'react-i18next';
import { AVAILABLE_DIFFICULTIES } from '../config/difficulties';
import { difficultyLabel } from '../utils/difficulty';

interface BoardRow {
  id: number;
  displayId: string;
  total: number;
  wins: number;
  winRate: number;
  avgGuesses: number | null;
}

interface LeaderboardResponse {
  difficulty: string;
  items: BoardRow[];
  currentUser: { displayId: string; rank: number | null } | null;
}

export default function Leaderboard() {
  const { t } = useTranslation();
  const [rows, setRows] = useState<BoardRow[]>([]);
  const [currentUser, setCurrentUser] = useState<LeaderboardResponse['currentUser']>(null);
  const [loading, setLoading] = useState(true);
  const [difficulty, setDifficulty] = useState('beginner');
  const requestId = useRef(0);
  const currentUserId = useAuth((state) => state.user?.id ?? null);

  useEffect(() => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    api
      .get<LeaderboardResponse>('/leaderboard', { params: { difficulty } })
      .then((res) => {
        if (currentRequest !== requestId.current) return;
        setRows(res.data.items);
        setCurrentUser(res.data.currentUser);
      })
      .catch((err) => {
        if (currentRequest === requestId.current) toast.error(errMsg(err));
      })
      .finally(() => {
        if (currentRequest === requestId.current) setLoading(false);
      });
  }, [difficulty]);

  const columns: Column<BoardRow>[] = [
    { key: 'rank', title: '#', render: (r) => rows.indexOf(r) + 1 },
    {
      key: 'displayId',
      title: t('leaderboard.player'),
      render: (row) => (
        <span className="leaderboard-player-label">
          {row.displayId}
          {row.id === currentUserId && <span className="leaderboard-self-marker">{t('leaderboard.self')}</span>}
        </span>
      ),
    },
    { key: 'wins', title: t('leaderboard.wins') },
    { key: 'total', title: t('leaderboard.total') },
    { key: 'winRate', title: t('leaderboard.winRate'), render: (r) => `${(r.winRate * 100).toFixed(1)}%` },
    {
      key: 'avgGuesses',
      title: t('leaderboard.avgGuesses'),
      render: (r: BoardRow) => (r.avgGuesses != null ? r.avgGuesses.toFixed(2) : '-'),
    },
  ];

  const selectionLabel = t('leaderboard.selection', {
    mode: t('leaderboard.single'),
    difficulty: difficultyLabel(t, difficulty),
  });

  return (
    <Page title={t('leaderboard.title')} icon={<Trophy size={17} />}>
      {currentUserId != null && (
        <div
          className="leaderboard-self-summary"
          aria-label={t('leaderboard.myRank')}
          aria-busy={loading}
        >
          <span className="leaderboard-self-summary-label">{t('leaderboard.myRank')}</span>
          <strong>
            {loading
              ? <span className="leaderboard-self-placeholder rank" aria-hidden="true" />
              : currentUser?.rank == null ? t('leaderboard.unranked') : `#${currentUser.rank}`}
          </strong>
          <span className="leaderboard-self-summary-name">
            {loading
              ? <span className="leaderboard-self-placeholder name" aria-hidden="true" />
              : currentUser?.displayId ?? ' '}
          </span>
        </div>
      )}
      <div className="leaderboard-controls">
        <label className="leaderboard-difficulty-select">
          {t('leaderboard.difficultyLabel')}
          <select
            className="input"
            value={difficulty}
            aria-label={t('leaderboard.difficultyLabel')}
            onChange={(event) => setDifficulty(event.target.value)}
          >
          {AVAILABLE_DIFFICULTIES.map((option) => (
            <option
              key={option.key}
              value={option.key}
            >
              {difficultyLabel(t, option.key)}
            </option>
          ))}
          </select>
        </label>
      </div>
      <div className="card leaderboard-card leaderboard-card-single">
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          loading={loading}
          empty={t('leaderboard.empty', { type: selectionLabel })}
        />
      </div>
    </Page>
  );
}
