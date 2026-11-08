# Rend une page HTML de la pub en JPG 1080 x 1350 (rendu à 2x puis réduit). Usage : sh rendu.sh pub-site.html sortie.jpg
CH="/c/Program Files/Google/Chrome/Application/chrome.exe"
"$CH" --headless=new --disable-gpu --hide-scrollbars --force-device-scale-factor=2 --window-size=1080,1350 --virtual-time-budget=8000 --screenshot="$(cygpath -w $PWD)\rendu@2x.png" "file:///$(cygpath -m $PWD)/$1" >/dev/null 2>&1
python -c "from PIL import Image; Image.open('rendu@2x.png').resize((1080,1350),Image.LANCZOS).convert('RGB').save('$2',quality=94)"
