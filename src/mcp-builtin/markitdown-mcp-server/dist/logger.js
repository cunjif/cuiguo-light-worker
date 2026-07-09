function formatLog(level, message, context) {
    const timestamp = new Date().toISOString();
    const ctx = context ? ` ${JSON.stringify(context)}` : '';
    return `[${timestamp}] [${level}] ${message}${ctx}\n`;
}
export function info(message, context) {
    process.stderr.write(formatLog('INFO', message, context));
}
export function warn(message, context) {
    process.stderr.write(formatLog('WARN', message, context));
}
export function error(message, context) {
    process.stderr.write(formatLog('ERROR', message, context));
}
//# sourceMappingURL=logger.js.map