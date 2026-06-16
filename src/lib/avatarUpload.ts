import imageCompression from 'browser-image-compression';
import { supabase } from '@/lib/supabase';

const PENDING_AVATAR_KEY = 'spigen_pending_avatar';

export async function compressAvatar(file: File): Promise<Blob> {
  const options = {
    maxSizeMB: 0.5,
    maxWidthOrHeight: 512,
    useWebWorker: true,
  };
  return await imageCompression(file, options);
}

export async function stashPendingAvatar(blob: Blob): Promise<void> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64data = reader.result as string;
      localStorage.setItem(PENDING_AVATAR_KEY, base64data);
      resolve();
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

export function getPendingAvatar(): string | null {
  return localStorage.getItem(PENDING_AVATAR_KEY);
}

export function clearPendingAvatar(): void {
  localStorage.removeItem(PENDING_AVATAR_KEY);
}

// Helper to convert base64 back to Blob
function dataURLtoBlob(dataurl: string): Blob {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/webp';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new Blob([u8arr], { type: mime });
}

export async function uploadPendingAvatar(userId: string): Promise<string | null> {
  try {
    const pendingDataUrl = getPendingAvatar();
    if (!pendingDataUrl) {
      return null;
    }

    const blob = dataURLtoBlob(pendingDataUrl);
    const file = new File([blob], 'avatar.webp', { type: blob.type });
    const path = `${userId}/${Date.now()}.webp`;

    const { error: uploadError } = await supabase.storage
      .from('avatars')
      .upload(path, file, { cacheControl: '3600', upsert: false });

    if (uploadError) {
      console.error('Failed to upload avatar:', uploadError);
      return null; // Don't clear stash, return null
    }

    const { data: { publicUrl } } = supabase.storage
      .from('avatars')
      .getPublicUrl(path);

    const { error: dbError } = await supabase
      .from('profiles')
      .update({ avatar_url: publicUrl })
      .eq('id', userId);

    if (dbError) {
      console.error('Failed to update profile with avatar url:', dbError);
      return null;
    }

    clearPendingAvatar();
    return publicUrl;
  } catch (err) {
    console.error('Error in uploadPendingAvatar:', err);
    return null; // Return null on failure instead of throwing
  }
}
