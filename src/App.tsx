import { HashRouter, Route, Routes } from 'react-router-dom';
import { Layout } from './ui/components/Layout.tsx';
import { Calendar, RoundDetail } from './ui/screens/Calendar.tsx';
import { DriverDetail, Drivers } from './ui/screens/Drivers.tsx';
import { Home } from './ui/screens/Home.tsx';
import { NotFound } from './ui/screens/NotFound.tsx';
import { Settings } from './ui/screens/Settings.tsx';
import { Standings } from './ui/screens/Standings.tsx';
import { TeamDetail, Teams } from './ui/screens/Teams.tsx';

/**
 * HashRouter: el juego es estático y debe funcionar servido desde cualquier
 * ruta (o instalado como PWA) sin configurar redirecciones en el servidor.
 */
export function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<Home />} />
          <Route path="teams" element={<Teams />} />
          <Route path="teams/:teamId" element={<TeamDetail />} />
          <Route path="drivers" element={<Drivers />} />
          <Route path="drivers/:driverId" element={<DriverDetail />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="calendar/:round" element={<RoundDetail />} />
          <Route path="standings" element={<Standings />} />
          <Route path="settings" element={<Settings />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
