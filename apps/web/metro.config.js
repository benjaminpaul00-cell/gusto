// Permet à l'app d'importer le dossier /shared à la racine du dépôt.
const { getDefaultConfig } = require("expo/metro-config");
const path = require("path");

const projectRoot = __dirname;
const repoRoot = path.resolve(projectRoot, "../..");
const config = getDefaultConfig(projectRoot);
config.watchFolders = [path.join(repoRoot, "shared")];
config.resolver.nodeModulesPaths = [path.join(projectRoot, "node_modules")];
module.exports = config;
