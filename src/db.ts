import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import logger from './logger';

export class DB {
  db: sqlite3.Database;

  constructor(dbPath: string) {
    logger.info(`Using database at ${dbPath}...`)
    this.db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE, (err) => {
      if (err) {
        logger.error(err.message);
      } else {
        logger.info('Connected to database');
      }
    });

    this.run(`
      CREATE TABLE IF NOT EXISTS transact (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        from_name VARCHAR(20),
        to_name VARCHAR(20),
        amount INTEGER,
        reason TEXT,
        createdAt DATETIME
      )
    `, []).then(() => logger.info('`transact` table initialized'))
      .catch((err) => { throw err });
    this.run(`
      CREATE TABLE IF NOT EXISTS balance (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name_a VARCHAR(20),
        name_b VARCHAR(20),
        debt INTEGER
      )
    `, []).then(() => logger.info('`balance` table initialized'))
      .catch((err) => { throw err; });
  }

  async run(sql: string, params: any[]) {
    return new Promise<boolean>((resolve, reject) => {
      this.db.run(sql, params, (err) => {
        if (err) reject(err);
        else resolve(true);
      });
    })
  }

  async all(sql: string, params: any[]) {
    return new Promise<any[]>((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  async get(sql: string, params: any[]) {
    return new Promise<any>((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  async addTransaction(from: string, to: string, reason: string, amount: number) {
    try {
      await this.run(`
        INSERT INTO transact (from_name, to_name, amount, reason, createdAt) VALUES (?, ?, ?, ?, ?)
      `, [from, to, amount, reason, new Date()])
    } catch (err) {
      throw err;
    }
    const [nameA, nameB] = from < to ? [from, to] : [to, from];
    const debt = from < to ? -amount : amount;
    const row = await this.get(`
      SELECT debt FROM balance WHERE name_a=? AND name_b=?
    `, [nameA, nameB]);
    if (row) {
      const newDebt = row.debt + debt;
      if (newDebt === 0) {
        this.run(`
          DELETE FROM balance WHERE name_a=? AND name_b=?
        `, [nameA, nameB]);
        this.run(`
          DELETE FROM transact WHERE (from_name=? AND to_name=?) OR (from_name=? AND to_name=?)
        `, [nameA, nameB, nameB, nameA]); // Delete related transactions
      } else {
        this.run(`
          UPDATE balance SET debt=? WHERE name_a=? AND name_b=?
        `, [row.debt + debt, nameA, nameB]);
      }
    } else {
      this.run(`
        INSERT INTO balance (name_a, name_b, debt) VALUES (?, ?, ?)
      `, [nameA, nameB, debt]);
    }
    return true;
  }

  async getTransactions(limit: number, name1?: string, name2?: string) {
    let rows;
    if (name1) {
      if (name2) {
        rows = await this.all(`
          SELECT * FROM transact WHERE (from_name=? OR to_name=?) AND (from_name=? OR to_name=?) ORDER BY createdAt DESC LIMIT ?
        `, [name1, name1, name2, name2, limit]);
      } else {
        rows = await this.all(`
          SELECT * FROM transact WHERE from_name=? OR to_name=? ORDER BY createdAt DESC LIMIT ?
        `, [name1, name1, limit]);
      }
    } else {
      rows = await this.all(`
        SELECT * FROM transact ORDER BY createdAt DESC LIMIT ?
      `, [limit]);
    }
    return rows.map((row) => ({
      id: row.id,
      fromName: row.from_name,
      toName: row.to_name,
      amount: row.amount,
      reason: row.reason,
      createdAt: row.createdAt,
    }));
  }

  async getBalances(name?: string) {
    let rows;
    if (name) {
      rows = await this.all(`
        SELECT * FROM balance WHERE name_a=? OR name_b=?
      `, [name, name]);
    } else {
      rows = await this.all(`
        SELECT * FROM balance
      `, []);
    }
    return rows.map((row) => ({
      nameA: row.name_a,
      nameB: row.name_b,
      debt: row.debt,
    }));
  }
}

const DB_DIR = path.join(__dirname, '../db');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR);
}
const db = new DB(`${DB_DIR}/my.db`);
export default db;
