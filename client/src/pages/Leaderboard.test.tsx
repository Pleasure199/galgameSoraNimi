import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderAtRoute } from '../test/render';
import { useAuth } from '../store/auth';
import Leaderboard from './Leaderboard';
import { SINGLE_MODE } from '../config/difficulties';

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
    apiGet.mockResolvedValue({
      data: {
        difficulty: SINGLE_MODE,
        items: [],
        currentUser: { displayId: '用户#ABCDE', rank: 1 },
      },
    });
  });

  it('loads the fixed ranking without a difficulty selector', async () => {
    renderAtRoute(<Leaderboard />);

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/leaderboard', {
      params: { difficulty: SINGLE_MODE },
    }));
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('shows the current-user rank from the fixed board', async () => {
    renderAtRoute(<Leaderboard />);
    const summary = await screen.findByLabelText('我的排名');
    await waitFor(() => expect(summary).toHaveTextContent('#1'));
  });
});
