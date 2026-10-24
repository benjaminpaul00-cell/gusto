// iOS et Android : écrit le fichier puis ouvre le menu de partage (le calendrier propose d'importer un .ics).
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

export async function saveFile(name: string, content: string, mime: string): Promise<void> {
  const uri = `${FileSystem.cacheDirectory}${name}`;
  await FileSystem.writeAsStringAsync(uri, content);
  await Sharing.shareAsync(uri, { mimeType: mime });
}
