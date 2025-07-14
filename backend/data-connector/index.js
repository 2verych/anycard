const type = process.env.DATA_CONNECTOR || 'fs';

let connector;
if (type === 'mysql') {
  connector = require('./mysql');
} else {
  connector = require('./fs');
}

connector.type = type;

module.exports = connector;
