import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, fireEvent, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import GuessInputBar from './GuessInputBar';
import { renderWithProviders } from '../test/render';
import { getCharacterList } from '../api/characterList';

const characters = [
  { id: 1, name: 's1mple', difficulties: ['easy', 'normal'] },
  { id: 2, name: 'ZywOo', difficulties: ['normal'] },
];
let characterListListener: ((list: typeof characters) => void) | null = null;

vi.mock('../api/characterList', () => ({
  getCharacterList: vi.fn(async () => characters),
  subscribeCharacterList: vi.fn((listener: (list: typeof characters) => void) => {
    characterListListener = listener;
    return () => {
      if (characterListListener === listener) characterListListener = null;
    };
  }),
  searchCharacterList: (list: typeof characters, query: string) =>
    list.filter((item) => item.name.toLowerCase().includes(query.trim().toLowerCase())),
}));

describe('GuessInputBar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    characterListListener = null;
  });

  it('shows submitting on the button only, never a secondary status line', async () => {
    const user = userEvent.setup();
    let resolvePick: ((value: void) => void) | undefined;
    const onPick = vi.fn(() => new Promise<void>((resolve) => {
      resolvePick = resolve;
    }));

    renderWithProviders(<GuessInputBar onPick={onPick} />);

    await user.type(screen.getByPlaceholderText('输入角色名...'), 's1');
    await screen.findByText('s1mple');
    await user.click(screen.getByRole('button', { name: '提交猜测' }));

    expect(await screen.findByRole('button', { name: '提交中...' })).toBeDisabled();
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
    expect(screen.queryByText('正在提交...')).not.toBeInTheDocument();

    resolvePick?.();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '提交猜测' })).toBeInTheDocument();
    });
  });

  it('keeps input text when onPick rejects the guess (network/busy guard)', async () => {
    const user = userEvent.setup();
    const onPick = vi.fn(async () => false);
    renderWithProviders(<GuessInputBar onPick={onPick} />);

    const input = screen.getByPlaceholderText('输入角色名...');
    await user.type(input, 's1');
    await screen.findByText('s1mple');
    await user.click(screen.getByRole('button', { name: '提交猜测' }));

    await waitFor(() => expect(onPick).toHaveBeenCalled());
    expect(input).toHaveValue('s1');
  });

  it('disables input while parent marks the dock busy (desktop and mobile)', () => {
    renderWithProviders(<GuessInputBar onPick={vi.fn()} disabled />);
    expect(screen.getByPlaceholderText('输入角色名...')).toBeDisabled();
    expect(screen.getByRole('button', { name: '提交猜测' })).toBeDisabled();
  });

  it('renders external status only when explicitly provided (e.g. game feedback)', () => {
    renderWithProviders(<GuessInputBar onPick={vi.fn()} statusText="冷却 2s" />);
    expect(screen.getByRole('status')).toHaveTextContent('冷却 2s');
  });

  it('keeps the current query open while a background character-list update arrives', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GuessInputBar onPick={vi.fn()} />);

    const input = screen.getByPlaceholderText('输入角色名...');
    await user.type(input, 's1');
    await screen.findByText('s1mple');

    act(() => {
      characterListListener?.([
        ...characters,
        { id: 3, name: 's1ren', difficulties: ['easy', 'normal'] },
      ]);
    });

    expect(input).toHaveValue('s1');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByText('s1mple')).toBeInTheDocument();
    expect(screen.getByText('s1ren')).toBeInTheDocument();
  });

  it('filters the in-memory list in the same input event without debounce', () => {
    renderWithProviders(<GuessInputBar onPick={vi.fn()} />);
    act(() => characterListListener?.(characters));

    const input = screen.getByPlaceholderText('输入角色名...');
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 's1' } });

    expect(input).toHaveValue('s1');
    expect(screen.getByText('s1mple')).toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'true');
  });

  it('only suggests characters inside the selected difficulty', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GuessInputBar onPick={vi.fn()} difficulty="easy" />);

    const input = screen.getByPlaceholderText('输入角色名...');
    await user.type(input, 's1');
    expect(screen.getByText('s1mple')).toBeInTheDocument();

    await user.clear(input);
    await user.type(input, 'Zy');
    expect(screen.queryByText('ZywOo')).not.toBeInTheDocument();
  });

  it('does not revalidate the character list on every input change', async () => {
    renderWithProviders(<GuessInputBar onPick={vi.fn()} />);
    await waitFor(() => expect(getCharacterList).toHaveBeenCalled());
    const input = screen.getByPlaceholderText('输入角色名...');
    fireEvent.focus(input);
    const callsAfterFocus = vi.mocked(getCharacterList).mock.calls.length;

    fireEvent.change(input, { target: { value: 's' } });
    fireEvent.change(input, { target: { value: 's1' } });

    expect(getCharacterList).toHaveBeenCalledTimes(callsAfterFocus);
  });

  it('cycles completion with Tab and reverses with Shift+Tab', async () => {
    const user = userEvent.setup();
    renderWithProviders(<GuessInputBar onPick={vi.fn()} />);

    const input = screen.getByPlaceholderText('输入角色名...');
    await user.type(input, 's1');
    act(() => {
      characterListListener?.([
        { id: 1, name: 's1mple', difficulties: ['easy', 'normal'] },
        { id: 3, name: 's1ren', difficulties: ['easy', 'normal'] },
      ]);
    });

    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input).toHaveValue('s1mple');
    expect(input).toHaveAttribute('aria-expanded', 'true');

    fireEvent.keyDown(input, { key: 'Tab' });
    expect(input).toHaveValue('s1ren');

    fireEvent.keyDown(input, { key: 'Tab', shiftKey: true });
    expect(input).toHaveValue('s1mple');
  });
});
