/* mobile_qa: favicon (evita 404 de /favicon.ico) e pequenos ajustes globais. Nada de dados. */
(function(){
 try{
  if(!document.querySelector('link[rel~="icon"]')){
   var l=document.createElement('link');l.rel='icon';l.type='image/svg+xml';
   l.href='data:image/svg+xml,'+encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="6" fill="#12151a"/><rect x="6" y="17" width="5" height="9" fill="#e5646b"/><rect x="13.5" y="9" width="5" height="17" fill="#6b9be0"/><rect x="21" y="13" width="5" height="13" fill="#b8ad86"/></svg>');
   document.head.appendChild(l);}
 }catch(e){}
})();
