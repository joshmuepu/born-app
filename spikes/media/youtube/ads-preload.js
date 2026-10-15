const { ipcRenderer, contextBridge } = require('electron')
contextBridge.exposeInMainWorld('__openSignin', () => ipcRenderer.send('open-signin'))
