"use client";

import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import type { Meeting } from "@/lib/types";

interface Folder {
  id: string;
  name: string;
  description?: string;
  color?: string;
  parentId?: string | null;
  parent?: Folder;
  children?: Folder[];
  _count?: {
    meetings: number;
  };
}

export default function HistoryPage() {
  const router = useRouter();
  const [meetings, setMeetings] = useState<Meeting[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [selectedFolderId, setSelectedFolderId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);
  const [showFolderModal, setShowFolderModal] = useState(false);
  const [folderModalMode, setFolderModalMode] = useState<"create" | "edit">(
    "create",
  );
  const [editingFolder, setEditingFolder] = useState<Folder | null>(null);
  const [folderFormData, setFolderFormData] = useState({
    name: "",
    description: "",
    color: "#6366f1",
    parentId: null as string | null,
  });
  const [generatingSummaryId, setGeneratingSummaryId] = useState<string | null>(
    null,
  );

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch meetings
        const meetingsRes = await fetch("/api/meetings");
        const meetingsData = await meetingsRes.json();
        if (meetingsData.success) {
          const sorted = meetingsData.meetings.sort(
            (a: Meeting, b: Meeting) =>
              new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
          );
          setMeetings(sorted);
        }

        // Fetch folders
        const foldersRes = await fetch("/api/folders");
        const foldersData = await foldersRes.json();
        if (foldersData.success) {
          setFolders(foldersData.folders);
        }
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // Folder management functions
  const openCreateFolderModal = (parentId: string | null = null) => {
    setFolderModalMode("create");
    setEditingFolder(null);
    setFolderFormData({
      name: "",
      description: "",
      color: "#6366f1",
      parentId,
    });
    setShowFolderModal(true);
  };

  const openEditFolderModal = (folder: Folder) => {
    setFolderModalMode("edit");
    setEditingFolder(folder);
    setFolderFormData({
      name: folder.name,
      description: folder.description || "",
      color: folder.color || "#6366f1",
      parentId: folder.parentId || null,
    });
    setShowFolderModal(true);
  };

  const handleSaveFolder = async () => {
    if (!folderFormData.name.trim()) {
      alert("Le nom du dossier est requis");
      return;
    }

    try {
      if (folderModalMode === "create") {
        const response = await fetch("/api/folders", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(folderFormData),
        });
        const data = await response.json();
        if (data.success) {
          setFolders([...folders, data.folder]);
          setShowFolderModal(false);
        }
      } else if (editingFolder) {
        const response = await fetch(`/api/folders/${editingFolder.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(folderFormData),
        });
        const data = await response.json();
        if (data.success) {
          setFolders(
            folders.map((f) => (f.id === editingFolder.id ? data.folder : f)),
          );
          setShowFolderModal(false);
        }
      }
    } catch (error) {
      console.error("Error saving folder:", error);
      alert("Erreur lors de l'enregistrement du dossier");
    }
  };

  const handleDeleteFolder = async (folderId: string) => {
    if (
      !confirm(
        "Êtes-vous sûr de vouloir supprimer ce dossier ? Il doit être vide.",
      )
    ) {
      return;
    }

    try {
      const response = await fetch(`/api/folders/${folderId}`, {
        method: "DELETE",
      });
      const data = await response.json();
      if (data.success) {
        setFolders(folders.filter((f) => f.id !== folderId));
        if (selectedFolderId === folderId) {
          setSelectedFolderId(null);
        }
      } else if (data.hasContent) {
        alert(
          "Impossible de supprimer un dossier contenant des meetings ou des sous-dossiers",
        );
      }
    } catch (error) {
      console.error("Error deleting folder:", error);
      alert("Erreur lors de la suppression du dossier");
    }
  };

  const handleMoveMeeting = async (
    meetingId: string,
    folderId: string | null,
  ) => {
    const meeting = meetings.find((m) => m.id === meetingId);
    if (!meeting) return;

    const oldFolderId = meeting.folderId;

    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId }),
      });
      const data = await response.json();
      if (data.success) {
        // Update meeting
        setMeetings(
          meetings.map((m) => (m.id === meetingId ? { ...m, folderId } : m)),
        );

        // Update folder counts
        setFolders(
          folders.map((f) => {
            if (f.id === oldFolderId && f._count) {
              // Decrease count from old folder
              return {
                ...f,
                _count: { ...f._count, meetings: f._count.meetings - 1 },
              };
            } else if (f.id === folderId && f._count) {
              // Increase count for new folder
              return {
                ...f,
                _count: { ...f._count, meetings: f._count.meetings + 1 },
              };
            }
            return f;
          }),
        );
      }
    } catch (error) {
      console.error("Error moving meeting:", error);
      alert("Erreur lors du déplacement du meeting");
    }
  };

  const filteredMeetings = selectedFolderId
    ? meetings.filter((m) => m.folderId === selectedFolderId)
    : meetings.filter((m) => !m.folderId);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (seconds?: number) => {
    if (!seconds) return "-";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const handleDelete = async (meetingId: string) => {
    setIsDeleting(true);
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (data.success) {
        // Remove meeting from list
        setMeetings(meetings.filter((m) => m.id !== meetingId));
        setDeleteConfirmId(null);
      } else {
        console.error("Error deleting meeting:", data.error);
        alert("Erreur lors de la suppression du meeting");
      }
    } catch (error) {
      console.error("Error deleting meeting:", error);
      alert("Erreur lors de la suppression du meeting");
    } finally {
      setIsDeleting(false);
    }
  };

  const startEditing = (meeting: Meeting) => {
    setEditingId(meeting.id);
    setEditingTitle(meeting.title || `Meeting ${meeting.id.slice(0, 8)}`);
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditingTitle("");
  };

  const saveTitle = async (meetingId: string) => {
    if (!editingTitle.trim()) {
      alert("Le titre ne peut pas être vide");
      return;
    }

    setIsUpdating(true);
    try {
      const response = await fetch(`/api/meetings/${meetingId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ title: editingTitle.trim() }),
      });
      const data = await response.json();

      if (data.success) {
        // Update meeting in list
        setMeetings(
          meetings.map((m) =>
            m.id === meetingId ? { ...m, title: editingTitle.trim() } : m,
          ),
        );
        setEditingId(null);
        setEditingTitle("");
      } else {
        console.error("Error updating meeting:", data.error);
        alert("Erreur lors de la mise à jour du titre");
      }
    } catch (error) {
      console.error("Error updating meeting:", error);
      alert("Erreur lors de la mise à jour du titre");
    } finally {
      setIsUpdating(false);
    }
  };

  const handleGenerateSummary = async (meetingId: string) => {
    setGeneratingSummaryId(meetingId);
    try {
      const response = await fetch("/api/summary", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          meetingId,
          force: true,
          async: true,
        }),
      });
      const data = await response.json();

      if (data.success) {
        // Update meeting status to processing
        setMeetings(
          meetings.map((m) =>
            m.id === meetingId ? { ...m, status: "processing" } : m,
          ),
        );

        // Start polling for completion
        const pollInterval = setInterval(async () => {
          try {
            const meetingRes = await fetch(`/api/meeting/${meetingId}`);
            const meetingData = await meetingRes.json();

            if (
              meetingData.success &&
              meetingData.meeting.status === "completed" &&
              meetingData.meeting.summary
            ) {
              clearInterval(pollInterval);
              setGeneratingSummaryId(null);
              // Update the meeting in the list
              setMeetings(
                meetings.map((m) =>
                  m.id === meetingId
                    ? {
                        ...m,
                        status: "completed",
                        summary: meetingData.meeting.summary,
                      }
                    : m,
                ),
              );
              // Redirect to summary page
              router.push(`/summary/${meetingId}`);
            }
          } catch (error) {
            console.error("Error polling meeting status:", error);
          }
        }, 3000); // Poll every 3 seconds

        // Stop polling after 2 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          setGeneratingSummaryId(null);
        }, 120000);
      } else {
        console.error("Error generating summary:", data.error);
        alert("Erreur lors de la génération du résumé");
        setGeneratingSummaryId(null);
      }
    } catch (error) {
      console.error("Error generating summary:", error);
      alert("Erreur lors de la génération du résumé");
      setGeneratingSummaryId(null);
    }
  };

  const getStatusBadge = (status: Meeting["status"]) => {
    const badges = {
      active:
        "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
      processing:
        "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
      completed:
        "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300",
    };
    const labels = {
      active: "En cours",
      processing: "Traitement",
      completed: "Terminé",
    };
    return (
      <span
        className={`px-2 py-1 rounded-full text-xs font-medium ${badges[status]}`}
      >
        {labels[status]}
      </span>
    );
  };

  const getTypeBadge = (type: Meeting["type"]) => {
    return type === "upload" ? (
      <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
          ></path>
        </svg>
        Upload
      </span>
    ) : (
      <span className="inline-flex items-center gap-1 text-xs text-gray-600 dark:text-gray-400">
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth="2"
            d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
          ></path>
        </svg>
        Live
      </span>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Chargement...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex">
      {/* Sidebar with folders */}
      <div className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col">
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <button
            onClick={() => router.push("/")}
            className="mb-3 inline-flex items-center gap-2 text-sm text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400 transition-colors"
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
                strokeWidth="2"
                d="M10 19l-7-7m0 0l7-7m-7 7h18"
              />
            </svg>
            Accueil
          </button>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
            Dossiers
          </h2>
          <button
            onClick={() => openCreateFolderModal(null)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 rounded-lg hover:bg-indigo-100 dark:hover:bg-indigo-900/50 transition-colors"
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
                strokeWidth="2"
                d="M12 4v16m8-8H4"
              />
            </svg>
            Nouveau dossier
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          <button
            onClick={() => setSelectedFolderId(null)}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors mb-1 ${
              selectedFolderId === null
                ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
            }`}
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
                strokeWidth="2"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
            <span className="flex-1 text-left">Non classés</span>
            <span className="text-xs">
              {meetings.filter((m) => !m.folderId).length}
            </span>
          </button>

          {folders
            .filter((f) => !f.parentId)
            .map((folder) => (
              <div key={folder.id} className="mb-1">
                <div className="group flex items-center gap-1">
                  <button
                    onClick={() => setSelectedFolderId(folder.id)}
                    className={`flex-1 flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition-colors ${
                      selectedFolderId === folder.id
                        ? "bg-indigo-50 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400"
                        : "text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  >
                    <div
                      className="w-3 h-3 rounded"
                      style={{ backgroundColor: folder.color || "#6366f1" }}
                    ></div>
                    <span className="flex-1 text-left truncate">
                      {folder.name}
                    </span>
                    <span className="text-xs">
                      {folder._count?.meetings || 0}
                    </span>
                  </button>
                  <button
                    onClick={() => openEditFolderModal(folder)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-gray-200 dark:hover:bg-gray-600 rounded transition-opacity"
                    title="Éditer"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => handleDeleteFolder(folder.id)}
                    className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-opacity text-red-600 dark:text-red-400"
                    title="Supprimer"
                  >
                    <svg
                      className="w-3 h-3"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <div className="bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
          <div className="px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {selectedFolderId
                    ? folders.find((f) => f.id === selectedFolderId)?.name ||
                      "Dossier"
                    : "Non classés"}
                </h1>
                <p className="mt-2 text-gray-600 dark:text-gray-400">
                  {filteredMeetings.length} enregistrement
                  {filteredMeetings.length > 1 ? "s" : ""}
                </p>
              </div>
              <button
                onClick={() => router.push("/")}
                className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
              >
                Nouveau meeting
              </button>
            </div>
          </div>
        </div>

        {/* Meeting list */}
        <div className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-8">
          {filteredMeetings.length === 0 ? (
            <div className="text-center py-12">
              <svg
                className="mx-auto h-12 w-12 text-gray-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">
                Aucun meeting
              </h3>
              <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
                Commencez par créer un meeting ou uploader un enregistrement.
              </p>
              <div className="mt-6">
                <button
                  onClick={() => router.push("/")}
                  className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
                >
                  Nouveau meeting
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredMeetings.map((meeting) => (
                <div
                  key={meeting.id}
                  className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-shadow overflow-hidden"
                >
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-3">
                      {getStatusBadge(meeting.status)}
                      {getTypeBadge(meeting.type)}
                    </div>

                    {editingId === meeting.id ? (
                      <div className="flex items-center gap-2 mb-2">
                        <input
                          type="text"
                          value={editingTitle}
                          onChange={(e) => setEditingTitle(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              saveTitle(meeting.id);
                            } else if (e.key === "Escape") {
                              cancelEditing();
                            }
                          }}
                          className="flex-1 text-lg font-semibold text-gray-900 dark:text-white bg-white dark:bg-gray-700 border border-indigo-500 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          autoFocus
                          disabled={isUpdating}
                        />
                        <button
                          onClick={() => saveTitle(meeting.id)}
                          disabled={isUpdating}
                          className="p-1 text-green-600 hover:text-green-700 dark:text-green-400 dark:hover:text-green-300 disabled:opacity-50"
                          title="Enregistrer"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M5 13l4 4L19 7"
                            />
                          </svg>
                        </button>
                        <button
                          onClick={cancelEditing}
                          disabled={isUpdating}
                          className="p-1 text-gray-600 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-300 disabled:opacity-50"
                          title="Annuler"
                        >
                          <svg
                            className="w-5 h-5"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth="2"
                              d="M6 18L18 6M6 6l12 12"
                            />
                          </svg>
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 mb-2 group">
                        <h3 className="flex-1 text-lg font-semibold text-gray-900 dark:text-white truncate">
                          {meeting.title || `Meeting ${meeting.id.slice(0, 8)}`}
                        </h3>
                        <button
                          onClick={() => startEditing(meeting)}
                          className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-600 hover:text-indigo-600 dark:text-gray-400 dark:hover:text-indigo-400"
                          title="Modifier le titre"
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
                              strokeWidth="2"
                              d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z"
                            />
                          </svg>
                        </button>
                      </div>
                    )}

                    <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                      {formatDate(meeting.createdAt)}
                    </p>

                    <div className="mb-4">
                      <select
                        value={meeting.folderId || ""}
                        onChange={(e) =>
                          handleMoveMeeting(meeting.id, e.target.value || null)
                        }
                        className="w-full text-xs px-2 py-1 border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
                      >
                        <option value="">Non classé</option>
                        {folders.map((folder) => (
                          <option key={folder.id} value={folder.id}>
                            {folder.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400 mb-4">
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
                          />
                        </svg>
                        {formatDuration(meeting.duration)}
                      </span>
                      <span className="flex items-center gap-1">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="2"
                            d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z"
                          />
                        </svg>
                        {meeting.transcript.length} segments
                      </span>
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => router.push(`/meeting/${meeting.id}`)}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                      >
                        Transcript
                      </button>
                      {meeting.summary ? (
                        <button
                          onClick={() => router.push(`/summary/${meeting.id}`)}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        >
                          Résumé
                        </button>
                      ) : meeting.status !== "active" ? (
                        <button
                          onClick={() => handleGenerateSummary(meeting.id)}
                          disabled={generatingSummaryId === meeting.id}
                          className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        >
                          {generatingSummaryId === meeting.id ? (
                            <>
                              <svg
                                className="animate-spin h-4 w-4"
                                fill="none"
                                viewBox="0 0 24 24"
                              >
                                <circle
                                  className="opacity-25"
                                  cx="12"
                                  cy="12"
                                  r="10"
                                  stroke="currentColor"
                                  strokeWidth="4"
                                ></circle>
                                <path
                                  className="opacity-75"
                                  fill="currentColor"
                                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                ></path>
                              </svg>
                              Génération...
                            </>
                          ) : (
                            "Reset"
                          )}
                        </button>
                      ) : null}
                      <button
                        onClick={() => setDeleteConfirmId(meeting.id)}
                        className="bg-red-100 hover:bg-red-200 dark:bg-red-900/30 dark:hover:bg-red-900/50 text-red-600 dark:text-red-400 px-4 py-2 rounded-lg text-sm font-medium transition-colors"
                        title="Supprimer"
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
                            strokeWidth="2"
                            d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                          />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete confirmation modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0">
                <svg
                  className="w-6 h-6 text-red-600 dark:text-red-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
                  Confirmer la suppression
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-6">
                  Êtes-vous sûr de vouloir supprimer cet enregistrement ? Cette
                  action est irréversible et supprimera également tous les
                  fichiers associés.
                </p>
                <div className="flex gap-3 justify-end">
                  <button
                    onClick={() => setDeleteConfirmId(null)}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    onClick={() => handleDelete(deleteConfirmId)}
                    disabled={isDeleting}
                    className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isDeleting ? (
                      <>
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                        Suppression...
                      </>
                    ) : (
                      "Supprimer"
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Folder modal */}
      {showFolderModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-md w-full p-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              {folderModalMode === "create"
                ? "Nouveau dossier"
                : "Modifier le dossier"}
            </h3>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Nom du dossier *
                </label>
                <input
                  type="text"
                  value={folderFormData.name}
                  onChange={(e) =>
                    setFolderFormData({
                      ...folderFormData,
                      name: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  placeholder="Ex: Projets clients"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Description
                </label>
                <textarea
                  value={folderFormData.description}
                  onChange={(e) =>
                    setFolderFormData({
                      ...folderFormData,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white focus:ring-2 focus:ring-indigo-500"
                  rows={3}
                  placeholder="Description optionnelle"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Couleur
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={folderFormData.color}
                    onChange={(e) =>
                      setFolderFormData({
                        ...folderFormData,
                        color: e.target.value,
                      })
                    }
                    className="w-12 h-10 border border-gray-300 dark:border-gray-600 rounded cursor-pointer"
                  />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {folderFormData.color}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end mt-6">
              <button
                onClick={() => setShowFolderModal(false)}
                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-900 dark:text-white rounded-lg text-sm font-medium transition-colors"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveFolder}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {folderModalMode === "create" ? "Créer" : "Enregistrer"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
