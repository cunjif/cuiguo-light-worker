import { PRIORITY_GENERIC } from './constants.js';
export class ConverterRegistry {
    registrations = [];
    extensionIndex = new Map();
    mimeIndex = new Map();
    fallbackConverters = [];
    nextInsertOrder = 0;
    dirty = true;
    sortedCache = [];
    register(converter, options) {
        const priority = options.priority ?? 0;
        const reg = {
            converter,
            priority,
            extensions: options.extensions,
            mimeTypes: options.mimeTypes,
        };
        reg._insertOrder = this.nextInsertOrder++;
        this.registrations.push(reg);
        this.dirty = true;
        for (const ext of options.extensions) {
            const key = ext.toLowerCase();
            if (!this.extensionIndex.has(key))
                this.extensionIndex.set(key, []);
            this.extensionIndex.get(key).push(reg);
        }
        for (const mime of options.mimeTypes) {
            const key = mime.toLowerCase();
            if (!this.mimeIndex.has(key))
                this.mimeIndex.set(key, []);
            this.mimeIndex.get(key).push(reg);
        }
        if (priority >= PRIORITY_GENERIC) {
            this.fallbackConverters.push(reg);
        }
    }
    findConverters(info) {
        const candidates = new Set();
        if (info.extension) {
            const ext = info.extension.toLowerCase();
            const byExt = this.extensionIndex.get(ext);
            if (byExt)
                byExt.forEach((r) => candidates.add(r));
        }
        if (info.mimetype) {
            const mime = info.mimetype.toLowerCase();
            const exact = this.mimeIndex.get(mime);
            if (exact)
                exact.forEach((r) => candidates.add(r));
            for (const [key, regs] of this.mimeIndex) {
                if (key.endsWith('/') && mime.startsWith(key)) {
                    regs.forEach((r) => candidates.add(r));
                }
                else if (mime.startsWith(key)) {
                    regs.forEach((r) => candidates.add(r));
                }
            }
        }
        if (candidates.size === 0) {
            for (const fb of this.fallbackConverters) {
                candidates.add(fb);
            }
        }
        const arr = [...candidates];
        arr.sort((a, b) => {
            const pDiff = a.priority - b.priority;
            if (pDiff !== 0)
                return pDiff;
            return b._insertOrder - a._insertOrder;
        });
        return arr;
    }
    getAll() {
        if (this.dirty) {
            this.sortedCache = [...this.registrations];
            this.sortedCache.sort((a, b) => {
                const pDiff = a.priority - b.priority;
                if (pDiff !== 0)
                    return pDiff;
                return b._insertOrder - a._insertOrder;
            });
            this.dirty = false;
        }
        return this.sortedCache;
    }
}
//# sourceMappingURL=converter-registry.js.map