// ═══════════════════════════════════════════════════════════
//  GLOBAL CHART MODERNISATION (ui upgrade)
//  • brand typography + soft grid + rich tooltips everywhere
//  • bar datasets get vertical gradients + rounded corners
//  • value labels drawn above bars (valueLabels plugin)
//  • smooth easeOutQuart entrance animation
//  All applied centrally in mkC() so every chart in the app —
//  including the solar activity bars — is upgraded at once.
// ═══════════════════════════════════════════════════════════
if (typeof Chart !== 'undefined') {
  try {
    Chart.defaults.font.family = "'Exo 2','Rajdhani',system-ui,sans-serif";
    Chart.defaults.font.size = 10;
    Chart.defaults.animation = { duration: 850, easing: 'easeOutQuart' };
    Chart.defaults.plugins.tooltip = Object.assign(Chart.defaults.plugins.tooltip || {}, {
      backgroundColor: 'rgba(7,16,31,.94)',
      borderColor: 'rgba(79,195,247,.35)',
      borderWidth: 1,
      cornerRadius: 8,
      padding: 10,
      titleFont: { weight: '700', size: 11 },
      bodyFont: { size: 10 },
      displayColors: true,
      boxPadding: 4,
      caretSize: 6
    });
    Chart.defaults.plugins.legend.labels.usePointStyle = true;
    Chart.defaults.plugins.legend.labels.pointStyle = 'rectRounded';
    Chart.defaults.plugins.legend.labels.boxWidth = 9;
    Chart.defaults.plugins.legend.labels.boxHeight = 9;

    // valueLabels — draws each bar's value just above it.
    // Enabled automatically for bar charts with a readable number of bars;
    // opt out per-chart with options.plugins.valueLabels = false.
    Chart.register({
      id: 'valueLabels',
      afterDatasetsDraw(chart) {
        const opt = chart.options && chart.options.plugins && chart.options.plugins.valueLabels;
        if (opt === false) return;
        if (chart.config.type !== 'bar') return;
        const nBars = (chart.data.labels || []).length * chart.data.datasets.length;
        if (nBars === 0 || nBars > 28) return;
        const { ctx } = chart;
        const lt = document.documentElement.getAttribute('data-theme') === 'light';
        ctx.save();
        ctx.font = "700 9px 'Exo 2',sans-serif";
        ctx.textAlign = 'center';
        ctx.fillStyle = lt ? 'rgba(20,32,56,.85)' : 'rgba(221,238,255,.85)';
        const stacked = chart.options.scales && chart.options.scales.y && chart.options.scales.y.stacked;
        if (stacked) { ctx.restore(); return; }   // stacked bars stay clean — tooltip carries the detail
        chart.data.datasets.forEach((ds, di) => {
          const meta = chart.getDatasetMeta(di);
          if (meta.hidden) return;
          meta.data.forEach((bar, i) => {
            const v = ds.data[i];
            if (v == null || +v === 0) return;
            ctx.fillText(String(Math.round(+v * 10) / 10), bar.x, bar.y - 4);
          });
        });
        ctx.restore();
      }
    });
  } catch (e) { console.warn('[charts] modernisation skipped:', e); }
}

// vertical gradient cache-less helper for bar fills
function _barGrad(ctx, area, color) {
  try {
    const g = ctx.createLinearGradient(0, area.top, 0, area.bottom);
    // lift the top, fade the bottom — keeps the base hue readable
    g.addColorStop(0, color);
    const m = /rgba?\(([^)]+)\)/.exec(color);
    if (m) {
      const parts = m[1].split(',').map(x => x.trim());
      const [r, gg, b] = parts;
      g.addColorStop(1, `rgba(${r},${gg},${b},0.12)`);
    } else {
      g.addColorStop(1, 'rgba(79,195,247,0.10)');
    }
    return g;
  } catch (e) { return color; }
}

//  CHART FACTORY
// ═══════════════════════════════════════════════════════════
function mkC(id,cfg){
  if(CH[id])CH[id].destroy();
  const c=document.getElementById(id);if(!c)return;
  const lt=document.documentElement.getAttribute('data-theme')==='light';
  const tc=lt?'rgba(20,32,56,.8)':'rgba(221,238,255,.8)';const gc=lt?'rgba(197,213,232,.35)':'rgba(26,46,74,.45)';
  // ── modernise bar datasets: gradient fills, rounded corners, hover pop ──
  if (cfg.type === 'bar' && cfg.data && Array.isArray(cfg.data.datasets)) {
    cfg.data.datasets.forEach(ds => {
      const orig = ds.backgroundColor;
      if (typeof orig === 'string') {
        ds.backgroundColor = (c2) => {
          const { ctx, chartArea } = c2.chart;
          return chartArea ? _barGrad(ctx, chartArea, orig) : orig;
        };
        ds.hoverBackgroundColor = orig;
      } else if (Array.isArray(orig)) {
        ds.backgroundColor = (c2) => {
          const { ctx, chartArea } = c2.chart;
          const base = orig[c2.dataIndex % orig.length];
          return chartArea ? _barGrad(ctx, chartArea, base) : base;
        };
        ds.hoverBackgroundColor = orig;
      }
      if (ds.borderRadius === undefined) ds.borderRadius = 6;
      if (ds.maxBarThickness === undefined) ds.maxBarThickness = 42;
      if (ds.borderSkipped === undefined) ds.borderSkipped = false;
    });
  }
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