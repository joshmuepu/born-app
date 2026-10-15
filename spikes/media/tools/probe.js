const { app, BrowserWindow } = require('electron')
app.whenReady().then(async () => {
  const w = new BrowserWindow({ show: false })
  await w.loadURL('http://127.0.0.1:1/')  .catch(()=>{})
  await w.loadURL('data:text/html,<html></html>')
  const r = await w.webContents.executeJavaScript(`(()=>{const o={};
   for (const t of ['video/mp4;codecs=avc1.640028','video/mp4;codecs=avc1','video/mp4;codecs=hvc1.1.6.L93.B0','video/mp4','video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm;codecs=av1','video/x-matroska;codecs=avc1']) o[t]=MediaRecorder.isTypeSupported(t);
   o.secure=isSecureContext; o.VideoDecoder=typeof VideoDecoder; o.cores=navigator.hardwareConcurrency; return o})()`)
  console.log('R'+JSON.stringify(r)); app.exit(0)
})
