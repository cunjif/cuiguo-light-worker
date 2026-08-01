export declare function fileUriToPath(uri: string): {
    netloc: string;
    path: string;
};
export declare function parseDataUri(uri: string): {
    mimetype: string;
    charset?: string;
    data: Uint8Array;
};
