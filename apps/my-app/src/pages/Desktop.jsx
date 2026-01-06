import React, { useState, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { 
  Clock, Cloud, StickyNote, Calculator, Calendar, 
  CheckSquare, Timer, Quote, Music, Plus, FolderPlus, Globe, PlusCircle 
} from 'lucide-react';
import { cn } from '@/lib/utils';

import Widget from '@/components/desktop/Widget';
import Taskbar from '@/components/desktop/Taskbar';
import Folder from '@/components/desktop/Folder';

import ClockWidget from '@/components/widgets/ClockWidget';
import WeatherWidget from '@/components/widgets/WeatherWidget';
import NotesWidget from '@/components/widgets/NotesWidget';
import CalculatorWidget from '@/components/widgets/CalculatorWidget';
import CalendarWidget from '@/components/widgets/CalendarWidget';
import TodoWidget from '@/components/widgets/TodoWidget';
import TimerWidget from '@/components/widgets/TimerWidget';
import QuoteWidget from '@/components/widgets/QuoteWidget';
import MusicWidget from '@/components/widgets/MusicWidget';
import IframeWidget from '@/components/widgets/IframeWidget';
import IframeCreatorWidget from '@/components/widgets/IframeCreatorWidget';

const WIDGET_CONFIGS = [
  { id: 'clock', title: 'Clock', icon: Clock, color: 'from-slate-500/20 to-slate-600/20', component: ClockWidget },
  { id: 'weather', title: 'Weather', icon: Cloud, color: 'from-sky-500/20 to-cyan-500/20', component: WeatherWidget },
  { id: 'notes', title: 'Notes', icon: StickyNote, color: 'from-amber-500/20 to-orange-500/20', component: NotesWidget },
  { id: 'calculator', title: 'Calculator', icon: Calculator, color: 'from-violet-500/20 to-purple-500/20', component: CalculatorWidget },
  { id: 'calendar', title: 'Calendar', icon: Calendar, color: 'from-rose-500/20 to-pink-500/20', component: CalendarWidget },
  { id: 'todo', title: 'Tasks', icon: CheckSquare, color: 'from-emerald-500/20 to-teal-500/20', component: TodoWidget },
  { id: 'timer', title: 'Timer', icon: Timer, color: 'from-orange-500/20 to-red-500/20', component: TimerWidget },
  { id: 'quote', title: 'Quotes', icon: Quote, color: 'from-indigo-500/20 to-blue-500/20', component: QuoteWidget },
  { id: 'music', title: 'Music', icon: Music, color: 'from-fuchsia-500/20 to-pink-500/20', component: MusicWidget },
  { id: 'santa', title: 'NC Santa', icon: Globe, color: 'from-red-500/20 to-green-500/20', component: IframeWidget, props: { src: 'https://nc-santa.com' } },
  { id: 'iframe-creator', title: 'Add Website', icon: PlusCircle, color: 'from-cyan-500/20 to-blue-500/20', component: IframeCreatorWidget, isCreator: true },
];

export default function Desktop() {
  const [widgets, setWidgets] = useState(
    WIDGET_CONFIGS.map((config, i) => ({
      ...config,
      isMinimized: false,
      isMaximized: false,
      position: { 
        x: 50 + (i % 4) * 320, 
        y: 50 + Math.floor(i / 4) * 280 
      },
      size: { width: 300, height: 250 },
      folderId: null,
    }))
  );

  const [folders, setFolders] = useState([
    { id: 'folder-1', name: 'Productivity', position: { x: 50, y: 50 }, isOpen: false },
  ]);

  const [dropTargetFolder, setDropTargetFolder] = useState(null);
  const folderBoundsRef = useRef({});

  const [showAddMenu, setShowAddMenu] = useState(false);

  const handleMinimize = useCallback((id) => {
    setWidgets(prev => prev.map(w => 
      w.id === id ? { ...w, isMinimized: true, isMaximized: false } : w
    ));
  }, []);

  const handleMaximize = useCallback((id) => {
    setWidgets(prev => prev.map(w => 
      w.id === id ? { ...w, isMaximized: !w.isMaximized } : w
    ));
  }, []);

  const handleRestore = useCallback((id) => {
    setWidgets(prev => prev.map(w => 
      w.id === id ? { ...w, isMinimized: false } : w
    ));
  }, []);

  const handlePositionChange = useCallback((id, position) => {
    setWidgets(prev => prev.map(w => 
      w.id === id ? { ...w, position } : w
    ));
    
    // Check if widget is over a folder
    let foundTarget = null;
    for (const [folderId, getBounds] of Object.entries(folderBoundsRef.current)) {
      const bounds = getBounds();
      if (bounds) {
        const widgetCenterX = position.x + 150;
        const widgetCenterY = position.y + 30;
        if (
          widgetCenterX >= bounds.left &&
          widgetCenterX <= bounds.right &&
          widgetCenterY >= bounds.top &&
          widgetCenterY <= bounds.bottom
        ) {
          foundTarget = folderId;
          break;
        }
      }
    }
    setDropTargetFolder(foundTarget);
  }, []);

  const handleSizeChange = useCallback((id, size) => {
    setWidgets(prev => prev.map(w => 
      w.id === id ? { ...w, size } : w
    ));
  }, []);

  const handleWidgetDragEnd = useCallback((widgetId, mousePos) => {
    // Check if dropped on a folder
    for (const [folderId, getBounds] of Object.entries(folderBoundsRef.current)) {
      const bounds = getBounds();
      if (bounds) {
        if (
          mousePos.x >= bounds.left &&
          mousePos.x <= bounds.right &&
          mousePos.y >= bounds.top &&
          mousePos.y <= bounds.bottom
        ) {
          // Add widget to folder
          setWidgets(prev => prev.map(w => 
            w.id === widgetId ? { ...w, folderId, isMinimized: true } : w
          ));
          break;
        }
      }
    }
    setDropTargetFolder(null);
  }, []);

  const handleFolderBounds = useCallback((folderId, getBounds) => {
    folderBoundsRef.current[folderId] = getBounds;
  }, []);

  const handleCreateIframeWidget = useCallback(({ url, name }) => {
    const newWidget = {
      id: `iframe-${Date.now()}`,
      title: name,
      icon: Globe,
      color: 'from-cyan-500/20 to-blue-500/20',
      component: IframeWidget,
      props: { src: url },
      isMinimized: false,
      isMaximized: false,
      position: { x: 100 + Math.random() * 200, y: 100 + Math.random() * 200 },
      size: { width: 400, height: 350 },
      folderId: null,
    };
    setWidgets(prev => [...prev, newWidget]);
  }, []);

  const handleFolderPositionChange = useCallback((id, position) => {
    setFolders(prev => prev.map(f => 
      f.id === id ? { ...f, position } : f
    ));
  }, []);

  const handleFolderToggle = useCallback((id) => {
    setFolders(prev => prev.map(f => 
      f.id === id ? { ...f, isOpen: !f.isOpen } : f
    ));
  }, []);

  const handleWidgetFromFolder = useCallback((widgetId) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, folderId: null, isMinimized: false } : w
    ));
  }, []);

  const addWidgetToFolder = (widgetId, folderId) => {
    setWidgets(prev => prev.map(w => 
      w.id === widgetId ? { ...w, folderId, isMinimized: true } : w
    ));
  };

  const createFolder = () => {
    const newFolder = {
      id: `folder-${Date.now()}`,
      name: `Folder ${folders.length + 1}`,
      position: { x: 100 + folders.length * 50, y: 100 + folders.length * 50 },
      isOpen: false,
    };
    setFolders([...folders, newFolder]);
    setShowAddMenu(false);
  };

  const activeWidgets = widgets.filter(w => !w.folderId);
  const minimizedWidgets = widgets.filter(w => w.isMinimized && !w.folderId);

  return (
    <div 
      className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 overflow-hidden relative"
      onDragOver={(e) => e.preventDefault()}
      onDrop={(e) => {
        e.preventDefault();
        const widgetId = e.dataTransfer.getData('widgetId');
        const fromFolder = e.dataTransfer.getData('fromFolder');
        if (widgetId && fromFolder === 'true') {
          // Remove from folder and place on desktop
          setWidgets(prev => prev.map(w => 
            w.id === widgetId ? { 
              ...w, 
              folderId: null, 
              isMinimized: false,
              position: { x: e.clientX - 150, y: e.clientY - 30 }
            } : w
          ));
        }
      }}
    >
      {/* Background pattern */}
      <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%239C92AC' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")" }} />
      
      {/* Folders */}
      {folders.map(folder => (
        <Folder
          key={folder.id}
          {...folder}
          widgets={widgets.filter(w => w.folderId === folder.id)}
          onPositionChange={handleFolderPositionChange}
          onToggle={handleFolderToggle}
          onWidgetClick={handleWidgetFromFolder}
          isDropTarget={dropTargetFolder === folder.id}
          onGetBounds={handleFolderBounds}
        />
      ))}

      {/* Widgets */}
      {activeWidgets.map(widget => {
        const WidgetComponent = widget.component;
        return (
          <Widget
            key={widget.id}
            id={widget.id}
            title={widget.title}
            icon={widget.icon}
            color={widget.color}
            isMinimized={widget.isMinimized}
            isMaximized={widget.isMaximized}
            position={widget.position}
            size={widget.size}
            onMinimize={handleMinimize}
            onMaximize={handleMaximize}
            onPositionChange={handlePositionChange}
            onSizeChange={handleSizeChange}
            onDragEnd={handleWidgetDragEnd}
          >
            <WidgetComponent 
              isMaximized={widget.isMaximized} 
              {...(widget.props || {})}
              {...(widget.isCreator ? { onCreateWidget: handleCreateIframeWidget } : {})}
            />
          </Widget>
        );
      })}

      {/* Add Button */}
      <div className="fixed top-4 right-4 z-40">
        <div className="relative">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowAddMenu(!showAddMenu)}
            className={cn(
              "p-3 rounded-xl transition-all",
              "bg-white/10 backdrop-blur-xl border border-white/10",
              "hover:bg-white/20",
              showAddMenu && "bg-white/20"
            )}
          >
            <Plus className={cn(
              "w-5 h-5 text-white transition-transform duration-300",
              showAddMenu && "rotate-45"
            )} />
          </motion.button>

          {showAddMenu && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className={cn(
                "absolute top-full right-0 mt-2 w-64",
                "bg-slate-900/95 backdrop-blur-2xl rounded-xl",
                "border border-white/10 shadow-2xl overflow-hidden"
              )}
            >
              <div className="p-2">
                <button
                  onClick={createFolder}
                  className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-lg",
                    "hover:bg-white/10 transition-colors text-left"
                  )}
                >
                  <FolderPlus className="w-5 h-5 text-amber-400" />
                  <span className="text-white/90">New Folder</span>
                </button>
              </div>
              <div className="border-t border-white/10 p-2">
                <p className="text-xs text-white/40 px-4 py-2">Add to folder</p>
                {widgets.filter(w => !w.folderId).map(widget => {
                  const Icon = widget.icon;
                  return (
                    <div key={widget.id} className="group">
                      <button
                        onClick={() => {
                          if (folders.length > 0) {
                            addWidgetToFolder(widget.id, folders[0].id);
                            setShowAddMenu(false);
                          }
                        }}
                        className={cn(
                          "w-full flex items-center gap-3 px-4 py-2 rounded-lg",
                          "hover:bg-white/10 transition-colors text-left"
                        )}
                      >
                        <div className={cn("p-1.5 rounded-lg bg-gradient-to-br", widget.color)}>
                          <Icon className="w-3.5 h-3.5 text-white" />
                        </div>
                        <span className="text-sm text-white/70">{widget.title}</span>
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </div>
      </div>

      {/* Taskbar */}
      <Taskbar widgets={widgets} onRestore={handleRestore} />

      {/* Desktop hint */}
      <div className="fixed bottom-20 left-1/2 -translate-x-1/2 text-white/20 text-sm pointer-events-none">
        Drag widgets to move • Double-click folders to open
      </div>
    </div>
  );
}
