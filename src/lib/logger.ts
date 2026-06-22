type Level = 'debug' | 'info' | 'warn' | 'error';

export interface LogRecord {
  timestamp: string;
  level: Level;
  message: string;
  context?: Record<string, unknown>;
}

export class Logger {
  constructor(
    private readonly verbose = false,
    private readonly prefix = 'content-import'
  ) {}

  debug(message: string, context?: Record<string, unknown>): void {
    if (this.verbose) {
      this.log('debug', message, context);
    }
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, context?: Record<string, unknown>): void {
    this.log('error', message, context);
  }

  child(suffix: string): Logger {
    return new Logger(this.verbose, `${this.prefix}:${suffix}`);
  }

  private log(level: Level, message: string, context?: Record<string, unknown>): void {
    const record: LogRecord = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context
    };

    const printable = context ? `${message} ${JSON.stringify(context)}` : message;
    const line = `[${record.timestamp}] ${this.prefix} ${level.toUpperCase()} ${printable}`;
    // eslint-disable-next-line no-console
    console.log(line);
  }
}
