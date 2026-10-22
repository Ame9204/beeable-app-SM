// Native camera for the Android app. The web build keeps the plain <input type="file" capture>.
import { Camera } from "@capacitor/camera";

/** Takes a photo with the camera and returns it as a File, or null if the user cancelled. */
export async function takePhoto(): Promise<File | null> {
  try {
    // ~1600 px is plenty: the server resizes to 1024 px anyway, and smaller uploads are faster on mobile data.
    const result = await Camera.takePhoto({ quality: 80, targetWidth: 1600, targetHeight: 1600 });
    if (!result?.webPath) return null;
    const blob = await (await fetch(result.webPath)).blob();
    return new File([blob], `report-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });
  } catch (err) {
    if (err instanceof Error && /cancel/i.test(err.message)) return null;
    throw err;
  }
}
