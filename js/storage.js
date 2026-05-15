'use strict';
// =============================================================
//  storage.js  —  Firebase Storage uploads (replaces base64 in DB)
//
//  v8 stored photos as data:image/png;base64,… inside the database.
//  A 2 MB photo became a 2 MB string sitting on every device's
//  realtime listener. Demo dies under three observations.
//
//  Here, every upload returns a downloadURL — short text — that
//  goes into the DB instead.
//
//  Public surface (window.storage):
//    storage.uploadHseImage(file)       → Promise<{url, path}>
//    storage.uploadItcMap(itcId, file)  → Promise<{url, path}>
//    storage.uploadPodImage(file)       → Promise<{url, path}>
//    storage.deleteByPath(path)         → Promise<void>
// =============================================================

(function (global) {

  const MAX = 5 * 1024 * 1024;
  const OK_TYPES = /^image\/(png|jpe?g|webp|gif)$/i;

  function _validate(file) {
    if (!file) throw new Error('No file provided.');
    if (!OK_TYPES.test(file.type)) throw new Error('Only PNG, JPG, WebP, or GIF images are accepted.');
    if (file.size > MAX) throw new Error('Image too large (max 5 MB).');
  }

  function _ext(file) {
    const m = /\.([a-z0-9]+)$/i.exec(file.name || '');
    if (m) return m[1].toLowerCase();
    if (file.type === 'image/png')  return 'png';
    if (file.type === 'image/jpeg') return 'jpg';
    if (file.type === 'image/webp') return 'webp';
    if (file.type === 'image/gif')  return 'gif';
    return 'bin';
  }

  function _todayISO() {
    const d = new Date();
    return d.getFullYear() + '-' +
           String(d.getMonth()+1).padStart(2,'0') + '-' +
           String(d.getDate()).padStart(2,'0');
  }

  /**
   * Internal upload primitive.
   * @param {string} path  Storage path
   * @param {File}   file  the browser File object
   * @param {(pct:number)=>void} [onProgress]  optional 0..100
   * @returns {Promise<{url:string, path:string}>}
   */
  function _upload(path, file, onProgress) {
    _validate(file);
    if (!auth.current()) throw new Error('Not signed in.');

    const ref = fbStorage.ref(path);
    const task = ref.put(file, { contentType: file.type });

    return new Promise((resolve, reject) => {
      task.on('state_changed',
        snap => {
          if (onProgress && snap.totalBytes) {
            onProgress(Math.round(snap.bytesTransferred * 100 / snap.totalBytes));
          }
        },
        err => reject(err),
        async () => {
          try {
            const url = await ref.getDownloadURL();
            resolve({ url, path });
          } catch (e) { reject(e); }
        }
      );
    });
  }

  function uploadHseImage(file, onProgress) {
    const id = (auth.current() || {}).uid + '_' + Date.now() + '.' + _ext(file);
    return _upload('hse/' + _todayISO() + '/' + id, file, onProgress);
  }

  function uploadItcMap(itcId, file, onProgress) {
    if (!/^ITC-\d+$/.test(itcId)) throw new Error('Bad ITC id');
    const id = Date.now() + '.' + _ext(file);
    return _upload('itc/' + itcId + '/maps/' + id, file, onProgress);
  }

  function uploadPodImage(file, onProgress) {
    const id = (auth.current() || {}).uid + '_' + Date.now() + '.' + _ext(file);
    return _upload('pod/' + _todayISO() + '/' + id, file, onProgress);
  }

  async function deleteByPath(path) {
    if (!auth.current()) throw new Error('Not signed in.');
    await fbStorage.ref(path).delete();
  }

  global.storage = { uploadHseImage, uploadItcMap, uploadPodImage, deleteByPath };

})(window);
