
import React, { useState, useRef, useEffect } from 'react';
import { Asset } from '../types';
import { generateAssetTags, urlToBase64, compressToWebP, convertToPngBlob } from '../services/geminiService';
import { 
  X, 
  Minus, 
  Plus, 
  Maximize, 
  FolderOpen, 
  Tag, 
  Info,
  Clock,
  Database,
  Hash,
  ChevronRight,
  Monitor,
  Check,
  Sparkles,
  Loader2,
  RefreshCw,
  Briefcase,
  Copy,
  Video,
  Play,
  Trash2,
  Link as LinkIcon,
  Map as MapIcon,
  AlertTriangle,
  Upload,
  ImagePlus
} from 'lucide-react';

interface AssetDetailViewProps {
  asset: Asset;
  isAdmin: boolean;
  onClose: () => void;
  onUpdateAsset: (updatedAsset: Asset) => void;
  onDeleteAsset: (id: string) => void;
}

const BOUND_PATH_PREFIX = '\\\\192.168.28.28\\市场美术\\3D美术\\道具\\绑定的道具';
const ENV_ART_PATH_PREFIX = '\\\\192.168.28.28\\市场美术\\3D美术\\场景模型\\地编组制作';

export const AssetDetailView: React.FC<AssetDetailViewProps> = ({ asset, isAdmin, onClose, onUpdateAsset, onDeleteAsset }) => {
  // Initial scale set to 0.85 for better visibility
  const [scale, setScale] = useState(0.85);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [showCopyToast, setShowCopyToast] = useState(false);
  
  // Delete State
  const [deleteStage, setDeleteStage] = useState<'idle' | 'confirm'>('idle');
  
  // AI Tagging State
  const [isGeneratingTags, setIsGeneratingTags] = useState(false);

  // Manual Tagging State
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [newTagValue, setNewTagValue] = useState("");
  
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const tagInputRef = useRef<HTMLInputElement>(null);

  const isBound = asset.path.includes(BOUND_PATH_PREFIX);
  const isEnvArt = asset.path.includes(ENV_ART_PATH_PREFIX);
  
  // Display WebP if available, fallback to high-res
  const displayImage = asset.previewUrl || asset.thumbnailUrl;

  // Focus tag input when adding
  useEffect(() => {
    if (isAddingTag && tagInputRef.current) {
        tagInputRef.current.focus();
    }
  }, [isAddingTag]);

  // --- Logic Handlers ---

  const handleDeleteClick = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();

    // Permission Check
    if (!isAdmin) {
       alert("权限拒绝：您没有删除资产的管理员权限。");
       return;
    }
    
    // 2-Stage Deletion Logic
    if (deleteStage === 'idle') {
        setDeleteStage('confirm');
        // Auto reset after 3 seconds if not confirmed
        setTimeout(() => setDeleteStage('idle'), 3000);
    } else {
        // Confirmed
        onDeleteAsset(asset.id);
        onClose();
    }
  };

  const handleCopyImage = async () => {
    try {
      // Attempt to convert to PNG Blob (Standard format for Clipboard)
      // This handles CORS (if allowed), Format (WebP->PNG), and ensures clean data
      // We use the displayImage (usually WebP/DataURL) as it's likely already loaded
      const blob = await convertToPngBlob(displayImage);
      
      await navigator.clipboard.write([
        new ClipboardItem({
          [blob.type]: blob,
        }),
      ]);
      
      setShowCopyToast(true);
      setTimeout(() => setShowCopyToast(false), 2000);
    } catch (err) {
      console.error('Failed to copy image:', err);
      // If it fails (likely CORS or Security), fallback
      try {
          await navigator.clipboard.writeText(asset.path);
          alert('图片复制失败 (可能是跨域限制或格式问题)。\n\n已为您复制文件路径:\n' + asset.path);
      } catch (e) {
          alert('复制失败。');
      }
    }
  };

  const handleGenerateAiTags = async () => {
    setIsGeneratingTags(true);
    try {
      // Use display image (WebP is fine for analysis)
      const base64Data = await urlToBase64(displayImage);
      const newTags = await generateAssetTags(base64Data);
      
      const updatedAsset = {
        ...asset,
        aiTags: newTags
      };
      
      onUpdateAsset(updatedAsset);
    } catch (e) {
      alert("生成标签失败，请检查网络或 Key 是否有效。");
      console.error(e);
    } finally {
      setIsGeneratingTags(false);
    }
  };

  const handleOpenFolder = async () => {
    try {
        await navigator.clipboard.writeText(asset.path);
        // Silent copy, no alert
    } catch (e) {
        console.error(e);
    }
  };

  // --- Manual Tags Logic ---
  const handleAddTag = () => {
      if (!newTagValue.trim()) {
          setIsAddingTag(false);
          return;
      }
      const tag = newTagValue.trim();
      if (!asset.tags.includes(tag)) {
          onUpdateAsset({
              ...asset,
              tags: [...asset.tags, tag]
          });
      }
      setNewTagValue("");
      setIsAddingTag(false);
  };

  const handleRemoveTag = (tagToRemove: string) => {
      onUpdateAsset({
          ...asset,
          tags: asset.tags.filter(t => t !== tagToRemove)
      });
  };

  // --- Image Replace Logic ---
  const handleReplaceImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
        const file = e.target.files[0];
        try {
            // Compress and get Data URL
            const webpUrl = await compressToWebP(file, 0.8);
            
            // We update both thumbnail and preview to keep it simple for now, 
            // or we could keep original if we wanted to upload raw.
            // Here we just use the optimized version for display.
            onUpdateAsset({
                ...asset,
                thumbnailUrl: webpUrl,
                previewUrl: webpUrl
            });
        } catch (err) {
            console.error(err);
            alert("图片处理失败");
        }
    }
  };


  // --- Keyboard Shortcuts ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Close
      if (e.key === 'Escape') {
        onClose();
      }
      
      // Copy Image
      if ((e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault();
        handleCopyImage();
      }

      // Delete Shortcut - Only for Admins
      if (e.key === 'Delete' || e.key === 'Backspace') {
          // If editing a text field, don't trigger delete
          if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') {
              return;
          }

          if (isAdmin) {
             // Trigger the visual confirm stage or delete if already confirming
             if (deleteStage === 'idle') {
                 setDeleteStage('confirm');
                 setTimeout(() => setDeleteStage('idle'), 3000);
             } else {
                 onDeleteAsset(asset.id);
                 onClose();
             }
          }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose, asset, isAdmin, deleteStage, onDeleteAsset]);


  // --- Zoom & Pan Logic (Only for Images) ---
  const handleWheel = (e: React.WheelEvent) => {
    if (asset.type === 'video') return;
    e.stopPropagation(); 
    const scaleAmount = -e.deltaY * 0.001;
    const newScale = Math.min(Math.max(0.1, scale + scaleAmount), 5);
    setScale(newScale);
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (asset.type === 'video') return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging && asset.type !== 'video') {
      setPosition({
        x: e.clientX - dragStart.x,
        y: e.clientY - dragStart.y
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Reset view on open
  useEffect(() => {
    setScale(0.85); // Reset to reasonable size
    setPosition({ x: 0, y: 0 });
    setDeleteStage('idle');
  }, [asset]);


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/80 backdrop-blur-md animate-enter select-none p-4 md:p-8">
      
      {/* Toast Notification */}
      {showCopyToast && (
        <div className="absolute top-10 left-1/2 transform -translate-x-1/2 z-[70] bg-zinc-800 text-white px-5 py-2.5 rounded-full shadow-2xl border border-zinc-600 flex items-center gap-2 animate-enter">
          <Check size={16} className="text-emerald-400"/>
          <span className="text-sm font-medium">图片已复制到剪贴板</span>
        </div>
      )}

      {/* Main Glass Panel Container */}
      <div className="glass-panel w-full h-full max-w-[1600px] max-h-[90vh] rounded-3xl overflow-hidden flex shadow-2xl flex-col md:flex-row relative ring-1 ring-white/10">
         
         {/* Close Button Mobile/Absolute */}
         <button onClick={onClose} className="absolute top-4 right-4 z-50 p-2 bg-black/50 hover:bg-red-500/20 text-zinc-400 hover:text-white rounded-full backdrop-blur-md transition-all md:hidden">
            <X size={20} />
         </button>

        {/* --- Left: Canvas (Image or Video) --- */}
        <div className="flex-1 relative flex flex-col bg-black overflow-hidden group/canvas">
          
          {/* Top Toolbar */}
          <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 bg-gradient-to-b from-zinc-900/90 to-transparent shrink-0 z-10 backdrop-blur-sm">
            <div className="flex items-center space-x-4 text-xs font-medium text-zinc-500">
               <span className="flex items-center gap-2 text-zinc-400">
                  <Monitor size={14} /> 3D 资产库
               </span>
               <ChevronRight size={14} className="opacity-30" />
               <span className="text-zinc-200 max-w-[200px] truncate flex items-center gap-2 font-semibold tracking-wide">
                  {asset.type === 'video' && <Video size={14} className="text-blue-400"/>}
                  {asset.name}
               </span>
            </div>
            
            <div className="flex items-center gap-4">
                {asset.type === 'image' && (
                  <div className="flex items-center space-x-2 bg-black/40 p-1.5 rounded-full border border-white/10 opacity-0 group-hover/canvas:opacity-100 transition-all duration-500 transform translate-y-[-10px] group-hover/canvas:translate-y-0">
                     <span className="text-[10px] text-zinc-400 w-10 text-center font-mono">{Math.round(scale * 100)}%</span>
                     <button onClick={() => setScale(s => Math.max(0.1, s - 0.25))} className="p-1 hover:bg-white/10 rounded-full text-zinc-400"><Minus size={14}/></button>
                     <div className="w-16 bg-zinc-800 h-1 rounded-full overflow-hidden">
                        <div className="bg-zinc-400 h-full transition-all" style={{ width: `${(scale / 5) * 100}%` }}></div>
                     </div>
                     <button onClick={() => setScale(s => Math.min(5, s + 0.25))} className="p-1 hover:bg-white/10 rounded-full text-zinc-400"><Plus size={14}/></button>
                     <button onClick={() => { setScale(0.85); setPosition({x:0,y:0}); }} className="p-1 hover:bg-white/10 rounded-full ml-1 text-zinc-400" title="重置视图"><Maximize size={14}/></button>
                  </div>
                )}

                <div className="flex items-center gap-3">
                   {/* Replace Image Button (Admin Only) */}
                   {isAdmin && (
                       <>
                         <button 
                            onClick={() => fileInputRef.current?.click()}
                            className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/40 hover:bg-zinc-700/60 text-zinc-300 hover:text-white rounded-lg text-xs transition-colors border border-white/5 hover:border-white/10 shadow-sm"
                            title="替换预览图"
                         >
                            <ImagePlus size={12}/> 替换封面
                         </button>
                         <input 
                            type="file" 
                            ref={fileInputRef} 
                            onChange={handleReplaceImage} 
                            accept="image/*" 
                            className="hidden" 
                         />
                       </>
                   )}

                   {asset.type === 'image' && (
                      <button 
                        onClick={handleCopyImage}
                        className="hidden md:flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800/40 hover:bg-zinc-700/60 text-zinc-300 hover:text-white rounded-lg text-xs transition-colors border border-white/5 hover:border-white/10 shadow-sm"
                        title="复制图片 (Ctrl+C)"
                      >
                          <Copy size={12}/> 复制
                      </button>
                   )}
                   
                   {/* DELETE BUTTON - Only if Admin */}
                   {isAdmin && (
                      <button 
                          onClick={handleDeleteClick}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs transition-all border shadow-sm ${
                             deleteStage === 'confirm' 
                             ? 'bg-red-600 hover:bg-red-500 text-white border-red-500 animate-pulse' 
                             : 'bg-zinc-800/40 hover:bg-red-500/10 text-red-400 hover:text-red-300 border-white/5 hover:border-red-500/30'
                          }`}
                          title={deleteStage === 'confirm' ? "确认删除? (再次点击)" : "删除资产 (Delete / Del)"}
                      >
                          {deleteStage === 'confirm' ? <AlertTriangle size={12} className="text-white"/> : <Trash2 size={12}/>}
                          {deleteStage === 'confirm' ? '确认删除?' : '删除'}
                      </button>
                   )}
                </div> 
            </div>
          </div>

          {/* Interactive Canvas */}
          <div 
            ref={containerRef}
            className="flex-1 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing"
            onWheel={handleWheel}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          >
             {/* Dark Background with softer noise */}
             <div className="absolute inset-0 bg-[#000000]"></div>
             
             {/* Softer Noise Pattern (Reduced opacity) */}
             <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.02] mix-blend-overlay pointer-events-none"></div>
             
             {/* Vignette for cinematic look */}
             <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_0%,rgba(0,0,0,0.8)_100%)] pointer-events-none"></div>
             
             {/* Subtle Grid Pattern */}
             <div className="absolute inset-0 opacity-[0.03] pointer-events-none" 
                  style={{ 
                    backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', 
                    backgroundSize: '40px 40px' 
                  }}>
             </div>

             {asset.type === 'video' ? (
                // VIDEO PLAYER
                <div className="w-full h-full flex items-center justify-center p-8 cursor-default z-10" onMouseDown={(e) => e.stopPropagation()}>
                   <video 
                      ref={videoRef}
                      src={asset.videoUrl || asset.thumbnailUrl} // Fallback to thumb if videoUrl not present
                      controls
                      autoPlay
                      loop
                      className="max-w-full max-h-full rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.5)] ring-1 ring-white/10"
                   />
                </div>
             ) : (
                // IMAGE VIEWER
                <>
                  <div 
                    className="relative transition-transform duration-[0.05s] ease-linear pointer-events-none select-none z-10"
                    style={{
                      transform: `translate(${position.x}px, ${position.y}px) scale(${scale})`
                    }}
                  >
                     <img 
                        src={displayImage} 
                        alt="Full View" 
                        className="max-w-none shadow-[0_50px_100px_-20px_rgba(0,0,0,0.9)] rounded-sm ring-1 ring-white/10"
                        draggable={false}
                      />
                  </div>
                  
                   {/* Navigator (only for image) */}
                  <div className="absolute bottom-6 right-6 w-40 h-28 bg-zinc-900/80 border border-white/10 shadow-2xl rounded-xl overflow-hidden flex items-center justify-center z-20 group opacity-0 group-hover/canvas:opacity-100 transition-all duration-500 translate-y-4 group-hover/canvas:translate-y-0 backdrop-blur-md">
                      <img src={displayImage} className="w-full h-full object-contain opacity-50" alt="nav" />
                      <div 
                        className="absolute border border-indigo-400/50 bg-indigo-500/10 shadow-[0_0_15px_rgba(99,102,241,0.3)]"
                        style={{
                          width: `${Math.min(100, 100/scale)}%`,
                          height: `${Math.min(100, 100/scale)}%`,
                          transform: `translate(${-position.x / 10}px, ${-position.y / 10}px)`
                        }}
                      ></div>
                  </div>
                </>
             )}
          </div>
        </div>

        {/* --- Right: Information Sidebar --- */}
        <div className="w-full md:w-96 border-l border-white/5 bg-zinc-900/80 flex flex-col shrink-0 h-full backdrop-blur-2xl">
          {/* Header */}
          <div className="h-16 border-b border-white/5 flex items-center justify-between px-6 shrink-0 bg-white/[0.02]">
            <span className="font-semibold text-xs text-zinc-300 uppercase tracking-widest flex items-center gap-2">
              <Info size={14} className="text-indigo-400"/> 属性面板
            </span>
            <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-full">
              <X size={18} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto custom-scrollbar p-6 space-y-8">
            
            {/* Colors / Info */}
            {asset.type === 'video' && (
               <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-center gap-3">
                  <div className="p-2 bg-blue-500/20 rounded-lg">
                    <Video className="text-blue-400" size={18}/>
                  </div>
                  <div>
                     <h4 className="text-xs font-bold text-blue-100">视频资产</h4>
                     <p className="text-[10px] text-blue-300/70">MP4 / WebM / GIF 动画</p>
                  </div>
               </div>
            )}

            {/* AI Tags Section (Doubao) */}
            <div className="relative group">
               <div className="flex justify-between items-center mb-3">
                 <h3 className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider flex items-center gap-1.5">
                   <Sparkles size={12} className="text-indigo-400" /> 豆包 AI 智能标签
                 </h3>
                 {(
                  <button 
                      onClick={handleGenerateAiTags}
                      disabled={isGeneratingTags}
                      className="text-[10px] text-indigo-300 hover:text-white flex items-center gap-1.5 transition-colors bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded-md border border-indigo-500/20"
                  >
                      {isGeneratingTags ? <Loader2 size={10} className="animate-spin"/> : <RefreshCw size={10} />}
                      {asset.aiTags && asset.aiTags.length > 0 ? '重新分析' : '智能分析'}
                  </button>
                 )}
               </div>
               
               <div className="flex flex-col gap-2 mb-2">
                  {isBound && (
                    <span className="px-2.5 py-1 bg-purple-500/10 hover:bg-purple-500/20 rounded border border-purple-500/30 text-xs text-purple-300 transition-colors cursor-default select-all flex items-center gap-1.5 w-fit">
                      <LinkIcon size={12}/> 已绑定
                    </span>
                  )}
                  {isEnvArt && (
                    <span className="px-2.5 py-1 bg-cyan-500/10 hover:bg-cyan-500/20 rounded border border-cyan-500/30 text-xs text-cyan-300 transition-colors cursor-default select-all flex items-center gap-1.5 w-fit">
                      <MapIcon size={12}/> 地编组制作
                    </span>
                  )}
               </div>

               {asset.aiTags && asset.aiTags.length > 0 ? (
                 <div className="flex flex-wrap gap-2">
                   {asset.aiTags.map(tag => (
                     <span key={tag} className="px-2.5 py-1 bg-white/5 hover:bg-indigo-500/20 rounded-md text-xs text-zinc-300 hover:text-indigo-200 border border-white/5 hover:border-indigo-500/30 transition-all cursor-default select-all shadow-sm">
                       {tag}
                     </span>
                   ))}
                 </div>
               ) : (
                 <div className="text-xs text-zinc-500 italic border border-dashed border-zinc-800 rounded-xl p-4 text-center bg-black/20">
                   暂无标签。点击“智能分析”让豆包模型自动识别。
                 </div>
               )}
            </div>

            <div className="h-px bg-white/5 w-full" />

            {/* Manual Tags */}
            <div>
              <div className="flex justify-between items-center mb-3">
                 <h3 className="text-[10px] font-bold text-zinc-500 uppercase tracking-wider">手动标签</h3>
                 {!isAddingTag && (
                     <button 
                        onClick={() => setIsAddingTag(true)}
                        className="text-[10px] text-zinc-500 hover:text-zinc-300 flex items-center gap-1 transition-colors hover:bg-white/5 px-2 py-1 rounded transition-silky"
                     >
                        <Plus size={10}/> 添加
                     </button>
                 )}
              </div>
              
              <div className="flex flex-wrap gap-2">
                {asset.tags.map(tag => (
                  <span key={tag} className="px-2.5 py-1 bg-zinc-800/50 hover:bg-zinc-700 rounded-md text-xs text-zinc-400 border border-zinc-700/50 hover:border-zinc-600 transition-colors flex items-center gap-1 group shadow-sm">
                    <Tag size={10} className="text-zinc-600 group-hover:text-zinc-400"/> {tag}
                    {(
                        <button 
                            onClick={(e) => { e.stopPropagation(); handleRemoveTag(tag); }}
                            className="ml-1 text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                            <X size={10} />
                        </button>
                    )}
                  </span>
                ))}
                
                {/* Input for new tag */}
                {isAddingTag && (
                    <div className="flex items-center gap-1 animate-enter">
                        <input 
                            ref={tagInputRef}
                            type="text" 
                            className="bg-zinc-900 border border-indigo-500/50 rounded-md px-2 py-1 text-xs text-zinc-200 w-20 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            value={newTagValue}
                            onChange={(e) => setNewTagValue(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') handleAddTag();
                                if (e.key === 'Escape') setIsAddingTag(false);
                            }}
                            onBlur={handleAddTag}
                        />
                    </div>
                )}
              </div>
            </div>

            <div className="h-px bg-white/5 w-full" />

            {/* Location / Action */}
            <div>
               <h3 className="text-[10px] font-bold text-zinc-500 uppercase mb-3 tracking-wider">源文件路径</h3>
               <div 
                 onClick={handleOpenFolder}
                 className="group cursor-pointer bg-black/20 hover:bg-indigo-500/10 border border-white/5 hover:border-indigo-500/30 p-4 rounded-xl transition-all duration-300 relative overflow-hidden"
               >
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000 pointer-events-none"></div>
                  <div className="flex items-center gap-2 mb-2 text-zinc-300 group-hover:text-indigo-300 transition-colors">
                     <FolderOpen size={14} />
                     <span className="text-xs font-semibold">点击复制本地路径</span>
                  </div>
                  <div className="text-[10px] text-zinc-500 font-mono break-all leading-relaxed opacity-80 group-hover:opacity-100">
                     {asset.path}
                  </div>
               </div>
            </div>

            <div className="h-px bg-white/5 w-full" />

            {/* Basic Info Table */}
            <div>
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase mb-3 tracking-wider">元数据 (Metadata)</h3>
              <div className="space-y-3 text-xs bg-white/5 p-5 rounded-xl border border-white/5">
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 flex items-center gap-2"><Info size={12}/> 名称</span>
                  <span className="text-zinc-300 select-all font-medium text-right max-w-[150px] truncate">{asset.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 flex items-center gap-2"><Database size={12}/> 来源</span>
                  <span className="text-zinc-300">{asset.source}</span>
                </div>
                 <div className="flex justify-between items-center">
                  <span className="text-zinc-500 flex items-center gap-2"><Briefcase size={12}/> 项目</span>
                  <span className="text-zinc-300">{asset.project}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 flex items-center gap-2"><Hash size={12}/> 资产 ID</span>
                  <span className="text-zinc-300 font-mono text-[10px] opacity-60">{asset.id}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-zinc-500 flex items-center gap-2"><Clock size={12}/> 修改时间</span>
                  <span className="text-zinc-300">{new Date(asset.lastModified).toLocaleDateString()}</span>
                </div>
              </div>
            </div>

            {/* Notes Area */}
            <div>
              <h3 className="text-[10px] font-bold text-zinc-500 uppercase mb-2 tracking-wider">备注</h3>
              <textarea 
                className={`w-full bg-black/20 border border-white/10 rounded-xl p-4 text-xs text-zinc-300 focus:outline-none focus:border-indigo-500/50 focus:bg-black/40 h-24 resize-none transition-all placeholder-zinc-700`}
                placeholder="添加个人备注..."
              ></textarea>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
};