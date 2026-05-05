//  CHART FACTORY
// ═══════════════════════════════════════════════════════════
function mkC(id,cfg){
  if(CH[id])CH[id].destroy();
  const c=document.getElementById(id);if(!c)return;
  const lt=document.documentElement.getAttribute('data-theme')==='light';
  const tc=lt?'rgba(20,32,56,.8)':'rgba(221,238,255,.8)';const gc=lt?'rgba(197,213,232,.35)':'rgba(26,46,74,.45)';
  if(cfg.options){cfg.options.plugins=cfg.options.plugins||{};cfg.options.plugins.legend=cfg.options.plugins.legend||{};cfg.options.plugins.legend.labels=cfg.options.plugins.legend.labels||{};cfg.options.plugins.legend.labels.color=tc;if(cfg.options.scales)Object.values(cfg.options.scales).forEach(s=>{if(s.ticks)s.ticks.color=tc;else s.ticks={color:tc};if(s.grid)s.grid.color=gc;else s.grid={color:gc};});}
  CH[id]=new Chart(c,cfg);
}
function mkDo(id,pct,col){mkC(id,{type:'doughnut',data:{labels:['Done','Rem'],datasets:[{data:[pct,100-pct],backgroundColor:[col,'rgba(26,46,74,.55)'],borderWidth:0,cutout:'72%'}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{display:false}}}});}
function mkCWIP(id,labels,progs){
  mkC(id,{type:'bar',data:{labels,datasets:[
    {label:'✔ Done', data:progs.map(v=>v>=50?v:0), backgroundColor:'rgba(0,230,118,.75)',borderRadius:4,stack:'s'},
    {label:'🟡 WIP', data:progs.map(v=>v>0&&v<50?v:0), backgroundColor:'rgba(255,202,40,.75)',borderRadius:4,stack:'s'},
    {label:'🔴 Rem', data:progs.map(v=>100-v), backgroundColor:'rgba(255,82,82,.5)',borderRadius:4,stack:'s'},
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:'top'}},scales:{x:{stacked:true},y:{stacked:true,min:0,max:100,ticks:{callback:v=>v+'%'}}}}});
}

// ═══════════════════════════════════════════════════════════