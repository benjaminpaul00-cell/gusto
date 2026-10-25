@echo off
rem Lancé chaque jour par le Planificateur de tâches de Windows (tâche « Gusto - prix »).
rem Récupère les prix d'épiceries.ca depuis cet ordinateur et les envoie à l'API Gusto.
rem Le journal est dans worker\prix.log.
cd /d "%~dp0.."
"C:\Program Files\nodejs\node.exe" scripts\prix.mjs >nul 2>&1
rem Puis l'historique des produits en rabais : vrai prix régulier, faux rabais, plus bas prix de l'année.
"C:\Program Files\nodejs\node.exe" scripts\historique.mjs >nul 2>&1
