import { BrowserRouter, Routes, Route } from 'react-router';
import Layout from '@/components/Layout';
import Home from '@/pages/Home';
import Game from '@/pages/Game';
import Results from '@/pages/Results';
import Armory from '@/pages/Armory';
import Guide from '@/pages/Guide';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/play" element={<Game />} />
          <Route path="/results" element={<Results />} />
          <Route path="/armory" element={<Armory />} />
          <Route path="/guide" element={<Guide />} />
          <Route path="*" element={<Home />} />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}
