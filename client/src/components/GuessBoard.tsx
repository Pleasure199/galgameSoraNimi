import { ArrowUp, ArrowDown } from 'lucide-react';
import { memo } from 'react';
import { AttributeFeedback, GuessFeedback } from '../types';
import { useTranslation } from 'react-i18next';

function Cell({ attr, label }: { attr: AttributeFeedback; label: string }) {
  const { t } = useTranslation();
  const text = String(attr.value);
  return (
    <td className={attr.level} data-label={label}>
      {text}
      {attr.hint && attr.level !== 'correct' && (
        <span className="dir">
          {attr.hint === 'higher' ? <ArrowUp size={13} /> : <ArrowDown size={13} />}
        </span>
      )}
    </td>
  );
}

/** 猜测反馈表:原版 game-table 布局,每行一次猜测的逐属性对比 */
function GuessBoard({ guesses }: { guesses: GuessFeedback[] }) {
  const { t } = useTranslation();
  const columns = [
    t('guess.columns.name'),
    t('guess.columns.work'),
    t('guess.columns.company'),
    t('guess.columns.releaseYear'),
    t('guess.columns.gender'),
    t('guess.columns.cv'),
    t('guess.columns.hairColor'),
    t('guess.columns.hairLength'),
    t('guess.columns.writer'),
  ];
  return (
    <div className="game-table-wrap">
      <table className="game-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {guesses.map((g, i) => (
            <tr
              key={`${g.characterId}-${i}`}
              className={`${i === guesses.length - 1 ? 'row-latest' : ''} ${g.correct ? 'row-correct' : ''}`}
            >
              <td
                className={`name ${g.correct ? 'correct' : ''}`}
                data-label={columns[0]}
              >
                {g.name}
              </td>
              <Cell attr={g.attributes.work} label={columns[1]} />
              <Cell attr={g.attributes.company} label={columns[2]} />
              <Cell attr={g.attributes.releaseYear} label={columns[3]} />
              <Cell attr={g.attributes.gender} label={columns[4]} />
              <Cell attr={g.attributes.cv} label={columns[5]} />
              <Cell attr={g.attributes.hairColor} label={columns[6]} />
              <Cell attr={g.attributes.hairLength} label={columns[7]} />
              <Cell attr={g.attributes.writer} label={columns[8]} />
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default memo(GuessBoard);
