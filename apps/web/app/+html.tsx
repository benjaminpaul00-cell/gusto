// Gabarit HTML des pages web générées à l'avance (rendu statique).
import { ScrollViewStyleReset } from "expo-router/html";
import type { PropsWithChildren } from "react";

// Règles responsive et animations : les composants s'y accrochent avec r("…") (src/theme.ts).
const CSS = `
body{background-color:#FFFFFF;-webkit-font-smoothing:antialiased;-moz-osx-font-smoothing:grayscale;text-rendering:optimizeLegibility}
@media (prefers-color-scheme: dark){body{background-color:#0B0D26}}
a{text-decoration:none}
::selection{background:#FFE14D;color:#0E1030}

/* Apparition au défilement (le script ajoute data-in quand l'élément est visible) */
html.js [data-r~="reveal"]:not([data-in]){opacity:0;transform:translateY(32px)}
html.js [data-r~="reveal-left"]:not([data-in]){opacity:0;transform:translateX(-40px)}
html.js [data-r~="reveal-scale"]:not([data-in]){opacity:0;transform:scale(.92)}
[data-r~="reveal"],[data-r~="reveal-left"],[data-r~="reveal-scale"]{transition:opacity .8s cubic-bezier(.2,.7,.2,1),transform .8s cubic-bezier(.2,.7,.2,1)}
[data-r~="d1"]{transition-delay:.08s;animation-delay:.08s}
[data-r~="d2"]{transition-delay:.16s;animation-delay:.16s}
[data-r~="d3"]{transition-delay:.24s;animation-delay:.24s}
[data-r~="d4"]{transition-delay:.32s;animation-delay:.32s}
[data-r~="d5"]{transition-delay:.4s;animation-delay:.4s}
[data-r~="d6"]{transition-delay:.48s;animation-delay:.48s}

/* Interactions « pop » : l'élément se soulève et son ombre s'allonge */
[data-r~="press"]{transition:transform .15s ease, box-shadow .15s ease}
[data-r~="press"]:hover{transform:translate(-2px,-2px);box-shadow:6px 6px 0 #0E1030!important}
[data-r~="press"]:active{transform:translate(3px,3px);box-shadow:0 0 0 #0E1030!important}
[data-r~="lift"]{transition:transform .25s cubic-bezier(.2,.8,.2,1.4)}
[data-r~="lift"]:hover{transform:translateY(-6px) rotate(-1deg)}
[data-r~="dim"]{transition:opacity .15s ease}
[data-r~="dim"]:hover{opacity:.7}
[data-r~="wiggle"]:hover{animation:wiggle .5s ease}

@keyframes rise{from{opacity:0;transform:translateY(36px)}to{opacity:1;transform:none}}
[data-r~="rise"]{animation:rise .9s cubic-bezier(.2,.7,.2,1) both}
@keyframes wiggle{0%,100%{transform:rotate(0)}25%{transform:rotate(-8deg)}75%{transform:rotate(6deg)}}
@keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
@keyframes floatx{0%,100%{transform:translate(0,0) rotate(0)}33%{transform:translate(10px,-12px) rotate(6deg)}66%{transform:translate(-8px,8px) rotate(-4deg)}}
@keyframes spin{to{transform:rotate(360deg)}}
@keyframes marquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@keyframes stepin{0%{opacity:0;transform:translateY(24px) scale(.98)}100%{opacity:1;transform:none}}
@keyframes wordin{0%{opacity:0;transform:translateY(70%) rotate(-6deg)}60%{opacity:1;transform:translateY(-8%) rotate(2deg)}100%{opacity:1;transform:none}}
@keyframes pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}
@keyframes blob{0%,100%{border-radius:42% 58% 63% 37%/41% 44% 56% 59%}50%{border-radius:61% 39% 38% 62%/58% 63% 37% 42%}}
@keyframes popin{0%{opacity:0;transform:scale(.4) rotate(-20deg)}70%{transform:scale(1.12) rotate(4deg)}100%{opacity:1;transform:none}}
@keyframes bar{from{transform:scaleX(0)}to{transform:scaleX(1)}}
@keyframes dots{0%,80%,100%{opacity:.25;transform:scale(.8)}40%{opacity:1;transform:scale(1)}}
[data-r~="float"]{animation:float 6s ease-in-out infinite}
[data-r~="float-slow"]{animation:float 9s ease-in-out infinite}
[data-r~="floatx"]{animation:floatx 14s ease-in-out infinite}
[data-r~="spin"]{animation:spin 24s linear infinite}
[data-r~="marquee"]{animation:marquee 32s linear infinite}
[data-r~="marquee-wrap"]:hover [data-r~="marquee"]{animation-play-state:paused}
[data-r~="step-in"]{animation:stepin .5s cubic-bezier(.2,.8,.2,1) both}
[data-r~="word-in"]{animation:wordin .7s cubic-bezier(.2,.8,.2,1) both}
[data-r~="pulse"]{animation:pulse 2.4s ease-in-out infinite}
[data-r~="blob"]{animation:blob 10s ease-in-out infinite}
[data-r~="pop-in"]{animation:popin .6s cubic-bezier(.2,.8,.2,1) both}
[data-r~="bar"]{transform-origin:left;animation:bar 1.2s cubic-bezier(.2,.8,.2,1) both}
[data-r~="dot"]{animation:dots 1.2s ease-in-out infinite}

@media (max-width: 1240px){
  [data-r~="hero-title"]{font-size:68px!important;line-height:76px!important;letter-spacing:-2.5px!important}
}
@media (max-width: 900px){
  [data-r~="hide-md"]{display:none!important}
  [data-r~="stack-md"]{flex-direction:column!important;align-items:stretch!important}
  [data-r~="stack-md"]>*{flex-basis:auto!important}
  [data-r~="full-md"]{width:100%!important;max-width:100%!important;flex-basis:auto!important}
  [data-r~="hero-title"]{font-size:58px!important;line-height:62px!important}
}
@media (max-width: 640px){
  [data-r~="hide-sm"]{display:none!important}
  [data-r~="stack-sm"]{flex-direction:column!important;align-items:stretch!important}
  [data-r~="stack-sm"]>*{flex-basis:auto!important}
  [data-r~="hero-title"]{font-size:44px!important;line-height:48px!important;letter-spacing:-1.5px!important}
  [data-r~="h2"]{font-size:34px!important;line-height:40px!important;letter-spacing:-1px!important}
  [data-r~="title"]{font-size:38px!important;line-height:44px!important;letter-spacing:-1px!important}
  [data-r~="q-title"]{font-size:28px!important;line-height:34px!important;letter-spacing:-.5px!important}
  [data-r~="section"]{padding-top:72px!important;padding-bottom:72px!important}
  [data-r~="card-pad"]{padding:20px!important}
  [data-r~="gutter"]{padding-left:18px!important;padding-right:18px!important}
  [data-r~="tile-2"]{flex-basis:44%!important;min-width:0!important}
}
@media (min-width: 641px){[data-r~="only-sm"]{display:none!important}}
@media (prefers-reduced-motion: reduce){
  *,*::before,*::after{animation:none!important;transition:none!important}
  html.js [data-r~="reveal"]:not([data-in]),html.js [data-r~="reveal-left"]:not([data-in]),html.js [data-r~="reveal-scale"]:not([data-in]){opacity:1;transform:none}
}
`;

