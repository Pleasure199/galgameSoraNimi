import { useState } from 'react';
import { Search as SearchIcon, CircleDot, ChevronLeft, ChevronRight, List } from 'lucide-react';
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
  const [allCharacters, setAllCharacters] = useState<CharacterInfo[] | null>(null);
  const [allPage, setAllPage] = useState(1);
  const [loadingAll, setLoadingAll] = useState(false);
  const PAGE_SIZE = 100;

  const lookup = async (name: string) => {
    try {
      setAllCharacters(null);
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

  const loadAll = async () => {
    setLoadingAll(true);
    try {
      const res = await api.get<CharacterInfo[]>('/characters', {
        params: { search: '', limit: 100000 },
      });
      setAllCharacters(res.data);
      setAllPage(1);
      setCharacter(null);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoadingAll(false);
    }
  };

  const totalPages = allCharacters
    ? Math.max(1, Math.ceil(allCharacters.length / PAGE_SIZE))
    : 0;
  const pageItems = allCharacters
    ? allCharacters.slice((allPage - 1) * PAGE_SIZE, allPage * PAGE_SIZE)
    : [];

  return (
    <Page
      title={t('search.title')}
      icon={<SearchIcon size={17} />}
      actions={
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => void loadAll()}
          disabled={loadingAll}
        >
          <List size={15} />
          <span className="btn-text">{loadingAll ? t('search.loading') : t('search.showAll')}</span>
        </button>
      }
      dock={
        <GuessInputBar
          onPick={(c) => void lookup(c.name)}
          placeholder={t('search.placeholder')}
          buttonText={t('search.button')}
        />
      }
    >
      <div className={`player-search-content${allCharacters ? ' search-all-content' : ''}`}>
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
        ) : allCharacters ? (
          <div className="card search-all-card">
            <h3>{t('search.allResults', { count: allCharacters.length })}</h3>
            <div className="search-all-list">
              {pageItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="search-all-row"
                  onClick={() => setCharacter(item)}
                >
                  <span>{item.name}</span>
                  <span className="muted">{item.work}</span>
                </button>
              ))}
            </div>
            <div className="search-all-pagination">
              <button
                type="button"
                className="btn"
                aria-label={t('common.previousPage')}
                disabled={allPage <= 1}
                onClick={() => setAllPage((page) => Math.max(1, page - 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <span>{t('search.pageInfo', { current: allPage, total: totalPages })}</span>
              <button
                type="button"
                className="btn"
                aria-label={t('common.nextPage')}
                disabled={allPage >= totalPages}
                onClick={() => setAllPage((page) => Math.min(totalPages, page + 1))}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-light)' }}>
            <SearchIcon size={32} strokeWidth={1.5} />
            <p>{t('search.empty')}</p>
            <p style={{ fontSize: '0.8rem' }}>{t('search.fuzzy')}</p>
            <button
              type="button"
              className="btn"
              onClick={() => void loadAll()}
              disabled={loadingAll}
            >
              <List size={15} />
              {loadingAll ? t('search.loading') : t('search.showAll')}
            </button>
          </div>
        )}
      </div>
    </Page>
  );
}
