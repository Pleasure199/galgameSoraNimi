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
        difficulties: ['normal'],
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

  it('filters all characters by the selected difficulty', async () => {
    get.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          name: '神尾观铃',
          work: 'AIR',
          company: 'Key',
          releaseYear: 2000,
          gender: '女',
          cv: '川上とも子',
          hairColor: '金色',
          hairLength: '长发',
          difficulties: ['normal', 'easy', 'beginner'],
        },
        {
          id: 2,
          name: '雾岛佳乃',
          work: 'AIR',
          company: 'Key',
          releaseYear: 2000,
          gender: '女',
          cv: '岡本麻弥',
          hairColor: '蓝色',
          hairLength: '短发',
          difficulties: ['normal', 'easy'],
        },
      ],
    } as never);

    renderAtRoute(<Search />, { route: '/search', path: '/search' });
    await userEvent.click(screen.getAllByRole('button', { name: '显示全部角色' })[0]);
    await screen.findByText('雾岛佳乃');

    await userEvent.click(screen.getByRole('button', { name: /入门版/ }));

    expect(screen.getByText('神尾观铃')).toBeInTheDocument();
    expect(screen.queryByText('雾岛佳乃')).not.toBeInTheDocument();
    expect(screen.getByText('全部角色（1）')).toBeInTheDocument();
  });

  it('searches all characters under a work', async () => {
    get.mockResolvedValueOnce({
      data: { items: [{ name: 'AIR', company: 'Key', count: 2 }] },
    } as never);
    get.mockResolvedValueOnce({
      data: [
        {
          id: 1,
          name: '神尾观铃',
          work: 'AIR',
          company: 'Key',
          releaseYear: 2000,
          gender: '女',
          cv: '川上とも子',
          hairColor: '金色',
          hairLength: '长发',
          difficulties: ['normal', 'easy', 'beginner'],
        },
        {
          id: 2,
          name: '雾岛佳乃',
          work: 'AIR',
          company: 'Key',
          releaseYear: 2000,
          gender: '女',
          cv: '岡本麻弥',
          hairColor: '蓝色',
          hairLength: '短发',
          difficulties: ['normal', 'easy'],
        },
      ],
    } as never);

    renderAtRoute(<Search />, { route: '/search', path: '/search' });
    await userEvent.type(
      screen.getByPlaceholderText('输入作品名搜索全部角色'),
      'AIR'
    );
    await userEvent.click(screen.getByRole('button', { name: '按作品搜索' }));

    expect(await screen.findByText('作品“AIR”的角色（2）')).toBeInTheDocument();
    expect(screen.getByText('神尾观铃')).toBeInTheDocument();
    expect(screen.getByText('雾岛佳乃')).toBeInTheDocument();
    expect(get).toHaveBeenCalledWith('/characters', {
      params: { work: 'AIR', limit: 100000 },
    });
  });

  it('shows work autocomplete suggestions', async () => {
    get.mockResolvedValueOnce({
      data: {
        items: [
          { name: 'AIR', company: 'Key', count: 2 },
          { name: 'Kanon', company: 'Key', count: 3 },
        ],
      },
    } as never);

    renderAtRoute(<Search />, { route: '/search', path: '/search' });
    await userEvent.type(
      screen.getByPlaceholderText('输入作品名搜索全部角色'),
      'AI'
    );

    expect(await screen.findByRole('option', { name: /AIR/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /Kanon/ })).not.toBeInTheDocument();
  });

  it('shows all works grouped by company', async () => {
    get.mockResolvedValueOnce({
      data: {
        items: [
          { name: 'AIR', company: 'Key', count: 2 },
          { name: 'Kanon', company: 'Key', count: 3 },
          { name: '传颂之物', company: 'Leaf', count: 5 },
        ],
      },
    } as never);

    renderAtRoute(<Search />, { route: '/search', path: '/search' });
    await userEvent.click(screen.getByRole('button', { name: '显示全部作品' }));

    expect(await screen.findByText('全部作品（3）')).toBeInTheDocument();
    expect(screen.getByText('Key')).toBeInTheDocument();
    expect(screen.getByText('Leaf')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /AIR/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /传颂之物/ })).toBeInTheDocument();
  });
});
