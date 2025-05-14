const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const filePath = process.argv[2];

if (!filePath) {
  console.error('Ошибка: путь к файлу не указан.');
  process.exit(1);
}

function readFileSyncOrExit(file, errorCode) {
  try {
    return fs.readFileSync(file);
  } catch (err) {
    console.error(`Ошибка чтения файла: ${file}`);
    process.exit(errorCode);
  }
}

const fileBuffer = readFileSyncOrExit(filePath, 100);

const hashFilePath = filePath + '.sha256';
const hashFileContent = readFileSyncOrExit(hashFilePath, 101).toString().trim();

const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

if (hash !== hashFileContent) {
  console.error('Ошибка: хеш не совпадает.');
  process.exit(102);
}

console.log('Успех: хеш совпадает.');

