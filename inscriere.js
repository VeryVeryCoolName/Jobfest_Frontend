const h=(t,p,...c)=>{const e=Object.assign(document.createElement(t),p);e.append(...c);return e};
const Q=[
{n:"nume",t:"Nume",k:"text",r:1},
{n:"prenume",t:"Prenume",k:"text",r:1},
{n:"email",t:"Email",k:"email",r:1},
{n:"zile",t:"La ce zile vii?",d:"Fiecare zi are speakeri pentru alte facultăți. Poți alege mai multe zile.",k:"checkbox",r:1,o:["4 martie (CSIE, REI, FABBV)","5 martie (Management, Marketing, FABIZ, BTS)","6 martie (Drept, ETA, EAM, AMP)"]},
{n:"facultate",t:"Facultate",k:"checkbox",r:1,alt:1,o:["CSIE","Drept","CIG","FABIZ","REI","FABBV","Management","Marketing","BTS","AMP","ETA","EAM"]},
{n:"an",t:"Anul de studiu",k:"radio",r:1,o:["1","2","3"]},
{n:"sursa",t:"Cum ai aflat de Job Fest?",k:"text"}
];
const f=h("form"),o=h("pre"),g=n=>[...f.querySelectorAll(`[name=${n}]`)];
Q.forEach(q=>{
const t=q.t+(q.r?" *":"");
if(!q.o){f.append(h("p",{},h("label",{},t+" ",h("input",{type:q.k,name:q.n,required:!!q.r}))));return}
const s=h("fieldset",{},h("legend",{},t));
if(q.d)s.append(h("p",{},q.d));
q.o.forEach(v=>s.append(h("label",{},h("input",{type:q.k,name:q.n,value:v,required:q.k=="radio"&&!!q.r}),v),h("br")));
if(q.alt){
const c=h("input",{type:"checkbox",name:q.n,value:"alta"}),x=h("input",{name:q.n+"_alta"});
x.oninput=()=>c.checked=!!x.value.trim();
s.append(h("label",{},c,"Alta: "),x)
}
f.append(s)
});
f.append(h("button",{},"Trimite"));
const sync=()=>Q.forEach(q=>{
if(q.k!="checkbox")return;
const b=g(q.n);
b[0].setCustomValidity(q.r&&!b.some(x=>x.checked)?"Alege cel puțin o opțiune":"");
if(q.alt){const c=b[b.length-1],x=g(q.n+"_alta")[0];x.setCustomValidity(c.checked&&!x.value.trim()?"Completează câmpul":"")}
});
f.oninput=f.onchange=sync;
sync();
f.onsubmit=e=>{
e.preventDefault();
const d={};
Q.forEach(q=>{
const b=g(q.n);
d[q.n]=q.k=="checkbox"?b.filter(x=>x.checked).map(x=>x.value=="alta"?"Altă: "+g(q.n+"_alta")[0].value.trim():x.value):q.k=="radio"?(b.find(x=>x.checked)||{}).value||null:b[0].value.trim()
});
o.textContent=JSON.stringify(d,null,2)
};
const card=h("div",{className:"member-card"});
card.append(f,o);
document.getElementById("app").append(card);
