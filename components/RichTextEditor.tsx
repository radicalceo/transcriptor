'use client'

import { useRef, useEffect } from 'react'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
}

export default function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isUpdatingRef = useRef(false)

  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      editorRef.current.innerHTML = value
    }
  }, [value])

  const handleInput = () => {
    if (editorRef.current) {
      isUpdatingRef.current = true
      onChange(editorRef.current.innerHTML)
      setTimeout(() => {
        isUpdatingRef.current = false
      }, 0)
    }
  }

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    handleInput()
  }

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
      {/* Toolbar */}
      <div className="bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600 p-2 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => execCommand('bold')}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm font-semibold text-gray-700 dark:text-gray-200"
          title="Gras"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => execCommand('italic')}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm italic text-gray-700 dark:text-gray-200"
          title="Italique"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => execCommand('underline')}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm underline text-gray-700 dark:text-gray-200"
          title="Souligné"
        >
          U
        </button>

        <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>

        <button
          type="button"
          onClick={() => execCommand('formatBlock', '<h1>')}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm font-bold text-gray-700 dark:text-gray-200"
          title="Titre 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => execCommand('formatBlock', '<h2>')}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm font-semibold text-gray-700 dark:text-gray-200"
          title="Titre 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => execCommand('formatBlock', '<h3>')}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm font-medium text-gray-700 dark:text-gray-200"
          title="Titre 3"
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => execCommand('formatBlock', '<p>')}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm text-gray-700 dark:text-gray-200"
          title="Paragraphe"
        >
          P
        </button>

        <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>

        <button
          type="button"
          onClick={() => execCommand('insertUnorderedList')}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm text-gray-700 dark:text-gray-200"
          title="Liste à puces"
        >
          • Liste
        </button>
        <button
          type="button"
          onClick={() => execCommand('insertOrderedList')}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm text-gray-700 dark:text-gray-200"
          title="Liste numérotée"
        >
          1. Liste
        </button>

        <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>

        <button
          type="button"
          onClick={() => execCommand('removeFormat')}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm text-gray-700 dark:text-gray-200"
          title="Supprimer le formatage"
        >
          ✕ Format
        </button>
      </div>

      {/* Editor */}
      <div
        ref={editorRef}
        contentEditable
        onInput={handleInput}
        className="prose prose-lg dark:prose-invert max-w-none p-6 bg-white dark:bg-gray-800 min-h-[600px] focus:outline-none text-gray-900 dark:text-white [&>h1]:text-3xl [&>h1]:font-bold [&>h1]:mb-4 [&>h1]:mt-6 [&>h2]:text-2xl [&>h2]:font-bold [&>h2]:mb-3 [&>h2]:mt-5 [&>h3]:text-xl [&>h3]:font-semibold [&>h3]:mb-2 [&>h3]:mt-4 [&>p]:mb-3 [&>ul]:mb-3 [&>ul]:ml-6 [&>ul]:list-disc [&>ol]:mb-3 [&>ol]:ml-6 [&>ol]:list-decimal [&>li]:mb-1"
        suppressContentEditableWarning
      />
    </div>
  )
}
