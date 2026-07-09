type LogLevel = 'INFO' | 'WARN' | 'ERROR';

function formatLog(level: LogLevel, message: string, context?: Record<string, unknown>): string {
  const timestamp = new Date().toISOString();
  const ctx = context ? ` ${JSON.stringify(context)}` : '';
  return `[${timestamp}] [${level}] ${message}${ctx}\n`;
}

export function info(message: string, context?: Record<string, unknown>): void {
  process.stderr.write(formatLog('INFO', message, context));
}

export function warn(message: string, context?: Record<string, unknown>): void {
  process.stderr.write(formatLog('WARN', message, context));
}

export function error(message: string, context?: Record<string, unknown>): void {
  process.stderr.write(formatLog('ERROR', message, context));
}