// Site Gusto : sert les pages statiques et renvoie les anciennes adresses vers mongusto.ca.
// - www.mongusto.ca et gusto.<compte>.workers.dev → https://mongusto.ca (redirection permanente, chemin conservé)
const HOME = "mongusto.ca";

export default {
  async fetch(req, env) {
    const url = new URL(req.url);
    const local = url.hostname === "localhost" || url.hostname === "127.0.0.1";
    if (url.hostname !== HOME && !local) {
      url.hostname = HOME;
      url.protocol = "https:";
      url.port = "";
      return Response.redirect(url.toString(), 301);
    }
    return env.ASSETS.fetch(req);
  },
};
