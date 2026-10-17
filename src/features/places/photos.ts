import { eq } from 'drizzle-orm';
import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

import { db } from '@/db/client';
import { machines } from '@/db/schema';
import { touched } from '@/lib/ids';

/** Longest side of a saved machine photo, in px. Low-res on purpose: it only helps to recognise the machine. */
const MAX_SIDE = 800;
const JPEG_QUALITY = 0.6;

const photosDir = () => new Directory(Paths.document, 'machine-photos');

/**
 * Only the file name is stored in the DB: the document dir's absolute path can
 * change between app updates (iOS), so it's resolved at read time.
 */
export function machinePhotoUri(photo: string | null | undefined): string | null {
  return photo ? new File(photosDir(), photo).uri : null;
}

export type PhotoSource = 'camera' | 'library';

/** Opens the camera or the gallery. Returns null if cancelled; throws 'permission' if camera access was denied. */
export async function pickPhoto(source: PhotoSource): Promise<ImagePicker.ImagePickerAsset | null> {
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('permission');
  }
  const options: ImagePicker.ImagePickerOptions = { mediaTypes: 'images', quality: 0.8 };
  const result =
    source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
  return result.canceled ? null : result.assets[0];
}

/** Downscales the picked image to a small JPEG, stores it and replaces the machine's previous photo. */
export async function saveMachinePhoto(machineId: string, asset: { uri: string; width: number; height: number }) {
  const landscape = asset.width >= asset.height;
  const longest = Math.max(asset.width, asset.height);
  let ctx = ImageManipulator.manipulate(asset.uri);
  if (longest > MAX_SIDE) {
    ctx = ctx.resize(landscape ? { width: MAX_SIDE, height: null } : { width: null, height: MAX_SIDE });
  }
  const image = await ctx.renderAsync();
  const saved = await image.saveAsync({ format: SaveFormat.JPEG, compress: JPEG_QUALITY });

  const dir = photosDir();
  dir.create({ idempotent: true, intermediates: true });
  const name = `${machineId}-${Date.now()}.jpg`;
  await new File(saved.uri).move(new File(dir, name));

  const previous = await db.query.machines.findFirst({ where: eq(machines.id, machineId), columns: { photo: true } });
  await db.update(machines).set({ photo: name, ...touched() }).where(eq(machines.id, machineId));
  deleteFile(previous?.photo);
}

export async function removeMachinePhoto(machineId: string) {
  const previous = await db.query.machines.findFirst({ where: eq(machines.id, machineId), columns: { photo: true } });
  await db.update(machines).set({ photo: null, ...touched() }).where(eq(machines.id, machineId));
  deleteFile(previous?.photo);
}

function deleteFile(photo: string | null | undefined) {
  if (!photo) return;
  const file = new File(photosDir(), photo);
  if (file.exists) file.delete();
}
