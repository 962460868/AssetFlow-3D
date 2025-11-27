import React, { useState, useRef, useEffect } from 'react';
import { DefaultCategory, SidebarGroup } from '../types';
import { 
  Box, 
  Layers, 
  Image as ImageIcon, 
  Palette, 
  Aperture, 
  Sticker, 
  Zap, 
  LayoutGrid,
  Settings,
  Database,
  FolderOpen,
  Briefcase,
  Plus,
  Trash2,
  FolderPlus,
  Check,
  X as XMark,
  ArrowRight,
  User,
  ShieldCheck,
  Users,
  Component,
  MoreHorizontal
} from 'lucide-react';

interface SidebarProps {
  currentCategory: string;
  availableProjects: string[];
  sidebarGroups: SidebarGroup[];
  currentUser?: string | null;
  isAdmin: boolean;
  onSelectCategory: (c: string) => void;
  onSelectProject: (p: string) => void;
  onOpenPreferences: () => void;
  onAddFolder: (groupId: string, name: string) => void;
  onAddGroup: (name: string) => void;
  onRemoveFolder: (groupId: string, folder: string) => void;
  onRemoveGroup: (groupId: string) => void;
  onDropAsset: (assetId: string, folder: string) => void;
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  [DefaultCategory.ALL]: <LayoutGrid size={15} />,
  [DefaultCategory.PROPS]: <Box size={15} />,
  [DefaultCategory.ENVIRONMENT]: <Layers size={15} />,
  [DefaultCategory.CHARACTERS]: <Users size={15} />,
  [DefaultCategory.BLUEPRINTS]: <Component size={15} />,
  [DefaultCategory.TEXTURES]: <ImageIcon size={15} />,
  [DefaultCategory.MATERIALS]: <Palette size={15} />,
  [DefaultCategory.HDR]: <Aperture size={15} />, 
  [DefaultCategory.DECALS]: <Sticker size={15} />,
  [DefaultCategory.VFX]: <Zap size={15} />,
  [DefaultCategory.OTHERS]: <MoreHorizontal size={15} />,
};

