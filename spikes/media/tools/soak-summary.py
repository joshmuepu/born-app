import json, sys, statistics as st
rows=[json.loads(l) for l in open(sys.argv[1]) if l.strip()]
def series(f): return [f(r) for r in rows]
def slope_per_hour(xs, ys):
    n=len(xs); mx=sum(xs)/n; my=sum(ys)/n
    return sum((x-mx)*(y-my) for x,y in zip(xs,ys))/(sum((x-mx)**2 for x in xs) or 1)*3600
ts=series(lambda r:r['t'])
print('samples',len(rows),'duration_min',round(ts[-1]/60,1))
for k in ('gpu','renderer','browser','other'):
    ws=series(lambda r:r[k]['ws']/1024); cpu=series(lambda r:r[k]['cpu'])
    print(f"{k:9s} workingSet MB start={ws[0]/1024:.0f} end={ws[-1]/1024:.0f} max={max(ws)/1024:.0f} slope/h={slope_per_hour(ts,[w/1024 for w in ws]):+.1f} MB | cpu% mean={st.mean(cpu):.1f} max={max(cpu):.1f}")
last=rows[-1]['vids']
for i,v in sorted(last.items()):
    print('video',i,'dropped',v['dropped'],'/',v['total'],f"({100*v['dropped']/max(1,v['total']):.3f}%)",'stalls',v['stalls'],'loops',v['loops'],'heapMB',round(v['heap']/1048576,1),'err',v.get('err'))
