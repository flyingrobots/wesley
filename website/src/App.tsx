import { MantineProvider } from '@mantine/core';
import { NavbarSegmented } from './components/NavbarSegmented';

export default function App() {
  return (
    <MantineProvider>
      <div className="app-blank">
        <NavbarSegmented />
      </div>
    </MantineProvider>
  );
}
