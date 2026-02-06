import pc from 'picocolors';
import { APP_NAME } from './constants';

const prefix = pc.cyan(pc.bold(`[${APP_NAME}]`));

export const log = {
  info: (msg: string, ...args: unknown[]) =>
    console.log(`${prefix} ${msg}`, ...args),
  success: (msg: string, ...args: unknown[]) =>
    console.log(`${prefix} ${pc.green('●')} ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) =>
    console.warn(`${prefix} ${pc.yellow('⚠')} ${pc.yellow(msg)}`, ...args),
  error: (msg: string, ...args: unknown[]) =>
    console.error(`${prefix} ${pc.red('✖')} ${pc.red(msg)}`, ...args),
  debug: (msg: string, ...args: unknown[]) => {
    if (process.env.DEBUG) console.log(`${prefix} ${pc.dim(msg)}`, ...args);
  },
  plain: (msg: string, ...args: unknown[]) =>
    console.log(msg, ...args),
};
