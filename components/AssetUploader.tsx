

import React, { useState, useRef, useEffect } from 'react';
import { Asset, Category, DefaultCategory, AssetType } from '../types';
import { generateAssetTags, fileToGenerativePart, extractVideoFrame, compressToWebP } from '../services/geminiService';
import { X, Upload, Loader2, Plus, Check, FileSpreadsheet, FileImage, Video } from 'lucide-react';

interface AssetUploaderProps {
  onClose: () => void;
  onAdd: (assets: Asset[]) => void;
  availableCategories?: string[]; // New prop for dynamic folders
}

type Mode = 'single' | 'batch';

export const AssetUploader: React.FC<AssetUploaderProps> = ({ onClose, onAdd, availableCategories = [] }) => {
  const [mode, setMode] = useState<Mode>('single');
  
  // Single Mode State
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>(''); // For UI display (WebP preferred)
  const [originalThumbnailUrl, setOriginalThumbnailUrl] = useState<string>(''); // Original for storage/copy
  const [videoSourceUrl, setVideoSourceUrl] = useState<string>(''); // For actual video playback
  const [assetType, setAssetType] = useState<AssetType>('image');

  const [tags, setTags] = useState<string[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [name, setName] = useState('');
  const [path, setPath] = useState('');
  const [category, setCategory] = useState<Category>(DefaultCategory.PROPS);

  // Batch Mode State
  const [pasteContent, setPasteContent] = useState('');
  const [parsedAssets, setParsedAssets] = useState<Asset[]>([]);
  const [batchCategory, setBatchCategory] = useState<Category>(DefaultCategory.PROPS);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fallback if availableCategories is empty or undefined
  const categoryOptions = availableCategories.length > 0 
    ? availableCategories 
    : Object.values(DefaultCategory).filter(c => c !== DefaultCategory.ALL);

  // --- Single Mode Handlers ---
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      setName(selectedFile.name.split('.')[0]);
      setPath(`\\\\192.168.28.28\\Assets\\New_Imports\\${selectedFile.name}`);

      const isVideo = selectedFile.type.startsWith('video');
      setAssetType(isVideo ? 'video' : 'image');

      try {
        if (isVideo) {
          // 1. Create Object URL for the video file
          const vidUrl = URL.createObjectURL(selectedFile);
          setVideoSourceUrl(vidUrl);
          
          // 2. Extract frame for thumbnail and AI
          const frameBase64 = await extractVideoFrame(selectedFile);
          
          // 3. Compress frame to WebP for preview
          const webpFrame = await compressToWebP(frameBase64, 0.8);
          
          setOriginalThumbnailUrl(frameBase64); // Store high-res/original extraction
          setPreviewUrl(webpFrame); // Show WebP
          
          // 4. Analyze the frame
          await runAnalysis(frameBase64, 'image/jpeg'); // Treat frame as jpeg

        } else {
          // It's an image
          
          // 1. Get original as base64 or URL for storage
          const originalBase64 = await fileToGenerativePart(selectedFile);
          setOriginalThumbnailUrl(originalBase64);
          
          // 2. Compress to WebP for UI
          const webpUrl = await compressToWebP(selectedFile, 0.8);
          setPreviewUrl(webpUrl);
          
          setVideoSourceUrl('');
          
          await runAnalysis(originalBase64, selectedFile.type); // Pass original to AI
        }
      } catch (err) {
        console.error("File processing error:", err);
        alert("无法处理文件，请确保格式正确。");
      }
    }
  };

  const runAnalysis = async (input: File | string, mimeType: string = 'image/png') => {
    setIsAnalyzing(true);
    try {
      let base64Data = '';
      if (input instanceof File) {
        base64Data = await fileToGenerativePart(input);
        mimeType = input.type;
      } else {
        base64Data = input; // Already base64 string
      }

      const generatedTags = await generateAssetTags(base64Data, mimeType);
      setTags(generatedTags);
    } catch (err) {
      console.error(err);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSingleSubmit = () => {
    if (!name || !originalThumbnailUrl) return;
    
    const newAsset: Asset = {
      id: Math.random().toString(36).substr(2, 9),
      name,
      path,
      category,
      type: assetType,
      project: 'Global_Library',
      tags,
      thumbnailUrl: originalThumbnailUrl, // Store Original High Res
      previewUrl: previewUrl, // Store WebP Low Res
      videoUrl: assetType === 'video' ? videoSourceUrl : undefined,
      quality: 'A',
      source: 'User Import',
      lastModified: new Date().toISOString()
    };
    
    onAdd([newAsset]);
    onClose();
  };

  // --- Batch Mode Handlers ---
  const parseBatchContent = (content: string, selectedCat: string) => {
    const rows = content.split('\n').filter(r => r.trim());
    const results: Asset[] = [];

    rows.forEach(row => {
      // Split by tab (Excel/APITable default copy format)
      const cols = row.split('\t');
      if (cols.length < 1) return;

      // 1. Name is assumed to be the first column (Safe assumption mostly)
      const rawName = cols[0]?.trim() || 'Untitled';

      // 2. Extract Image URL (Scans entire row for APITable format `name (url)` or raw URL)
      //    This makes it order-independent.
      let thumbUrl = '';
      const apiTableMatch = row.match(/\((https?:\/\/[^)]+)\)/); // Matches (http...) pattern
      if (apiTableMatch) {
          thumbUrl = apiTableMatch[1];
      } else {
          // Fallback: Find any column containing http that isn't wrapped in parens (if format is raw url)
          const urlCol = cols.find(c => c.includes('http') && !c.includes('(')); 
          const rawUrlMatch = urlCol?.match(/(https?:\/\/[^\s]+)/);
          if (rawUrlMatch) thumbUrl = rawUrlMatch[1];
      }
      
      if (!thumbUrl) thumbUrl = 'https://via.placeholder.com/300?text=No+Image';
      
      // 3. Extract Path (Scans columns for \\ prefix)
      //    This makes it order-independent.
      const pathCol = cols.find(c => c.trim().startsWith('\\\\'));
      const rawPath = pathCol ? pathCol.trim() : '';

      // 4. Extract Quality (Scans columns for exact S/A/B/C)
      const qualityCol = cols.find(c => ['S', 'A', 'B', 'C'].includes(c.trim().toUpperCase()));
      const rawQuality = qualityCol ? qualityCol.trim().toUpperCase() : 'B';

      // 5. Build Tags/Project/Source from remaining data
      const usedIndices = [0]; // Name index
      if (pathCol) usedIndices.push(cols.indexOf(pathCol));
      if (qualityCol) usedIndices.push(cols.indexOf(qualityCol));
      
      // Find index of col containing URL if we found one
      const imgColIndex = cols.findIndex(c => c.includes('http'));
      if (imgColIndex > -1) usedIndices.push(imgColIndex);

      const otherData = cols.filter((_, idx) => !usedIndices.includes(idx)).map(c => c.trim()).filter(Boolean);
      
      const rawSource = otherData[0] || 'Batch Import';
      const rawProject = 'Imported'; 
      const tags = otherData; // Dump everything else into tags

      const isVideo = thumbUrl.endsWith('.mp4') || thumbUrl.endsWith('.webm');

      let cat: Category = selectedCat;

      results.push({
        id: Math.random().toString(36).substr(2, 9),
        name: rawName,
        path: rawPath,
        category: cat,
        type: isVideo ? 'video' : 'image',
        project: rawProject,
        tags: tags,
        thumbnailUrl: thumbUrl, // Batch mostly uses remote URLs, difficult to convert to WebP client-side without CORS issues
        previewUrl: thumbUrl, // Fallback to same URL
        videoUrl: isVideo ? thumbUrl : undefined,
        quality: rawQuality as any,
        source: rawSource,
        lastModified: new Date().toISOString()
      });
    });

    setParsedAssets(results);
  };

  const handlePaste = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setPasteContent(val);
    parseBatchContent(val, batchCategory);
  };

  // Re-parse when category changes
  useEffect(() => {
    if (pasteContent) {
        parseBatchContent(pasteContent, batchCategory);
    }
  }, [batchCategory]);

  const handleBatchSubmit = () => {
    if (parsedAssets.length > 0) {
      onAdd(parsedAssets);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm animate-enter">
      <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        
        {/* Header with Tabs */}
        <div className="flex flex-col border-b border-slate-800 bg-slate-950">
          <div className="flex justify-between items-center p-4 pb-0">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <Plus className="text-blue-500" size={20}/> 导入资产
            </h2>
            <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors mb-2">
              <X size={24} />
            </button>
          </div>
          
          <div className="flex px-4 gap-6 mt-4">
            <button 
              onClick={() => setMode('single')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${mode === 'single' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <FileImage size={16}/> 单文件导入 (AI 标签 + WebP 压缩)
            </button>
            <button 
              onClick={() => setMode('batch')}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${mode === 'batch' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
            >
              <FileSpreadsheet size={16}/> APITable / Excel 批量粘贴
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          
          {/* SINGLE MODE */}
          {mode === 'single' && (
            <div className="flex gap-6 h-full">
              {/* Left Column: Image/Video */}
              <div className="w-1/2 flex flex-col gap-4">
                <div 
                  className={`aspect-square rounded-lg border-2 border-dashed flex flex-col items-center justify-center cursor-pointer transition-colors relative overflow-hidden ${
                    previewUrl ? 'border-slate-700 bg-slate-950' : 'border-slate-700 hover:border-blue-500 hover:bg-slate-800'
                  }`}
                  onClick={() => !previewUrl && fileInputRef.current?.click()}
                >
                  {previewUrl ? (
                    <>
                      {assetType === 'video' ? (
                        <div className="relative w-full h-full">
                            {/* Show the frame, but indicate it's a video */}
                             <img src={previewUrl} alt="Video Frame" className="w-full h-full object-cover opacity-80" />
                             <div className="absolute inset-0 flex items-center justify-center">
                                <div className="bg-black/50 p-3 rounded-full">
                                    <Video size={32} className="text-white"/>
                                </div>
                             </div>
                             <span className="absolute bottom-2 right-2 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded">
                                 视频封面
                             </span>
                        </div>
                      ) : (
                        <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                      )}
                      
                      <button 
                        onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                        className="absolute top-2 right-2 bg-black/70 text-white p-2 rounded-full hover:bg-blue-600 z-10"
                      >
                        <Upload size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <Upload size={48} className="text-slate-600 mb-2" />
                      <p className="text-slate-400 text-sm">支持图片与视频 (MP4, GIF)</p>
                      <p className="text-slate-600 text-xs mt-1">视频将自动截取封面并转为 WebP</p>
                    </>
                  )}
                  <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/mp4,video/webm" onChange={handleFileChange} />
                </div>
              </div>

              {/* Right Column: Form */}
              <div className="w-1/2 flex flex-col gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">资产名称</label>
                  <input 
                    type="text" 
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                    placeholder="例如：木制箱子 01"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-400 mb-1">分类</label>
                  <select 
                    value={category}
                    onChange={(e) => setCategory(e.target.value as Category)}
                    className="w-full bg-slate-800 border border-slate-700 rounded px-3 py-2 text-white focus:outline-none focus:border-blue-500"
                  >
                    {categoryOptions.map(cat => (
                      <option key={cat} value={cat}>{cat.includes('/') ? cat.split('/')[0] : cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                    <label className="block text-xs font-medium text-slate-400 mb-1">本地路径 (模拟)</label>
                    <input 
                        type="text" 
                        value={path}
                        readOnly
                        className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-2 text-slate-500 text-xs font-mono select-none cursor-not-allowed"
                    />
                </div>
                {/* AI Tags Section */}
                <div className="flex-1 flex flex-col">
                   <div className="flex justify-between items-center mb-1">
                     <label className="block text-xs font-medium text-slate-400">智能标签 (Doubao AI)</label>
                     {isAnalyzing && <span className="text-xs text-blue-400 flex items-center gap-1"><Loader2 size={10} className="animate-spin"/> 正在分析...</span>}
                   </div>
                   <div className="bg-slate-800 border border-slate-700 rounded p-3 min-h-[100px] max-h-[150px] overflow-y-auto">
                     {tags.length === 0 && !isAnalyzing && (
                       <div className="text-slate-600 text-xs text-center mt-4">
                         {assetType === 'video' ? '已提取视频关键帧进行分析...' : '上传图片后自动生成标签'}
                       </div>
                     )}
                     <div className="flex flex-wrap gap-2">
                       {tags.map((tag, i) => (
                         <span key={i} className="flex items-center gap-1 bg-blue-900/30 text-blue-200 text-xs px-2 py-1 rounded border border-blue-800/50">
                           {tag}
                           <button onClick={() => setTags(tags.filter((_, idx) => idx !== i))} className="hover:text-white"><X size={10} /></button>
                         </span>
                       ))}
                     </div>
                   </div>
                </div>
              </div>
            </div>
          )}

          {/* BATCH MODE */}
          {mode === 'batch' && (
            <div className="flex flex-col h-full gap-4">
              <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3 text-xs text-blue-200">
                <p className="font-semibold mb-1">智能识别导入:</p>
                <div className="opacity-80">
                   直接从 Excel 或 APITable 复制粘贴整行数据。系统会自动识别：
                   <ul className="list-disc list-inside mt-1 ml-1 space-y-0.5">
                      <li>名称 (通常为第一列)</li>
                      <li>文件路径 (识别 \\ 开头的内容)</li>
                      <li>图片/视频链接 (识别 http 或 APITable 附件格式)</li>
                      <li>质量 (识别 S, A, B, C)</li>
                   </ul>
                   <span className="block mt-1 text-slate-400">* 无法识别的内容将自动添加为标签。</span>
                </div>
              </div>

              {/* Batch Category Selector */}
              <div className="flex items-center gap-3">
                 <label className="text-sm text-slate-400 font-medium">导入到分组:</label>
                 <select 
                    value={batchCategory}
                    onChange={(e) => setBatchCategory(e.target.value as Category)}
                    className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5 text-white focus:outline-none focus:border-blue-500 text-sm"
                  >
                    {categoryOptions.map(cat => (
                      <option key={cat} value={cat}>{cat.includes('/') ? cat.split('/')[0] : cat}</option>
                    ))}
                  </select>
              </div>

              <textarea 
                className="w-full h-32 bg-slate-950 border border-slate-700 rounded-lg p-3 text-xs font-mono text-slate-300 focus:outline-none focus:border-blue-500 resize-none"
                placeholder={`在此处粘贴...\n示例 1:\n道具名称  \\\\192.168.1.1\\Path  ImageName.jpg (https://...)\n\n示例 2:\n道具名称  项目名  \\\\192.168.1.1\\Path  http://image.url  A级`}
                value={pasteContent}
                onChange={handlePaste}
              />

              <div className="flex-1 bg-slate-800/50 border border-slate-700 rounded-lg overflow-hidden flex flex-col">
                 <div className="px-4 py-2 bg-slate-800 border-b border-slate-700 flex justify-between items-center">
                    <span className="text-xs font-semibold text-slate-300">预览 ({parsedAssets.length} 项)</span>
                    {parsedAssets.length > 0 && <span className="text-xs text-emerald-400">准备导入</span>}
                 </div>
                 <div className="flex-1 overflow-y-auto p-4 space-y-2">
                    {parsedAssets.length === 0 ? (
                       <div className="h-full flex flex-col items-center justify-center text-slate-600">
                          <FileSpreadsheet size={32} className="mb-2 opacity-50"/>
                          <p className="text-sm">暂无数据</p>
                       </div>
                    ) : (
                       parsedAssets.map((asset, idx) => (
                          <div key={idx} className="flex items-center gap-3 bg-slate-800 p-2 rounded border border-slate-700/50">
                             <div className="w-10 h-10 rounded bg-slate-900 overflow-hidden shrink-0 relative">
                                <img src={asset.thumbnailUrl} alt="" className="w-full h-full object-cover" />
                                {asset.type === 'video' && <div className="absolute inset-0 bg-black/40 flex items-center justify-center"><Video size={12} className="text-white"/></div>}
                             </div>
                             <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium text-slate-200 truncate">{asset.name}</div>
                                <div className="text-[10px] text-slate-500 truncate">{asset.path}</div>
                             </div>
                             <div className="flex flex-col items-end gap-1">
                                <span className="text-[10px] bg-slate-700 px-1.5 py-0.5 rounded text-slate-300">{asset.category.split('/')[0]}</span>
                                <div className="flex gap-1">
                                    {asset.tags.slice(0, 2).map((t, i) => <span key={i} className="text-[9px] bg-slate-800 px-1 rounded border border-slate-700 text-slate-500 truncate max-w-[50px]">{t}</span>)}
                                </div>
                             </div>
                          </div>
                       ))
                    )}
                 </div>
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-950 flex justify-end gap-3">
          <button 
            onClick={onClose}
            className="px-4 py-2 text-sm text-slate-400 hover:text-white transition-colors"
          >
            取消
          </button>
          
          {mode === 'single' ? (
             <button 
               onClick={handleSingleSubmit}
               disabled={!name || !originalThumbnailUrl}
               className={`px-6 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${
                 !name || !originalThumbnailUrl 
                 ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                 : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
               }`}
             >
               <Check size={16} /> 保存资产
             </button>
          ) : (
             <button 
               onClick={handleBatchSubmit}
               disabled={parsedAssets.length === 0}
               className={`px-6 py-2 rounded-md text-sm font-medium flex items-center gap-2 ${
                 parsedAssets.length === 0 
                 ? 'bg-slate-800 text-slate-600 cursor-not-allowed' 
                 : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-900/20'
               }`}
             >
               <Check size={16} /> 导入 {parsedAssets.length > 0 ? `(${parsedAssets.length})` : ''}
             </button>
          )}
        </div>
      </div>
    </div>
  );
};