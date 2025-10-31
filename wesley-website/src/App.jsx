import { useEffect, useState } from 'react'
import { Anchor, Box, Button, Card, Center, Container, Group, Stack, Text, Title } from '@mantine/core'
import ThemeLab from './pages/ThemeLab.jsx'
import FooterLinks from './components/FooterLinks.jsx'
import HeroBullets from './components/HeroBullets.jsx'
import FeaturesTitleWesley from './components/FeaturesTitleWesley.jsx'
import FeaturesCardsWesley from './components/FeaturesCardsWesley.jsx'
import GettingStarted from './components/GettingStarted.jsx'
import FutureSection from './components/FutureSection.jsx'
import Documentation from './pages/Documentation.jsx'
import HeaderSearch from './components/HeaderSearch.jsx'

function usePath() {
  const [path, setPath] = useState(typeof window !== 'undefined' ? window.location.pathname : '/')
  useEffect(() => {
    const onPop = () => setPath(window.location.pathname)
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])
  const navigate = (to) => {
    if (to === path) return
    window.history.pushState({}, '', to)
    setPath(to)
  }
  return { path, navigate }
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
  )
}

function App() {
  const { path, navigate } = usePath()

  return (
    <Box style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <HeaderSearch onNavigate={navigate} />
      <Box style={{ flex: 1, minHeight: 0, overflow: 'auto' }}>
        {path === '/docs' ? (
          <Documentation />
        ) : path === '/theme-lab' ? (
          <ThemeLab />
        ) : (
          <HomeContent onNavigate={navigate} />
        )}
      </Box>
      <FooterLinks />
    </Box>
  )
}

export default App
