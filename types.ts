
export enum DefaultCategory {
  ALL = '全部资产',
  PROPS = '道具库 (Props)',
  ENVIRONMENT = '场景/地编 (Env)',
  CHARACTERS = '角色 (Characters)',
  BLUEPRINTS = '插件蓝图 (Plugin BP)',
  TEXTURES = '贴图库 (Textures)',
  MATERIALS = '材质库 (Materials)',
  HDR = 'HDR 环境光',
  DECALS = '贴花 (Decals)',
  VFX = '特效库 (VFX)',
  OTHERS = '其他 (Others)'
}

// Category is now a string to allow custom folders
export type Category = string;

export enum ViewMode {
  GRID = 'GRID',
  TABLE = 'TABLE'
}

export type AssetType = 'image' | 'video';

export interface Asset {
  id: string;
  name: string;
  path: string; // The UNC path e.g. \\192.168...
  type: AssetType;
  category: Category;
  project: string;
  tags: string[]; // Manual tags
  aiTags?: string[]; // Auto-generated AI tags
  thumbnailUrl: string; // Original High-Res image (PNG/JPG)
  previewUrl?: string; // WebP compressed version for UI display
  videoUrl?: string; // Actual video source if type is video
  quality: 'S' | 'A' | 'B' | 'C';
  source: string; // e.g. "TGM", "Marketplace"
  lastModified: string;
}

export interface ProjectOption {
  id: string;
  name: string;
}

export interface SidebarGroup {
  id: string;
  title: string;
  items: string[]; // Category names
}
