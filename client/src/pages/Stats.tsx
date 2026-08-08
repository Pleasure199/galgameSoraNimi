import { useCallback, useEffect, useRef, useState } from 'react';
import { BarChart3, ChevronLeft, ChevronRight, Users } from 'lucide-react';
import Page from '../components/Page';
import DataTable, { Column } from '../components/DataTable';
import Badge from '../components/Badge';
import { api, errMsg } from '../api/client';
import { toast } from '../components/Toast';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../i18n';

interface SingleStats {
  totalGames: number;
  wins: number;
  winRate: number;
  avgGuesses: number | null;
  bestGuesses: number | null;
  firstGuess: { characterId: number; name: string; percentage: number } | null;
}

interface StatsResponse {
  difficulties: string[];
  personal: SingleStats;
  global: SingleStats & { registeredUsers: number };
}

interface SingleReplayItem {
  id: number;
  mode: string;
  status: string;
  guessCount: number;
  finishedAt: string;
  answer: string;
}

interface ReplayPage<T> {
  page: number;
  pageSize: number;
  hasNext: boolean;
  items: T[];
}

function formatAverage(value: number | null): string {
  return value == null ? '-' : value.toFixed(2);
}

function formatFirstGuess(value: SingleStats['firstGuess']): string {
  return value ? `${value.name} ${(value.percentage * 100).toFixed(1)}%` : '-';
}

function StatTable({ rows }: { rows: [string, string | number][] }) {
  return (
    <table className="table stats-summary-table">
      <tbody>
        {rows.map(([label, value]) => (
          <tr key={label}><td>{label}</td><td className="stat-value">{value}</td></tr>
        ))}
      </tbody>
    </table>
  );
}

