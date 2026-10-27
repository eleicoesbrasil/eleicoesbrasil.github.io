/* mobile_shell: barra de abas rolável (aba ativa visível, indicadores de borda), ajustes de a11y. Nada de dados. */
(function(){
 var nav=document.querySelector('nav.tabs'); if(!nav)return;
 function fade(){var max=nav.scrollWidth-nav.clientWidth;
  nav.style.setProperty('--fadeL',nav.scrollLeft>4?1:0);
  nav.style.setProperty('--fadeR',(max>4&&nav.scrollLeft<max-4)?1:0);}
 function reveal(){var b=nav.querySelector('[aria-selected="true"]');if(!b||nav.scrollWidth<=nav.clientWidth)return;
  var l=b.offsetLeft-(nav.clientWidth-b.offsetWidth)/2;
  try{nav.scrollTo({left:Math.max(0,l),behavior:'smooth'});}catch(e){nav.scrollLeft=Math.max(0,l);}}
 nav.addEventListener('scroll',fade,{passive:true});
 var mo=new MutationObserver(function(){reveal();});
 mo.observe(nav,{attributes:true,attributeFilter:['aria-selected'],subtree:true});
 if(window.ResizeObserver)new ResizeObserver(function(){fade();}).observe(nav);else window.addEventListener('resize',fade);
 // ao trocar de aba num celular, volta o conteúdo para logo abaixo da barra fixa
 nav.addEventListener('click',function(e){var b=e.target.closest&&e.target.closest('button[role=tab]');if(!b)return;
  if(matchMedia('(max-width:700px)').matches){var top=nav.getBoundingClientRect().top;
   if(top<=1){var y=window.scrollY+top;window.scrollTo(0,Math.max(0,y-0));}}});
 fade();setTimeout(function(){fade();reveal();},60);
})();
