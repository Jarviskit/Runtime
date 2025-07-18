import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { AppDataSource } from '../../config/database.js';
import { UserEntity } from '../../entities/user.entity.js';
import { config } from '../../config/index.js';

export interface LoginData {
  email: string;
  password: string;
}

export interface RegisterData {
  email: string;
  password: string;
  name?: string;
}

export interface AuthResult {
  user: {
    id: string;
    email: string;
    name?: string;
    avatar?: string;
  };
  token: string;
  expiresIn: string;
}

export class AuthService {
  private userRepository = AppDataSource.getRepository(UserEntity);

  async login(email: string, password: string): Promise<AuthResult> {
    const user = await this.userRepository.findOne({
      where: { email, isActive: true },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.passwordHash) {
      throw new Error('Password not set for this user');
    }

    const isValidPassword = await bcrypt.compare(password, user.passwordHash);
    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      token,
      expiresIn: config.jwt.expiresIn,
    };
  }

  async register(userData: RegisterData): Promise<AuthResult> {
    // Check if user already exists
    const existingUser = await this.userRepository.findOne({
      where: { email: userData.email },
    });

    if (existingUser) {
      throw new Error('User already exists');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(userData.password, 10);

    // Create user
    const user = this.userRepository.create({
      id: this.generateId(),
      email: userData.email,
      name: userData.name,
      passwordHash,
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await this.userRepository.save(user);

    const token = this.generateToken(user);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      },
      token,
      expiresIn: config.jwt.expiresIn,
    };
  }

  async verifyToken(token: string): Promise<{ user: any }> {
    try {
      const decoded = jwt.verify(token, config.jwt.secret) as any;
      
      const user = await this.userRepository.findOne({
        where: { id: decoded.userId, isActive: true },
      });

      if (!user) {
        throw new Error('User not found');
      }

      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatar: user.avatar,
        },
      };
    } catch (error) {
      throw new Error('Invalid token');
    }
  }

  async refreshToken(token: string): Promise<AuthResult> {
    const { user } = await this.verifyToken(token);
    
    const userEntity = await this.userRepository.findOne({
      where: { id: user.id },
    });

    if (!userEntity) {
      throw new Error('User not found');
    }

    const newToken = this.generateToken(userEntity);

    return {
      user,
      token: newToken,
      expiresIn: config.jwt.expiresIn,
    };
  }

  private generateToken(user: UserEntity): string {
    return jwt.sign(
      {
        userId: user.id,
        email: user.email,
      },
      config.jwt.secret,
      {
        expiresIn: config.jwt.expiresIn,
      }
    );
  }

  private generateId(): string {
    return 'user_' + Math.random().toString(36).substr(2, 9) + Date.now().toString(36);
  }
}