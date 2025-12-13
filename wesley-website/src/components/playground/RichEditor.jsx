import React from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { RichTextEditor as MantineRichTextEditor, Link } from '@mantine/tiptap';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import graphqlLang from 'highlight.js/lib/languages/graphql'; // Import the language definition
import { Extension } from '@tiptap/react'; // Import Extension from @tiptap/react instead of @tiptap/core

const lowlight = createLowlight(common);
lowlight.register('graphql', graphqlLang); // Register directly

// Custom TabKey Extension
const TabKeyExtension = Extension.create({
  name: 'tabKey',

  addKeyboardShortcuts() {
    return {
      Tab: ({ editor }) => {
        // Prevent default browser behavior of focusing next element
        editor.commands.insertContent('  '); // Insert 2 spaces for tab
        return true; // Mark as handled
      },
    };
  },
});

// Helper to ensure content is treated as a code block
const createCodeDocument = (text) => ({
  type: 'doc',
  content: [
    {
      type: 'codeBlock',
      attrs: { language: 'graphql' },
      content: text ? [{ type: 'text', text }] : []
    }
  ]
});

export default function RichEditor({ value, onChange }) {
  const editor = useEditor({
    extensions: [
      StarterKit,
      Link, // Use Mantine's Link extension for Ctrl+K
      CodeBlockLowlight.configure({
        lowlight,
        // Optional: define default language
        defaultLanguage: 'graphql',
      }),
      TabKeyExtension, // Add our custom tab key extension
    ],
    content: createCodeDocument(value), // Initialize as code block
    onUpdate: ({ editor }) => {
      // Get plain text from the code block
      // We use getText() which extracts text from all nodes. 
      // Since we only have one code block, this works.
      onChange(editor.getText()); 
    },
    // Adding placeholder for better UX
    editorProps: {
      attributes: {
        class: 'tiptap-editor-focused', // Apply custom class for editor area
      },
    },
  });

  // Ensure editor content is up-to-date with value prop
  React.useEffect(() => {
    if (editor && editor.getText() !== value) {
      // Force update into code block structure
      editor.commands.setContent(createCodeDocument(value), false, { preserveCursor: true });
    }
  }, [value, editor]);

  return (
    <MantineRichTextEditor 
      editor={editor} 
      style={{ 
        flex: 1, 
        display: 'flex', 
        flexDirection: 'column',
        border: 'none', // Remove default border to blend with container
      }}
    >
      {/* Removed Toolbar for Code Editor feel */}
      
      <MantineRichTextEditor.Content 
        style={{ 
          flex: 1, 
          overflowY: 'auto',
          fontFamily: 'var(--mantine-font-family-monospace)', // Force monospace
          fontSize: 'var(--mantine-font-size-sm)',
        }} 
      />
      <style>{`
        .ProseMirror {
          min-height: 100%;
          padding: 1rem;
          outline: none;
        }
        /* Target the code block specifically */
        .ProseMirror pre {
          background: transparent;
          padding: 0;
          margin: 0;
          border-radius: 0;
          font-family: inherit;
        }
        .ProseMirror p {
          margin: 0;
        }
      `}</style>
    </MantineRichTextEditor>
  );
}