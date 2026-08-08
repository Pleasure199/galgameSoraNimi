import { screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { renderAtRoute } from '../test/render';
import Stats from './Stats';

const apiGet = vi.hoisted(() => vi.fn());

vi.mock('../api/client', () => ({
  api: { get: apiGet },
  errMsg: () => 'request failed',
}));

describe('Stats overview', () => {
  beforeEach(() => {
    apiGet.mockReset();
    apiGet.mockImplementation((url: string) => {
      if (url === '/stats/me') {
        return Promise.resolve({
          data: {
            difficulties: ['beginner', 'easy', 'normal'],
            personal: {
              totalGames: 6,
              wins: 1,
              winRate: 1 / 6,
              avgGuesses: 2,
              bestGuesses: 1,
              firstGuess: null,
            },
            global: {
              totalGames: 60,
              wins: 10,
              winRate: 1 / 6,
              avgGuesses: 3,
              bestGuesses: 1,
              firstGuess: null,
              registeredUsers: 12,
            },
          },
        });
      }
      if (url === '/stats/replays') {
        return Promise.resolve({
          data: { type: 'single', page: 1, pageSize: 15, hasNext: false, items: [] },
        });
      }
      return Promise.reject(new Error(`unexpected request: ${url}`));
    });
  });

  it('loads the aggregated summary without a difficulty filter', async () => {
    renderAtRoute(<Stats />);

    await waitFor(() => expect(apiGet).toHaveBeenCalledWith('/stats/me'));
    expect(screen.getByRole('heading', { name: '个人统计', level: 3 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: '全站统计', level: 3 })).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
    expect(screen.getByText('60')).toBeInTheDocument();
    expect(screen.queryByRole('group', { name: '统计难度' })).toBeNull();
  });

  it('shows personal and global winning average guesses', async () => {
    renderAtRoute(<Stats />);

    await waitFor(() => expect(screen.getByRole('heading', { name: '个人统计', level: 3 })).toBeInTheDocument());
    const personalCard = screen.getByRole('heading', { name: '个人统计', level: 3 }).closest('.card') as HTMLElement;
    const globalCard = screen.getByRole('heading', { name: '全站统计', level: 3 }).closest('.card') as HTMLElement;
    expect(personalCard).toHaveTextContent('2.00');
    expect(globalCard).toHaveTextContent('3.00');
  });
});
