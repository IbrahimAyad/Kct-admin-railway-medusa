declare module 'medusa-interfaces' {
  export class BaseService {
    constructor(...args: any[]);
  }

  export interface Logger {
    info(message: string, ...meta: any[]): void;
    warn(message: string, ...meta: any[]): void;
    error(message: string, ...meta: any[]): void;
    debug(message: string, ...meta: any[]): void;
  }
}