export default function Stats() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<StatsResponse | null>(null);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<SingleReplayItem[]>([]);
  const [hasNext, setHasNext] = useState(false);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const statsRequestId = useRef(0);

  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);

  const loadStats = useCallback(() => {
    const currentRequest = ++statsRequestId.current;
    setStatsLoading(true);
    setStatsError(false);
    api.get<StatsResponse>('/stats/me')
      .then((res) => {
        if (currentRequest === statsRequestId.current) setStats(res.data);
      })
      .catch(() => {
        if (currentRequest === statsRequestId.current) setStatsError(true);
      })
      .finally(() => {
        if (currentRequest === statsRequestId.current) setStatsLoading(false);
      });
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const loadReplays = useCallback(async () => {
    const currentRequest = ++requestId.current;
    setLoading(true);
    try {
      const res = await api.get<ReplayPage<SingleReplayItem>>('/stats/replays', {
        params: { page, pageSize: 15 },
      });
      if (currentRequest !== requestId.current) return;
      setItems(res.data.items);
      setHasNext(res.data.hasNext);
    } catch (err) {
      if (currentRequest === requestId.current) toast.error(errMsg(err));
    } finally {
      if (currentRequest === requestId.current) setLoading(false);
    }
  }, [page]);

  useEffect(() => { void loadReplays(); }, [loadReplays]);

  const singleColumns: Column<SingleReplayItem>[] = [
    { key: 'status', title: t('stats.result'), render: (game) => game.status === 'won'
      ? <Badge text={t('common.win')} color="green" /> : <Badge text={t('common.loss')} color="gray" /> },
    { key: 'guessCount', title: t('stats.guesses') },
    { key: 'answer', title: t('stats.answer') },
    { key: 'finishedAt', title: t('stats.time'), render: (game) => new Date(game.finishedAt).toLocaleString(currentLocale()) },
  ];

  return (
    <Page title={t('stats.title')} icon={<BarChart3 size={17} />}>
      <div className="stats-content">
        {!stats && statsLoading && (
          <section className="stats-difficulty-section" aria-busy="true">
            <div className="stats-overview-grid">
              <div className="card" role="status" aria-label={t('common.loading')}>
                <div className="table-skeleton"><i /><i /><i /><i /><i /><i /><i /><i /></div>
              </div>
              <div className="card" aria-hidden="true">
                <div className="table-skeleton"><i /><i /><i /><i /><i /><i /><i /><i /></div>
              </div>
            </div>
          </section>
        )}
        {!stats && !statsLoading && statsError && (
          <section className="stats-difficulty-section">
            <div className="card game-empty-actions" style={{ alignItems: 'center' }}>
              <p className="muted" style={{ margin: 0 }}>{t('stats.loadFailed')}</p>
              <button className="btn btn-ghost btn-sm" type="button" onClick={loadStats}>
                {t('common.retry')}
              </button>
            </div>
          </section>
        )}
        {stats && (
          <section className="stats-difficulty-section" aria-busy={statsLoading}>
            <div className="stats-overview-grid">
              <div className="card">
                <h3><BarChart3 size={16} />{t('stats.personal')}</h3>
                <StatTable rows={[
                  [t('stats.singleGames'), stats.personal.totalGames],
                  [t('stats.singleWins'), stats.personal.wins],
                  [t('stats.singleWinRate'), `${(stats.personal.winRate * 100).toFixed(1)}%`],
                  [t('stats.avgWinningGuesses'), formatAverage(stats.personal.avgGuesses)],
                  [t('stats.bestGuess'), stats.personal.bestGuesses ?? '-'],
                  [t('stats.topFirstGuess'), formatFirstGuess(stats.personal.firstGuess)],
                ]} />
              </div>
              <div className="card">
                <h3><Users size={16} />{t('stats.global')}</h3>
                <StatTable rows={[
                  [t('stats.registeredUsers'), stats.global.registeredUsers],
                  [t('stats.singleGames'), stats.global.totalGames],
                  [t('stats.singleWins'), stats.global.wins],
                  [t('stats.globalWinRate'), `${(stats.global.winRate * 100).toFixed(1)}%`],
                  [t('stats.avgWinningGuesses'), formatAverage(stats.global.avgGuesses)],
                  [t('stats.topFirstGuess'), formatFirstGuess(stats.global.firstGuess)],
                ]} />
              </div>
            </div>
          </section>
        )}

        <section className="card stats-recent-card">
          <div className="stats-replay-toolbar">
            <h3>{t('stats.personalReplays')}</h3>
          </div>
          <div className="stats-recent-table stats-replay-desktop-list">
            <DataTable
              columns={singleColumns}
              rows={items}
              rowKey={(game) => game.id}
              loading={loading}
              empty={t('stats.noSingle')}
            />
          </div>
          <div className="stats-replay-mobile-list">
            {items.length ? items.map((item) => (
              <article className="stats-replay-mobile-item" key={`single:${item.id}`}>
                <div className="stats-replay-mobile-heading">
                  <Badge
                    text={item.status === 'won' ? t('common.win') : t('common.loss')}
                    color={item.status === 'won' ? 'green' : 'gray'}
                  />
                </div>
                <div className="stats-replay-mobile-details">
                  <span>{t('stats.answer')} <strong>{item.answer}</strong></span>
                  <span>{t('stats.guesses')} <strong>{item.guessCount}</strong></span>
                </div>
                <div className="stats-replay-mobile-footer">
                  <time dateTime={item.finishedAt}>{new Date(item.finishedAt).toLocaleString(currentLocale())}</time>
                </div>
              </article>
            )) : <p className="muted">{loading ? t('common.loading') : t('stats.noSingle')}</p>}
          </div>
          <div className="stats-pagination">
            <button className="btn btn-ghost" type="button" aria-label={t('common.previousPage')} title={t('common.previousPage')} disabled={page === 1 || loading} onClick={() => setPage((current) => Math.max(1, current - 1))}>
              <ChevronLeft size={17} />
            </button>
            <span>{t('common.page', { page })}</span>
            <button className="btn btn-ghost" type="button" aria-label={t('common.nextPage')} title={t('common.nextPage')} disabled={!hasNext || loading} onClick={() => setPage((current) => current + 1)}>
              <ChevronRight size={17} />
            </button>
          </div>
        </section>
      </div>
    </Page>
  );
}
