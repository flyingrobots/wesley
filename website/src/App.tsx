import { MantineProvider } from '@mantine/core';
import { HeaderMegaMenu } from './components/HeaderMegaMenu';

export default function App() {
  return (
    <MantineProvider>
      <div className="app-blank">
        <HeaderMegaMenu />
      </div>
    </MantineProvider>
  );
}
