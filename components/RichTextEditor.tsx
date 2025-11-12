'use client'

import { useRef, useEffect } from 'react'
import Quill from 'quill'
import 'quill/dist/quill.snow.css'

interface RichTextEditorProps {
  value: string
  onChange: (html: string) => void
}

export default function RichTextEditor({ value, onChange }: RichTextEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const quillRef = useRef<Quill | null>(null)
  const isUpdatingRef = useRef(false)

  // Initialize Quill
  useEffect(() => {
    if (!containerRef.current) return
    if (quillRef.current) return // Already initialized

    const container = containerRef.current
    const editorDiv = document.createElement('div')
    container.appendChild(editorDiv)

    const quill = new Quill(editorDiv, {
      theme: 'snow',
      modules: {
        toolbar: '#custom-toolbar', // Use custom toolbar
      },
      placeholder: 'Prenez des notes pendant la réunion...',
    })

    // Set initial content
    if (value) {
      quill.root.innerHTML = value
    }

    // Listen to text changes
    quill.on('text-change', () => {
      if (!isUpdatingRef.current) {
        const html = quill.root.innerHTML
        onChange(html)
      }
    })

    quillRef.current = quill

    // Cleanup
    return () => {
      if (quillRef.current) {
        quillRef.current = null
      }
      if (container.firstChild) {
        container.removeChild(container.firstChild)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []) // Empty deps - only run once (onChange is stable, value is handled in separate effect)

  // Update Quill content when value prop changes (external updates)
  useEffect(() => {
    if (!quillRef.current) return
    if (isUpdatingRef.current) return

    const currentHtml = quillRef.current.root.innerHTML

    // Only update if content is different
    if (currentHtml !== value && value !== undefined) {
      isUpdatingRef.current = true

      // Preserve cursor position
      const selection = quillRef.current.getSelection()

      quillRef.current.root.innerHTML = value || ''

      // Restore cursor position if it existed
      if (selection) {
        try {
          quillRef.current.setSelection(selection.index, selection.length)
        } catch (error) {
          // Ignore errors if cursor position is invalid
          console.debug('Could not restore cursor position:', error)
        }
      }

      setTimeout(() => {
        isUpdatingRef.current = false
      }, 100)
    }
  }, [value])

  const handleFormat = (format: string, value?: string) => {
    if (!quillRef.current) return

    if (value) {
      quillRef.current.format(format, value)
    } else {
      const currentFormat = quillRef.current.getFormat()
      quillRef.current.format(format, !currentFormat[format])
    }
    quillRef.current.focus()
  }

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
      {/* Custom Toolbar */}
      <div id="custom-toolbar" className="bg-gray-100 dark:bg-gray-700 border-b border-gray-300 dark:border-gray-600 p-2 flex flex-wrap gap-1">
        <button
          type="button"
          onClick={() => handleFormat('bold')}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors"
          title="Gras"
        >
          B
        </button>
        <button
          type="button"
          onClick={() => handleFormat('italic')}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm italic text-gray-700 dark:text-gray-200 transition-colors"
          title="Italique"
        >
          I
        </button>
        <button
          type="button"
          onClick={() => handleFormat('underline')}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm underline text-gray-700 dark:text-gray-200 transition-colors"
          title="Souligné"
        >
          U
        </button>

        <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>

        <button
          type="button"
          onClick={() => handleFormat('header', '1')}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm font-bold text-gray-700 dark:text-gray-200 transition-colors"
          title="Titre 1"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => handleFormat('header', '2')}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm font-semibold text-gray-700 dark:text-gray-200 transition-colors"
          title="Titre 2"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => handleFormat('header', '3')}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm font-medium text-gray-700 dark:text-gray-200 transition-colors"
          title="Titre 3"
        >
          H3
        </button>
        <button
          type="button"
          onClick={() => handleFormat('header', 'false')}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm text-gray-700 dark:text-gray-200 transition-colors"
          title="Paragraphe"
        >
          P
        </button>

        <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>

        <button
          type="button"
          onClick={() => handleFormat('list', 'bullet')}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm text-gray-700 dark:text-gray-200 transition-colors"
          title="Liste à puces"
        >
          • Liste
        </button>
        <button
          type="button"
          onClick={() => handleFormat('list', 'ordered')}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm text-gray-700 dark:text-gray-200 transition-colors"
          title="Liste numérotée"
        >
          1. Liste
        </button>

        <div className="w-px bg-gray-300 dark:bg-gray-600 mx-1"></div>

        <button
          type="button"
          onClick={() => {
            if (!quillRef.current) return
            quillRef.current.removeFormat(quillRef.current.getSelection()?.index || 0, quillRef.current.getLength())
            quillRef.current.focus()
          }}
          className="px-3 py-1.5 bg-white dark:bg-gray-600 hover:bg-gray-200 dark:hover:bg-gray-500 rounded border border-gray-300 dark:border-gray-500 text-sm text-gray-700 dark:text-gray-200 transition-colors"
          title="Supprimer le formatage"
        >
          ✕ Format
        </button>
      </div>

      {/* Editor */}
      <div
        ref={containerRef}
        className="bg-white dark:bg-gray-800 [&_.ql-container]:border-0 [&_.ql-editor]:min-h-[600px] [&_.ql-editor]:text-gray-900 [&_.ql-editor]:dark:text-white [&_.ql-editor]:text-base [&_.ql-editor]:p-6 [&_.ql-editor_h1]:text-3xl [&_.ql-editor_h1]:font-bold [&_.ql-editor_h1]:mb-4 [&_.ql-editor_h1]:mt-6 [&_.ql-editor_h2]:text-2xl [&_.ql-editor_h2]:font-bold [&_.ql-editor_h2]:mb-3 [&_.ql-editor_h2]:mt-5 [&_.ql-editor_h3]:text-xl [&_.ql-editor_h3]:font-semibold [&_.ql-editor_h3]:mb-2 [&_.ql-editor_h3]:mt-4 [&_.ql-editor_p]:mb-3 [&_.ql-editor_ul]:mb-3 [&_.ql-editor_ul]:ml-6 [&_.ql-editor_ol]:mb-3 [&_.ql-editor_ol]:ml-6 [&_.ql-editor_li]:mb-1 [&_.ql-editor.ql-blank::before]:text-gray-400 [&_.ql-editor.ql-blank::before]:dark:text-gray-500"
      />
    </div>
  )
}
