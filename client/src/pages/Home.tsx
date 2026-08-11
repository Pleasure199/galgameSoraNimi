import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useSyncExternalStore, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Gamepad2,
  LogIn,
  LogOut,
  Megaphone,
  Search,
  Trophy,
} from 'lucide-react';
import GameRules from '../components/GameRules';
import { useAuth } from '../store/auth';
import { getGuestName, subscribeGuestName } from '../store/guest';
import { api, errMsg } from '../api/client';
import { clearAuthenticated } from '../api/session';
import { markGuestSession } from '../api/session';
import { useConfirm } from '../components/ConfirmDialog';
import ThemeToggle from '../components/ThemeToggle';
import { toast } from '../components/Toast';
import { useTranslation } from 'react-i18next';
import PersonalSettings from '../components/PersonalSettings';

function GitHubIcon() {
  return (
    <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" fill="currentColor">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27s1.36.09 2 .27c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
    </svg>
  );
}

interface HomeActionCardProps {
  to: string;
  icon: ReactNode;
  label: string;
  description: string;
  color: string;
}

function HomeActionCard({ to, icon, label, description, color }: HomeActionCardProps) {
  return (
    <Link to={to} className="home-card" style={{ '--card-color': color } as CSSProperties}>
      <span className="home-card-icon">{icon}</span>
      <span className="home-card-copy">
        <strong>{label}</strong>
        <small>{description}</small>
      </span>
      <ArrowUpRight className="home-card-arrow" size={18} />
    </Link>
  );
}

export default function Home() {
  const { t } = useTranslation();
  const { user, initialized, setUser } = useAuth();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [loggingOut, setLoggingOut] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(true);
  const guestName = useSyncExternalStore(subscribeGuestName, getGuestName, () => '访客');

  useEffect(() => {
    document.title = `${t('common.brand')} - ${t('home.subtitle')}`;
  }, [t]);

  useEffect(() => {
    void fetch('/api/health', { credentials: 'include' })
      .then((response) => response.ok ? response.json() : null)
      .then((data: { features?: { leaderboard?: boolean } } | null) => {
        setShowLeaderboard(typeof data?.features?.leaderboard === 'boolean' ? data.features.leaderboard : true);
      })
      .catch(() => setShowLeaderboard(true));
  }, []);

  const logout = async () => {
    if (!await confirm({
      title: t('home.logoutTitle'),
      message: t('home.logoutMessage'),
      confirmLabel: t('home.logoutConfirm'),
      tone: 'warning',
    })) return;
    setLoggingOut(true);
    try {
      await api.post('/auth/logout');
      clearAuthenticated();
      markGuestSession();
      setUser(null);
      navigate('/');
    } catch (error) {
      toast.error(errMsg(error));
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="page home-page">
      <a className="skip-link" href="#main-content">
        {t('common.skipToContent')}
      </a>
      <div className="header-bar">
        <div className="home-brand">
          <span className="home-brand-slashes" aria-hidden="true">//</span>
          <span className="title">{t('common.brand')}</span>
        </div>
        <span className="btns">
          <PersonalSettings />
          <ThemeToggle />
          {!initialized ? (
            <span className="auth-pending" aria-label={t('home.restoring')} />
          ) : user ? (
            <>
              <span className="muted">
                {user.username}
              </span>
              <button
                className="btn btn-ghost btn-sm"
                aria-label={t('home.logout')}
                onClick={() => void logout()}
                disabled={loggingOut}
              >
                <LogOut size={15} />
                <span className="btn-text">{t('home.logout')}</span>
              </button>
            </>
          ) : (
            <>
              <span className="muted">{guestName === '访客' ? t('common.guest') : guestName}</span>
              <Link className="btn btn-sm" to="/login" aria-label={t('home.loginRegister')}>
                <LogIn size={15} />
                <span className="btn-text">{t('home.loginRegister')}</span>
              </Link>
            </>
          )}
        </span>
      </div>
      <main className="page-scroll home-scroll" id="main-content">
        <section className="home-stage" aria-labelledby="home-title">
          <div className="home-stage-copy">
            <span className="home-stage-eyebrow">// {t('common.brand')}</span>
            <h1 id="home-title">{t('common.brand')}</h1>
            <p className="home-stage-subtitle">{t('home.subtitle')}</p>
            <div className="home-stage-actions">
              <Link className="btn btn-lg home-play-btn" to="/single">
                <Gamepad2 size={18} />
                <span>{t('home.singleMode')}</span>
                <ArrowRight className="home-play-arrow" size={16} />
              </Link>
              <GameRules />
            </div>
            {initialized && !user && (
              <p className="home-stage-hint">
                {t('home.guestHint')}
              </p>
            )}
          </div>
          <div className="home-stage-art" aria-hidden="true">
            <img className="home-stage-image" src="/images/sora-nimi-01.png" alt="" />
          </div>
        </section>
        <section className="home-dashboard" aria-label={t('common.home')}>
          <HomeActionCard
            to="/single"
            icon={<Gamepad2 size={22} />}
            label={t('home.singleMode')}
            description={t('home.singleModeDescription')}
            color="#ff9f43"
          />
          <HomeActionCard
            to="/search"
            icon={<Search size={22} />}
            label={t('home.search')}
            description={t('home.searchDescription')}
            color="#7c4dff"
          />
          <div className="home-rail">
            <Link to="/stats" className="home-rail-link">
              <BarChart3 size={16} />
              <span>{t('home.stats')}</span>
            </Link>
            {showLeaderboard && (
              <Link to="/leaderboard" className="home-rail-link">
                <Trophy size={16} />
                <span>{t('home.leaderboard')}</span>
              </Link>
            )}
            <Link to="/announcement" className="home-rail-link">
              <Megaphone size={16} />
              <span>{t('home.announcements')}</span>
            </Link>
          </div>
        </section>
        <footer className="home-footer">
          <a
            href="https://github.com/Pleasure199/galgameSoraNimi"
            className="home-footer-link"
            target="_blank"
            rel="noopener noreferrer"
            data-umami-event="home-github"
          >
            <GitHubIcon />
            {t('home.github')}
          </a>
        </footer>
      </main>
    </div>
  );
}
