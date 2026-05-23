import { useEffect, useState } from 'react';
import { Box } from '@mantine/core';
import ThemeLab from './pages/ThemeLab.jsx';
import TryNow from './pages/TryNow.jsx';
import FooterLinks from './components/FooterLinks.jsx';
import HeroBullets from './components/HeroBullets.jsx';
import FeaturesTitleWesley from './components/FeaturesTitleWesley.jsx';
import FeaturesCardsWesley from './components/FeaturesCardsWesley.jsx';
import GettingStarted from './components/GettingStarted.jsx';
import FutureSection from './components/FutureSection.jsx';
import Documentation from './pages/Documentation.jsx';
import { HeaderTabs } from './components/HeaderTabs.jsx';

function usePath() {
  const [path, setPath] = useState(typeof window !== 'undefined' ? window.location.pathname : '/');
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname);
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const navigate = (to) => {
    if (to === path) return;
    window.history.pushState({}, '', to);
    setPath(to);
  };
  return { path, navigate };
}

// Note: We avoid adding a router dependency; navigation is handled in App.

// Right rail removed; replaced with left sidebar nav

function HomeContent({ onNavigate }) {
  return (
    <Box>
      <HeroBullets onNavigate={onNavigate} />
      <FeaturesTitleWesley />
      <FeaturesCardsWesley />
      <GettingStarted />
      <FutureSection />
    </Box>
  );
}

function App() {
  const { path, navigate } = usePath();

  return (
    <Box style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <HeaderTabs onNavigate={navigate} />
      <Box style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {path === '/docs' ? (
          <Documentation />
        ) : path === '/theme-lab' ? (
          <ThemeLab />
        ) : path === '/try' ? (
          <TryNow />
        ) : (
          <HomeContent onNavigate={navigate} />
        )}
      </Box>
      <FooterLinks />
    </Box>
  );
}

export default App;
