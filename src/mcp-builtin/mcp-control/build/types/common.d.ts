export interface MousePosition {
    x: number;
    y: number;
}
export interface KeyboardInput {
    text: string;
}
export interface KeyCombination {
    keys: string[];
}
export interface KeyHoldOperation {
    key: string;
    duration?: number;
    state: 'down' | 'up';
}
export interface WindowInfo {
    title: string;
    position: {
        x: number;
        y: number;
    };
    size: {
        width: number;
        height: number;
    };
}
export interface ClipboardInput {
    text: string;
}
export type ButtonMap = {
    [key: string]: string;
    left: string;
    right: string;
    middle: string;
};
export interface ImageSearchOptions {
    confidence?: number;
    searchRegion?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    waitTime?: number;
}
export interface ImageSearchResult {
    location: {
        x: number;
        y: number;
    };
    confidence: number;
    width: number;
    height: number;
}
export interface HighlightOptions {
    duration?: number;
    color?: string;
}
export interface ScreenshotOptions {
    region?: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    quality?: number;
    format?: 'png' | 'jpeg';
    grayscale?: boolean;
    resize?: {
        width?: number;
        height?: number;
        fit?: 'contain' | 'cover' | 'fill' | 'inside' | 'outside';
    };
    compressionLevel?: number;
}
