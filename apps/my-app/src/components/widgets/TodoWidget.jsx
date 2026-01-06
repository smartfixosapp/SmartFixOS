import React, { useState } from 'react';
import { Plus, Check, Circle } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function TodoWidget({ isMaximized }) {
  const [todos, setTodos] = useState([
    { id: 1, text: 'Complete dashboard design', done: true },
    { id: 2, text: 'Review pull requests', done: false },
    { id: 3, text: 'Update documentation', done: false },
    { id: 4, text: 'Schedule team sync', done: false },
  ]);
  const [newTodo, setNewTodo] = useState('');

  const addTodo = () => {
    if (!newTodo.trim()) return;
    setTodos([...todos, { id: Date.now(), text: newTodo, done: false }]);
    setNewTodo('');
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(t => t.id === id ? { ...t, done: !t.done } : t));
  };

  const completedCount = todos.filter(t => t.done).length;
  const progress = todos.length ? (completedCount / todos.length) * 100 : 0;

  return (
    <div className={cn("flex flex-col", isMaximized && "h-full")}>
      <div className="mb-4">
        <div className="flex justify-between text-sm mb-2">
          <span className="text-white/60">Progress</span>
          <span className="text-white/80">{completedCount}/{todos.length}</span>
        </div>
        <div className="h-2 bg-white/10 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addTodo()}
          placeholder="Add a task..."
          className={cn(
            "flex-1 px-3 py-2 rounded-lg",
            "bg-white/10 border border-white/10",
            "text-white placeholder-white/30",
            "focus:outline-none focus:border-white/30"
          )}
        />
        <button
          onClick={addTodo}
          className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors"
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      <div className={cn("space-y-2", isMaximized && "flex-1 overflow-auto")}>
        {todos.map((todo) => (
          <div
            key={todo.id}
            onClick={() => toggleTodo(todo.id)}
            className={cn(
              "flex items-center gap-3 p-3 rounded-lg cursor-pointer",
              "bg-white/5 hover:bg-white/10 transition-all",
              todo.done && "opacity-50"
            )}
          >
            <div className={cn(
              "w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all",
              todo.done ? "border-emerald-400 bg-emerald-400/20" : "border-white/30"
            )}>
              {todo.done && <Check className="w-3 h-3 text-emerald-400" />}
            </div>
            <span className={cn(
              "flex-1",
              todo.done && "line-through text-white/40",
              isMaximized && "text-lg"
            )}>
              {todo.text}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
