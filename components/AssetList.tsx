import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Asset, ViewMode } from '../types';
import { FolderOpen, Play, Link as LinkIcon, Map as MapIcon } from 'lucide-react';

interface AssetListProps {
  assets: Asset[];
  viewMode: ViewMode;
  onAssetClick: (asset: Asset) => void;
  onAssetDoubleClick: (asset: Asset) => void;
}

const CHUNK_SIZE = 40;

const BOUND_PATH_PREFIX = '\\\\192.168.28.28\\市场美术\\3D美术\\道具\\绑定的道具';
const ENV_ART_PATH_PREFIX = '\\\\192.168.28.28\\市场美术\\3D美术\\场景模型\\地编组制作';

const AssetCard = React.memo(({ asset, onClick, onDoubleClick, onFolderClick }: { 
  asset: Asset; 
  onClick: () => void; 
  onDoubleClick: () => void; 
  onFolderClick: (path: string, e: React.MouseEvent) => void;
}) => {
  const isBound = asset.path.includes(BOUND_PATH_PREFIX);
  const isEnvArt = asset.path.includes(ENV_ART_PATH_PREFIX);
  const displayImage = asset.previewUrl || asset.thumbnailUrl;

  return (
    <div 
      className="asset-card-container break-inside-avoid mb-6 group relative flex flex-col perspective-1000"
      onClick={onClick}
      onDoubleClick={onDoubleClick}
      draggable="true"
      onDragStart={(e) => {
        e.dataTransfer.setData("assetId", asset.id);
        e.dataTransfer.effectAllowed = "move";
      }}
    >
      <div className="bg-zinc-900/60 rounded-xl overflow-hidden border border-zinc-800/60 group-hover:border-indigo-500/40 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] shadow-sm hover:shadow-[0_15px_40px_-10px_rgba(0,0,0,0.6)] cursor-grab active:cursor-grabbing hover:-translate-y-1 relative backdrop-blur-sm group-hover:bg-zinc-800/80">
        
        {/* Hover Glow Effect */}
        <div className="absolute inset-0 bg-gradient-to-b from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none z-10" />

        {/* Image/Video Thumbnail - Waterfall Friendly: h-auto allows natural height */}
        <div className="relative bg-zinc-950 w-full group/image">
          <img 
            src={displayImage} 
            alt={asset.name} 
            className="w-full h-auto block object-cover will-change-transform"
            loading="lazy" 
            decoding="async"
            draggable="false" 
          />
          
          {asset.type === 'video' && (
            <div className="absolute inset-0 flex items-center justify-center opacity-70 group-hover:opacity-100 transition-opacity z-20">
               <div className="bg-black/40 p-3 rounded-full backdrop-blur-md border border-white/10 group-hover:scale-110 transition-transform duration-300">
                  <Play size={20} className="text-white fill-white"/>
               </div>
            </div>
          )}
          
          <div className="absolute top-3 left-3 flex gap-1 opacity-0 group-hover:opacity-100 transition-all duration-300 translate-y-2 group-hover:translate-y-0 z-20">
             <span className={`px-2 py-0.5 text-[9px] font-bold rounded-full shadow-lg text-zinc-950 backdrop-blur-md ${
              asset.quality === 'S' ? 'bg-amber-300/90' :
              asset.quality === 'A' ? 'bg-emerald-300/90' : 'bg-zinc-300/90'
            }`}>
              {asset.quality}
            </span>
          </div>
        </div>

        {/* Metadata Footer */}
        <div className="p-3 bg-zinc-900/40 border-t border-zinc-800/50 group-hover:border-zinc-700/30 transition-colors">
          <div className="flex justify-between items-start mb-1.5">
            <h3 className="font-medium text-zinc-300 text-xs truncate pr-2 leading-tight select-none group-hover:text-zinc-100 transition-colors" title={asset.name}>
              {asset.name}
            </h3>
          </div>
          
          <div className="flex flex-wrap gap-1 mb-2.5 min-h-[1.25rem]">
            {isBound && (
              <span className="text-[9px] flex items-center gap-0.5 text-purple-300 bg-purple-900/20 px-1.5 py-0.5 rounded border border-purple-500/20 select-none">
                <LinkIcon size={8} /> 绑定
              </span>
            )}
            {isEnvArt && (
              <span className="text-[9px] flex items-center gap-0.5 text-cyan-300 bg-cyan-900/20 px-1.5 py-0.5 rounded border border-cyan-500/20 select-none">
                <MapIcon size={8} /> 地编
              </span>
            )}
            {(asset.aiTags && asset.aiTags.length > 0 ? asset.aiTags : asset.tags).slice(0, 3).map(tag => (
              <span key={tag} className="text-[9px] text-zinc-500 bg-zinc-800/50 px-1.5 py-0.5 rounded border border-zinc-700/30 select-none group-hover:border-zinc-600/50 transition-colors">
                {tag}
              </span>
            ))}
          </div>

          <div 
            onClick={(e) => onFolderClick(asset.path, e)}
            className="flex items-center text-[10px] text-zinc-600 space-x-1 hover:text-indigo-400 transition-colors cursor-pointer group/folder" 
            title="点击复制路径"
          >
             <FolderOpen size={10} className="group-hover/folder:text-indigo-400 transition-colors"/>
             <span className="truncate opacity-70 group-hover:opacity-100 transition-opacity">
                {asset.path.split('\\').pop() || asset.path}
             </span>
          </div>
        </div>
      </div>
    </div>
  );
});

