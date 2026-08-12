import { describe, expect, it, beforeEach } from 'vitest';
import { Route, useLocation } from 'react-router-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SingleLobby from './SingleLobby';
import { renderAtRoute } from '../test/render';

function PathProbe() {
  const location = useLocation();
  return <span data-testid="current-path">{location.pathname}</span>;
}

describe('SingleLobby', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders the three difficulty choices', () => {
    renderAtRoute(<SingleLobby />, { route: '/single', path: '/single' });

    expect(screen.getAllByRole('radio')).toHaveLength(3);
    expect(screen.getByRole('radio', { name: /入门版/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /简单版/ })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /完整版/ })).toBeInTheDocument();
    expect(screen.getByText('开始一局单人猜测，猜出目标角色即获胜。')).toBeInTheDocument();
  });

  it('starts a game with the selected difficulty', async () => {
    const user = userEvent.setup();
    renderAtRoute(
      <SingleLobby />,
      {
        route: '/single',
        path: '/single',
        extraRoutes: (
          <>
            <Route path="/single/:mode" element={<PathProbe />} />
            <Route path="/single" element={<div data-testid="lobby" />} />
          </>
        ),
      }
    );

    await user.click(screen.getByRole('radio', { name: /简单版/ }));
    await user.click(screen.getByRole('button', { name: /开始游戏/ }));

    expect(await screen.findByTestId('current-path')).toHaveTextContent('/single/easy');
    expect(localStorage.getItem('tianyiba.single-difficulty')).toBeNull();
  });

  it('defaults to the beginner difficulty', async () => {
    const user = userEvent.setup();
    renderAtRoute(
      <SingleLobby />,
      {
        route: '/single',
        path: '/single',
        extraRoutes: <Route path="/single/:mode" element={<PathProbe />} />,
      }
    );

    await user.click(screen.getByRole('button', { name: /开始游戏/ }));

    expect(await screen.findByTestId('current-path')).toHaveTextContent('/single/beginner');
  });

  it('start button remains a full-width primary action class', () => {
    renderAtRoute(<SingleLobby />, { route: '/single', path: '/single' });
    const start = screen.getByRole('button', { name: /开始游戏/ });
    expect(start).toHaveClass('btn', 'btn-lg', 'btn-green');
  });

  it('asks for confirmation before starting full mode', async () => {
    const user = userEvent.setup();
    renderAtRoute(
      <SingleLobby />,
      {
        route: '/single',
        path: '/single',
        extraRoutes: <Route path="/single/:mode" element={<PathProbe />} />,
      }
    );

    await user.click(screen.getByRole('radio', { name: /完整版/ }));
    await user.click(screen.getByRole('button', { name: /开始游戏/ }));

    expect(await screen.findByRole('alertdialog')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /继续挑战/ }));

    expect(await screen.findByTestId('current-path')).toHaveTextContent('/single/normal');
  });

  it('stays on the lobby when full mode confirmation is cancelled', async () => {
    const user = userEvent.setup();
    renderAtRoute(
      <SingleLobby />,
      {
        route: '/single',
        path: '/single',
        extraRoutes: <Route path="/single/:mode" element={<PathProbe />} />,
      }
    );

    await user.click(screen.getByRole('radio', { name: /完整版/ }));
    await user.click(screen.getByRole('button', { name: /开始游戏/ }));
    await user.click(await screen.findByRole('button', { name: /取消/ }));

    expect(screen.queryByTestId('current-path')).not.toBeInTheDocument();
  });
});
