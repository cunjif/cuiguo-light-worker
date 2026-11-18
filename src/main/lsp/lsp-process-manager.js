import { spawn } from 'child_process';
import path from 'path';
import os from 'os';

const LSP_SERVER_STATUS = {
    STOPPED: 'stopped',
    STARTING: 'starting',
    READY: 'ready',
    ERROR: 'error',
    UNAVAILABLE: 'unavailable',
};

const MAX_RESTART_COUNT = 3;
const MEMORY_LIMIT_MB = 512;
const INITIALIZE_TIMEOUT_MS = 15000;
const SHUTDOWN_TIMEOUT_MS = 5000;

class LSPProcessManager {
    constructor() {
        this.servers = new Map();
        this.statusCallbacks = new Set();
        this.requestIdCounter = 0;
        this.pendingRequests = new Map();
        this.restartCounts = new Map();
        this.memoryCheckInterval = null;
    }

    startLanguageServer(language, command, args, rootUri) {
        if (this.servers.has(language)) {
            const existing = this.servers.get(language);
            if (existing.status === LSP_SERVER_STATUS.READY || existing.status === LSP_SERVER_STATUS.STARTING) {
                return { success: true, message: 'Server already running' };
            }
        }

        try {
            const child = spawn(command, args || [], {
                stdio: ['pipe', 'pipe', 'pipe'],
                cwd: rootUri ? path.dirname(rootUri) : os.homedir(),
            });

            const serverInfo = {
                process: child,
                status: LSP_SERVER_STATUS.STARTING,
                language,
                command,
                args,
                rootUri,
                buffer: '',
                capabilities: null,
            };

            this.servers.set(language, serverInfo);
            this._setStatus(language, LSP_SERVER_STATUS.STARTING);

            child.stdout.on('data', (data) => this._onStdoutData(language, data));
            child.stderr.on('data', (data) => {
                console.error(`[LSP ${language}] stderr:`, data.toString());
            });
            child.on('exit', (code, signal) => {
                this._onProcessExit(language, code, signal);
            });

            this._initializeServer(language, rootUri).catch((err) => {
                console.error(`[LSP ${language}] Initialize failed:`, err);
                this._setStatus(language, LSP_SERVER_STATUS.ERROR);
            });

            this._startMemoryCheck();
            return { success: true };
        } catch (err) {
            console.error(`[LSP ${language}] Failed to start:`, err);
            this._setStatus(language, LSP_SERVER_STATUS.ERROR);
            return { success: false, error: String(err) };
        }
    }

    async _initializeServer(language, rootUri) {
        const initParams = {
            processId: process.pid,
            rootUri: rootUri || null,
            capabilities: {
                textDocument: {
                    synchronization: {
                        didOpen: true,
                        didChange: true,
                        didClose: true,
                        willSave: false,
                        willSaveWaitUntil: false,
                        save: false,
                    },
                    hover: {
                        dynamicRegistration: false,
                        contentFormat: ['markdown', 'plaintext'],
                    },
                    definition: {
                        dynamicRegistration: false,
                        linkSupport: false,
                    },
                    completion: {
                        dynamicRegistration: false,
                        completionItem: {
                            snippetSupport: false,
                            documentationFormat: ['markdown', 'plaintext'],
                        },
                    },
                },
            },
        };

        const result = await this._sendRequestInternal(language, 'initialize', initParams, INITIALIZE_TIMEOUT_MS);
        if (!result) {
            throw new Error('Initialize timed out');
        }

        const serverInfo = this.servers.get(language);
        if (serverInfo) {
            serverInfo.capabilities = result.capabilities || {};
        }

        this._sendNotificationInternal(language, 'initialized', {});

        this._setStatus(language, LSP_SERVER_STATUS.READY);
    }

    _onStdoutData(language, data) {
        const serverInfo = this.servers.get(language);
        if (!serverInfo) return;

        serverInfo.buffer += data.toString();

        while (serverInfo.buffer.length > 0) {
            const headerEnd = serverInfo.buffer.indexOf('\r\n\r\n');
            if (headerEnd === -1) break;

            const header = serverInfo.buffer.substring(0, headerEnd);
            const bodyStart = headerEnd + 4;

            let contentLength = 0;
            const lines = header.split('\r\n');
            for (const line of lines) {
                if (line.toLowerCase().startsWith('content-length:')) {
                    contentLength = parseInt(line.substring(15).trim(), 10);
                }
            }

            if (contentLength === 0) break;

            if (serverInfo.buffer.length < bodyStart + contentLength) break;

            const body = serverInfo.buffer.substring(bodyStart, bodyStart + contentLength);
            serverInfo.buffer = serverInfo.buffer.substring(bodyStart + contentLength);

            try {
                const message = JSON.parse(body);
                this._handleMessage(language, message);
            } catch (e) {
                console.error(`[LSP ${language}] Failed to parse message:`, e);
            }
        }
    }

