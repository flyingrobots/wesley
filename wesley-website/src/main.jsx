import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { MantineProvider } from '@mantine/core'
import { CodeHighlightAdapterProvider, createHighlightJsAdapter } from '@mantine/code-highlight';
import { Notifications } from '@mantine/notifications';
import { ModalsProvider } from '@mantine/modals';
import hljs from 'highlight.js/lib/core';
import sql from 'highlight.js/lib/languages/sql';
import graphql from 'highlight.js/lib/languages/graphql';
import json from 'highlight.js/lib/languages/json';
import '@mantine/core/styles.css'
import '@mantine/code-highlight/styles.css';
import '@mantine/notifications/styles.css';
import './index.css'
import App from './App.jsx'

hljs.registerLanguage('sql', sql);
hljs.registerLanguage('graphql', graphql);
hljs.registerLanguage('json', json);

const highlightJsAdapter = createHighlightJsAdapter(hljs);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <MantineProvider defaultColorScheme="light">
      <Notifications position="top-right" />
      <ModalsProvider>
        <CodeHighlightAdapterProvider adapter={highlightJsAdapter}>
          <App />
        </CodeHighlightAdapterProvider>
      </ModalsProvider>
    </MantineProvider>
  </StrictMode>,
)
