import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderAtRoute } from '../test/render';
import { useAuth } from '../store/auth';
import Leaderboard from './Leaderboard';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('../api/client', () => ({
  api: { get: apiGet },
  errMsg: () => 'request failed',
}));

describe('Leaderboard', () => {
  beforeEach(() => {
    useAuth.setState({
      user: { id: 7, username: 'leaderboard-user', role: 'user' },
      initialized: true,
    });
    apiGet.mockReset();
    apiGet.mockImplementation((_url: string, config?: { params?: { difficulty?: string } }) =>
      Promise.resolve({
        data: {
          difficulty: config?.params?.difficulty ?? 'beginner',
          items: [],
          currentUser: { displayId: '用户#ABCDE', rank: 1 },
        },
      })
    );
  });

  it('renders a five-option difficulty select and requests the beginner board by default', async () => {
    renderAtRoute(<Leaderboard />);

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/leaderboard', {
      params: { difficulty: 'beginner' },
    }));
    const select = screen.getByRole('combobox', { name: '难度' });
    expect(select).toHaveValue('beginner');
    for (const label of ['入门版', '简单版', '普通版', '困难版', '完整版']) {
      expect(screen.getByRole('option', { name: label })).toBeInTheDocument();
    }
  });

  it('switches boards when another difficulty is selected', async () => {
    const user = userEvent.setup();
    renderAtRoute(<Leaderboard />);

    await user.selectOptions(screen.getByRole('combobox', { name: '难度' }), 'beginner');

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/leaderboard', {
      params: { difficulty: 'beginner' },
    }));
    expect(screen.getByRole('combobox', { name: '难度' })).toHaveValue('beginner');
  });

  it('shows the current-user rank from the selected board', async () => {
    renderAtRoute(<Leaderboard />);
    const summary = await screen.findByLabelText('我的排名');
    await waitFor(() => expect(summary).toHaveTextContent('#1'));
  });
});
