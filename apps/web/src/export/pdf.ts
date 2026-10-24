// iOS et Android : crée un vrai fichier PDF, puis ouvre le menu de partage du téléphone.
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

export async function exportPdf(html: string): Promise<void> {
  const { uri } = await Print.printToFileAsync({ html });
  await Sharing.shareAsync(uri, { mimeType: "application/pdf", UTI: "com.adobe.pdf" });
}
