// Rendered-contrast audit of the main screens in all four themes (dark, light, high-contrast dark and light): every visible text sample must meet WCAG AA (AAA in high contrast). Disabled controls and hidden hover actions are exempt. Run against a dev app on 9920 (see run-all.sh).
const {targets,attach,sleep}=require('./cdp.cjs')
const probe=`(strong=>{
 const parse=(s)=>{const m=s.match(/rgba?\\(([^)]+)\\)/);if(!m)return null;const p=m[1].split(/[ ,\\/]+/).filter(Boolean).map(Number);return {r:p[0],g:p[1],b:p[2],a:p[3]===undefined?1:p[3]}}
 const over=(f,b)=>({r:f.r*f.a+b.r*(1-f.a),g:f.g*f.a+b.g*(1-f.a),b:f.b*f.a+b.b*(1-f.a),a:1})
 const lum=(c)=>{const f=x=>{x/=255;return x<=0.03928?x/12.92:Math.pow((x+0.055)/1.055,2.4)};return 0.2126*f(c.r)+0.7152*f(c.g)+0.0722*f(c.b)}
 const bgOf=(el)=>{const chain=[];for(let e=el;e;e=e.parentElement){const c=parse(getComputedStyle(e).backgroundColor);if(c&&c.a>0){chain.push(c);if(c.a>=1)break}}let base={r:255,g:255,b:255,a:1};if(!chain.length||chain[chain.length-1].a<1){const b=parse(getComputedStyle(document.body).backgroundColor);if(b&&b.a>0)base=b}
  for(let i=chain.length-1;i>=0;i--)base=chain[i].a>=1?chain[i]:over(chain[i],base);return base}
 const out=[];const seen=new Set()
 for(const el of document.querySelectorAll('body *')){
  if(!el.childNodes||![...el.childNodes].some(n=>n.nodeType===3&&n.textContent.trim().length>1))continue
  const r=el.getBoundingClientRect();if(r.width<2||r.height<2||r.bottom<0||r.top>innerHeight)continue
  const cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.opacity==='0'||el.closest('[hidden]'))continue
  if(el.closest('.projection-preview, .scr, .plp-frame, svg')) continue
  let op=1;for(let e=el;e;e=e.parentElement){op*=parseFloat(getComputedStyle(e).opacity)}
  if(el.disabled||el.closest('[disabled],[aria-disabled=true]'))continue
  const fg0=parse(cs.color);if(!fg0)continue;const bg=bgOf(el);const fg=over({...fg0,a:fg0.a*op},bg)
  if(op<0.05)continue;const L1=lum(fg),L2=lum(bg);const ratio=(Math.max(L1,L2)+0.05)/(Math.min(L1,L2)+0.05)
  const px=parseFloat(cs.fontSize);const bold=parseInt(cs.fontWeight)>=700;const large=px>=24||(px>=18.66&&bold)
  const need=strong?(large?4.5:7):(large?3:4.5)
  if(ratio<need){const key=(el.className&&el.className.toString().split(' ')[0]||el.tagName)+'|'+el.textContent.trim().slice(0,24);if(seen.has(key))continue;seen.add(key);out.push({sel:(el.className&&el.className.toString().split(' ').slice(0,2).join('.'))||el.tagName.toLowerCase(),t:el.textContent.trim().slice(0,28),ratio:+ratio.toFixed(2),need,px})}
 }
 return out})`
;(async()=>{const c=await attach((await targets(9920)).find(x=>x.type==='page'&&x.title==='Born Again'))
await c.send('Emulation.setDeviceMetricsOverride',{width:1366,height:768,deviceScaleFactor:1,mobile:false})
const clk=(sel,t)=>c.eval(`(()=>{const b=[...document.querySelectorAll(${JSON.stringify(sel)})].find(b=>(b.getAttribute('aria-label')||b.textContent).trim().startsWith(${JSON.stringify(t)}));b&&b.click();return !!b})()`)
const theme=(t)=>c.eval(`(()=>{const d=document.documentElement;delete d.dataset.contrast;d.dataset.theme=${JSON.stringify(t.startsWith('hc')?t.slice(3):t)};if(${JSON.stringify(t)}.startsWith('hc'))d.dataset.contrast='true'})()`)
const screens={
 'Prepare (Bible, queue, screens live)':async()=>{await clk('.rail-btn','Bible');await sleep(300);await c.eval(`window.electronAPI.showSlide({kind:'bible',text:'For God so loved the world',reference:'John 3:16 · KJV'})`);await sleep(900)},
 'Run view':async()=>{await clk('button','Run view');await sleep(600)},
 'Screen hidden (dock, banner)':async()=>{await c.eval(`window.electronAPI.setBlankScreen(true)`);await sleep(900)},
 'Gear menu':async()=>{await c.eval(`window.electronAPI.setBlankScreen(false)`);await clk('button','‹ Prepare');await sleep(400);await clk('button','Settings and help');await sleep(500)},
 'Songs':async()=>{await c.eval(`document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))`);await clk('.rail-btn','Songs');await sleep(700)},
 'Tape place':async()=>{await clk('.rail-btn','Tape');await sleep(700)},
 'First run (empty queue, checklist)':async()=>{await clk('.rail-btn','Sermons');await sleep(300);await c.eval(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim().startsWith('File'))?.click()`);await sleep(300);await c.eval(`[...document.querySelectorAll('[role=menuitem]')].find(m=>/New service/.test(m.textContent))?.click()`);await sleep(600);await c.eval(`window.confirm=()=>true`);await clk('button','Settings and help');await sleep(300);await c.eval(`[...document.querySelectorAll('.am-item')].find(b=>/Set up Sunday/.test(b.textContent))?.click()`);await sleep(600)},
}
await c.eval(`[...document.querySelectorAll('button')].find(b=>/^Open projection/.test(b.textContent.trim()))?.click()`);await sleep(2500)
const res={}
for(const th of ['dark','light','hc-dark','hc-light']){await theme(th);res[th]={}
 for(const [name,go] of Object.entries(screens)){await go();await sleep(300);const f=await c.eval(`${probe}(${th.startsWith('hc')})`);res[th][name]=f}}
let total=0
for(const [th,sc] of Object.entries(res))for(const [n,f] of Object.entries(sc)){total+=f.length;if(f.length)console.log(th.padEnd(9),n.padEnd(38),f.length,JSON.stringify(f.slice(0,6)))}
console.log(total === 0 ? 'ok' : 'FAIL', '— rendered contrast: ' + total + ' failing text samples'); console.log(Object.values(res).reduce((n, sc) => n + Object.keys(sc).length, 0), 'checks,', total, 'failed'); process.exitCode = total === 0 ? 0 : 1
await c.send('Emulation.clearDeviceMetricsOverride');c.close()})()
