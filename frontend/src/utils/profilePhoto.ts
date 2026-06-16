import { API } from '../api/client';

export async function loadProfilePhotoObjectUrl(
  profilePhotoPath: string | null | undefined,
): Promise<string | null> {
  if (!profilePhotoPath) {
    return null;
  }

  const sep = profilePhotoPath.includes('?') ? '&' : '?';
  const url = `${API}${profilePhotoPath}${sep}t=${Date.now()}`;
  const response = await fetch(url, {
    credentials: 'include',
    cache: 'no-store',
  });

  if (!response.ok) {
    throw new Error('Impossible de charger la photo de profil.');
  }

  const blob = await response.blob();
  return blobToDataUrl(blob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      if (typeof reader.result === 'string') {
        resolve(reader.result);
        return;
      }
      reject(new Error('Impossible de lire la photo.'));
    };
    reader.onerror = () => reject(new Error('Impossible de lire la photo.'));
    reader.readAsDataURL(blob);
  });
}
