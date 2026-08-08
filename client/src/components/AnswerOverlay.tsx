import { ReactNode, useEffect } from 'react';
import { BookOpen, Landmark, Calendar, UserRound, Mic, Palette } from 'lucide-react';
import ModalPortal from './ModalPortal';
import { useTranslation } from 'react-i18next';

export interface AnswerInfo {
  name: string;
  work: string;
  company: string;
  releaseYear: number;
  gender: string;
  cv: string;
  hairColor: string;
}

/** 角色信息表(答案卡片/查询结果共用) */
export function CharacterInfoTable({ answer }: { answer: AnswerInfo }) {
  const { t } = useTranslation();
  const rows: [ReactNode, string, ReactNode][] = [
    [<BookOpen size={14} key="i" />, t('character.work'), answer.work || '-'],
    [<Landmark size={14} key="i" />, t('character.company'), answer.company || '-'],
    [<Calendar size={14} key="i" />, t('character.releaseYear'), answer.releaseYear || '-'],
    [<UserRound size={14} key="i" />, t('character.gender'), answer.gender || '-'],
    [<Mic size={14} key="i" />, t('character.cv'), answer.cv || '-'],
    [<Palette size={14} key="i" />, t('character.hairColor'), answer.hairColor || '-'],
  ];
  return (
    <table className="character-info-table">
      <tbody>
        {rows.map(([icon, label, value]) => (
          <tr key={label}>
            <td className="label">
              {icon}
              {label}
            </td>
            <td className="value">{value}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

interface Props {
  title: string;
  answer: AnswerInfo | null;
  extra?: ReactNode;
  actions: ReactNode;
  onClose?: () => void;
  /** 胜负配色:win 绿色调头部,lose 中性 */
  tone?: 'win' | 'lose';
}

/** 结算/答案遮罩卡片 */
export default function AnswerOverlay({ title, answer, extra, actions, onClose, tone }: Props) {
  useEffect(() => {
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose?.();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = oldOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [onClose]);

  return (
    <ModalPortal>
      <div
        className="overlay"
        onMouseDown={(event) => {
          if (event.target === event.currentTarget) onClose?.();
        }}
      >
        <div
          className={`overlay-card${tone ? ` overlay-card-${tone}` : ''}`}
          role="dialog"
          aria-modal="true"
        >
          <h2>{title}</h2>
          {extra}
          {answer && (
            <>
              <p className="answer-name">{answer.name}</p>
              <CharacterInfoTable answer={answer} />
            </>
          )}
          <div className="btns">{actions}</div>
        </div>
      </div>
    </ModalPortal>
  );
}
