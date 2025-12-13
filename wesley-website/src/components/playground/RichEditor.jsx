import React from 'react';
import { useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { RichTextEditor as MantineRichTextEditor, Link } from '@mantine/tiptap';
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight';
import { common, createLowlight } from 'lowlight';
import graphqlLang from 'highlight.js/lib/languages/graphql'; // Import the language definition

const lowlight = createLowlight(common);
lowlight.register('graphql', graphqlLang); // Register directly

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
    ],
    content: value,
    onUpdate: ({ editor }) => {
      onChange(editor.getText()); // Get plain text for our schema
    },
    // Adding placeholder for better UX
    editorProps: {
      attributes: {
        class: 'tiptap-editor-focused', // Apply custom class for editor area
      },
    },
    // Adding placeholder for better UX
    placeholder: 'Write your GraphQL schema here...',
  });

  // Ensure editor content is up-to-date with value prop
  React.useEffect(() => {
    if (editor && editor.getText() !== value) {
      editor.commands.setContent(value, false, { preserveCursor: true });
    }
  }, [value, editor]);

  return (
    <MantineRichTextEditor editor={editor} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <MantineRichTextEditor.Toolbar sticky stickyOffset={0}> {/* Toolbar at the top */}
        <MantineRichTextEditor.ControlsGroup>
          <MantineRichTextEditor.Bold />
          <MantineRichTextEditor.Italic />
          <MantineRichTextEditor.Code />
          <MantineRichTextEditor.CodeBlock />
        </MantineRichTextEditor.ControlsGroup>
      </MantineRichTextEditor.Toolbar>
      <MantineRichTextEditor.Content style={{ flex: 1, overflowY: 'auto' }} />
    </MantineRichTextEditor>
  );
}