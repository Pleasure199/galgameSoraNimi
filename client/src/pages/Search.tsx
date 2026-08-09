import { useState } from 'react';
import { Search as SearchIcon, CircleDot } from 'lucide-react';
import Page from '../components/Page';
import GuessInputBar from '../components/GuessInputBar';
import { CharacterInfoTable } from '../components/AnswerOverlay';
import { api, errMsg } from '../api/client';
import { CharacterInfo } from '../types';
import { toast } from '../components/Toast';
import { useTranslation } from 'react-i18next';

/** 查角色:底部输入 + 自动补全,选中后在上方展示角色卡片(原版布局) */
export default function Search() {
  const { t } = useTranslation();
  const [character, setCharacter] = useState<CharacterInfo | null>(null);

  const lookup = async (name: string) => {
    try {
      const res = await api.get<CharacterInfo[]>('/characters', {
        params: { search: name },
      });
      const exact =
        res.data.find((c) => c.name.toLowerCase() === name.toLowerCase()) ??
        res.data[0] ??
        null;
      setCharacter(exact);
    } catch (err) {
      toast.error(errMsg(err));
    }
  };

  return (
    <Page
      title={t('search.title')}
      icon={<SearchIcon size={17} />}
      dock={
        <GuessInputBar
          onPick={(c) => void lookup(c.name)}
          placeholder={t('search.placeholder')}
          buttonText={t('search.button')}
        />
      }
    >
      <div className="player-search-content">
        {character ? (
          <div className="card">
            <h3>
              <CircleDot size={15} color="#16a34a" />
              {character.name}
              <span className="muted" style={{ fontWeight: 400 }}>
                {character.work}
              </span>
            </h3>
            <CharacterInfoTable
              answer={{
                name: character.name,
                work: character.work,
                company: character.company,
                releaseYear: character.releaseYear,
                gender: character.gender,
                cv: character.cv,
                hairColor: character.hairColor,
                hairLength: character.hairLength,
                height: character.height,
              }}
            />
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-light)' }}>
            <SearchIcon size={32} strokeWidth={1.5} />
            <p>{t('search.empty')}</p>
            <p style={{ fontSize: '0.8rem' }}>{t('search.fuzzy')}</p>
          </div>
        )}
      </div>
    </Page>
  );
}
