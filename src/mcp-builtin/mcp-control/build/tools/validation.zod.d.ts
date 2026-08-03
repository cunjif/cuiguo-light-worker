import { z } from 'zod';
export declare const MAX_TEXT_LENGTH = 1000;
export declare const MAX_ALLOWED_COORDINATE = 10000;
export declare const MAX_SCROLL_AMOUNT = 1000;
/**
 * List of allowed keyboard keys for validation
 */
export declare const VALID_KEYS: string[];
export declare const VALID_KEYS_lowercase: string[];
/**
 * Zod schema for mouse position validation
 */
export declare const MousePositionSchema: z.ZodObject<{
    x: z.ZodEffects<z.ZodNumber, number, number>;
    y: z.ZodEffects<z.ZodNumber, number, number>;
}, "strip", z.ZodTypeAny, {
    x: number;
    y: number;
}, {
    x: number;
    y: number;
}>;
/**
 * Zod schema for mouse button validation
 */
export declare const MouseButtonSchema: z.ZodEnum<["left", "right", "middle"]>;
/**
 * Zod schema for keyboard key validation
 */
export declare const KeySchema: z.ZodEffects<z.ZodString, string, string>;
/**
 * Zod schema for key combination validation
 */
export declare const KeyCombinationSchema: z.ZodObject<{
    keys: z.ZodEffects<z.ZodArray<z.ZodEffects<z.ZodString, string, string>, "many">, string[], string[]>;
}, "strip", z.ZodTypeAny, {
    keys: string[];
}, {
    keys: string[];
}>;
/**
 * Zod schema for keyboard input validation
 */
export declare const KeyboardInputSchema: z.ZodObject<{
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    text: string;
}, {
    text: string;
}>;
/**
 * Zod schema for key hold operation validation
 */
export declare const KeyHoldOperationSchema: z.ZodEffects<z.ZodEffects<z.ZodObject<{
    key: z.ZodEffects<z.ZodString, string, string>;
    state: z.ZodEnum<["down", "up"]>;
    duration: z.ZodOptional<z.ZodNumber>;
}, "strict", z.ZodTypeAny, {
    key: string;
    state: "down" | "up";
    duration?: number | undefined;
}, {
    key: string;
    state: "down" | "up";
    duration?: number | undefined;
}>, {
    key: string;
    state: "down" | "up";
    duration?: number | undefined;
}, {
    key: string;
    state: "down" | "up";
    duration?: number | undefined;
}>, {
    key: string;
    state: "down" | "up";
    duration?: number | undefined;
}, {
    key: string;
    state: "down" | "up";
    duration?: number | undefined;
}>;
/**
 * Zod schema for scroll amount validation
 */
export declare const ScrollAmountSchema: z.ZodEffects<z.ZodNumber, number, number>;
/**
 * Zod schema for clipboard input validation
 */
export declare const ClipboardInputSchema: z.ZodObject<{
    text: z.ZodString;
}, "strip", z.ZodTypeAny, {
    text: string;
}, {
    text: string;
}>;
/**
 * Zod schema for screenshot region validation
 */
export declare const ScreenshotRegionSchema: z.ZodObject<{
    x: z.ZodNumber;
    y: z.ZodNumber;
    width: z.ZodNumber;
    height: z.ZodNumber;
}, "strip", z.ZodTypeAny, {
    x: number;
    y: number;
    width: number;
    height: number;
}, {
    x: number;
    y: number;
    width: number;
    height: number;
}>;
/**
 * Zod schema for screenshot resize options validation
 */
export declare const ScreenshotResizeSchema: z.ZodObject<{
    width: z.ZodOptional<z.ZodNumber>;
    height: z.ZodOptional<z.ZodNumber>;
    fit: z.ZodOptional<z.ZodEnum<["contain", "cover", "fill", "inside", "outside"]>>;
}, "strip", z.ZodTypeAny, {
    width?: number | undefined;
    height?: number | undefined;
    fit?: "contain" | "cover" | "fill" | "inside" | "outside" | undefined;
}, {
    width?: number | undefined;
    height?: number | undefined;
    fit?: "contain" | "cover" | "fill" | "inside" | "outside" | undefined;
}>;
/**
 * Zod schema for screenshot options validation
 */
export declare const ScreenshotOptionsSchema: z.ZodObject<{
    region: z.ZodOptional<z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
        width: number;
        height: number;
    }, {
        x: number;
        y: number;
        width: number;
        height: number;
    }>>;
    quality: z.ZodOptional<z.ZodNumber>;
    format: z.ZodOptional<z.ZodEnum<["png", "jpeg"]>>;
    grayscale: z.ZodOptional<z.ZodBoolean>;
    resize: z.ZodOptional<z.ZodObject<{
        width: z.ZodOptional<z.ZodNumber>;
        height: z.ZodOptional<z.ZodNumber>;
        fit: z.ZodOptional<z.ZodEnum<["contain", "cover", "fill", "inside", "outside"]>>;
    }, "strip", z.ZodTypeAny, {
        width?: number | undefined;
        height?: number | undefined;
        fit?: "contain" | "cover" | "fill" | "inside" | "outside" | undefined;
    }, {
        width?: number | undefined;
        height?: number | undefined;
        fit?: "contain" | "cover" | "fill" | "inside" | "outside" | undefined;
    }>>;
    compressionLevel: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    region?: {
        x: number;
        y: number;
        width: number;
        height: number;
    } | undefined;
    quality?: number | undefined;
    format?: "png" | "jpeg" | undefined;
    grayscale?: boolean | undefined;
    resize?: {
        width?: number | undefined;
        height?: number | undefined;
        fit?: "contain" | "cover" | "fill" | "inside" | "outside" | undefined;
    } | undefined;
    compressionLevel?: number | undefined;
}, {
    region?: {
        x: number;
        y: number;
        width: number;
        height: number;
    } | undefined;
    quality?: number | undefined;
    format?: "png" | "jpeg" | undefined;
    grayscale?: boolean | undefined;
    resize?: {
        width?: number | undefined;
        height?: number | undefined;
        fit?: "contain" | "cover" | "fill" | "inside" | "outside" | undefined;
    } | undefined;
    compressionLevel?: number | undefined;
}>;
/**
 * Zod schema for window info validation
 */
export declare const WindowInfoSchema: z.ZodObject<{
    title: z.ZodString;
    position: z.ZodObject<{
        x: z.ZodNumber;
        y: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        x: number;
        y: number;
    }, {
        x: number;
        y: number;
    }>;
    size: z.ZodObject<{
        width: z.ZodNumber;
        height: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        width: number;
        height: number;
    }, {
        width: number;
        height: number;
    }>;
}, "strip", z.ZodTypeAny, {
    title: string;
    position: {
        x: number;
        y: number;
    };
    size: {
        width: number;
        height: number;
    };
}, {
    title: string;
    position: {
        x: number;
        y: number;
    };
    size: {
        width: number;
        height: number;
    };
}>;
