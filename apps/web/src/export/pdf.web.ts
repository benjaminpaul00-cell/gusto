// Web : ouvre la boîte d'impression du navigateur, où l'utilisateur choisit « Enregistrer en PDF ».
export async function exportPdf(html: string): Promise<void> {
  const frame = document.createElement("iframe");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(frame);
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  // Attendre le chargement des images avant d'imprimer
  await Promise.all(
    Array.from(doc.images).map((img) => (img.complete ? null : new Promise((r) => { img.onload = img.onerror = r; }))),
  );
  frame.contentWindow!.focus();
  frame.contentWindow!.print();
  setTimeout(() => frame.remove(), 60_000);
}
