import { Gamepad2, Play } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import Page from '../components/Page';
import { SINGLE_MODE } from '../config/difficulties';
import { useTranslation } from 'react-i18next';

export default function SingleLobby() {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const start = () => {
    navigate(`/single/${SINGLE_MODE}`);
  };

  return (
    <Page title={t('singleLobby.title')} icon={<Gamepad2 size={17} />}>
      <p className="muted single-lobby-subtitle">{t('singleLobby.subtitle')}</p>
      <div className="single-lobby-action">
        <button type="button" className="btn btn-lg btn-green" onClick={start}>
          <Play size={17} /> {t('singleLobby.start')}
        </button>
      </div>
    </Page>
  );
}
