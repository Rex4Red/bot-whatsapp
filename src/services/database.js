const path = require('path');
const dataDir = process.env.DATA_DIR || '.';
const dbPath = path.join(dataDir, 'database.sqlite');
const db = require('better-sqlite3')(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');

// Create tables
db.exec(`
  CREATE TABLE IF NOT EXISTS message_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    phone_number TEXT NOT NULL,
    message TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending',
    error TEXT,
    type TEXT DEFAULT 'single',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS contacts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    phone_number TEXT NOT NULL UNIQUE,
    group_name TEXT DEFAULT 'default',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE INDEX IF NOT EXISTS idx_message_logs_status ON message_logs(status);
  CREATE INDEX IF NOT EXISTS idx_message_logs_created_at ON message_logs(created_at);
  CREATE INDEX IF NOT EXISTS idx_contacts_group ON contacts(group_name);
`);

// Message logs
const insertMessageLog = db.prepare(`
  INSERT INTO message_logs (phone_number, message, status, error, type)
  VALUES (@phone_number, @message, @status, @error, @type)
`);

const updateMessageLog = db.prepare(`
  UPDATE message_logs SET status = @status, error = @error WHERE id = @id
`);

const getMessageLogs = (page = 1, limit = 20, status = null) => {
  const offset = (page - 1) * limit;
  let query = 'SELECT * FROM message_logs';
  let countQuery = 'SELECT COUNT(*) as total FROM message_logs';
  const params = {};

  if (status) {
    query += ' WHERE status = @status';
    countQuery += ' WHERE status = @status';
    params.status = status;
  }

  query += ' ORDER BY created_at DESC LIMIT @limit OFFSET @offset';
  params.limit = limit;
  params.offset = offset;

  const logs = db.prepare(query).all(params);
  const { total } = db.prepare(countQuery).get(status ? { status } : {}) || { total: 0 };

  return { logs, total, page, limit, totalPages: Math.ceil(total / limit) };
};

const getMessageStats = () => {
  const stats = db.prepare(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) as sent,
      SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
      SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending
    FROM message_logs
  `).get();

  const today = db.prepare(`
    SELECT COUNT(*) as count FROM message_logs 
    WHERE date(created_at) = date('now')
  `).get();

  return { ...stats, today: today.count };
};

// Contacts
const insertContact = db.prepare(`
  INSERT INTO contacts (name, phone_number, group_name)
  VALUES (@name, @phone_number, @group_name)
`);

const deleteContact = db.prepare('DELETE FROM contacts WHERE id = ?');

const getAllContacts = (group = null) => {
  if (group) {
    return db.prepare('SELECT * FROM contacts WHERE group_name = ? ORDER BY name').all(group);
  }
  return db.prepare('SELECT * FROM contacts ORDER BY name').all();
};

const getContactById = db.prepare('SELECT * FROM contacts WHERE id = ?');

module.exports = {
  db,
  insertMessageLog,
  updateMessageLog,
  getMessageLogs,
  getMessageStats,
  insertContact,
  deleteContact,
  getAllContacts,
  getContactById,
};
