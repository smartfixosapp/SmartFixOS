import React, { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function NotesWidget({ isMaximized }) {
  const [notes, setNotes] = useState([
    { id: 1, text: 'Review project proposal', color: 'bg-amber-500/20' },
    { id: 2, text: 'Call with design team at 3pm', color: 'bg-emerald-500/20' },
    { id: 3, text: 'Update portfolio website', color: 'bg-violet-500/20' },
  ]);
  const [newNote, setNewNote] = useState('');

  const addNote = () => {
    if (!newNote.trim()) return;
    const colors = ['bg-amber-500/20', 'bg-emerald-500/20', 'bg-violet-500/20', 'bg-rose-500/20', 'bg-sky-500/20'];
    setNotes([...notes, { 
      id: Date.now(), 
      text: newNote,
      color: colors[Math.floor(Math.random() * colors.length)]
    }]);
    setNewNote('');
  };

  const deleteNote = (id) => {
    setNotes(notes.filter(n => n.id !== id));
  };

  return (
    <div className={`${isMaximized ? 'h-full flex flex-col' : ''}`}>
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addNote()}
          placeholder="Add a note..."
          className={cn(
            "flex-1 px-3 py-2 rounded-lg",
            "bg-white/10 border border-white/10",
            "text-white placeholder-white/30",
            "focus:outline-none focus:border-white/30"
          )}
        />
        <button
          onClick={addNote}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className={cn(
        "space-y-2",
        isMaximized && "flex-1 overflow-auto grid grid-cols-2 gap-3 space-y-0"
      )}>
        {notes.map((note) => (
          <div
            key={note.id}
            className={cn(
              "group flex items-start justify-between gap-2 p-3 rounded-lg",
              note.color,
              "border border-white/5"
            )}
          >
            <span className={isMaximized ? 'text-base' : 'text-sm'}>{note.text}</span>
            <button
              onClick={() => deleteNote(note.id)}
              className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-white/10 rounded"
            >
              <Trash2 className="w-3.5 h-3.5 text-white/50" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
