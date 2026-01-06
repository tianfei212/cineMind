type LogLevel = 'INFO' | 'WARN' | 'ERROR' | 'EVENT';

interface LogPayload {
  level: LogLevel;
  message: string;
  data?: any;
  timestamp: string;
}

const postLog = async (payload: LogPayload) => {
  try {
    await fetch('/__log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {}
};

const format = (level: LogLevel, message: string, data?: any) => {
  const ts = new Date().toISOString();
  const base = `[${ts}] [${level}] ${message}`;
  return data !== undefined ? `${base} ${JSON.stringify(data)}` : base;
};

export const logger = {
  info(message: string, data?: any) {
    const line = format('INFO', message, data);
    console.log(line);
    postLog({ level: 'INFO', message, data, timestamp: new Date().toISOString() });
  },
  warn(message: string, data?: any) {
    const line = format('WARN', message, data);
    console.warn(line);
    postLog({ level: 'WARN', message, data, timestamp: new Date().toISOString() });
  },
  error(message: string, data?: any) {
    const line = format('ERROR', message, data);
    console.error(line);
    postLog({ level: 'ERROR', message, data, timestamp: new Date().toISOString() });
  },
  event(action: string, data?: any) {
    const line = format('EVENT', action, data);
    console.log(line);
    postLog({ level: 'EVENT', message: action, data, timestamp: new Date().toISOString() });
  },
};

export type { LogLevel, LogPayload };
