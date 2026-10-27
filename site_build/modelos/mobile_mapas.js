(function(){
var mq=window.matchMedia('(max-width:700px)');
function pt(){return window.__LANG==='en';}
function T(a,b){return pt()?b:a;}
function setup(wrap){
 var cv=wrap.querySelector('canvas');if(!cv||wrap.__mv)return;wrap.__mv=1;
 var b=document.createElement('button');b.type='button';b.className='mv-toggle';b.setAttribute('aria-pressed','false');
 var on=false;
 function lab(){b.textContent=on?T('Mover mapa: ligado','Move map: on'):T('Mover mapa: desligado','Move map: off');b.setAttribute('aria-pressed',on);wrap.classList.toggle('mv-on',on);}
 b.addEventListener('click',function(){on=!on;lab();});
 lab();wrap.insertBefore(b,wrap.firstChild);
 new MutationObserver(function(){var n=b.textContent;if(n!==T('Mover mapa: ligado','Move map: on')&&n!==T('Mover mapa: desligado','Move map: off'))lab();}).observe(b,{childList:true,characterData:true,subtree:true});
 // pinch (2 dedos) via eventos de roda sinteticos; captura antes dos handlers do mapa
 var ptrs={},pinch=null;
 function dist(){var k=Object.keys(ptrs);if(k.length<2)return null;var a=ptrs[k[0]],c=ptrs[k[1]];return {d:Math.hypot(a.x-c.x,a.y-c.y),x:(a.x+c.x)/2,y:(a.y+c.y)/2};}
 wrap.addEventListener('pointerdown',function(e){if(e.pointerType!=='touch'||!on)return;ptrs[e.pointerId]={x:e.clientX,y:e.clientY};
  if(Object.keys(ptrs).length===2){var d=dist();pinch={last:d.d};e.stopPropagation();}},true);
 wrap.addEventListener('pointermove',function(e){if(!ptrs[e.pointerId])return;ptrs[e.pointerId]={x:e.clientX,y:e.clientY};
  if(pinch){e.stopPropagation();var d=dist();if(!d)return;var r=d.d/pinch.last;
   while(r>1.18||r<1/1.18){var up=r>1;cv.dispatchEvent(new WheelEvent('wheel',{deltaY:up?-100:100,clientX:d.x,clientY:d.y,bubbles:true,cancelable:true}));
    var f=up?1.18:1/1.18;pinch.last*=f;r=d.d/pinch.last;}}},true);
 function up(e){if(!ptrs[e.pointerId])return;delete ptrs[e.pointerId];
  if(pinch){e.stopPropagation();if(Object.keys(ptrs).length<2){pinch=null;ptrs={};cv.dispatchEvent(new PointerEvent('pointerup',{bubbles:false,pointerId:e.pointerId}));}}}
 wrap.addEventListener('pointerup',up,true);wrap.addEventListener('pointercancel',up,true);
 // toque simples mostra o tooltip (handlers originais so reagem a mouse)
 var st=null;
 cv.addEventListener('pointerdown',function(e){if(e.pointerType==='touch')st={x:e.clientX,y:e.clientY};});
 cv.addEventListener('pointerup',function(e){if(e.pointerType!=='touch'||!st||pinch)return;var s=st;st=null;
  if(Math.abs(e.clientX-s.x)+Math.abs(e.clientY-s.y)>6)return;var x=e.clientX,y=e.clientY;
  setTimeout(function(){cv.dispatchEvent(new MouseEvent('mousemove',{clientX:x,clientY:y,bubbles:true}));cv.dispatchEvent(new PointerEvent('pointermove',{clientX:x,clientY:y,bubbles:true,pointerType:'mouse'}));},0);});
}
function init(){document.querySelectorAll('#p-mapa .hwrap,#p-secoes .hwrap').forEach(setup);
 var i=document.getElementById('h-info');if(i&&!i.__m){i.__m=1;i.textContent=i.textContent;}}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init);else init();
})();