    _handleMessage(language, message) {
        if (message.id !== undefined && message.result !== undefined) {
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                pending.resolve(message.result);
                this.pendingRequests.delete(message.id);
            }
        } else if (message.id !== undefined && message.error !== undefined) {
            const pending = this.pendingRequests.get(message.id);
            if (pending) {
                pending.resolve(null);
                this.pendingRequests.delete(message.id);
            }
        }
    }

    _onProcessExit(language, code, signal) {
        const serverInfo = this.servers.get(language);
        if (!serverInfo) return;

        this.pendingRequests.forEach((pending, id) => {
            if (pending.language === language) {
                pending.resolve(null);
                this.pendingRequests.delete(id);
            }
        });

        if (code !== 0 && code !== null) {
            const restartCount = this.restartCounts.get(language) || 0;
            if (restartCount < MAX_RESTART_COUNT) {
                this.restartCounts.set(language, restartCount + 1);
                console.log(`[LSP ${language}] Process exited (code=${code}), restarting (${restartCount + 1}/${MAX_RESTART_COUNT})...`);
                this.servers.delete(language);
                setTimeout(() => {
                    this.startLanguageServer(language, serverInfo.command, serverInfo.args, serverInfo.rootUri);
                }, 1000);
            } else {
                console.error(`[LSP ${language}] Max restart count reached, marking as unavailable`);
                this._setStatus(language, LSP_SERVER_STATUS.UNAVAILABLE);
            }
        } else {
            this._setStatus(language, LSP_SERVER_STATUS.STOPPED);
        }
    }

    async stopLanguageServer(language) {
        const serverInfo = this.servers.get(language);
        if (!serverInfo) {
            return { success: true, message: 'Server not running' };
        }

        try {
            await this._sendRequestInternal(language, 'shutdown', {}, SHUTDOWN_TIMEOUT_MS);
        } catch (e) {
        }

        this._sendNotificationInternal(language, 'exit', {});

        try {
            serverInfo.process.kill('SIGTERM');
        } catch (e) {
        }

        this.servers.delete(language);
        this.restartCounts.delete(language);
        this._setStatus(language, LSP_SERVER_STATUS.STOPPED);

        return { success: true };
    }

    async sendRequest(language, method, params, timeoutMs = 5000) {
        return this._sendRequestInternal(language, method, params, timeoutMs);
    }

    sendNotification(language, method, params) {
        this._sendNotificationInternal(language, method, params);
    }

    _sendRequestInternal(language, method, params, timeoutMs) {
        return new Promise((resolve) => {
            const serverInfo = this.servers.get(language);
            if (!serverInfo || !serverInfo.process || !serverInfo.process.stdin.writable) {
                resolve(null);
                return;
            }

            const id = ++this.requestIdCounter;
            const message = {
                jsonrpc: '2.0',
                id,
                method,
                params: params || {},
            };

            this.pendingRequests.set(id, { resolve, language });

            const body = JSON.stringify(message);
            const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;

            try {
                serverInfo.process.stdin.write(header + body);
            } catch (e) {
                this.pendingRequests.delete(id);
                resolve(null);
                return;
            }

            setTimeout(() => {
                if (this.pendingRequests.has(id)) {
                    this.pendingRequests.delete(id);
                    resolve(null);
                }
            }, timeoutMs);
        });
    }

    _sendNotificationInternal(language, method, params) {
        const serverInfo = this.servers.get(language);
        if (!serverInfo || !serverInfo.process || !serverInfo.process.stdin.writable) {
            return;
        }

        const message = {
            jsonrpc: '2.0',
            method,
            params: params || {},
        };

        const body = JSON.stringify(message);
        const header = `Content-Length: ${Buffer.byteLength(body)}\r\n\r\n`;

        try {
            serverInfo.process.stdin.write(header + body);
        } catch (e) {
        }
    }

    getStatus(language) {
        const serverInfo = this.servers.get(language);
        return serverInfo ? serverInfo.status : LSP_SERVER_STATUS.STOPPED;
    }

    onStatusChanged(callback) {
        this.statusCallbacks.add(callback);
        return () => this.statusCallbacks.delete(callback);
    }

    _setStatus(language, status) {
        const serverInfo = this.servers.get(language);
        if (serverInfo) {
            serverInfo.status = status;
        }
        for (const callback of this.statusCallbacks) {
            try {
                callback(language, status);
            } catch (e) {
            }
        }
    }

    _startMemoryCheck() {
        if (this.memoryCheckInterval) return;
        this.memoryCheckInterval = setInterval(() => {
            for (const [language, serverInfo] of this.servers) {
                if (!serverInfo.process || serverInfo.process.killed) continue;
                try {
                    const mem = process.memoryUsage();
                    if (mem.rss > MEMORY_LIMIT_MB * 1024 * 1024) {
                        console.warn(`[LSP ${language}] Memory limit exceeded, restarting...`);
                        this.stopLanguageServer(language).then(() => {
                            setTimeout(() => {
                                this.startLanguageServer(language, serverInfo.command, serverInfo.args, serverInfo.rootUri);
                            }, 1000);
                        });
                    }
                } catch (e) {
                }
            }
        }, 60000);
    }

    stopAllServers() {
        for (const language of this.servers.keys()) {
            this.stopLanguageServer(language);
        }
        if (this.memoryCheckInterval) {
            clearInterval(this.memoryCheckInterval);
            this.memoryCheckInterval = null;
        }
    }
}

export { LSPProcessManager, LSP_SERVER_STATUS };