const AssetRow = React.memo(({ asset, index, onClick, onDoubleClick, onFolderClick }: { 
    asset: Asset; 
    index: number;
    onClick: () => void; 
    onDoubleClick: () => void; 
    onFolderClick: (path: string, e: React.MouseEvent) => void;
}) => {
    const isBound = asset.path.includes(BOUND_PATH_PREFIX);
    const isEnvArt = asset.path.includes(ENV_ART_PATH_PREFIX);
    const displayImage = asset.previewUrl || asset.thumbnailUrl;

    return (
        <tr 
          className="hover:bg-zinc-800/50 transition-colors group cursor-pointer border-b border-zinc-800/30 last:border-0 content-visibility-auto"
          onClick={onClick}
          onDoubleClick={onDoubleClick}
          draggable="true"
          onDragStart={(e) => {
            e.dataTransfer.setData("assetId", asset.id);
            e.dataTransfer.effectAllowed = "move";
          }}
        >
          <td className="px-4 py-3 text-center text-xs text-zinc-600">{index + 1}</td>
          <td className="px-4 py-3">
            <div className="w-12 h-9 rounded-md bg-zinc-800 overflow-hidden border border-zinc-700/50 relative group-hover:border-zinc-500 transition-all shadow-sm">
               <img 
                 src={displayImage} 
                 className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-500" 
                 alt="" 
                 draggable="false" 
                 loading="lazy" 
               />
               {asset.type === 'video' && (
                 <div className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[1px]">
                    <Play size={10} className="text-white fill-white"/>
                 </div>
               )}
            </div>
          </td>
          <td className="px-4 py-3 font-medium text-zinc-300 group-hover:text-white transition-colors text-xs">{asset.name}</td>
          <td className="px-4 py-3">
            <button 
              onClick={(e) => onFolderClick(asset.path, e)}
              className="flex items-center space-x-1.5 text-[10px] px-2 py-1 rounded bg-zinc-900/50 border border-zinc-800 text-zinc-500 hover:border-indigo-500/30 hover:bg-indigo-500/10 hover:text-indigo-300 transition-all max-w-[200px]"
              title="点击复制路径"
            >
               <FolderOpen size={10} />
               <span className="truncate">{asset.path}</span>
            </button>
          </td>
          <td className="px-4 py-3">
            <span className="px-2 py-0.5 bg-zinc-900 rounded text-[10px] border border-zinc-800 text-zinc-400">{asset.project}</span>
          </td>
          <td className="px-4 py-3">
             <div className="flex items-center">
                <span className={`w-2 h-2 rounded-full inline-block mr-2 shadow-sm ${
                  asset.quality === 'S' ? 'bg-amber-400 shadow-amber-900/20' :
                  asset.quality === 'A' ? 'bg-emerald-400 shadow-emerald-900/20' : 'bg-zinc-600'
                }`}></span>
                <span className="text-xs text-zinc-400">{asset.quality}</span>
             </div>
          </td>
          <td className="px-4 py-3">
            <div className="flex flex-wrap gap-1 max-w-xs">
                {isBound && (
                  <span className="text-[10px] text-purple-400 bg-purple-900/20 px-1 rounded border border-purple-500/20">已绑定</span>
                )}
                {isEnvArt && (
                  <span className="text-[10px] text-cyan-400 bg-cyan-900/20 px-1 rounded border border-cyan-500/20">地编组</span>
                )}
                {(asset.aiTags && asset.aiTags.length > 0 ? asset.aiTags : asset.tags).slice(0, 3).map(t => (
                    <span key={t} className="text-[10px] text-zinc-500 bg-zinc-800/50 px-1 rounded">{t}</span>
                ))}
            </div>
          </td>
        </tr>
    );
});


