const { app, BrowserWindow } = require('electron')
app.disableHardwareAcceleration && 0
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false, webPreferences: { offscreen: false } })
  await w.loadURL('data:text/html,<html></html>')
  const r = await w.webContents.executeJavaScript(`(async()=>{
    const v=document.createElement('video'), a=document.createElement('audio');
    const vt={ 'mp4 h264 baseline':'video/mp4; codecs="avc1.42E01E"','mp4 h264 high':'video/mp4; codecs="avc1.640028"','mp4 h264+aac':'video/mp4; codecs="avc1.640028, mp4a.40.2"',
      'mp4 hevc main':'video/mp4; codecs="hvc1.1.6.L93.B0"','mp4 hev1':'video/mp4; codecs="hev1.1.6.L93.B0"','webm vp8':'video/webm; codecs="vp8"','webm vp9':'video/webm; codecs="vp9"','webm vp9+opus':'video/webm; codecs="vp9, opus"','mp4 av1':'video/mp4; codecs="av01.0.05M.08"','webm av1':'video/webm; codecs="av01.0.05M.08"','mov prores':'video/quicktime; codecs="apcn"','mov (container only)':'video/quicktime','mkv':'video/x-matroska','ogg theora':'video/ogg; codecs="theora"','mpeg-ts':'video/mp2t','avi':'video/x-msvideo'};
    const at={'mp3':'audio/mpeg','aac m4a':'audio/mp4; codecs="mp4a.40.2"','wav':'audio/wav','flac':'audio/flac','ogg vorbis':'audio/ogg; codecs="vorbis"','opus':'audio/ogg; codecs="opus"','ac3':'audio/mp4; codecs="ac-3"','eac3':'audio/mp4; codecs="ec-3"'};
    const out={video:{},audio:{},webcodecs:{},mse:{}};
    for(const k in vt){out.video[k]=v.canPlayType(vt[k])||'no'; out.mse[k]=MediaSource.isTypeSupported(vt[k])}
    for(const k in at){out.audio[k]=a.canPlayType(at[k])||'no'}
    const wc={'h264':'avc1.640028','hevc':'hvc1.1.6.L93.B0','vp9':'vp09.00.10.08','av1':'av01.0.05M.08','vp8':'vp8'};
    for(const k in wc){try{const s=await Promise.race([VideoDecoder.isConfigSupported({codec:wc[k],codedWidth:1920,codedHeight:1080}),new Promise(r=>setTimeout(()=>r({supported:'timeout'}),3000))]);out.webcodecs[k]=String(s.supported)}catch(e){out.webcodecs[k]='err '+e.message}}
    out.ua=navigator.userAgent; out.pictureInPicture=!!document.pictureInPictureEnabled; out.setSinkId=typeof a.setSinkId;
    return out})()`)
  require('fs').writeFileSync(__dirname+'/out.json',JSON.stringify(r,null,1)); app.exit(0)
})
