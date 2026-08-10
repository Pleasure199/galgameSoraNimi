import { useCallback, useEffect, useId, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  BookOpen,
  Calendar,
  Flag,
  Palette,
  Target,
  X,
} from 'lucide-react';
import ModalPortal from './ModalPortal';
import { useTranslation } from 'react-i18next';

const hairColorFamilies = [
  'black',
  'brown',
  'blond',
  'white',
  'red',
  'orange',
  'yellow',
  'green',
  'blue',
  'purple',
  'pink',
  'gray',
  'cyan',
] as const;

export default function GameRules() {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const titleId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);

  const closeRules = useCallback(() => {
    setOpen(false);
    requestAnimationFrame(() => triggerRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeRules();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [closeRules, open]);

  return (
    <>
      <button
        ref={triggerRef}
        className="game-rules-trigger"
        type="button"
        onClick={() => setOpen(true)}
        data-umami-event="home-rules-open"
      >
        <BookOpen size={14} aria-hidden="true" />
        {t('rules.trigger')}
      </button>

      {open && (
        <ModalPortal>
          <div
            className="game-rules-backdrop"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) closeRules();
            }}
          >
            <div
              className="game-rules-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby={titleId}
            >
              <header className="game-rules-dialog-heading">
                <span className="game-rules-heading-icon" aria-hidden="true">
                  <BookOpen size={24} />
                </span>
                <div className="game-rules-heading-copy">
                  <span className="game-rules-kicker">HOW TO PLAY</span>
                  <h2 id={titleId}>{t('rules.title')}</h2>
                  <p>{t('rules.description')}</p>
                </div>
                <strong className="guess-limit"><span>{t('rules.max')}</span> {t('rules.guesses')}</strong>
                <button
                  ref={closeRef}
                  className="confirm-close"
                  type="button"
                  aria-label={t('rules.close')}
                  onClick={closeRules}
                  data-umami-event="home-rules-close"
                >
                  <X size={18} />
                </button>
              </header>

              <div className="game-rules-dialog-body">
                <div className="rule-quick-guide" aria-label={t('rules.feedbackLabel')}>
                  <div className="rule-feedback rule-feedback-correct">
                    <span className="rule-color-swatch" aria-hidden="true" />
                    <div><strong>{t('rules.greenTitle')}</strong><span>{t('rules.greenText')}</span></div>
                  </div>
                  <div className="rule-feedback rule-feedback-close">
                    <span className="rule-color-swatch" aria-hidden="true" />
                    <div><strong>{t('rules.yellowTitle')}</strong><span>{t('rules.yellowText')}</span></div>
                  </div>
                  <div className="rule-feedback rule-feedback-wrong">
                    <span className="rule-color-swatch" aria-hidden="true" />
                    <div><strong>{t('rules.grayTitle')}</strong><span>{t('rules.grayText')}</span></div>
                  </div>
                  <div className="rule-feedback rule-feedback-arrow">
                    <span className="rule-arrow-pair" aria-hidden="true"><ArrowUp size={16} /><ArrowDown size={16} /></span>
                    <div><strong>{t('rules.arrowTitle')}</strong><span>{t('rules.arrowText')}</span></div>
                  </div>
                </div>

                <div className="rule-sections">
                  <article className="rule-panel rule-panel-main">
                    <div className="rule-panel-title">
                      <span aria-hidden="true"><Target size={20} /></span>
                      <div><small>01</small><h3>{t('rules.guessTitle')}</h3></div>
                    </div>
                    <p>{t('rules.guessIntro')}</p>
                    <div className="rule-field-grid">
                      <div>
                        <strong>{t('rules.exactTitle')}</strong>
                        <span>{t('rules.exactText')}</span>
                      </div>
                      <div>
                        <strong>{t('rules.hairColorTitle')}</strong>
                        <span>{t('rules.hairColorText')}</span>
                      </div>
                      <div>
                        <strong>{t('rules.hairLengthTitle')}</strong>
                        <span>{t('rules.hairLengthText')}</span>
                      </div>
                      <div>
                        <strong>{t('rules.releaseYearTitle')}</strong>
                        <span>{t('rules.releaseYearText')}</span>
                      </div>
                      <div>
                        <strong>{t('rules.writerTitle')}</strong>
                        <span>{t('rules.writerText')}</span>
                      </div>
                    </div>
                    <div className="rule-result-notes">
                      <p><span className="rule-result-icon rule-result-win"><Flag size={15} /></span><strong>{t('rules.winLabel')}</strong>{t('rules.winText')}</p>
                      <p><span className="rule-result-icon rule-result-loss">8</span><strong>{t('rules.lossLabel')}</strong>{t('rules.lossText')}</p>
                    </div>
                  </article>

                  <article className="rule-panel rule-panel-hair-colors">
                    <div className="rule-panel-title">
                      <span aria-hidden="true"><Palette size={20} /></span>
                      <div><small>02</small><h3>{t('rules.hairColorsTitle')}</h3></div>
                    </div>
                    <p>{t('rules.hairColorsIntro')}</p>
                    <div className="region-list">
                      {hairColorFamilies.map((family) => (
                        <div className="region-item" key={family}>
                          <strong>{t(`rules.hairColors.${family}.name`)}</strong>
                          <span>{t(`rules.hairColors.${family}.example`)}</span>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className="rule-panel rule-panel-release-year">
                    <div className="rule-panel-title">
                      <span aria-hidden="true"><Calendar size={20} /></span>
                      <div><small>03</small><h3>{t('rules.releaseYearPanelTitle')}</h3></div>
                    </div>
                    <p>{t('rules.releaseYearPanelText')}</p>
                  </article>
                </div>
              </div>
            </div>
          </div>
        </ModalPortal>
      )}
    </>
  );
}
