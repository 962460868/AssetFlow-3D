import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Sidebar } from './components/Sidebar';
import { AssetList } from './components/AssetList';
import { AssetUploader } from './components/AssetUploader';
import { AssetDetailView } from './components/AssetDetailView';
import { Asset, DefaultCategory, Category, ViewMode, SidebarGroup } from './types';
import { generateAssetTags, urlToBase64, expandSearchQuery } from './services/geminiService';
import { 
  subscribeToAssets, 
  subscribeToGroups, 
  saveGroupsToFirebase, 
  addAssetsToFirebase, 
  updateAssetInFirebase, 
  deleteAssetFromFirebase, 
  batchUpdateAssets, 
  batchDeleteAssets 
} from './services/firebase';
import { 
  Search, 
  Grid, 
  List, 
  Plus, 
  Filter, 
  ChevronDown,
  Settings,
  X,
  Sparkles,
  Loader2,
  Trash2,
  CheckCircle2,
  User,
  LogIn,
  Eraser,
  AlertTriangle,
  HardDrive,
  Download,
  Upload as UploadIcon,
  Cloud,
  CloudOff
} from 'lucide-react';

// --- MOCK DATA FOR FALLBACK ---
const MOCK_ASSETS: Asset[] = [];
const INITIAL_GROUPS: SidebarGroup[] = [
  {
    id: 'library-root',
    title: "资源库",
    items: [DefaultCategory.ALL]
  },
  {
    id: '3d-assets',
    title: "3D 资产",
    items: [
        DefaultCategory.PROPS, 
        DefaultCategory.CHARACTERS, 
        DefaultCategory.ENVIRONMENT, 
        DefaultCategory.VFX, 
        DefaultCategory.OTHERS
    ]
  },
  {
    id: 'art-assets',
    title: "美术资源",
    items: [
        DefaultCategory.BLUEPRINTS, 
        DefaultCategory.TEXTURES, 
        DefaultCategory.MATERIALS, 
        DefaultCategory.HDR, 
        DefaultCategory.DECALS
    ]
  }
];

// --- AUTH CONFIG ---
const ADMIN_USERS = ['米波', '玲芽'];
const ALLOWED_USERS = [
  '泷泽朗', '蛋糕', '少少', '非浅', '原野', '糯米', '彦舟', 
  '两仪', '奥兹玛', '米波', '装甲兔', '咸菜', '玲芽'
];

// --- LOGIN COMPONENT ---
const LoginScreen = ({ onLogin, error }: { onLogin: (name: string) => void, error: string }) => {
  const [input, setInput] = useState('');
  
  return (
    <div className="flex h-screen w-screen bg-zinc-950 items-center justify-center animate-enter">
      <div className="w-full max-w-md bg-zinc-900 p-8 rounded-xl border border-zinc-800 shadow-2xl relative overflow-hidden">
        {/* Decorative background element */}
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>
        
        <div className="text-center mb-8">
           <div className="w-16 h-16 bg-zinc-800 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-zinc-700 shadow-inner">
              <User className="text-zinc-400" size={32} />
           </div>
           <h1 className="text-2xl font-bold text-zinc-100 tracking-tight">AssetFlow 3D</h1>
           <p className="text-zinc-500 text-sm mt-2">云端资产管理系统</p>
        </div>
        
        <form onSubmit={(e) => { e.preventDefault(); onLogin(input.trim()); }} className="space-y-4">
           <div>
              <label className="block text-xs font-medium text-zinc-500 mb-1.5 uppercase tracking-wider">花名 (Nickname)</label>
              <input 
                autoFocus
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="请输入花名登录..."
                className="w-full bg-zinc-950 border border-zinc-700 rounded-lg px-4 py-3 text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-700"
              />
           </div>
           
           {error && (
             <div className="text-red-400 text-xs text-center bg-red-900/10 p-2.5 rounded border border-red-900/20 flex items-center justify-center gap-2">
               <X size={12} /> {error}
             </div>
           )}

           <button 
             type="submit"
             disabled={!input}
             className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-indigo-900/20 mt-2"
           >
             <LogIn size={18} /> 
             <span>验证并登录</span>
           </button>
        </form>
        
        <div className="mt-6 text-center">
            <p className="text-[10px] text-zinc-600">
               仅限授权人员访问 · Restricted Access
            </p>
        </div>
      </div>
    </div>
  )
}

