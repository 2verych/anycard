const express = require('express');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const crypto = require('crypto');
const dataConnector = require('./data-connector');

const PREVIEW_SIZE = parseInt(process.env.PREVIEW_SIZE) || 128;

function uploadsMiddleware() {
  return express.static(dataConnector.getUploadsDir());
}

function filePath(uid, file, preview = false) {
  const dir = dataConnector.getUserDir(uid);
  return preview ? path.join(dir, 'previews', file) : path.join(dir, file);
}

function addCard(uid, file, comment, groups, originalEmail) {
  const userDir = dataConnector.getUserDir(uid);
  dataConnector.ensureDirs(userDir);
  const hash = crypto.createHash('sha256')
    .update(process.env.SALT + Date.now() + Math.random() + file.originalname)
    .digest('hex');
  const filename = hash + path.extname(file.originalname).toLowerCase();
  const dest = path.join(userDir, filename);
  fs.writeFileSync(dest, file.buffer);
  const previewPath = path.join(userDir, 'previews', filename);
  return sharp(file.buffer)
    .resize(PREVIEW_SIZE)
    .toFile(previewPath)
    .then(() => {
      dataConnector.saveMeta(userDir, filename, { comment, groups, originalName: file.originalname, size: file.size, email: originalEmail });
      return { filename };
    });
}

function listCards(uid) {
  const userDir = dataConnector.getUserDir(uid);
  if (!fs.existsSync(userDir)) return [];
  const files = fs
    .readdirSync(userDir)
    .filter(
      (f) =>
        !f.endsWith('.txt') &&
        f !== 'previews' &&
        f !== 'meta' &&
        !f.endsWith('.json')
    );
  return files.map((f) => {
    const meta = dataConnector.loadMeta(userDir, f);
    return {
      filename: f,
      original: `/files/${uid}/${f}`,
      preview: `/files/${uid}/previews/${f}`,
      comment: meta.comment,
      groups: meta.groups,
      owner: uid,
      originalName: meta.originalName,
      size: meta.size,
    };
  });
}

function deleteCard(uid, filename) {
  const userDir = dataConnector.getUserDir(uid);
  try {
    fs.unlinkSync(path.join(userDir, filename));
  } catch {}
  try {
    fs.unlinkSync(path.join(userDir, 'previews', filename));
  } catch {}
  try {
    fs.unlinkSync(path.join(userDir, 'meta', filename + '.json'));
  } catch {}
}

function loadMeta(uid, file) {
  const dir = dataConnector.getUserDir(uid);
  return dataConnector.loadMeta(dir, file);
}

function saveMeta(uid, file, meta) {
  const dir = dataConnector.getUserDir(uid);
  dataConnector.saveMeta(dir, file, meta);
}

function loadGroups(uid) {
  return dataConnector.loadGroups(dataConnector.getUserDir(uid));
}

function saveGroups(uid, groups) {
  dataConnector.saveGroups(dataConnector.getUserDir(uid), groups);
}

function loadRejections(uid) {
  return dataConnector.loadRejections(dataConnector.getUserDir(uid));
}

function saveRejections(uid, data) {
  dataConnector.saveRejections(dataConnector.getUserDir(uid), data);
}

function loadUsage(uid) {
  return dataConnector.loadUsage(dataConnector.getUserDir(uid));
}

function saveUsage(uid, data) {
  dataConnector.saveUsage(dataConnector.getUserDir(uid), data);
}

function loadSharedState(uid) {
  return dataConnector.loadSharedState(dataConnector.getUserDir(uid));
}

function saveSharedState(uid, data) {
  dataConnector.saveSharedState(dataConnector.getUserDir(uid), data);
}

module.exports = {
  uploadsMiddleware,
  addCard,
  listCards,
  deleteCard,
  loadMeta,
  saveMeta,
  loadGroups,
  saveGroups,
  loadRejections,
  saveRejections,
  loadUsage,
  saveUsage,
  loadSharedState,
  saveSharedState,
  loadSharedUsers: dataConnector.loadSharedUsers,
  saveSharedUsers: dataConnector.saveSharedUsers,
  loadUserInfo: dataConnector.loadUserInfo,
  saveUserInfo: dataConnector.saveUserInfo,
  ownerExists: dataConnector.ownerExists,
  allOwners: dataConnector.allUserDirs,
  ensureUser(uid) {
    dataConnector.ensureDirs(dataConnector.getUserDir(uid));
  },
  filePath,
};
