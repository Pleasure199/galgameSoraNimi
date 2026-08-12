import { useState } from 'react';
import type { CSSProperties } from 'react';
import { Check, Gamepad2, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Page from '../components/Page';
import { useConfirm } from '../components/ConfirmDialog';
import { AVAILABLE_DIFFICULTIES } from '../config/difficulties';
import {
  difficultyColor,
  difficultyDescription,
  difficultyIcon,
  difficultyLabel,
} from '../utils/difficulty';
import { useTranslation } from 'react-i18next';

export default function SingleLobby() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const [selected, setSelected] = useState(AVAILABLE_DIFFICULTIES[0]?.key ?? 'beginner');

  const start = async () => {
    if (selected === 'normal') {
      const confirmed = await confirm({
        title: t('singleLobby.normalConfirmTitle'),
        message: t('singleLobby.normalConfirmMessage'),
        confirmLabel: t('singleLobby.normalConfirmStart'),
        tone: 'warning',
      });
      if (!confirmed) return;
    }
    navigate(`/single/${selected}`);
  };

  return (
    <Page title={t('singleLobby.title')} icon={<Gamepad2 size={17} />}>
      <p className="muted single-lobby-subtitle">{t('singleLobby.subtitle')}</p>
      <div
        className="single-difficulty-grid"
        role="radiogroup"
        aria-label={t('singleLobby.difficultyTitle')}
      >
        {AVAILABLE_DIFFICULTIES.map((difficulty) => {
          const Icon = difficultyIcon(difficulty.key);
          const active = selected === difficulty.key;
          return (
            <button
              key={difficulty.key}
              type="button"
              className={`single-difficulty-option${active ? ' active' : ''}`}
              style={{ '--diff-color': difficultyColor(difficulty.key) } as CSSProperties}
              role="radio"
              aria-checked={active}
              onClick={() => setSelected(difficulty.key)}
            >
              <span className="single-difficulty-icon"><Icon size={20} /></span>
              <span className="single-difficulty-copy">
                <strong>{difficultyLabel(t, difficulty.key)}</strong>
                <small>{difficultyDescription(t, difficulty.key)}</small>
              </span>
              <span className="single-difficulty-check" aria-hidden="true">
                {active ? <Check size={14} /> : null}
              </span>
              {difficulty.recommended && (
                <span className="single-difficulty-badge">{t('singleLobby.recommended')}</span>
              )}
            </button>
          );
        })}
      </div>
      <div className="single-lobby-action">
        <button type="button" className="btn btn-lg btn-green" onClick={() => void start()}>
          <Play size={17} /> {t('singleLobby.start')}
        </button>
      </div>
    </Page>
  );
}
