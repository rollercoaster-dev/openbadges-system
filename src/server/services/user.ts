import Database from 'sqlite3';
import { promisify } from 'util';
import { join } from 'path';
import { existsSync, mkdirSync } from 'fs';

export interface User {
  id: string;
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  isActive: boolean;
  roles: string[];
  createdAt: string;
  updatedAt: string;
}

export interface CreateUserData {
  username: string;
  email: string;
  firstName: string;
  lastName: string;
  avatar?: string;
  isActive: boolean;
  roles: string[];
}

export interface UpdateUserData {
  email?: string;
  firstName?: string;
  lastName?: string;
  avatar?: string;
  isActive?: boolean;
  roles?: string[];
}

export interface UserCredential {
  id: string;
  userId: string;
  publicKey: string;
  transports: string[];
  counter: number;
  createdAt: string;
  lastUsed: string;
  name: string;
  type: 'platform' | 'cross-platform';
}

export interface UserSearchFilters {
  role?: string;
  status?: string;
  dateFrom?: string;
  dateTo?: string;
  credentials?: string;
  lastLogin?: string;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export class UserService {
  private db: Database.Database;
  private dbPath: string;

  constructor() {
    // Create data directory if it doesn't exist
    const dataDir = join(process.cwd(), 'data');
    if (!existsSync(dataDir)) {
      mkdirSync(dataDir, { recursive: true });
    }

    this.dbPath = join(dataDir, 'users.sqlite');
    this.db = new Database.Database(this.dbPath);
    
    // Enable foreign keys
    this.db.run('PRAGMA foreign_keys = ON');
    
    this.initializeDatabase();
  }

  private initializeDatabase() {
    try {
      // Create users table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT UNIQUE NOT NULL,
          email TEXT UNIQUE NOT NULL,
          firstName TEXT NOT NULL,
          lastName TEXT NOT NULL,
          avatar TEXT,
          isActive BOOLEAN NOT NULL DEFAULT 1,
          roles TEXT NOT NULL DEFAULT '["USER"]',
          createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );
      `);

      // Create user credentials table
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS user_credentials (
          id TEXT PRIMARY KEY,
          userId TEXT NOT NULL,
          publicKey TEXT NOT NULL,
          transports TEXT NOT NULL DEFAULT '[]',
          counter INTEGER NOT NULL DEFAULT 0,
          createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          lastUsed TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          name TEXT NOT NULL,
          type TEXT NOT NULL CHECK (type IN ('platform', 'cross-platform')),
          FOREIGN KEY (userId) REFERENCES users (id) ON DELETE CASCADE
        );
      `);

      // Create indexes for better performance
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
        CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
        CREATE INDEX IF NOT EXISTS idx_credentials_userId ON user_credentials(userId);
      `);
      
      console.log('Database initialized successfully');
    } catch (error) {
      console.error('Error initializing database:', error);
      throw error;
    }
  }

  private async runAsync(sql: string, params: any[] = []): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.run(sql, params, function(err) {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private async getAsync(sql: string, params: any[] = []): Promise<any> {
    return new Promise((resolve, reject) => {
      this.db.get(sql, params, (err, row) => {
        if (err) reject(err);
        else resolve(row);
      });
    });
  }

  private async allAsync(sql: string, params: any[] = []): Promise<any[]> {
    return new Promise((resolve, reject) => {
      this.db.all(sql, params, (err, rows) => {
        if (err) reject(err);
        else resolve(rows);
      });
    });
  }

  private generateId(): string {
    return 'user_' + Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  private parseUser(row: any): User {
    return {
      id: row.id,
      username: row.username,
      email: row.email,
      firstName: row.firstName,
      lastName: row.lastName,
      avatar: row.avatar,
      isActive: Boolean(row.isActive),
      roles: JSON.parse(row.roles),
      createdAt: row.createdAt,
      updatedAt: row.updatedAt
    };
  }

  async createUser(userData: CreateUserData): Promise<User> {
    const id = this.generateId();
    const now = new Date().toISOString();
    
    const sql = `
      INSERT INTO users (id, username, email, firstName, lastName, avatar, isActive, roles, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      id,
      userData.username,
      userData.email,
      userData.firstName,
      userData.lastName,
      userData.avatar || null,
      userData.isActive ? 1 : 0,
      JSON.stringify(userData.roles),
      now,
      now
    ];

    await this.runAsync(sql, params);
    
    return this.getUserById(id) as Promise<User>;
  }

  async getUserById(id: string): Promise<User | null> {
    const row = await this.getAsync('SELECT * FROM users WHERE id = ?', [id]);
    return row ? this.parseUser(row) : null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const row = await this.getAsync('SELECT * FROM users WHERE username = ?', [username]);
    return row ? this.parseUser(row) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const row = await this.getAsync('SELECT * FROM users WHERE email = ?', [email]);
    return row ? this.parseUser(row) : null;
  }

