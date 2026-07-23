import { Injectable } from '@nestjs/common';
import { argon2id, hash, verify } from 'argon2';

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$SzxIrkHBvtbwS07F6g9x4g$UyG78uAk7QPQIcxYOg48Zs1pJIuWKIDkXzFpZ5c08FQ';

@Injectable()
export class PasswordService {
  hash(password: string): Promise<string> {
    return hash(password, { type: argon2id, memoryCost: 65_536, timeCost: 3, parallelism: 1 });
  }

  verify(passwordHash: string | null, password: string): Promise<boolean> {
    return verify(passwordHash ?? DUMMY_PASSWORD_HASH, password);
  }
}
