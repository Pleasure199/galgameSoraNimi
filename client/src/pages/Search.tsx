import { FormEvent, useState } from 'react';
import type { CSSProperties } from 'react';
import { Search as SearchIcon, CircleDot, ChevronLeft, ChevronRight, Library, List } from 'lucide-react';
import Page from '../components/Page';
import GuessInputBar from '../components/GuessInputBar';
import { CharacterInfoTable } from '../components/AnswerOverlay';
import { api, errMsg } from '../api/client';
import { CharacterInfo } from '../types';
import { toast } from '../components/Toast';
import { useTranslation } from 'react-i18next';
import { AVAILABLE_DIFFICULTIES } from '../config/difficulties';
import { difficultyColor, difficultyLabel } from '../utils/difficulty';

/** 查角色:底部输入 + 自动补全,选中后在上方展示角色卡片(原版布局) */
export default function Search() {
  const { t } = useTranslation();
  const [character, setCharacter] = useState<CharacterInfo | null>(null);
  const [allCharacters, setAllCharacters] = useState<CharacterInfo[] | null>(null);
  const [allPage, setAllPage] = useState(1);
  const [selectedDifficulty, setSelectedDifficulty] = useState('normal');
  const [loadingAll, setLoadingAll] = useState(false);
  const [workResults, setWorkResults] = useState<CharacterInfo[] | null>(null);
  const [workQuery, setWorkQuery] = useState('');
  const [workPage, setWorkPage] = useState(1);
  const [workLoading, setWorkLoading] = useState(false);
  const [works, setWorks] = useState<Array<{ name: string; company: string; count: number }>>([]);
  const [workSuggestions, setWorkSuggestions] = useState<Array<{ name: string; company: string; count: number }>>([]);
  const [workOpen, setWorkOpen] = useState(false);
  const [workActive, setWorkActive] = useState(0);
  const [allWorks, setAllWorks] = useState<Array<{ company: string; works: Array<{ name: string; company: string; count: number }> }> | null>(null);
  const [loadingWorks, setLoadingWorks] = useState(false);
  const PAGE_SIZE = 100;

  const lookup = async (name: string) => {
    try {
      setAllCharacters(null);
      setWorkResults(null);
      setAllWorks(null);
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
      setWorkResults(null);
      setAllWorks(null);
      setAllPage(1);
      setCharacter(null);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setLoadingAll(false);
    }
  };

  const loadWorks = async () => {
    if (works.length) return works;
    try {
      const res = await api.get<{ items: Array<{ name: string; company: string; count: number }> }>(
        '/characters/works',
        { params: { limit: 100000 } }
      );
      setWorks(res.data.items);
      handleWorkInput(workQuery);
      return res.data.items;
    } catch (err) {
      toast.error(errMsg(err));
      return [];
    }
  };

  const loadWorkByName = async (query: string) => {
    if (!query.trim()) return;
    setWorkLoading(true);
    try {
      const res = await api.get<CharacterInfo[]>('/characters', {
        params: { work: query, limit: 100000 },
      });
      setWorkResults(res.data);
      setWorkPage(1);
      setCharacter(null);
      setAllCharacters(null);
      setAllWorks(null);
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setWorkLoading(false);
    }
  };

  const loadWork = async (event?: FormEvent) => {
    event?.preventDefault();
    await loadWorkByName(workQuery);
  };

  const selectWork = async (item: { name: string; company: string; count: number }) => {
    setWorkQuery(item.name);
    setWorkOpen(false);
    setAllWorks(null);
    await loadWorkByName(item.name);
  };

  const loadAllWorks = async () => {
    setLoadingWorks(true);
    try {
      const items = await loadWorks();
      const groups = new Map<string, Array<{ name: string; company: string; count: number }>>();
      for (const item of items) {
        const company = item.company || '未知会社';
        if (!groups.has(company)) groups.set(company, []);
        groups.get(company)!.push(item);
      }
      setAllWorks(
        [...groups.entries()]
          .map(([company, workItems]) => ({ company, works: workItems }))
          .sort((a, b) => a.company.localeCompare(b.company, 'zh'))
      );
      setCharacter(null);
      setWorkResults(null);
      setAllCharacters(null);
    } finally {
      setLoadingWorks(false);
    }
  };

  const handleWorkInput = (query: string) => {
    setWorkQuery(query);
    setWorkActive(0);
    const normalized = query.trim().toLocaleLowerCase();
    const list = works.filter((item) =>
      item.name.toLocaleLowerCase().includes(normalized)
    ).slice(0, 8);
    setWorkSuggestions(list);
    setWorkOpen(true);
  };

  const filteredAll = allCharacters?.filter((character) =>
    character.difficulties.includes(selectedDifficulty)
  ) ?? [];
  const difficultyCounts = new Map(
    AVAILABLE_DIFFICULTIES.map((difficulty) => [
      difficulty.key,
      allCharacters?.filter((character) => character.difficulties.includes(difficulty.key)).length ?? 0,
    ])
  );
  const totalPages = allCharacters
    ? Math.max(1, Math.ceil(filteredAll.length / PAGE_SIZE))
    : 0;
  const pageItems = filteredAll.slice((allPage - 1) * PAGE_SIZE, allPage * PAGE_SIZE);
  const workTotalPages = workResults
    ? Math.max(1, Math.ceil(workResults.length / PAGE_SIZE))
    : 0;
  const workPageItems = workResults
    ? workResults.slice((workPage - 1) * PAGE_SIZE, workPage * PAGE_SIZE)
    : [];

  return (
    <Page
      title={t('search.title')}
      icon={<SearchIcon size={17} />}
      actions={
        <>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void loadAllWorks()}
            disabled={loadingWorks}
          >
            <Library size={15} />
            <span className="btn-text">{loadingWorks ? t('search.loading') : t('search.showAllWorks')}</span>
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => void loadAll()}
            disabled={loadingAll}
          >
            <List size={15} />
            <span className="btn-text">{loadingAll ? t('search.loading') : t('search.showAll')}</span>
          </button>
        </>
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
        <form className="admin-search search-work-form" onSubmit={(event) => void loadWork(event)}>
          <SearchIcon size={16} />
          <input
            className="input"
            value={workQuery}
            onChange={(event) => handleWorkInput(event.target.value)}
            onFocus={() => {
              void loadWorks();
              handleWorkInput(workQuery);
            }}
            onBlur={() => setTimeout(() => setWorkOpen(false), 150)}
            onKeyDown={(event) => {
              if (!workSuggestions.length) return;
              if (event.key === 'ArrowDown') {
                event.preventDefault();
                setWorkActive((index) => (index + 1) % workSuggestions.length);
              } else if (event.key === 'ArrowUp') {
                event.preventDefault();
                setWorkActive((index) => (index - 1 + workSuggestions.length) % workSuggestions.length);
              } else if (event.key === 'Enter' && workOpen) {
                event.preventDefault();
                void selectWork(workSuggestions[workActive]);
              } else if (event.key === 'Escape') {
                setWorkOpen(false);
              }
            }}
            placeholder={t('search.workPlaceholder')}
            aria-label={t('search.workPlaceholder')}
            role="combobox"
            aria-expanded={workOpen}
            aria-controls="work-autocomplete"
            aria-activedescendant={workOpen ? `work-opt-${workActive}` : undefined}
          />
          <button type="submit" className="btn" disabled={workLoading}>
            {workLoading ? t('search.loading') : t('search.workButton')}
          </button>
          {workOpen && workSuggestions.length > 0 && (
            <ul className="autocomplete-list work-autocomplete" role="listbox" id="work-autocomplete">
              {workSuggestions.map((item, index) => (
                <li
                  key={item.name}
                  id={`work-opt-${index}`}
                  role="option"
                  aria-selected={index === workActive}
                  className={index === workActive ? 'active' : ''}
                  onMouseDown={(event) => {
                    event.preventDefault();
                    void selectWork(item);
                  }}
                >
                  <span>{item.name}</span>
                  <small>{item.company}</small>
                </li>
              ))}
            </ul>
          )}
        </form>
        {allWorks ? (
          <div className="card search-all-card">
            <h3>{t('search.allWorksTitle', {
              count: allWorks.reduce((total, group) => total + group.works.length, 0),
            })}</h3>
            <div className="works-by-company">
              {allWorks.map((group) => (
                <section key={group.company} className="work-company-group">
                  <h4>
                    {group.company}
                    <span>{group.works.length}</span>
                  </h4>
                  <div className="work-company-list">
                    {group.works.map((item) => (
                      <button
                        key={item.name}
                        type="button"
                        className="work-company-item"
                        onClick={() => void selectWork(item)}
                      >
                        <span>{item.name}</span>
                        <small>{t('search.workCharacterCount', { count: item.count })}</small>
                      </button>
                    ))}
                  </div>
                </section>
              ))}
            </div>
          </div>
        ) : character ? (
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
              }}
            />
          </div>
        ) : workResults ? (
          <div className="card search-all-card">
            <h3>{t('search.workResults', { work: workQuery, count: workResults.length })}</h3>
            <div className="search-all-list">
              {workPageItems.length ? workPageItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="search-all-row"
                  onClick={() => {
                    setCharacter(item);
                    setWorkResults(null);
                  }}
                >
                  <span>{item.name}</span>
                  <span className="muted">{item.work}</span>
                </button>
              )) : (
                <p className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                  {t('search.emptyDifficulty')}
                </p>
              )}
            </div>
            <div className="search-all-pagination">
              <button
                type="button"
                className="btn"
                aria-label={t('common.previousPage')}
                disabled={workPage <= 1}
                onClick={() => setWorkPage((page) => Math.max(1, page - 1))}
              >
                <ChevronLeft size={16} />
              </button>
              <span>{t('search.pageInfo', { current: workPage, total: workTotalPages })}</span>
              <button
                type="button"
                className="btn"
                aria-label={t('common.nextPage')}
                disabled={workPage >= workTotalPages}
                onClick={() => setWorkPage((page) => Math.min(workTotalPages, page + 1))}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          </div>
        ) : allCharacters ? (
          <div className="card search-all-card">
            <h3>{t('search.allResults', { count: filteredAll.length })}</h3>
            <div className="search-difficulty-tabs" role="group" aria-label={t('search.difficultyTitle')}>
              {AVAILABLE_DIFFICULTIES.map((difficulty) => (
                <button
                  key={difficulty.key}
                  type="button"
                  className={`search-difficulty-tab${selectedDifficulty === difficulty.key ? ' active' : ''}`}
                  style={{ '--diff-color': difficultyColor(difficulty.key) } as CSSProperties}
                  onClick={() => {
                    setSelectedDifficulty(difficulty.key);
                    setAllPage(1);
                  }}
                >
                  {difficultyLabel(t, difficulty.key)}
                  <span>{difficultyCounts.get(difficulty.key) ?? 0}</span>
                </button>
              ))}
            </div>
            <div className="search-all-list">
              {pageItems.length ? pageItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className="search-all-row"
                  onClick={() => setCharacter(item)}
                >
                  <span>{item.name}</span>
                  <span className="muted">{item.work}</span>
                </button>
              )) : (
                <p className="muted" style={{ textAlign: 'center', padding: '24px 0' }}>
                  {t('search.emptyDifficulty')}
                </p>
              )}
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
