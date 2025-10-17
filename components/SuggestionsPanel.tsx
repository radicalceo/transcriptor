'use client'

import { useState } from 'react'
import type { Suggestions } from '@/lib/types'

interface SuggestionsPanelProps {
  suggestions: Suggestions
  onUpdate?: (suggestions: Suggestions) => void
}

export default function SuggestionsPanel({
  suggestions,
  onUpdate,
}: SuggestionsPanelProps) {
  const [editingItem, setEditingItem] = useState<{
    type: 'topic' | 'decision' | 'action'
    index: number
  } | null>(null)

  const handleEdit = (
    type: 'topic' | 'decision' | 'action',
    index: number,
    newValue: string
  ) => {
    if (!onUpdate) return

    const updated = { ...suggestions }
    if (type === 'topic') {
      updated.topics[index] = newValue
    } else if (type === 'decision') {
      updated.decisions[index] = { ...updated.decisions[index], text: newValue }
    } else if (type === 'action') {
      updated.actions[index] = { ...updated.actions[index], text: newValue }
    }
    onUpdate(updated)
    setEditingItem(null)
  }

  const handleDelete = (type: 'topic' | 'decision' | 'action', index: number) => {
    if (!onUpdate) return

    const updated = { ...suggestions }
    if (type === 'topic') {
      updated.topics = updated.topics.filter((_, i) => i !== index)
    } else if (type === 'decision') {
      updated.decisions = updated.decisions.filter((_, i) => i !== index)
    } else if (type === 'action') {
      updated.actions = updated.actions.filter((_, i) => i !== index)
    }
    onUpdate(updated)
  }

  return (
    <div className="h-full bg-white dark:bg-gray-800 border-l border-gray-200 dark:border-gray-700 overflow-y-auto">
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
          Suggestions IA
        </h2>
      </div>

      <div className="p-4 space-y-6">
        {/* Topics */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
            Thèmes
          </h3>
          <div className="space-y-2">
            {suggestions.topics.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                Aucun thème détecté pour le moment
              </p>
            ) : (
              suggestions.topics.map((topic, index) => {
                // Handle both string and object formats
                const topicText = typeof topic === 'string' ? topic : (topic as any).title || ''
                return (
                <div
                  key={index}
                  className="flex items-start gap-2 p-2 bg-blue-50 dark:bg-blue-900/20 rounded-lg group"
                >
                  {editingItem?.type === 'topic' &&
                  editingItem.index === index ? (
                    <input
                      type="text"
                      defaultValue={topicText}
                      autoFocus
                      onBlur={(e) => handleEdit('topic', index, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleEdit('topic', index, e.currentTarget.value)
                        }
                      }}
                      className="flex-1 px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-blue-300 rounded"
                    />
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">
                        {topicText}
                      </span>
                      <button
                        onClick={() => setEditingItem({ type: 'topic', index })}
                        className="opacity-0 group-hover:opacity-100 text-blue-600 hover:text-blue-700"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete('topic', index)}
                        className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
                )
              })
            )}
          </div>
        </div>

        {/* Decisions */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 bg-green-500 rounded-full"></span>
            Décisions
          </h3>
          <div className="space-y-2">
            {suggestions.decisions.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                Aucune décision détectée
              </p>
            ) : (
              suggestions.decisions.map((decision, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg group"
                >
                  {editingItem?.type === 'decision' &&
                  editingItem.index === index ? (
                    <input
                      type="text"
                      defaultValue={decision.text}
                      autoFocus
                      onBlur={(e) =>
                        handleEdit('decision', index, e.target.value)
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          handleEdit('decision', index, e.currentTarget.value)
                        }
                      }}
                      className="flex-1 px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-green-300 rounded"
                    />
                  ) : (
                    <>
                      <span className="flex-1 text-sm text-gray-900 dark:text-gray-100">
                        {decision.text}
                      </span>
                      <button
                        onClick={() =>
                          setEditingItem({ type: 'decision', index })
                        }
                        className="opacity-0 group-hover:opacity-100 text-green-600 hover:text-green-700"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                          />
                        </svg>
                      </button>
                      <button
                        onClick={() => handleDelete('decision', index)}
                        className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700"
                      >
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Actions */}
        <div>
          <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 bg-purple-500 rounded-full"></span>
            Actions
          </h3>
          <div className="space-y-2">
            {suggestions.actions.length === 0 ? (
              <p className="text-sm text-gray-500 italic">
                Aucune action détectée
              </p>
            ) : (
              suggestions.actions.map((action, index) => (
                <div
                  key={index}
                  className="flex items-start gap-2 p-2 bg-purple-50 dark:bg-purple-900/20 rounded-lg group"
                >
                  <div className="flex-1">
                    {editingItem?.type === 'action' &&
                    editingItem.index === index ? (
                      <input
                        type="text"
                        defaultValue={action.text}
                        autoFocus
                        onBlur={(e) =>
                          handleEdit('action', index, e.target.value)
                        }
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            handleEdit('action', index, e.currentTarget.value)
                          }
                        }}
                        className="w-full px-2 py-1 text-sm bg-white dark:bg-gray-700 border border-purple-300 rounded"
                      />
                    ) : (
                      <>
                        <p className="text-sm text-gray-900 dark:text-gray-100">
                          {action.text}
                        </p>
                        {(action.assignee || action.due_date) && (
                          <div className="flex gap-2 mt-1 text-xs text-gray-600 dark:text-gray-400">
                            {action.assignee && (
                              <span className="flex items-center gap-1">
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                                  />
                                </svg>
                                {action.assignee}
                              </span>
                            )}
                            {action.due_date && (
                              <span className="flex items-center gap-1">
                                <svg
                                  className="w-3 h-3"
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                                  />
                                </svg>
                                {action.due_date}
                              </span>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </div>
                  <button
                    onClick={() => setEditingItem({ type: 'action', index })}
                    className="opacity-0 group-hover:opacity-100 text-purple-600 hover:text-purple-700"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDelete('action', index)}
                    className="opacity-0 group-hover:opacity-100 text-red-600 hover:text-red-700"
                  >
                    <svg
                      className="w-4 h-4"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M6 18L18 6M6 6l12 12"
                      />
                    </svg>
                  </button>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