// Preferences Modal Component
const PreferencesModal = ({ 
  isOpen, 
  onClose, 
  onBatchTag, 
  onDeduplicate,
  onCleanEmpty,
  onBatchDelete,
  onExportData,
  onImportData,
  totalAssets, 
  untaggedAssetsCount,
  isBatchProcessing,
  batchProgress,
  allCategories
}: {
  isOpen: boolean;
  onClose: () => void;
  onBatchTag: () => void;
  onDeduplicate: () => number;
  onCleanEmpty: () => number;
  onBatchDelete: (scope: 'all' | string) => void;
  onExportData: () => void;
  onImportData: (e: React.ChangeEvent<HTMLInputElement>) => void;
  totalAssets: number;
  untaggedAssetsCount: number;
  isBatchProcessing: boolean;
  batchProgress: number;
  allCategories: string[];
}) => {
  const [dedupeMessage, setDedupeMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Batch Delete State
  const [deleteScope, setDeleteScope] = useState<string>(''); 
  const [confirmDelete, setConfirmDelete] = useState(false);

  if (!isOpen) return null;

  const handleDedupeClick = () => {
    const count = onDeduplicate();
    setDedupeMessage(`成功移除了 ${count} 个重复资产。`);
    setTimeout(() => setDedupeMessage(null), 3000);
  };

  const handleCleanEmptyClick = () => {
    const count = onCleanEmpty();
    setDedupeMessage(`成功清理了 ${count} 个无效资产。`);
    setTimeout(() => setDedupeMessage(null), 3000);
  };
  
  const handleExecuteDelete = () => {
      if (!confirmDelete || !deleteScope) return;
      onBatchDelete(deleteScope);
      setConfirmDelete(false);
      setDeleteScope('');
      setDedupeMessage("批量删除执行完毕。");
      setTimeout(() => setDedupeMessage(null), 3000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-enter">
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-zinc-800 flex justify-between items-center bg-zinc-950">
          <h2 className="text-lg font-semibold text-zinc-100 flex items-center gap-2">
            <Settings size={18} /> 偏好设置
          </h2>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh]">
          
              {/* Data Sync / Export Section */}
              <div>
                 <h3 className="text-xs font-bold text-zinc-500 mb-3 uppercase tracking-widest">数据管理</h3>
                 <div className="bg-zinc-800/30 rounded-lg p-4 border border-zinc-800">
                    <div className="flex items-start gap-3">
                       <div className="p-2 bg-emerald-500/10 rounded-lg border border-emerald-500/20">
                          <Cloud className="text-emerald-400" size={18}/>
                       </div>
                       <div className="flex-1">
                          <h4 className="text-sm font-medium text-zinc-200 mb-1">云端同步</h4>
                          <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
                            所有数据已实时同步至 Firebase 云端数据库。
                            <br/>
                            您可以导出 JSON 进行本地备份，或导入旧数据。
                          </p>
                          
                          <div className="flex gap-2">
                             <button 
                               onClick={onExportData}
                               className="flex items-center gap-1.5 text-xs px-3 py-2 rounded font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                             >
                                <Download size={12} /> 备份数据 (JSON)
                             </button>
                             <button 
                               onClick={() => fileInputRef.current?.click()}
                               className="flex items-center gap-1.5 text-xs px-3 py-2 rounded font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                             >
                                <UploadIcon size={12} /> 恢复数据
                             </button>
                             <input 
                               type="file" 
                               ref={fileInputRef} 
                               className="hidden" 
                               accept=".json"
                               onChange={onImportData}
                             />
                          </div>
                       </div>
                    </div>
                 </div>
              </div>

              {/* AI Settings Section */}
              <div>
                 <h3 className="text-xs font-bold text-zinc-500 mb-3 uppercase tracking-widest">AI & 自动化</h3>
                 <div className="bg-zinc-800/30 rounded-lg p-4 border border-zinc-800">
                    <div className="flex items-start gap-3">
                       <div className="p-2 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
                          <Sparkles className="text-indigo-400" size={18}/>
                       </div>
                       <div className="flex-1">
                          <h4 className="text-sm font-medium text-zinc-200 mb-1">智能标签生成 (Doubao AI)</h4>
                          <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
                            使用豆包大模型分析资产缩略图，并自动生成描述性标签。
                            <br/>
                            <span className="text-orange-400 mt-1 inline-block">发现 {untaggedAssetsCount} 个未标记资产。</span>
                          </p>
                          
                          {isBatchProcessing ? (
                             <div className="mt-2">
                                <div className="flex justify-between text-xs text-indigo-300 mb-1">
                                  <span>处理中...</span>
                                  <span>{batchProgress > 0 ? Math.round((batchProgress / untaggedAssetsCount) * 100) : 0}%</span>
                                </div>
                                <div className="h-2 bg-zinc-700 rounded-full overflow-hidden">
                                   <div className="h-full bg-indigo-500 transition-all duration-300" style={{ width: `${(batchProgress / untaggedAssetsCount) * 100}%` }}></div>
                                </div>
                             </div>
                          ) : (
                            <button 
                              onClick={onBatchTag}
                              disabled={untaggedAssetsCount === 0}
                              className={`text-xs px-3 py-2 rounded font-medium transition-colors ${
                                untaggedAssetsCount === 0 
                                 ? 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                 : 'bg-indigo-600 hover:bg-indigo-500 text-white'
                              }`}
                            >
                              {untaggedAssetsCount === 0 ? '所有资产已标记' : '开始全局批量处理'}
                            </button>
                          )}
                       </div>
                    </div>
                 </div>
              </div>

              {/* Data Maintenance */}
              <div>
                <h3 className="text-xs font-bold text-zinc-500 mb-3 uppercase tracking-widest">数据维护</h3>
                
                <div className="grid grid-cols-2 gap-4">
                    {/* Deduplicate */}
                    <div className="bg-zinc-800/30 rounded-lg p-4 border border-zinc-800">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-red-500/10 rounded-lg border border-red-500/20">
                            <Trash2 className="text-red-400" size={18}/>
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-medium text-zinc-200 mb-1">智能去重</h4>
                            <p className="text-xs text-zinc-500 mb-3 leading-relaxed h-8">
                                扫描库中具有完全相同 <strong>名称</strong> 和 <strong>路径</strong> 的资产。
                            </p>
                            <button 
                                onClick={handleDedupeClick}
                                className="text-xs px-3 py-2 rounded font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                            >
                                一键去重
                            </button>
                        </div>
                    </div>
                    </div>

                    {/* Clean Empty */}
                    <div className="bg-zinc-800/30 rounded-lg p-4 border border-zinc-800">
                    <div className="flex items-start gap-3">
                        <div className="p-2 bg-orange-500/10 rounded-lg border border-orange-500/20">
                            <Eraser className="text-orange-400" size={18}/>
                        </div>
                        <div className="flex-1">
                            <h4 className="text-sm font-medium text-zinc-200 mb-1">清理无效资产</h4>
                            <p className="text-xs text-zinc-500 mb-3 leading-relaxed h-8">
                                移除既没有图片预览，也没有文件路径的"空"资产。
                            </p>
                            <button 
                                onClick={handleCleanEmptyClick}
                                className="text-xs px-3 py-2 rounded font-medium bg-zinc-800 hover:bg-zinc-700 text-zinc-200 border border-zinc-700 transition-colors"
                            >
                                清理空集
                            </button>
                        </div>
                    </div>
                    </div>
                </div>

                {/* Batch Delete Section */}
                <div className="mt-4 bg-red-900/10 rounded-lg p-4 border border-red-900/30">
                     <h4 className="text-sm font-bold text-red-200 mb-2 flex items-center gap-2">
                         <AlertTriangle size={16}/> 批量删除资产
                     </h4>
                     <p className="text-xs text-zinc-400 mb-3">此操作不可逆，请谨慎操作。</p>
                     
                     <div className="flex gap-2 items-end">
                         <div className="flex-1">
                             <label className="block text-[10px] text-zinc-500 mb-1 uppercase">选择范围</label>
                             <select 
                                value={deleteScope} 
                                onChange={(e) => { setDeleteScope(e.target.value); setConfirmDelete(false); }}
                                className="w-full bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5 text-xs text-zinc-300 focus:outline-none focus:border-red-500"
                             >
                                 <option value="">-- 请选择删除范围 --</option>
                                 <option value="all">!! 清空整个库 (Delete All) !!</option>
                                 <optgroup label="按分类删除">
                                     {allCategories.map(c => (
                                         <option key={c} value={c}>{c}</option>
                                     ))}
                                 </optgroup>
                             </select>
                         </div>
                         
                         {deleteScope && (
                             <div className="flex items-center gap-2">
                                 <div className="flex items-center gap-1.5 bg-zinc-950 border border-zinc-700 rounded px-2 py-1.5">
                                    <input 
                                        type="checkbox" 
                                        id="confirm-del" 
                                        checked={confirmDelete} 
                                        onChange={(e) => setConfirmDelete(e.target.checked)}
                                        className="rounded border-zinc-600 bg-zinc-800 text-red-500 focus:ring-red-500"
                                    />
                                    <label htmlFor="confirm-del" className="text-xs text-zinc-400 select-none cursor-pointer">确认删除</label>
                                 </div>
                                 <button 
                                    onClick={handleExecuteDelete}
                                    disabled={!confirmDelete}
                                    className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                                        confirmDelete ? 'bg-red-600 text-white hover:bg-red-500' : 'bg-zinc-800 text-zinc-600 cursor-not-allowed'
                                    }`}
                                 >
                                     执行删除
                                 </button>
                             </div>
                         )}
                     </div>
                </div>

                {dedupeMessage && (
                   <div className="mt-2 text-xs text-emerald-400 flex items-center gap-1 animate-enter justify-center bg-emerald-900/10 p-2 rounded">
                     <CheckCircle2 size={12} /> {dedupeMessage}
                   </div>
                )}
              </div>
            
        </div>
        <div className="px-6 py-4 bg-zinc-950 border-t border-zinc-800 text-right">
           <button onClick={onClose} className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-sm rounded font-medium">关闭</button>
        </div>
      </div>
    </div>
  );
};


function App() {
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [loginError, setLoginError] = useState('');
  
  // -- FIREBASE SYNC --
  const [assets, setAssets] = useState<Asset[]>([]);
  const [sidebarGroups, setSidebarGroups] = useState<SidebarGroup[]>(INITIAL_GROUPS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Subscriptions
    const unsubscribeAssets = subscribeToAssets((data) => {
        setAssets(data);
        setLoading(false);
    });
    
    const unsubscribeGroups = subscribeToGroups((data) => {
        setSidebarGroups(data);
    });

    return () => {
        unsubscribeAssets();
        unsubscribeGroups();
    };
  }, []);

  const [currentCategory, setCurrentCategory] = useState<Category>(DefaultCategory.ALL);
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.GRID);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUploaderOpen, setIsUploaderOpen] = useState(false);
  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null);
  const [isPreferencesOpen, setIsPreferencesOpen] = useState(false);
  
  // Filtering State
  const [isFilterMenuOpen, setIsFilterMenuOpen] = useState(false);
  const [filterProjects, setFilterProjects] = useState<string[]>([]);
  const [filterTags, setFilterTags] = useState<string[]>([]);
  const filterMenuRef = useRef<HTMLDivElement>(null);
  
  // Batch processing state
  const [isBatchProcessing, setIsBatchProcessing] = useState(false);
  const [batchProgress, setBatchProgress] = useState(0);

  // Close filter menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (filterMenuRef.current && !filterMenuRef.current.contains(event.target as Node)) {
        setIsFilterMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleLogin = (name: string) => {
    if (ALLOWED_USERS.includes(name)) {
      setCurrentUser(name);
      setLoginError('');
    } else {
      setLoginError('未授权的访客。请确认您的花名是否在允许列表中。');
    }
  };
  
  const isAdmin = useMemo(() => {
    return currentUser ? ADMIN_USERS.includes(currentUser) : false;
  }, [currentUser]);

  // Collect all available categories from Sidebar Groups
  const allCategories = useMemo(() => {
    return sidebarGroups.flatMap(g => g.items);
  }, [sidebarGroups]);

  // Derive unique projects for Sidebar and Filters
  const availableProjects = useMemo(() => {
    const projects = new Set(assets.map(a => a.project).filter(Boolean));
    return Array.from(projects).sort();
  }, [assets]);

  // Derive unique tags for filter menu
  const availableTags = useMemo(() => {
    const tags = new Set<string>();
    assets.forEach(a => {
      a.tags.forEach(t => tags.add(t));
      a.aiTags?.forEach(t => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [assets]);

  // Derived filtered assets
  const filteredAssets = useMemo(() => {
    let result = assets;

    // 1. Filter by Category OR Project (Sidebar selection)
    if (currentCategory !== DefaultCategory.ALL) {
        if (availableProjects.includes(currentCategory)) {
            result = result.filter(a => a.project === currentCategory);
        } else {
             result = result.filter(a => a.category === currentCategory);
        }
    }

    // 2. Filter by Search (with Synonym Expansion)
    if (searchQuery.trim()) {
      const searchTerms = expandSearchQuery(searchQuery);
      result = result.filter(asset => {
        if (searchTerms.some(term => asset.name.toLowerCase().includes(term))) return true;
        if (asset.tags.some(tag => searchTerms.some(term => tag.toLowerCase().includes(term)))) return true;
        if (asset.aiTags && asset.aiTags.some(tag => searchTerms.some(term => tag.toLowerCase().includes(term)))) return true;
        return false;
      });
    }

    // 3. Filter by Specific Projects
    if (filterProjects.length > 0) {
      result = result.filter(a => filterProjects.includes(a.project));
    }

    // 4. Filter by Specific Tags
    if (filterTags.length > 0) {
      result = result.filter(a => {
        const hasManualTag = a.tags.some(t => filterTags.includes(t));
        const hasAiTag = a.aiTags?.some(t => filterTags.includes(t));
        return hasManualTag || hasAiTag;
      });
    }

    return result;
  }, [assets, currentCategory, searchQuery, filterProjects, filterTags, availableProjects]);

  const handleAddAssets = async (newAssets: Asset[]) => {
      setIsBatchProcessing(true);
      setBatchProgress(0);
      try {
        await addAssetsToFirebase(newAssets, (current, total) => {
            setBatchProgress(current);
        });
      } catch (e) {
        console.error("Error uploading assets:", e);
        alert("上传部分失败，请查看控制台");
      } finally {
        setIsBatchProcessing(false);
      }
  };

  const handleBatchTagging = async () => {
    const untaggedAssets = assets.filter(a => !a.aiTags || a.aiTags.length === 0);
    if (untaggedAssets.length === 0) return;

    setIsBatchProcessing(true);
    setBatchProgress(0);
    
    // Process a copy to update state locally? No, rely on firebase subscription.
    // However, we need to read file content for analysis.
    // Since images are now URLs (Firebase Storage), we need to fetch them as blob/base64 for Doubao.
    
    const updatedAssets: Asset[] = [];

    for (let i = 0; i < untaggedAssets.length; i++) {
      const asset = untaggedAssets[i];
      try {
        const base64 = await urlToBase64(asset.thumbnailUrl);
        const tags = await generateAssetTags(base64);
        updatedAssets.push({ ...asset, aiTags: tags });
      } catch (e) {
        console.error(`Skipping asset ${asset.name} due to error`, e);
      }
      setBatchProgress(i + 1);
    }
    
    // Batch Update to Firebase
    await batchUpdateAssets(updatedAssets);
    
    setIsBatchProcessing(false);
  };
  
  const handleBatchTaggingCurrentGroup = async () => {
    const targetAssets = filteredAssets.filter(a => !a.aiTags || a.aiTags.length === 0);
    if (targetAssets.length === 0) {
        alert("当前视图下的资产都已有标签，无需处理。");
        return;
    }
    if (!window.confirm(`即将为当前视图下的 ${targetAssets.length} 个资产生成 AI 标签，是否继续？`)) return;

    setIsBatchProcessing(true);
    setBatchProgress(0);
    
    const updatedAssets: Asset[] = [];
    
    for (let i = 0; i < targetAssets.length; i++) {
        const asset = targetAssets[i];
        try {
            const base64 = await urlToBase64(asset.thumbnailUrl);
            const tags = await generateAssetTags(base64);
            updatedAssets.push({ ...asset, aiTags: tags });
        } catch (e) {
            console.error(`Skipping asset ${asset.name}`, e);
        }
        setBatchProgress(i + 1);
    }
    
    await batchUpdateAssets(updatedAssets);
    setIsBatchProcessing(false);
  };

  const handleDeduplicate = (): number => {
    const seen = new Set<string>();
    const toDelete: Asset[] = [];

    assets.forEach(asset => {
      const key = `${asset.name.trim()}|${asset.path.trim()}`;
      if (seen.has(key)) {
        toDelete.push(asset);
      } else {
        seen.add(key);
      }
    });

    if (toDelete.length > 0) {
      batchDeleteAssets(toDelete);
    }
    return toDelete.length;
  };

  const handleCleanEmptyAssets = (): number => {
    const toDelete = assets.filter(a => {
       const hasImage = a.thumbnailUrl && a.thumbnailUrl.trim() !== '';
       const hasPath = a.path && a.path.trim() !== '';
       return !(hasImage || hasPath);
    });
    
    if (toDelete.length > 0) {
        batchDeleteAssets(toDelete);
    }
    return toDelete.length;
  };
  
  const handleBatchDelete = (scope: string) => {
      if (!scope) return;
      if (scope === 'all') {
          batchDeleteAssets(assets);
      } else {
          const toDelete = assets.filter(a => a.category === scope);
          batchDeleteAssets(toDelete);
      }
  };
  
  // --- Export / Import Logic ---
  const handleExportData = () => {
      const dataStr = JSON.stringify({
          version: '1.0',
          assets: assets,
          groups: sidebarGroups
      }, null, 2);
      
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `AssetFlow_Backup_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  };
  
  const handleImportData = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      
      const reader = new FileReader();
      reader.onload = (event) => {
          try {
              const result = event.target?.result as string;
              const data = JSON.parse(result);
              
              if (data.assets && Array.isArray(data.assets)) {
                  if (window.confirm(`即将导入 ${data.assets.length} 个资产到云端数据库。这可能需要一些时间上传图片。是否继续？`)) {
                      handleAddAssets(data.assets); // Reuse batch upload logic
                      if (data.groups) saveGroupsToFirebase(data.groups);
                  }
              } else {
                  alert("文件格式不正确。");
              }
          } catch (err) {
              console.error(err);
              alert("无法解析文件。");
          }
      };
      reader.readAsText(file);
      e.target.value = '';
  };

  const handleUpdateAsset = (updated: Asset) => {
    updateAssetInFirebase(updated);
    if (selectedAsset?.id === updated.id) {
      setSelectedAsset(updated);
    }
  };

  const handleDeleteAsset = (id: string) => {
    deleteAssetFromFirebase(id);
    if (selectedAsset?.id === id) {
        setSelectedAsset(null);
    }
  };

  const handleMoveAsset = (assetId: string, targetCategory: string) => {
    const asset = assets.find(a => a.id === assetId);
    if (asset && asset.category !== targetCategory) {
        updateAssetInFirebase({ ...asset, category: targetCategory });
    }
  };

  // --- Sidebar Management (Firebase Sync) ---
  const handleAddFolder = (groupId: string, folderName: string) => {
    const updatedGroups = sidebarGroups.map(g => {
        if (g.id === groupId) {
            if (g.items.includes(folderName)) return g;
            return { ...g, items: [...g.items, folderName] };
        }
        return g;
    });
    saveGroupsToFirebase(updatedGroups);
  };

  const handleAddGroup = (groupName: string) => {
    const newGroup: SidebarGroup = {
        id: `custom-${Date.now()}`,
        title: groupName,
        items: []
    };
    saveGroupsToFirebase([...sidebarGroups, newGroup]);
  };

  const handleRemoveFolder = (groupId: string, folderName: string) => {
    const updatedGroups = sidebarGroups.map(g => {
        if (g.id === groupId) {
            return { ...g, items: g.items.filter(i => i !== folderName) };
        }
        return g;
    });
    saveGroupsToFirebase(updatedGroups);
  };

  const handleRemoveGroup = (groupId: string) => {
      saveGroupsToFirebase(sidebarGroups.filter(g => g.id !== groupId));
  };

  const toggleProjectFilter = (project: string) => {
    setFilterProjects(prev => 
      prev.includes(project) ? prev.filter(p => p !== project) : [...prev, project]
    );
  };

  const toggleTagFilter = (tag: string) => {
    setFilterTags(prev => 
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const resetFilters = () => {
    setFilterProjects([]);
    setFilterTags([]);
  };

  if (!currentUser) {
    return <LoginScreen onLogin={handleLogin} error={loginError} />;
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-200 font-sans overflow-hidden animate-fade-in">
      
      <Sidebar 
        currentCategory={currentCategory} 
        availableProjects={availableProjects}
        sidebarGroups={sidebarGroups}
        currentUser={currentUser}
        isAdmin={isAdmin}
        onSelectCategory={setCurrentCategory}
        onSelectProject={(project) => setCurrentCategory(project)}
        onOpenPreferences={() => setIsPreferencesOpen(true)}
        onAddFolder={handleAddFolder}
        onAddGroup={handleAddGroup}
        onRemoveFolder={handleRemoveFolder}
        onRemoveGroup={handleRemoveGroup}
        onDropAsset={handleMoveAsset}
      />

      <div className="flex-1 flex flex-col min-w-0">
        
        {/* Top Bar */}
        <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-6 bg-zinc-900/50 backdrop-blur-md z-10 relative">
           
           <div className="flex-1 max-w-xl relative">
             <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-zinc-500" size={16} />
             <input 
               type="text" 
               placeholder="搜索资产..." 
               className="w-full bg-zinc-900 border border-zinc-700 rounded-lg pl-10 pr-4 py-1.5 text-sm text-zinc-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder-zinc-600 shadow-sm"
               value={searchQuery}
               onChange={(e) => setSearchQuery(e.target.value)}
             />
           </div>

           <div className="flex items-center space-x-3 ml-4">
              
              {isAdmin && currentCategory !== DefaultCategory.ALL && !isBatchProcessing && (
                  <button 
                    onClick={handleBatchTaggingCurrentGroup}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-400 border border-indigo-500/20 transition-all"
                  >
                      <Sparkles size={14}/>
                      <span>AI 标记当前组</span>
                  </button>
              )}
              {isBatchProcessing && (
                   <div className="flex items-center gap-2 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-300">
                      <Loader2 size={14} className="animate-spin text-indigo-500"/>
                      <span>处理中... ({batchProgress})</span>
                   </div>
              )}

              <div className="h-4 w-px bg-zinc-700 mx-2" />
              
              <div className="flex bg-zinc-900 rounded-lg p-0.5 border border-zinc-800 shadow-sm">
                <button 
                  onClick={() => setViewMode(ViewMode.GRID)}
                  className={`p-1.5 rounded-md transition-all ${viewMode === ViewMode.GRID ? 'bg-zinc-700 text-zinc-100 shadow-md scale-105' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <Grid size={16} />
                </button>
                <button 
                  onClick={() => setViewMode(ViewMode.TABLE)}
                  className={`p-1.5 rounded-md transition-all ${viewMode === ViewMode.TABLE ? 'bg-zinc-700 text-zinc-100 shadow-md scale-105' : 'text-zinc-500 hover:text-zinc-300'}`}
                >
                  <List size={16} />
                </button>
              </div>

              <div className="relative" ref={filterMenuRef}>
                <button 
                  onClick={() => setIsFilterMenuOpen(!isFilterMenuOpen)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-colors text-xs font-medium border cursor-pointer ${
                    isFilterMenuOpen || filterProjects.length > 0 || filterTags.length > 0
                    ? 'bg-zinc-800 text-zinc-200 border-zinc-700 shadow-sm' 
                    : 'text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 border-transparent hover:border-zinc-700'
                  }`}
                >
                   <Filter size={14} />
                   <span>筛选</span>
                   {(filterProjects.length > 0 || filterTags.length > 0) && (
                     <span className="bg-indigo-500 text-white text-[9px] px-1 rounded-full h-4 min-w-[16px] flex items-center justify-center animate-enter">
                       {filterProjects.length + filterTags.length}
                     </span>
                   )}
                   <ChevronDown size={12} className={`transition-transform duration-200 ${isFilterMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {isFilterMenuOpen && (
                  <div 
                    className="absolute right-0 top-full mt-2 w-64 bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[80vh] animate-slide-up glass-panel"
                    onClick={(e) => e.stopPropagation()} 
                  >
                     <div className="p-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/50">
                        <span className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">筛选条件</span>
                        {(filterProjects.length > 0 || filterTags.length > 0) && (
                          <button 
                            onClick={resetFilters}
                            className="text-[10px] text-zinc-500 hover:text-zinc-300 hover:underline"
                          >
                            重置
                          </button>
                        )}
                     </div>

                     <div className="overflow-y-auto custom-scrollbar p-2">
                        <div className="mb-4">
                           <h4 className="px-2 py-1 text-[10px] font-bold text-zinc-500 uppercase">项目</h4>
                           {availableProjects.length === 0 && <div className="px-2 text-xs text-zinc-600 italic">暂无项目</div>}
                           <div className="space-y-0.5 mt-1">
                              {availableProjects.map(p => (
                                 <div 
                                    key={p} 
                                    onClick={() => toggleProjectFilter(p)}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800 rounded cursor-pointer group select-none transition-colors"
                                  >
                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                                       filterProjects.includes(p) ? 'bg-indigo-600 border-indigo-600' : 'border-zinc-600 group-hover:border-zinc-500'
                                    }`}>
                                       {filterProjects.includes(p) && <CheckCircle2 size={10} className="text-white"/>}
                                    </div>
                                    <span className={`text-xs ${filterProjects.includes(p) ? 'text-zinc-200' : 'text-zinc-400 group-hover:text-zinc-300'}`}>{p}</span>
                                 </div>
                              ))}
                           </div>
                        </div>

                        <div>
                           <h4 className="px-2 py-1 text-[10px] font-bold text-zinc-500 uppercase">标签</h4>
                           {availableTags.length === 0 && <div className="px-2 text-xs text-zinc-600 italic">暂无标签</div>}
                           <div className="space-y-0.5 mt-1">
                              {availableTags.map(t => (
                                 <div 
                                    key={t} 
                                    onClick={() => toggleTagFilter(t)}
                                    className="flex items-center gap-2 px-2 py-1.5 hover:bg-zinc-800 rounded cursor-pointer group select-none transition-colors"
                                  >
                                    <div className={`w-3.5 h-3.5 rounded border flex items-center justify-center transition-all ${
                                       filterTags.includes(t) ? 'bg-indigo-600 border-indigo-600' : 'border-zinc-600 group-hover:border-zinc-500'
                                    }`}>
                                       {filterTags.includes(t) && <CheckCircle2 size={10} className="text-white"/>}
                                    </div>
                                    <span className={`text-xs truncate ${filterTags.includes(t) ? 'text-zinc-200' : 'text-zinc-400 group-hover:text-zinc-300'}`}>{t}</span>
                                 </div>
                              ))}
                           </div>
                        </div>
                     </div>
                  </div>
                )}
              </div>

              {isAdmin && (
                <button 
                  onClick={() => setIsUploaderOpen(true)}
                  className="bg-zinc-100 hover:bg-white text-zinc-900 px-3 py-1.5 rounded-lg text-xs font-semibold shadow-lg shadow-zinc-900/20 flex items-center gap-1.5 transition-all hover:scale-105"
                >
                  <Plus size={16} />
                  <span>导入</span>
                </button>
              )}
           </div>
        </div>

        <div className="flex-1 overflow-hidden relative bg-zinc-950">
           <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-[0.03] pointer-events-none"></div>

          <div className="absolute inset-0 overflow-y-auto custom-scrollbar">
             <div className="px-6 py-6 pb-2">
                <div className="flex items-end justify-between">
                   <div>
                      <h1 className="text-2xl font-bold text-zinc-100 tracking-tight flex items-center gap-2">
                         {currentCategory === DefaultCategory.ALL && !searchQuery ? '资源库' : 
                          currentCategory.includes('/') ? currentCategory.split('/')[0] : currentCategory}
                      </h1>
                      <div className="flex items-center gap-2 mt-1">
                         {loading ? (
                            <p className="text-zinc-500 text-xs flex items-center gap-2"><Loader2 size={12} className="animate-spin"/> 连接云端数据库...</p>
                         ) : (
                            <p className="text-zinc-500 text-xs font-medium">
                               发现 {filteredAssets.length} 个资产 
                               {searchQuery && ` (搜索: "${searchQuery}")`}
                            </p>
                         )}
                        {(filterProjects.length > 0 || filterTags.length > 0) && (
                           <div className="flex items-center gap-1 animate-enter">
                              <div className="w-1 h-1 rounded-full bg-zinc-600"></div>
                              <span className="text-xs text-indigo-400">
                                 已启用筛选: {[...filterProjects, ...filterTags].length}
                              </span>
                           </div>
                        )}
                      </div>
                   </div>
                </div>
             </div>
            
             <AssetList 
               assets={filteredAssets} 
               viewMode={viewMode}
               onAssetClick={() => {}} 
               onAssetDoubleClick={(asset) => setSelectedAsset(asset)}
             />
          </div>
        </div>
      </div>

      {isUploaderOpen && (
        <AssetUploader 
          onClose={() => setIsUploaderOpen(false)} 
          onAdd={handleAddAssets}
          availableCategories={allCategories} 
        />
      )}

      {selectedAsset && (
        <AssetDetailView 
          asset={selectedAsset} 
          isAdmin={isAdmin}
          onClose={() => setSelectedAsset(null)}
          onUpdateAsset={handleUpdateAsset}
          onDeleteAsset={handleDeleteAsset}
        />
      )}

      <PreferencesModal
        isOpen={isPreferencesOpen}
        onClose={() => setIsPreferencesOpen(false)}
        onBatchTag={handleBatchTagging}
        onDeduplicate={handleDeduplicate}
        onCleanEmpty={handleCleanEmptyAssets}
        onBatchDelete={handleBatchDelete}
        onExportData={handleExportData}
        onImportData={handleImportData}
        totalAssets={assets.length}
        untaggedAssetsCount={assets.filter(a => !a.aiTags || a.aiTags.length === 0).length}
        isBatchProcessing={isBatchProcessing}
        batchProgress={batchProgress}
        allCategories={allCategories}
      />

    </div>
  );
}

export default App;