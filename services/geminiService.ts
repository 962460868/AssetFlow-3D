

// Replaced with Doubao (Volcengine) Service
// Using model: doubao-seed-1-6-lite-251015

const API_KEY = '1eaa58c9-b2d2-4e70-bffd-eb5c07983dc3';
const API_URL = 'https://ark.cn-beijing.volces.com/api/v3/chat/completions';
const MODEL_ID = 'doubao-seed-1-6-lite-251015';

// Helper to convert file to base64
export const fileToGenerativePart = async (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64String = reader.result as string;
      resolve(base64String);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

// Helper to extract a frame from a video file to use as thumbnail/AI input
export const extractVideoFrame = async (videoFile: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      video.currentTime = 1; // Seek to 1 second (or 0)
    };
    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const base64 = canvas.toDataURL('image/jpeg', 0.8);
          resolve(base64);
        } else {
          reject(new Error("Canvas context failed"));
        }
      } catch (e) {
        reject(e);
      } finally {
        // Clean up
        URL.revokeObjectURL(video.src);
        video.remove();
      }
    };
    video.onerror = () => {
      reject(new Error("Video load failed"));
    };
    video.src = URL.createObjectURL(videoFile);
  });
};

// Helper to convert URL to base64
export const urlToBase64 = async (url: string): Promise<string> => {
  try {
    const response = await fetch(url);
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const res = reader.result as string;
        resolve(res); 
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Failed to convert URL to base64:", error);
    throw new Error("Could not process image. Possible CORS restriction on external URL.");
  }
};

// Helper to compress image to WebP (Shared Utility)
export const compressToWebP = async (fileOrBlob: File | Blob | string, quality: number = 0.8): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(img, 0, 0);
        const webpDataUrl = canvas.toDataURL('image/webp', quality);
        resolve(webpDataUrl);
      } else {
        reject(new Error("Canvas context failed"));
      }
    };
    img.onerror = (err) => reject(err);

    if (typeof fileOrBlob === 'string') {
      img.src = fileOrBlob;
    } else {
      img.src = URL.createObjectURL(fileOrBlob);
    }
  });
};

// Helper to convert image URL/Source to PNG Blob for Clipboard
export const convertToPngBlob = async (url: string): Promise<Blob> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // 'Anonymous' allows cross-origin access if server supports it.
    img.crossOrigin = 'Anonymous'; 
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error("Canvas toBlob failed"));
          }, 'image/png');
        } else {
          reject(new Error("Canvas context failed"));
        }
      } catch (e) {
        reject(e);
      }
    };
    img.onerror = (e) => reject(new Error("Image load failed for copy conversion"));
    img.src = url;
  });
};

export const generateAssetTags = async (base64ImageFull: string, mimeType: string = 'image/png'): Promise<string[]> => {
  try {
    let imageUrl = base64ImageFull;
    if (!base64ImageFull.startsWith('data:')) {
        imageUrl = `data:${mimeType};base64,${base64ImageFull}`;
    }

    const payload = {
      model: MODEL_ID,
      max_completion_tokens: 4096,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image_url",
              image_url: {
                url: imageUrl
              }
            },
            {
              type: "text",
              text: `你是一个专业的3D资产管理专家。请分析这张图片（或视频截图），并生成 10-15 个精准的标签（Tags）。
              
              要求：
              1. 识别物体类型（如：椅子、岩石、飞船）、材质（木头、金属、混凝土）、风格（赛博朋克、写实、卡通）和颜色。
              2. 必须包含同义词扩展。例如：看到“土豆”，必须同时输出“土豆”、“马铃薯”、“蔬菜”、“食物”。
              3. 必须包含层级关系。例如：看到“跑车”，必须包含“跑车”、“车辆”、“交通工具”。
              4. **只返回纯 JSON 字符串数组**，不要包含 markdown 格式（如 \`\`\`json），不要包含任何解释性文字。
              5. 使用中文标签。
              
              返回格式示例：["标签1", "标签2", "标签3"]`
            }
          ]
        }
      ]
    };

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${API_KEY}`
        },
        body: JSON.stringify(payload)
    });

    if (!response.ok) {
        const err = await response.text();
        throw new Error(`Doubao API Error: ${response.status} - ${err}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content || "[]";
    
    const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
    
    try {
        const tags = JSON.parse(cleanJson);
        return Array.isArray(tags) ? tags : [];
    } catch (e) {
        console.error("JSON Parse Error:", e, cleanJson);
        return cleanJson.split(/[,，\n]/).map((t: string) => t.trim()).filter((t: string) => t.length > 0);
    }

  } catch (error) {
    console.error("Doubao tagging error:", error);
    return ["AI分析失败", "请重试"];
  }
};

const SYNONYM_DICT: Record<string, string[]> = {
  'car': ['汽车', '车辆', '载具', '交通工具', 'automobile'],
  '汽车': ['car', '车辆', '载具', '轿车'],
  '土豆': ['马铃薯', '蔬菜', '食物', 'potato'],
  '马铃薯': ['土豆', 'potato'],
  '树': ['植物', '自然', '植被', '森林', 'tree'],
  '雪': ['冬天', '寒冷', '冰', '白色', 'snow'],
  '科幻': ['sci-fi', '未来', '赛博朋克', '太空', '高科技'],
  '椅子': ['座位', '家具', '办公椅', 'chair', 'seat'],
  '废弃': ['破旧', '工业风', '遗迹', 'abandoned', 'old'],
  '视频': ['video', '动态', '动画', 'mp4'],
  '动画': ['animation', '视频']
};

export const expandSearchQuery = (query: string): string[] => {
  const lowerQuery = query.toLowerCase().trim();
  if (!lowerQuery) return [];

  const expansions = new Set<string>();
  expansions.add(lowerQuery);

  if (SYNONYM_DICT[lowerQuery]) {
    SYNONYM_DICT[lowerQuery].forEach(s => expansions.add(s.toLowerCase()));
  }

  // Reverse lookup
  Object.entries(SYNONYM_DICT).forEach(([key, values]) => {
    if (values.map(v => v.toLowerCase()).includes(lowerQuery)) {
      expansions.add(key.toLowerCase());
    }
  });

  return Array.from(expansions);
};