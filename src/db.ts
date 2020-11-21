import fs from 'fs';
import path from 'path';
import sqlite3 from 'sqlite3';
import logger from './logger';
import { BaseballMeta } from './utils/types';

type Event = {
  id: number,
  eventType: 'pay' | 'clear' | 'dutch',
  fromName: string,
  toNames: string,
  amount: number,
  comment: string,
  createdAt: Date,
};

type Balance = {
  nameA: string,
  nameB: string,
  debt: number,
};

function getNowTs() {
  return Math.floor(new Date().getTime() / 1000);
}

function convertRow(row: any): Event {
  return {
    id: row.id,
    eventType: row.event_type,
    fromName: row.from_name,
    toNames: row.to_names,
    amount: row.amount,
    comment: row.comment,
    createdAt: new Date(row.created_at * 1000),
  };
}

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

    // event_type = 'pay' | 'repay' | 'dutch'
    this.run(`
      CREATE TABLE IF NOT EXISTS event (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type VARCHAR(32),
        from_name VARCHAR(20),
        to_names TEXT,
        amount INTEGER,
        comment TEXT,
        created_at INTEGER
      )
    `, []).then(() => logger.info('`event` table initialized'))
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
    this.run(`
      CREATE TABLE IF NOT EXISTS baseball_session (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id VARCHAR(32),
        answer VARCHAR(4),
        trial INTEGER,
        log TEXT,
        meta TEXT
      )
    `, []).then(() => logger.info('`baseball_session` table initialized'));
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

  /* ******** */
  /* Balances */
  /* ******** */
  async updateBalance(from: string, to: string, amount: number) {
    // from 이 to 에게 amount 만큼 빌려줬을 때 상태를 업데이트
    const [nameA, nameB] = from < to ? [from, to] : [to, from];
    const debt = from < to ? -amount : amount;
    const row = await this.get(`
      SELECT debt FROM balance WHERE name_a=? AND name_b=?
    `, [nameA, nameB]);
    if (row) {
      this.run(`
        UPDATE balance SET debt=? WHERE name_a=? AND name_b=?
      `, [row.debt + debt, nameA, nameB]);
    } else {
      this.run(`
        INSERT INTO balance (name_a, name_b, debt) VALUES (?, ?, ?)
      `, [nameA, nameB, debt]);
    }
  }

  async addTransaction(from: string, to: string, comment: string, amount: number) {
    // Add event
    try {
      await this.run(`
        INSERT INTO event (event_type, from_name, to_names, amount, comment, created_at) VALUES ("pay", ?, ?, ?, ?, ?)
      `, [from, to, amount, comment, getNowTs()])
    } catch (err) {
      throw err;
    }
    // Modify balance
    await this.updateBalance(from, to, amount);
    return true;
  }

  async addDutch(from: string, tos: string[], comment: string, totalAmount: number) {
    // Add event
    try {
      await this.run(`
        INSERT INTO event (event_type, from_name, to_names, amount, comment, created_at) VALUES ("dutch", ?, ?, ?, ?, ?)
      `, [from, tos.join(','), totalAmount, comment, getNowTs()])
    } catch (err) {
      throw err;
    }
    // Modify balance
    const dutchAmount = Math.ceil(totalAmount / (tos.length + 1));
    await Promise.all(tos.map((toName) => this.updateBalance(from, toName, dutchAmount)));
    return true;
  }

  async addClear(name1: string, name2: string, comment?: string) {
    const [nameA, nameB] = name1 < name2 ? [name1, name2] : [name2, name1];
    const row = await this.get(`
      SELECT debt FROM balance WHERE name_a=? AND name_b=?
    `, [nameA, nameB]);
    const debt = (() => {
      if (row) return row.debt;
      else return 0;
    })();
    if (debt === 0) return false;
    // Add event
    const amount = Math.abs(debt);
    const [from, to] = debt > 0 ? [nameA, nameB] : [nameB, nameA];
    try {
      await this.run(`
        INSERT INTO event (event_type, from_name, to_names, amount, comment, created_at) VALUES ("clear", ?, ?, ?, ?, ?)
      `, [from, to, amount, comment ?? '', getNowTs()])
    } catch (err) {
      throw err;
    }
    // Modify balance
    await this.updateBalance(from, to, amount);
    return true;
  }

  async undoEvent() {
    const row = await this.get(`
      SELECT * FROM event ORDER BY id DESC LIMIT 1
    `, []);
    if (row) {
      const convertedRow: Event = convertRow(row);
      // Update balance
      if (['pay', 'clear'].includes(convertedRow.eventType)) {
        await this.updateBalance(convertedRow.toNames, convertedRow.fromName, convertedRow.amount);
      } else if (convertedRow.eventType === 'dutch') {
        const people = convertedRow.toNames.split(',');
        const dutchAmount = Math.ceil(convertedRow.amount / (people.length + 1));
        await Promise.all(people.map((toName) => this.updateBalance(toName, convertedRow.fromName, dutchAmount)));  
      } else {
        throw new Error('Unknown event_type');
      }
      // Delete event
      await this.run(`
        DELETE FROM event WHERE id=?
      `, [convertedRow.id]);
      return true;
    } else {
      return false;
    }
  }

  async getEvents(limit: number, name1?: string, name2?: string): Promise<Event[]> {
    let rows;
    if (name1) {
      if (name2) {
        rows = await this.all(`
          SELECT * FROM event WHERE (from_name=? OR to_names LIKE ?) AND (from_name=? OR to_names LIKE ?) ORDER BY id DESC LIMIT ?
        `, [name1, `%${name1}%`, name2, `%${name2}%`, limit]);
      } else {
        rows = await this.all(`
          SELECT * FROM event WHERE from_name=? OR to_names LIKE ? ORDER BY id DESC LIMIT ?
        `, [name1, `%${name1}%`, limit]);
      }
    } else {
      rows = await this.all(`
        SELECT * FROM event ORDER BY id DESC LIMIT ?
      `, [limit]);
    }
    return rows.map((row) => convertRow(row));
  }

  async getBalances(name?: string): Promise<Balance[]> {
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

  /* ******** */
  /* Baseball */
  /* ******** */
  async getBaseballSession(userId: string) {
    const row = await this.get(`
      SELECT * FROM baseball_session WHERE user_id=?
    `, [userId]);
    if (row) {
      return {
        answer: row.answer as string,
        trial: row.trial as number,
        log: row.log.split(',').filter((e: string) => e !== '') as string[],
        meta: JSON.parse(row.meta) as BaseballMeta,
      };
    }
    return false;
  }

  async createBaseballSession(userId: string, answer: string, meta: BaseballMeta) {
    try {
      await this.run(`
        INSERT INTO baseball_session (user_id, answer, trial, log, meta) VALUES (?, ?, 0, '', ?)
      `, [userId, answer, JSON.stringify(meta)]);
    } catch (err) {
      throw err;
    }
    return true;
  }

  async updateBaseballSession(userId: string, trial: number, log: string[]) {
    this.run(`
      UPDATE baseball_session SET trial=?, log=? WHERE user_id=?
    `, [trial, log.join(','), userId]);
    return true;
  }

  async dropBaseballSession(userId: string) {
    await this.run(`
      DELETE FROM baseball_session WHERE user_id=?
    `, [userId]);
    return true;
  }
}

const DB_DIR = path.join(__dirname, '../db');
if (!fs.existsSync(DB_DIR)) {
  fs.mkdirSync(DB_DIR);
}
const db = new DB(`${DB_DIR}/my.db`);
export default db;
