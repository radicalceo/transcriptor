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
        toolbar: [
          [{ header: [1, 2, 3, false] }],
          ['bold', 'italic', 'underline'],
          [{ list: 'ordered' }, { list: 'bullet' }],
          ['clean'],
        ],
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

  return (
    <div className="border border-gray-300 dark:border-gray-600 rounded-lg overflow-hidden">
      <div
        ref={containerRef}
        className="bg-white dark:bg-gray-800 min-h-[600px] [&_.ql-toolbar]:bg-gray-100 [&_.ql-toolbar]:dark:bg-gray-700 [&_.ql-toolbar]:border-gray-300 [&_.ql-toolbar]:dark:border-gray-600 [&_.ql-container]:border-0 [&_.ql-editor]:min-h-[550px] [&_.ql-editor]:text-gray-900 [&_.ql-editor]:dark:text-white [&_.ql-editor]:text-base [&_.ql-editor]:p-6 [&_.ql-toolbar_.ql-stroke]:stroke-gray-700 [&_.ql-toolbar_.ql-stroke]:dark:stroke-gray-200 [&_.ql-toolbar_.ql-fill]:fill-gray-700 [&_.ql-toolbar_.ql-fill]:dark:fill-gray-200 [&_.ql-toolbar_.ql-picker-label]:text-gray-700 [&_.ql-toolbar_.ql-picker-label]:dark:text-gray-200 [&_.ql-toolbar_button:hover]:bg-gray-200 [&_.ql-toolbar_button:hover]:dark:bg-gray-600 [&_.ql-toolbar_button:hover_.ql-stroke]:stroke-gray-900 [&_.ql-toolbar_button:hover_.ql-stroke]:dark:stroke-white"
      />
    </div>
  )
}