export const Sidebar: React.FC<SidebarProps> = ({ 
  currentCategory, 
  availableProjects,
  sidebarGroups,
  currentUser,
  isAdmin,
  onSelectCategory, 
  onSelectProject,
  onOpenPreferences,
  onAddFolder,
  onAddGroup,
  onRemoveFolder,
  onRemoveGroup,
  onDropAsset
}) => {
  // Local state for inline inputs
  const [isCreatingGroup, setIsCreatingGroup] = useState(false);
  const [newGroupName, setNewGroupName] = useState("");
  
  const [activeGroupIdForFolder, setActiveGroupIdForFolder] = useState<string | null>(null);
  const [newFolderName, setNewFolderName] = useState("");
  
  // Drag and drop visual state
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input when appearing
  useEffect(() => {
    if ((isCreatingGroup || activeGroupIdForFolder) && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isCreatingGroup, activeGroupIdForFolder]);

  const submitGroup = () => {
    if (newGroupName.trim()) {
      onAddGroup(newGroupName.trim());
      setNewGroupName("");
      setIsCreatingGroup(false);
    } else {
      setIsCreatingGroup(false);
    }
  };

  const submitFolder = () => {
    if (activeGroupIdForFolder && newFolderName.trim()) {
      onAddFolder(activeGroupIdForFolder, newFolderName.trim());
      setNewFolderName("");
      setActiveGroupIdForFolder(null);
    } else {
      setActiveGroupIdForFolder(null);
    }
  };
  
  // --- Drag & Drop Handlers ---
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
    e.dataTransfer.dropEffect = "move";
  };

  const handleDragEnter = (e: React.DragEvent, cat: string) => {
    e.preventDefault();
    setDropTarget(cat);
  };

  const handleDragLeave = (e: React.DragEvent, cat: string) => {
    e.preventDefault();
    // Only clear if we actually leave the button element (not just entering a child)
    if (e.relatedTarget && e.currentTarget.contains(e.relatedTarget as Node)) {
        return;
    }
    if (dropTarget === cat) {
        setDropTarget(null);
    }
  };

  const handleDrop = (e: React.DragEvent, folder: string) => {
    e.preventDefault();
    setDropTarget(null);
    const assetId = e.dataTransfer.getData("assetId");
    if (assetId) {
      onDropAsset(assetId, folder);
    }
  };

  return (
    <div className="w-64 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full shrink-0 select-none text-zinc-400">
      {/* App Header */}
      <div className="h-14 flex items-center px-5 border-b border-zinc-800/50">
        <div className="w-6 h-6 bg-zinc-800 rounded flex items-center justify-center mr-3 border border-zinc-700">
          <Database className="text-zinc-200" size={12} />
        </div>
        <span className="font-semibold text-zinc-100 text-sm tracking-tight">AssetFlow 3D</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-6 px-3 space-y-8 custom-scrollbar">
        {/* Dynamic Groups */}
        {sidebarGroups.map((group) => (
          <div key={group.id} className="group/section">
            <div className="px-3 flex items-center justify-between mb-2">
               <h3 className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest truncate">{group.title}</h3>
               <div className="flex items-center gap-1 opacity-50 group-hover/section:opacity-100 transition-opacity">
                 <button 
                   onClick={() => setActiveGroupIdForFolder(group.id)}
                   className="text-zinc-600 hover:text-zinc-300 p-0.5 rounded transition-colors"
                   title="在此分组下新建文件夹"
                 >
                    <Plus size={12} />
                 </button>
                 {group.id.startsWith('custom-') && isAdmin && (
                    <button 
                      onClick={() => {
                        if(window.confirm(`确定删除分组 "${group.title}" 吗?`)) onRemoveGroup(group.id);
                      }}
                      className="text-zinc-600 hover:text-red-400 p-0.5 rounded transition-colors"
                      title="删除分组"
                    >
                        <Trash2 size={12} />
                    </button>
                 )}
               </div>
            </div>
            
            <div className="space-y-0.5">
              {group.items.map((cat) => (
                <div key={cat} className="group/item relative flex items-center">
                  <button
                    onClick={() => onSelectCategory(cat)}
                    onDragOver={handleDragOver}
                    onDragEnter={(e) => handleDragEnter(e, cat)}
                    onDragLeave={(e) => handleDragLeave(e, cat)}
                    onDrop={(e) => handleDrop(e, cat)}
                    className={`w-full flex items-center space-x-3 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ease-out border ${
                      dropTarget === cat 
                        ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' 
                        : currentCategory === cat
                            ? 'bg-zinc-800 text-zinc-100 border-transparent'
                            : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300 border-transparent'
                    }`}
                  >
                    <span className={`${currentCategory === cat || dropTarget === cat ? 'text-zinc-100' : 'text-zinc-600'}`}>
                      {CATEGORY_ICONS[cat] || <FolderOpen size={15} />}
                    </span>
                    <span className="truncate flex-1 text-left">{cat.includes('/') ? cat.split('/')[0].trim() : cat}</span> 
                    {dropTarget === cat && <ArrowRight size={12} className="animate-pulse text-indigo-400" />}
                  </button>
                  
                  {/* Delete Button for Custom Categories */}
                  {!Object.values(DefaultCategory).includes(cat as any) && (
                     <button
                       onClick={(e) => {
                         e.stopPropagation();
                         if(window.confirm(`确定删除文件夹 "${cat}" 吗? 里面的资产类别将清空。`)) onRemoveFolder(group.id, cat);
                       }}
                       className="absolute right-2 opacity-0 group-hover/item:opacity-100 text-zinc-600 hover:text-red-400 transition-opacity p-1"
                     >
                       <XIcon />
                     </button>
                  )}
                </div>
              ))}

              {/* Inline Input for New Folder */}
              {activeGroupIdForFolder === group.id && (
                <div className="px-3 py-1 flex items-center gap-1 animate-enter">
                   <input 
                     ref={inputRef}
                     type="text" 
                     className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500"
                     placeholder="文件夹名称..."
                     value={newFolderName}
                     onChange={(e) => setNewFolderName(e.target.value)}
                     onKeyDown={(e) => {
                       if (e.key === 'Enter') submitFolder();
                       if (e.key === 'Escape') setActiveGroupIdForFolder(null);
                     }}
                     onBlur={submitFolder}
                   />
                </div>
              )}

              {group.items.length === 0 && activeGroupIdForFolder !== group.id && (
                <div className="px-3 py-1 text-[10px] text-zinc-700 italic border-l-2 border-zinc-800 ml-3">
                  空文件夹
                </div>
              )}
            </div>
          </div>
        ))}

        {/* Add Group Section */}
        <div className="px-3">
           {!isCreatingGroup ? (
             <button 
               onClick={() => setIsCreatingGroup(true)}
               className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-zinc-800 rounded text-[10px] text-zinc-600 hover:text-zinc-400 hover:border-zinc-700 transition-colors"
             >
                <FolderPlus size={12} /> 新建分组
             </button>
           ) : (
             <div className="bg-zinc-800/50 p-2 rounded border border-zinc-700 animate-enter">
                <input 
                  ref={inputRef}
                  type="text" 
                  className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1 text-xs text-zinc-200 focus:outline-none focus:border-indigo-500 mb-2"
                  placeholder="分组名称..."
                  value={newGroupName}
                  onChange={(e) => setNewGroupName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitGroup();
                    if (e.key === 'Escape') setIsCreatingGroup(false);
                  }}
                />
                <div className="flex gap-2 justify-end">
                   <button onClick={() => setIsCreatingGroup(false)} className="p-1 hover:text-white"><XMark size={12}/></button>
                   <button onClick={submitGroup} className="p-1 text-emerald-500 hover:text-emerald-400"><Check size={12}/></button>
                </div>
             </div>
           )}
        </div>

        <div className="h-px bg-zinc-800 mx-3" />

        {/* Dynamic Projects Section */}
        <div>
          <h3 className="px-3 text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-2">项目 (Projects)</h3>
          <div className="space-y-0.5">
            {availableProjects.length === 0 ? (
               <div className="px-3 text-xs text-zinc-700 italic">暂无项目</div>
            ) : (
              availableProjects.map((project) => (
                <button
                  key={project}
                  onClick={() => onSelectProject(project)}
                  className={`w-full flex items-center space-x-3 px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ease-out ${
                    currentCategory === project
                      ? 'bg-zinc-800 text-zinc-100'
                      : 'text-zinc-500 hover:bg-zinc-800/50 hover:text-zinc-300'
                  }`}
                >
                  <Briefcase size={15} className={`${currentCategory === project ? 'text-zinc-100' : 'text-zinc-600'}`} />
                  <span className="truncate">{project}</span>
                </button>
              ))
            )}
          </div>
        </div>
      </nav>

      {/* Footer / Settings or User Info */}
      <div className="p-3 border-t border-zinc-800 bg-zinc-900/50">
        {isAdmin ? (
          <button 
            onClick={onOpenPreferences}
            className="flex items-center space-x-3 text-zinc-500 hover:text-zinc-200 w-full px-2 py-2 text-xs font-medium transition-colors hover:bg-zinc-800 rounded-md"
          >
            <Settings size={15} />
            <span className="flex-1 text-left">设置 (Settings)</span>
            <ShieldCheck size={12} className="text-emerald-500" />
          </button>
        ) : (
          <div className="flex items-center space-x-3 text-zinc-500 px-2 py-2 text-xs font-medium rounded-md bg-zinc-900/30">
             <div className="w-5 h-5 rounded-full bg-indigo-500/20 flex items-center justify-center border border-indigo-500/30 text-indigo-400">
               <User size={10} />
             </div>
             <span className="truncate">{currentUser || 'Guest'}</span>
          </div>
        )}
      </div>
    </div>
  );
};

// Mini X Icon component for deletion
const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
);