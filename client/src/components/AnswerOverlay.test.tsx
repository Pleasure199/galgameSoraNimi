import { describe, expect, it, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import AnswerOverlay from './AnswerOverlay';
import { renderWithProviders } from '../test/render';

const answer = {
  name: '牧瀬紅莉栖',
  work: 'STEINS;GATE',
  company: 'MAGES.',
  releaseYear: 2009,
  gender: '女',
  cv: '今井麻美',
  hairColor: '红色',
  hairLength: '长发',
};

describe('AnswerOverlay', () => {
  it('exposes dialog semantics used by keyboard focus guards', () => {
    renderWithProviders(
      <AnswerOverlay title="结算" answer={answer} actions={<button type="button">查看</button>} />
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('牧瀬紅莉栖')).toBeInTheDocument();
  });

  it('supports desktop Escape and mobile backdrop dismiss when onClose is provided', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    const { container } = renderWithProviders(
      <AnswerOverlay
        title="结算"
        answer={answer}
        onClose={onClose}
        actions={<button type="button">查看</button>}
      />
    );

    await user.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalledTimes(1);

    const overlay = container.ownerDocument.querySelector('.overlay');
    expect(overlay).toBeTruthy();
    fireEvent.mouseDown(overlay!);
    expect(onClose).toHaveBeenCalledTimes(2);

    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('does not close when onClose is omitted (game-over flow)', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <AnswerOverlay title="整场结算" answer={answer} actions={<button type="button">再来</button>} />
    );
    await user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
