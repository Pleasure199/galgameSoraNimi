import { describe, expect, it, beforeEach } from 'vitest';
import { Route, useLocation } from 'react-router-dom';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import SingleLobby from './SingleLobby';
import { renderAtRoute } from '../test/render';
import { SINGLE_MODE } from '../config/difficulties';

function PathProbe() {
  const location = useLocation();
  return <span data-testid="current-path">{location.pathname}</span>;
}

describe('SingleLobby', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('renders a single start action without difficulty cards', () => {
    renderAtRoute(<SingleLobby />, { route: '/single', path: '/single' });

    expect(screen.queryByRole('button', { name: /入门版|简单版|完整版/ })).toBeNull();
    expect(screen.getByText('开始一局单人猜测，猜出目标角色即获胜。')).toBeInTheDocument();
  });

  it('starts a game in the fixed mode', async () => {
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

    await user.click(screen.getByRole('button', { name: /开始游戏/ }));

    expect(await screen.findByTestId('current-path')).toHaveTextContent(`/single/${SINGLE_MODE}`);
    expect(localStorage.getItem('tianyiba.single-difficulty')).toBeNull();
  });

  it('start button remains a full-width primary action class', () => {
    renderAtRoute(<SingleLobby />, { route: '/single', path: '/single' });
    const start = screen.getByRole('button', { name: /开始游戏/ });
    expect(start).toHaveClass('btn', 'btn-lg', 'btn-green');
  });
});
