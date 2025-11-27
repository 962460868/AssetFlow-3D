import { initializeApp } from "firebase/app";
import { 
  getFirestore, 
  collection, 
  onSnapshot, 
  doc, 
  updateDoc, 
  deleteDoc, 
  writeBatch, 
  setDoc,
  query,
  orderBy
} from "firebase/firestore";
import { getStorage, ref, uploadString, getDownloadURL } from "firebase/storage";
import { Asset, SidebarGroup, DefaultCategory } from "../types";

// Firebase Configuration
const firebaseConfig = {
  apiKey: "AIzaSyBcA4h0Ago58SADBTx5aQEnUDji_Pv3sN0",
  authDomain: "gen-lang-client-0035265806.firebaseapp.com",
  projectId: "gen-lang-client-0035265806",
  storageBucket: "gen-lang-client-0035265806.firebasestorage.app",
  messagingSenderId: "1016601864654",
  appId: "1:1016601864654:web:12e9e4935a1b3bfee6e39f",
  measurementId: "G-0XP4910676"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const storage = getStorage(app);

// --- Subscriptions ---

export const subscribeToAssets = (onData: (assets: Asset[]) => void) => {
  // Order by lastModified desc for latest assets first
  const q = query(collection(db, "assets"), orderBy("lastModified", "desc"));
  return onSnapshot(q, (snapshot) => {
    const assets = snapshot.docs.map(doc => ({ ...doc.data(), id: doc.id } as Asset));
    onData(assets);
  }, (error) => {
    console.error("Error subscribing to assets:", error);
  });
};

export const subscribeToGroups = (onData: (groups: SidebarGroup[]) => void) => {
  return onSnapshot(doc(db, "config", "sidebar"), (docSnap) => {
    if (docSnap.exists()) {
      onData(docSnap.data().groups);
    } else {
      // If config doesn't exist yet, initialize it
      const initialGroups: SidebarGroup[] = [
        { id: 'library-root', title: "资源库", items: [DefaultCategory.ALL] },
        { id: '3d-assets', title: "3D 资产", items: [DefaultCategory.PROPS, DefaultCategory.ENVIRONMENT, DefaultCategory.CHARACTERS, DefaultCategory.VFX, DefaultCategory.OTHERS] },
        { id: 'art-assets', title: "美术资源", items: [DefaultCategory.BLUEPRINTS, DefaultCategory.TEXTURES, DefaultCategory.MATERIALS, DefaultCategory.HDR, DefaultCategory.DECALS] }
      ];
      setDoc(doc(db, "config", "sidebar"), { groups: initialGroups });
      onData(initialGroups);
    }
  });
};

// --- Writes ---

export const saveGroupsToFirebase = async (groups: SidebarGroup[]) => {
  try {
    await setDoc(doc(db, "config", "sidebar"), { groups });
  } catch (e) {
    console.error("Error saving groups:", e);
  }
};

export const uploadAssetImage = async (base64String: string, assetId: string): Promise<string> => {
  if (!base64String || !base64String.startsWith('data:')) return base64String; 
  
  try {
    const storageRef = ref(storage, `thumbnails/${assetId}_${Date.now()}.webp`);
    await uploadString(storageRef, base64String, 'data_url');
    return await getDownloadURL(storageRef);
  } catch (e) {
    console.error("Image upload failed:", e);
    return ""; // Return empty or original on fail
  }
};

export const addAssetsToFirebase = async (assets: Asset[], onProgress?: (current: number, total: number) => void) => {
  let processed = 0;
  const total = assets.length;

  // Process serially or in small parallel chunks to avoid overwhelming client/network
  // For simplicity and safety with large images:
  
  for (const asset of assets) {
    let finalThumbnail = asset.thumbnailUrl;
    let finalPreview = asset.previewUrl;

    // 1. Upload Thumbnail if Base64
    if (finalThumbnail && finalThumbnail.startsWith('data:')) {
        finalThumbnail = await uploadAssetImage(finalThumbnail, asset.id);
    }

    // 2. Upload Preview if Base64 (and different)
    if (finalPreview && finalPreview.startsWith('data:')) {
         // Optimization: if preview is same as thumb (often is), reuse URL
         if (asset.previewUrl === asset.thumbnailUrl && finalThumbnail.startsWith('http')) {
             finalPreview = finalThumbnail;
         } else {
             finalPreview = await uploadAssetImage(finalPreview, asset.id);
         }
    }
    
    // Fallback if upload failed or was empty
    if (!finalThumbnail) finalThumbnail = "";
    if (!finalPreview) finalPreview = finalThumbnail;

    // 3. Save to Firestore
    // Using asset.id as Doc ID (assuming it was generated in Uploader, otherwise generate new ref)
    const docRef = doc(collection(db, "assets"), asset.id); 
    const assetToSave = { 
        ...asset, 
        id: asset.id, 
        thumbnailUrl: finalThumbnail, 
        previewUrl: finalPreview 
    };
    
    await setDoc(docRef, assetToSave);
    
    processed++;
    if (onProgress) onProgress(processed, total);
  }
};

export const updateAssetInFirebase = async (asset: Asset) => {
   const assetRef = doc(db, "assets", asset.id);
   
   // Check for new base64 images during update
    let finalThumbnail = asset.thumbnailUrl;
    let finalPreview = asset.previewUrl;

    if (finalThumbnail && finalThumbnail.startsWith('data:')) {
        finalThumbnail = await uploadAssetImage(finalThumbnail, asset.id);
    }
    if (finalPreview && finalPreview.startsWith('data:')) {
        finalPreview = await uploadAssetImage(finalPreview, asset.id);
    }

   await updateDoc(assetRef, { 
       ...asset, 
       thumbnailUrl: finalThumbnail,
       previewUrl: finalPreview 
    });
};

export const deleteAssetFromFirebase = async (assetId: string) => {
  await deleteDoc(doc(db, "assets", assetId));
  // Note: We are not automatically deleting files from Storage to keep it simple, 
  // but in production you'd want a Cloud Function trigger for that.
};

// --- Batch Ops ---

export const batchDeleteAssets = async (assets: Asset[]) => {
    // Firestore batch limit is 500
    const chunks = [];
    for (let i = 0; i < assets.length; i += 500) {
        chunks.push(assets.slice(i, i + 500));
    }
    
    for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(a => {
            const ref = doc(db, "assets", a.id);
            batch.delete(ref);
        });
        await batch.commit();
    }
};

export const batchUpdateAssets = async (assets: Asset[]) => {
     const chunks = [];
    for (let i = 0; i < assets.length; i += 500) {
        chunks.push(assets.slice(i, i + 500));
    }
     for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(a => {
            const ref = doc(db, "assets", a.id);
            batch.update(ref, a);
        });
        await batch.commit();
    }
};
