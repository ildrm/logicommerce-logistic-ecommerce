import { Injectable } from '@nestjs/common';
import { verify } from 'argon2';

const DUMMY_PASSWORD_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$SzxIrkHBvtbwS07F6g9x4g$UyG78uAk7QPQIcxYOg48Zs1pJIuWKIDkXzFpZ5c08FQ';

@Injectable()
export class PasswordService {
  verify(passwordHash: string | null, password: string): Promise<boolean> {
    return verify(passwordHash ?? DUMMY_PASSWORD_HASH, password);
  }
}
