import { createBrowserRouter } from 'react-router-dom';
import Home from './pages/Home';
import Login from './pages/Login';
import Search from './pages/Search';
import SingleGame from './pages/SingleGame';
import SingleLobby from './pages/SingleLobby';
import Stats from './pages/Stats';
import Leaderboard from './pages/Leaderboard';
import Announcements from './pages/Announcements';
import NotFound from './pages/NotFound';
import RouteError from './components/RouteError';

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    children: [
      { path: '/', element: <Home /> },
      { path: '/login', element: <Login /> },
      { path: '/search', element: <Search /> },
      { path: '/single', element: <SingleLobby /> },
      { path: '/single/:mode', element: <SingleGame /> },
      { path: '/stats', element: <Stats /> },
      { path: '/leaderboard', element: <Leaderboard /> },
      { path: '/announcement', element: <Announcements /> },
      { path: '*', element: <NotFound /> },
    ],
  },
]);
