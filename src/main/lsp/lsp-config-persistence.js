import fs from 'fs';
import path from 'path';
import os from 'os';

class LSPConfigPersistence {
    constructor() {
        this.configDir = path.join(os.homedir(), '.chat-mcp', 'config');
        this.configFile = path.join(this.configDir, 'lsp-config.json');
    }

    save(config) {
        try {
            fs.mkdirSync(this.configDir, { recursive: true });
            fs.writeFileSync(this.configFile, JSON.stringify(config, null, 2), 'utf-8');
            return { success: true };
        } catch (err) {
            return { success: false, error: String(err) };
        }
    }

    load() {
        try {
            if (!fs.existsSync(this.configFile)) {
                return null;
            }
            const data = fs.readFileSync(this.configFile, 'utf-8');
            return JSON.parse(data);
        } catch (err) {
            return null;
        }
    }
}

export { LSPConfigPersistence };