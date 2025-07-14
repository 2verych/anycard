const express = require('express');
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const dataConnector = require('./data-connector');

const PREVIEW_SIZE = parseInt(process.env.PREVIEW_SIZE) || 128;

function uploadsMiddleware() {
  return express.static(dataConnector.getUploadsDir());
}

function addCard(email, file, comment, groups) {
  const userDir = dataConnector.getUserDir(email);
  dataConnector.ensureDirs(userDir);
  const filename = Date.now() + path.extname(file.originalname);
  const dest = path.join(userDir, filename);
  fs.writeFileSync(dest, file.buffer);
  const previewPath = path.join(userDir, 'previews', filename);
  return sharp(file.buffer)
    .resize(PREVIEW_SIZE)
    .toFile(previewPath)
    .then(() => {
      dataConnector.saveMeta(userDir, filename, { comment, groups });
      return { filename };
    });
}

function listCards(email) {
  const userDir = dataConnector.getUserDir(email);
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
      original: `/uploads/${email}/${f}`,
      preview: `/uploads/${email}/previews/${f}`,
      comment: meta.comment,
      groups: meta.groups,
      owner: email,
    };
  });
}

function deleteCard(email, filename) {
  const userDir = dataConnector.getUserDir(email);
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

function loadMeta(email, file) {
  const dir = dataConnector.getUserDir(email);
  return dataConnector.loadMeta(dir, file);
}

function saveMeta(email, file, meta) {
  const dir = dataConnector.getUserDir(email);
  dataConnector.saveMeta(dir, file, meta);
}

function loadGroups(email) {
  return dataConnector.loadGroups(dataConnector.getUserDir(email));
}

function saveGroups(email, groups) {
  dataConnector.saveGroups(dataConnector.getUserDir(email), groups);
}

function loadRejections(email) {
  return dataConnector.loadRejections(dataConnector.getUserDir(email));
}

function saveRejections(email, data) {
  dataConnector.saveRejections(dataConnector.getUserDir(email), data);
}

function loadUsage(email) {
  return dataConnector.loadUsage(dataConnector.getUserDir(email));
}

function saveUsage(email, data) {
  dataConnector.saveUsage(dataConnector.getUserDir(email), data);
}

function loadSharedState(email) {
  return dataConnector.loadSharedState(dataConnector.getUserDir(email));
}

function saveSharedState(email, data) {
  dataConnector.saveSharedState(dataConnector.getUserDir(email), data);
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
  ownerExists: dataConnector.ownerExists,
  allOwners: dataConnector.allUserDirs,
  ensureUser(email) {
    dataConnector.ensureDirs(dataConnector.getUserDir(email));
  },
};
