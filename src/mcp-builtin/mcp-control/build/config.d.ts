/**
 * Configuration interface for automation settings
 */
export interface AutomationConfig {
    /**
     * The provider to use for automation
     * Currently supported: 'keysender'
     */
    provider: string;
}
/**
 * Load configuration from environment variables
 */
export declare function loadConfig(): AutomationConfig;