  async getUsers(
    page: number = 1,
    limit: number = 10,
    search?: string,
    filters?: UserSearchFilters
  ): Promise<{ users: User[]; total: number }> {
    let whereClause = 'WHERE 1=1';
    let params: any[] = [];

    // Add search filter
    if (search) {
      whereClause += ' AND (username LIKE ? OR email LIKE ? OR firstName LIKE ? OR lastName LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm, searchTerm);
    }

    // Add filters
    if (filters?.role) {
      whereClause += ' AND roles LIKE ?';
      params.push(`%"${filters.role}"%`);
    }

    if (filters?.status) {
      const isActive = filters.status === 'active' ? 1 : 0;
      whereClause += ' AND isActive = ?';
      params.push(isActive);
    }

    if (filters?.dateFrom) {
      whereClause += ' AND createdAt >= ?';
      params.push(filters.dateFrom);
    }

    if (filters?.dateTo) {
      whereClause += ' AND createdAt <= ?';
      params.push(filters.dateTo);
    }

    // Get total count
    const totalResult = await this.getAsync(`SELECT COUNT(*) as count FROM users ${whereClause}`, params);
    const total = totalResult.count;

    // Add sorting
    const sortBy = filters?.sortBy || 'createdAt';
    const sortOrder = filters?.sortOrder || 'desc';
    const orderClause = `ORDER BY ${sortBy} ${sortOrder.toUpperCase()}`;

    // Add pagination
    const offset = (page - 1) * limit;
    const paginationClause = `LIMIT ? OFFSET ?`;
    params.push(limit, offset);

    // Get users
    const rows = await this.allAsync(
      `SELECT * FROM users ${whereClause} ${orderClause} ${paginationClause}`,
      params
    );

    const users = rows.map(row => this.parseUser(row));

    return { users, total };
  }

  async updateUser(id: string, userData: UpdateUserData): Promise<User | null> {
    const updates: string[] = [];
    const params: any[] = [];

    if (userData.email !== undefined) {
      updates.push('email = ?');
      params.push(userData.email);
    }

    if (userData.firstName !== undefined) {
      updates.push('firstName = ?');
      params.push(userData.firstName);
    }

    if (userData.lastName !== undefined) {
      updates.push('lastName = ?');
      params.push(userData.lastName);
    }

    if (userData.avatar !== undefined) {
      updates.push('avatar = ?');
      params.push(userData.avatar);
    }

    if (userData.isActive !== undefined) {
      updates.push('isActive = ?');
      params.push(userData.isActive ? 1 : 0);
    }

    if (userData.roles !== undefined) {
      updates.push('roles = ?');
      params.push(JSON.stringify(userData.roles));
    }

    if (updates.length === 0) {
      return this.getUserById(id);
    }

    updates.push('updatedAt = ?');
    params.push(new Date().toISOString());
    params.push(id);

    const sql = `UPDATE users SET ${updates.join(', ')} WHERE id = ?`;
    await this.runAsync(sql, params);

    return this.getUserById(id);
  }

  async deleteUser(id: string): Promise<boolean> {
    const result = await this.runAsync('DELETE FROM users WHERE id = ?', [id]);
    return true;
  }

  // Credential management
  async addUserCredential(userId: string, credential: Omit<UserCredential, 'userId'>): Promise<void> {
    const sql = `
      INSERT INTO user_credentials (id, userId, publicKey, transports, counter, createdAt, lastUsed, name, type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    
    const params = [
      credential.id,
      userId,
      credential.publicKey,
      JSON.stringify(credential.transports),
      credential.counter,
      credential.createdAt,
      credential.lastUsed,
      credential.name,
      credential.type
    ];

    await this.runAsync(sql, params);
  }

  async getUserCredentials(userId: string): Promise<UserCredential[]> {
    const rows = await this.allAsync('SELECT * FROM user_credentials WHERE userId = ?', [userId]);
    return rows.map(row => ({
      id: row.id,
      userId: row.userId,
      publicKey: row.publicKey,
      transports: JSON.parse(row.transports),
      counter: row.counter,
      createdAt: row.createdAt,
      lastUsed: row.lastUsed,
      name: row.name,
      type: row.type
    }));
  }

  async removeUserCredential(userId: string, credentialId: string): Promise<boolean> {
    await this.runAsync(
      'DELETE FROM user_credentials WHERE id = ? AND userId = ?',
      [credentialId, userId]
    );
    return true;
  }

  async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.db.close((err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }
}

export const userService = new UserService();
