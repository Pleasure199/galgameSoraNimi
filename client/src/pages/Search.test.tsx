import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import Search from './Search';
import { renderAtRoute } from '../test/render';
import { api } from '../api/client';

vi.mock('../api/client', () => ({
  api: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../api/characterList', () => ({
  getCharacterList: vi.fn(async () => []),
  subscribeCharacterList: vi.fn(() => () => undefined),
  searchCharacterList: () => [],
}));

const get = vi.mocked(api.get);

describe('Search', () => {
  beforeEach(() => {
    get.mockReset();
  });

  it('shows all characters after clicking the show-all action', async () => {
    get.mockResolvedValueOnce({
      data: [{
        id: 1,
        name: '神尾观铃',
        work: 'AIR',
        company: 'Key',
        releaseYear: 2000,
        gender: '女',
        cv: '川上とも子',
        hairColor: '金色',
        hairLength: '长发',
        height: 159,
      }],
    } as never);

    renderAtRoute(<Search />, { route: '/search', path: '/search' });
    await userEvent.click(screen.getAllByRole('button', { name: '显示全部角色' })[0]);

    expect(await screen.findByText('神尾观铃')).toBeInTheDocument();
    expect(screen.getByText('全部角色（1）')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/characters', {
      params: { search: '', limit: 100000 },
    });
  });
});