// Révèle les éléments [data-r~=reveal] quand ils entrent à l'écran. Un attribut (data-in), pas une
// classe : React gère les classes et les réécrirait.
const JS = `
document.documentElement.classList.add('js');
(function(){
  if(!('IntersectionObserver' in window)){document.documentElement.classList.remove('js');return;}
  var sel='[data-r~="reveal"],[data-r~="reveal-left"],[data-r~="reveal-scale"]';
  var io=new IntersectionObserver(function(es){es.forEach(function(e){if(e.isIntersecting){e.target.setAttribute('data-in','');io.unobserve(e.target);}});},{threshold:0.12,rootMargin:'0px 0px -40px 0px'});
  function scan(){document.querySelectorAll(sel).forEach(function(el){if(!el.__io){el.__io=1;io.observe(el);}});}
  new MutationObserver(scan).observe(document.documentElement,{childList:true,subtree:true});
  document.addEventListener('DOMContentLoaded',scan);
  setTimeout(function(){document.querySelectorAll(sel).forEach(function(el){var r=el.getBoundingClientRect();if(r.top<innerHeight)el.setAttribute('data-in','');});},2500);
})();
`;

export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="fr-CA">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="theme-color" content="#2B44FF" />
        {/* Validation de propriété AdSense : simple balise, aucun témoin (le script pub attend le consentement) */}
        {process.env.EXPO_PUBLIC_ADSENSE_CLIENT ? <meta name="google-adsense-account" content={process.env.EXPO_PUBLIC_ADSENSE_CLIENT} /> : null}
        <link rel="icon" type="image/png" href="/favicon.png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta property="og:site_name" content="Gusto" />
        <meta property="og:image" content="/og.png" />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{ __html: CSS }} />
        <script dangerouslySetInnerHTML={{ __html: JS }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
