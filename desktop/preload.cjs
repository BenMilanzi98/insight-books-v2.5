const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('desktopBridge', {
  getDeviceId: () => ipcRenderer.invoke('desktop:getDeviceId'),
  finishSetup: (snapshot, sessionCookie, bindMeta) =>
    ipcRenderer.invoke('desktop:finishSetup', { snapshot, sessionCookie, bindMeta }),
});
