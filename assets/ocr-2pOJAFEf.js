import{r as d,u as f}from"./main-DYpY7mbM.js";import"./firebase-config-BXcpKdmt.js";async function b(i){const a=i[0],p=await d(a),n=await window.pdfjsLib.getDocument({data:p}).promise,s=n.numPages;let r="";for(let e=1;e<=s;e++){const c=await n.getPage(e),o=c.getViewport({scale:2}),t=document.createElement("canvas"),g=t.getContext("2d");t.height=o.height,t.width=o.width,await c.render({canvasContext:g,viewport:o}).promise;const{data:{text:l}}=await window.Tesseract.recognize(t,"eng",{logger:w=>console.log(w)});r+=`--- Page ${e} ---

${l}

`,f(e/s*100)}return{blob:new Blob([r],{type:"text/plain"}),fileName:`ocr_${a.name.replace(".pdf","")}.txt`}}export{b as process};
