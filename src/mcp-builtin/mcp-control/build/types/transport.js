/**
 * Enumeration of supported transport types for MCP server communication
 */
export var TransportType;
(function (TransportType) {
    /**
     * HTTP transport for standard request-response communication
     */
    TransportType["HTTP"] = "HTTP";
    /**
     * Server-Sent Events transport for real-time unidirectional event streaming
     */
    TransportType["SSE"] = "SSE";
})(TransportType || (TransportType = {}));
