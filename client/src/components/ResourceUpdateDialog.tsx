import { useEffect, useId, useRef, useState } from 'react';
import { RefreshCw, X } from 'lucide-react';
import { RESOURCE_VERSION } from '../resourceVersion';
import type { ResourceVersionNotice } from '../resourceVersion';
import ModalPortal from './ModalPortal';
import { useTranslation } from 'react-i18next';

const DISMISSED_NOTICE_KEY = 'dismissed-resource-version-notice';
const VERSION_PATTERN = /^\d{13}$/;
const POLL_INTERVAL_MS = 30_000;

function noticeToken(notice: ResourceVersionNotice): string {
  return `${notice.version}:${notice.broadcastAt}`;
}

function isResourceVersionNotice(value: unknown): value is ResourceVersionNotice {
  if (!value || typeof value !== 'object') return false;
  const notice = value as Partial<ResourceVersionNotice>;
  return typeof notice.version === 'string'
    && VERSION_PATTERN.test(notice.version)
    && Number.isSafeInteger(notice.broadcastAt)
    && Number(notice.broadcastAt) > 0;
}

function dismissNotice(
  notice: ResourceVersionNotice,
  setNotice: (notice: ResourceVersionNotice | null) => void
): void {
  try {
    sessionStorage.setItem(DISMISSED_NOTICE_KEY, noticeToken(notice));
  } catch {
    // Closing the dialog must still work when browser storage is unavailable.
  }
  setNotice(null);
}

export default function ResourceUpdateDialog() {
  const { t } = useTranslation();
  const [notice, setNotice] = useState<ResourceVersionNotice | null>(null);
  const refreshButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();
  const messageId = useId();

  useEffect(() => {
    let disposed = false;
    let timer: number | undefined;
    // socket.io 已移除:资源版本通过 /api/health 轮询获取
    const check = async () => {
      try {
        const response = await fetch('/api/health', { credentials: 'include' });
        if (!response.ok) return;
        const data = await response.json() as { resourceVersion?: unknown };
        const value = data.resourceVersion;
        if (disposed || !isResourceVersionNotice(value)) return;
        if (Number(value.version) <= Number(RESOURCE_VERSION)) return;
        try {
          if (sessionStorage.getItem(DISMISSED_NOTICE_KEY) === noticeToken(value)) return;
        } catch {
          // Storage may be disabled; the notice should still be shown for this connection.
        }
        setNotice(value);
      } catch {
        // Transient polling failures are ignored; the next interval retries.
      }
    };
    void check();
    timer = window.setInterval(check, POLL_INTERVAL_MS);
    return () => {
      disposed = true;
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [t]);

  useEffect(() => {
    if (!notice) return;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    refreshButtonRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismissNotice(notice, setNotice);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [notice]);

  if (!notice) return null;

  const dismiss = () => dismissNotice(notice, setNotice);

  return (
    <ModalPortal>
      <div className="confirm-backdrop">
        <div
          className="confirm-dialog warning"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          aria-describedby={messageId}
        >
          <div className="confirm-icon" aria-hidden="true">
            <RefreshCw size={22} />
          </div>
          <div className="confirm-content">
            <div className="confirm-heading">
              <h2 id={titleId}>{t('resourceUpdate.title')}</h2>
              <button className="confirm-close" type="button" aria-label={t('resourceUpdate.laterAria')} onClick={dismiss}>
                <X size={18} />
              </button>
            </div>
            <p id={messageId}>{t('resourceUpdate.message')}</p>
            <div className="confirm-actions">
              <button className="btn btn-ghost" type="button" onClick={dismiss}>{t('resourceUpdate.later')}</button>
              <button
                ref={refreshButtonRef}
                className="btn btn-warning"
                type="button"
                onClick={() => window.location.reload()}
              >
                <RefreshCw size={16} />
                {t('resourceUpdate.refresh')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </ModalPortal>
  );
}