export const AssetList: React.FC<AssetListProps> = ({ assets, viewMode, onAssetClick, onAssetDoubleClick }) => {
  const [displayedCount, setDisplayedCount] = useState(CHUNK_SIZE);
  const observerTarget = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setDisplayedCount(CHUNK_SIZE);
  }, [assets]);

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          setDisplayedCount(prev => Math.min(prev + CHUNK_SIZE, assets.length));
        }
      },
      { threshold: 0.1, rootMargin: '400px' }
    );

    if (observerTarget.current) {
      observer.observe(observerTarget.current);
    }

    return () => {
      if (observerTarget.current) observer.unobserve(observerTarget.current);
    };
  }, [assets]);

  const visibleAssets = assets.slice(0, displayedCount);

  const handleOpenFolder = useCallback(async (path: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(path);
    } catch (err) {
      console.error(err);
    }
  }, []);

  if (viewMode === ViewMode.GRID) {
    return (
      <div className="h-full overflow-y-auto p-6 pb-24 scroll-smooth" style={{ overflowAnchor: 'none' }}>
        <div className="masonry-grid animate-slide-up">
          {visibleAssets.map((asset) => (
            <AssetCard 
              key={asset.id} 
              asset={asset} 
              onClick={() => onAssetClick(asset)}
              onDoubleClick={() => onAssetDoubleClick(asset)}
              onFolderClick={handleOpenFolder}
            />
          ))}
        </div>
        
        <div ref={observerTarget} className="h-20 w-full flex items-center justify-center p-4">
           {displayedCount < assets.length && (
              <span className="text-zinc-600 text-xs flex items-center gap-2">
                 <div className="w-1.5 h-1.5 bg-zinc-600 rounded-full animate-bounce"></div>
                 加载更多... ({displayedCount} / {assets.length})
              </span>
           )}
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto bg-zinc-950/50 animate-slide-up" style={{ overflowAnchor: 'none' }}>
      <table className="w-full text-left text-sm text-zinc-500">
        <thead className="bg-zinc-900/90 text-zinc-400 font-medium sticky top-0 z-10 shadow-sm border-b border-zinc-800 backdrop-blur-md">
          <tr>
            <th className="px-4 py-3 w-12 text-center text-xs">#</th>
            <th className="px-4 py-3 w-20 text-xs">预览</th>
            <th className="px-4 py-3 text-xs">名称</th>
            <th className="px-4 py-3 w-48 text-xs">文件路径</th>
            <th className="px-4 py-3 text-xs">项目</th>
            <th className="px-4 py-3 text-xs">质量</th>
            <th className="px-4 py-3 text-xs">标签</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-zinc-800/30">
          {visibleAssets.map((asset, index) => (
             <AssetRow 
               key={asset.id} 
               asset={asset} 
               index={index} 
               onClick={() => onAssetClick(asset)}
               onDoubleClick={() => onAssetDoubleClick(asset)}
               onFolderClick={handleOpenFolder}
             />
          ))}
        </tbody>
      </table>
      
      <div ref={observerTarget} className="h-10 w-full flex items-center justify-center p-4">
           {displayedCount < assets.length && (
              <span className="text-zinc-600 text-xs">加载更多... ({displayedCount} / {assets.length})</span>
           )}
      </div>
    </div>
  );
};