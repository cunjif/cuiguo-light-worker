#!/usr/bin/env node
import {
  injectToolbox
} from "./chunk-7XNUMIZP.js";

// src/server.ts
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

// src/mcp/index.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { chromium } from "playwright";

// src/mcp/eval.ts
import vm from "vm";
var secureEvalAsync = async (page2, code, context2 = {}) => {
  const timeout = 2e4;
  const filename = "eval.js";
  let logs = [];
  let errors = [];
  const wrappedCode = `
    ${code}
    run(page);
  `;
  const sandbox = {
    // Core async essentials
    Promise,
    setTimeout,
    clearTimeout,
    setImmediate,
    clearImmediate,
    // Pass page object to sandbox
    page: page2,
    // Capture all console methods
    console: {
      log: (...args) => {
        const msg = args.map((arg) => String(arg)).join(" ");
        logs.push(`[log] ${msg}`);
        console.log("[Sandbox]", ...args);
      },
      error: (...args) => {
        const msg = args.map((arg) => String(arg)).join(" ");
        errors.push(`[error] ${msg}`);
        console.error("[Sandbox]", ...args);
      },
      warn: (...args) => {
        const msg = args.map((arg) => String(arg)).join(" ");
        logs.push(`[warn] ${msg}`);
        console.warn("[Sandbox]", ...args);
      },
      info: (...args) => {
        const msg = args.map((arg) => String(arg)).join(" ");
        logs.push(`[info] ${msg}`);
        console.info("[Sandbox]", ...args);
      },
      debug: (...args) => {
        const msg = args.map((arg) => String(arg)).join(" ");
        logs.push(`[debug] ${msg}`);
        console.debug("[Sandbox]", ...args);
      },
      trace: (...args) => {
        const msg = args.map((arg) => String(arg)).join(" ");
        logs.push(`[trace] ${msg}`);
        console.trace("[Sandbox]", ...args);
      }
    },
    // User-provided context
    ...context2,
    // Explicitly block access to sensitive globals
    process: void 0,
    global: void 0,
    require: void 0,
    __dirname: void 0,
    __filename: void 0,
    Buffer: void 0
  };
  try {
    const vmContext = vm.createContext(sandbox);
    const script = new vm.Script(wrappedCode, { filename });
    const result = script.runInContext(vmContext);
    const awaitedResult = await result;
    return {
      result: awaitedResult,
      logs,
      errors
    };
  } catch (error) {
    return {
      error: true,
      message: error.message,
      stack: error.stack,
      logs,
      errors
    };
  }
};

// src/mcp/state.ts
var globalState = {
  messages: [],
  pickingType: null,
  recordingInteractions: false,
  code: `async function run(page) {
    let title = await page.title();
    return title
}`
};
async function initState(page2) {
  await page2.exposeFunction("updateGlobalState", (state) => {
    updateState(page2, state);
  });
  await page2.exposeFunction("triggerSyncToReact", () => {
    updateState(page2, getState());
  });
  await page2.addInitScript((state) => {
    if (window.globalState) {
      return;
    }
    window.globalState = state;
    window.stateSubscribers = [];
    window.notifyStateSubscribers = () => {
      window.stateSubscribers.forEach((cb) => cb(window.globalState));
    };
  }, globalState);
}
async function syncToReact(page2, state) {
  const allFrames = await page2.frames();
  const toolboxFrame = allFrames.find((f) => f.name() === "toolbox-frame");
  if (!toolboxFrame) {
    console.error("Toolbox frame not found");
    return;
  }
  try {
    await toolboxFrame.evaluate((state2) => {
      window.globalState = state2;
      window.notifyStateSubscribers();
    }, state);
  } catch (error) {
    console.debug("Error syncing to React:", error);
  }
}
var getState = () => {
  return structuredClone(globalState);
};
var updateState = (page2, state) => {
  globalState = structuredClone(state);
  syncToReact(page2, state);
};

// src/mcp/recording/snowflake.ts
import { Snowflake } from "@skorotkiewicz/snowflake-id";
var snowflake = new Snowflake(42 * 10);
var getSnowflakeId = async () => {
  return await snowflake.generate();
};

// src/mcp/recording/init-recording.ts
var initRecording = async (page2, onBrowserEvent) => {
  page2.addInitScript(() => {
    if (window.self !== window.top) {
      return;
    }
    function getDom() {
      const snapshot = document.documentElement.cloneNode(true);
      const originalElements = document.querySelectorAll("*");
      const clonedElements = snapshot.querySelectorAll("*");
      originalElements.forEach((originalElement, index) => {
        const clonedElement = clonedElements[index];
        if (!clonedElement) return;
        if (originalElement.scrollLeft || originalElement.scrollTop) {
          if (originalElement.scrollLeft) {
            clonedElement.setAttribute(
              "qaby-data-scroll-left",
              originalElement.scrollLeft.toString()
            );
          }
          if (originalElement.scrollTop) {
            clonedElement.setAttribute(
              "qaby-data-scroll-top",
              originalElement.scrollTop.toString()
            );
          }
        }
        if (originalElement instanceof HTMLInputElement || originalElement instanceof HTMLTextAreaElement || originalElement instanceof HTMLSelectElement || originalElement.hasAttribute("contenteditable")) {
          preserveElementState(originalElement, clonedElement);
        }
      });
      return snapshot.outerHTML;
    }
    function preserveElementState(original, cloned) {
      if (original.hasAttribute("contenteditable")) {
        const escapedHTML = original.innerHTML.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        cloned.setAttribute("qaby-data-contenteditable", escapedHTML);
      }
      if (original instanceof HTMLInputElement) {
        preserveInputState(original, cloned);
      } else if (original instanceof HTMLTextAreaElement) {
        preserveTextAreaState(original, cloned);
      } else if (original instanceof HTMLSelectElement) {
        preserveSelectState(original, cloned);
      }
    }
    function preserveInputState(original, cloned) {
      switch (original.type) {
        case "checkbox":
        case "radio":
          if (original.checked) {
            cloned.setAttribute("checked", "");
          } else {
            cloned.removeAttribute("checked");
          }
          if (original.indeterminate) {
            cloned.setAttribute("qaby-data-indeterminate", "true");
          }
          break;
        case "range":
          cloned.setAttribute("value", original.value);
          break;
        case "date":
        case "datetime-local":
        case "month":
        case "time":
        case "week":
          if (original.valueAsDate) {
            cloned.setAttribute(
              "qaby-data-value-as-date",
              original.valueAsDate.toISOString()
            );
            cloned.setAttribute("value", original.value);
          }
          break;
        default:
          cloned.setAttribute("value", original.value);
      }
    }
    function preserveTextAreaState(original, cloned) {
      cloned.innerHTML = original.value;
    }
    function preserveSelectState(original, cloned) {
      cloned.querySelectorAll("option").forEach((option) => {
        option.removeAttribute("selected");
      });
      if (original.multiple) {
        Array.from(original.selectedOptions).forEach((option) => {
          const optionIndex = Array.from(original.options).indexOf(option);
          const clonedOption = cloned.querySelector(
            `option:nth-child(${optionIndex + 1})`
          );
          if (clonedOption) {
            clonedOption.setAttribute("selected", "");
          }
        });
      } else if (original.selectedIndex >= 0) {
        const clonedOption = cloned.querySelector(
          `option:nth-child(${original.selectedIndex + 1})`
        );
        if (clonedOption) {
          clonedOption.setAttribute("selected", "");
        }
      }
    }
    function generateUUID() {
      return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
        const r = Math.random() * 16 | 0;
        const v = c === "x" ? r : r & 3 | 8;
        return v.toString(16);
      });
    }
    function addAttributesToNode(node) {
      if (node.nodeType === window.Node.ELEMENT_NODE) {
        const element = node;
        if (!element.getAttribute("uuid")) {
          element.setAttribute("uuid", generateUUID());
        }
        for (const child of node.childNodes) {
          addAttributesToNode(child);
        }
      }
    }
    function removeAttributesFromNode(node) {
      if (node.nodeType === window.Node.ELEMENT_NODE) {
        const element = node;
        element.removeAttribute("uuid");
      }
    }
    const recordedEvents = /* @__PURE__ */ new WeakMap();
    function handleClick(e) {
      if (recordedEvents.get(e)) {
        return;
      }
      const target = e.target;
      if (!target) return;
      if (target.getAttribute("data-skip-recording")) return;
      e.stopPropagation();
      recordedEvents.set(e, true);
      addAttributesToNode(document.documentElement);
      const elementUUID = target.getAttribute("uuid");
      const dom = getDom();
      window.recordDOM(dom, elementUUID).then(() => {
        target.dispatchEvent(e);
      });
      removeAttributesFromNode(document.documentElement);
    }
    function handleKeyDown(event) {
      const dom = getDom();
      if (["Enter", "Escape"].includes(event.key)) {
        window.recordKeyPress(dom, [event.key]);
        return;
      }
      if (document.activeElement?.tagName.toLowerCase() === "input") {
        if (event.key === "Tab") {
          window.recordKeyPress(dom, [event.key]);
        }
        return;
      }
      if (document.activeElement?.tagName.toLowerCase() === "textarea") {
        return;
      }
      const keys = [];
      if (event.ctrlKey) keys.push("Control");
      if (event.shiftKey) keys.push("Shift");
      if (event.altKey) keys.push("Alt");
      if (event.metaKey) keys.push("Meta");
      if (!["Control", "Shift", "Alt", "Meta"].includes(event.key)) {
        keys.push(event.key);
      }
      if (keys.includes("Meta") && keys.includes("Tab")) {
        return;
      }
      if (keys.length === 1 && keys[0] === "Meta") {
        return;
      }
      if (keys.length > 0) {
        window.recordKeyPress(dom, keys);
      }
    }
    function handleKeyUp(event) {
      if (["Enter", "Escape"].includes(event.key)) {
        return;
      }
      if (document.activeElement?.tagName.toLowerCase() !== "input" && document.activeElement?.tagName.toLowerCase() !== "textarea") {
        return;
      }
      const dom = getDom();
      window.recordInput(
        dom,
        document.activeElement.getAttribute("uuid"),
        document.activeElement.value
      );
    }
    window.addEventListener("click", handleClick, { capture: true });
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    window.addEventListener("keyup", handleKeyUp, { capture: true });
    console.log("Recording initialized for window:", window.location.href);
  });
  let buttonClicked = false;
  await page2.exposeFunction(
    "recordDOM",
    async (dom, elementUUID) => {
      buttonClicked = true;
      const event = {
        eventId: await getSnowflakeId(),
        type: "click" /* Click */,
        dom,
        elementUUID,
        selectors: [`[uuid="${elementUUID}"]`],
        windowUrl: page2.url()
      };
      onBrowserEvent(event);
    }
  );
  await page2.exposeFunction(
    "recordInput",
    async (dom, elementUUID, value) => {
      const event = {
        eventId: await getSnowflakeId(),
        type: "input" /* Input */,
        dom,
        elementUUID,
        typedText: value,
        selectors: [`[uuid="${elementUUID}"]`],
        windowUrl: page2.url()
      };
      onBrowserEvent(event);
    }
  );
  await page2.exposeFunction(
    "recordKeyPress",
    async (dom, keys) => {
      const event = {
        eventId: await getSnowflakeId(),
        type: "key-press" /* KeyPress */,
        keys,
        dom,
        windowUrl: page2.url()
      };
      onBrowserEvent(event);
    }
  );
  page2.on("load", async () => {
    if (!buttonClicked) {
      const event = {
        eventId: await getSnowflakeId(),
        type: "open-page" /* OpenPage */,
        windowUrl: page2.url(),
        // TODO: Fix navigation handling
        // title: await page.title(),
        title: "",
        // TODO: Fix dom content here
        dom: ""
      };
      onBrowserEvent(event);
    }
    buttonClicked = false;
  });
};

// src/mcp/logger.ts
var Logger = class {
  level;
  constructor(level = "info") {
    this.level = level;
  }
  shouldLog(messageLevel) {
    const levels = ["debug", "info", "warn", "error"];
    return levels.indexOf(messageLevel) >= levels.indexOf(this.level);
  }
  log(level, ...args) {
    if (this.shouldLog(level)) {
      console[level](...args);
    }
  }
  debug(...args) {
    this.log("debug", ...args);
  }
  info(...args) {
    this.log("info", ...args);
  }
  warn(...args) {
    this.log("warn", ...args);
  }
  error(...args) {
    this.log("error", ...args);
  }
};
var logger = new Logger();

// src/mcp/recording/selector-engine.ts
var ATTR_PRIORITIES = {
  id: 1,
  "data-testid": 2,
  "data-test-id": 2,
  "data-pw": 2,
  "data-cy": 2,
  "data-id": 2,
  "data-name": 3,
  name: 3,
  "aria-label": 3,
  title: 3,
  placeholder: 4,
  href: 4,
  alt: 4,
  "data-index": 5,
  "data-role": 5,
  role: 5
};
var IMPORTANT_ATTRS = Object.keys(ATTR_PRIORITIES);
var _escapeSpecialCharacters = (str) => {
  return str.replace(/"/g, '\\"');
};
var getNodeSimpleSelectors = (element) => {
  const selectors = [];
  const tag = element.tagName.toLowerCase();
  const attrSelectors = IMPORTANT_ATTRS.map((attr) => {
    const value = element.getAttribute(attr);
    if (!value) return null;
    return {
      priority: ATTR_PRIORITIES[attr] || 999,
      selector: attr === "id" ? `#${_escapeSpecialCharacters(value)}` : `${tag}[${attr}="${_escapeSpecialCharacters(value)}"]`
    };
  }).filter((item) => item !== null);
  const otherSelectors = [];
  const classList = element.classList;
  if (classList.length > 0) {
    otherSelectors.push({
      priority: 100,
      selector: `${tag}.${Array.from(classList).join(".")}`
    });
  }
  const availableSelectors = [...attrSelectors, ...otherSelectors];
  availableSelectors.sort((a, b) => a.priority - b.priority);
  const topSelectors = availableSelectors.slice(0, 5);
  topSelectors.push({
    priority: 999,
    selector: tag
  });
  for (const item of topSelectors) {
    selectors.push(item.selector);
  }
  return selectors;
};
var _getSiblingRelationshipSelectors = (dom, element) => {
  const selectors = [];
  const parent = element.parentElement;
  if (!parent || parent.tagName === "BODY") {
    return selectors;
  }
  const siblings = Array.from(parent.children);
  const elementIndex = siblings.indexOf(element);
  const tagName = element.tagName.toLowerCase();
  const selectorPrefixes = [];
  for (let i = 0; i < siblings.length; i++) {
    if (i === elementIndex) continue;
    const sibling = siblings[i];
    const siblingSimpleSelectors = getNodeSimpleSelectors(sibling);
    siblingSimpleSelectors.forEach((siblingSelector) => {
      selectorPrefixes.push(`${siblingSelector} ~ `);
    });
  }
  const selectorSuffixes = [tagName, ...getNodeSimpleSelectors(element)];
  selectorSuffixes.forEach((selectorSuffix) => {
    selectorPrefixes.forEach((selectorPrefix) => {
      selectors.push(`${selectorPrefix}${selectorSuffix}`);
    });
  });
  return selectors;
};
var _getChildRelationshipSelectors = (dom, element) => {
  const children = [];
  const currentQueue = Array.from(element.children).map((child) => ({
    child,
    depth: 0
  }));
  while (currentQueue.length > 0) {
    const item = currentQueue.shift();
    if (!item) continue;
    const { child, depth } = item;
    if (depth > 3) {
      continue;
    }
    children.push({ child, depth });
    currentQueue.push(
      ...Array.from(child.children).map((child2) => ({
        child: child2,
        depth: depth + 1
      }))
    );
  }
  const selectorSuffixes = [];
  children.forEach(({ child, depth }) => {
    const childSelectors = getNodeSimpleSelectors(child);
    const childIndex = Array.from(element.children).indexOf(child) + 1;
    childSelectors.forEach((childSelector) => {
      if (depth === 0) {
        selectorSuffixes.push(`:has(${childSelector})`);
        selectorSuffixes.push(`:has(${childSelector}:nth-child(${childIndex}))`);
      } else {
        selectorSuffixes.push(`:has(${childSelector})`);
      }
    });
  });
  const selectorPrefixes = [
    element.tagName.toLowerCase(),
    ...getNodeSimpleSelectors(element)
  ];
  const selectors = [];
  selectorPrefixes.forEach((selectorPrefix) => {
    selectorSuffixes.forEach((selectorSuffix) => {
      selectors.push(`${selectorPrefix}${selectorSuffix}`);
    });
  });
  return selectors;
};
var getMatchCount = (dom, selector) => {
  try {
    return dom.querySelectorAll(selector).length;
  } catch {
    return Number.POSITIVE_INFINITY;
  }
};
var _getParentPathSelectors = (dom, element) => {
  const path2 = [];
  let current = element;
  while (current && current.tagName !== "HTML") {
    path2.push(current);
    current = current.parentElement;
  }
  logger.debug(
    "Path",
    path2.map((node) => node.tagName)
  );
  const nodeSelectors = path2.map((node) => ({
    node,
    selectors: getNodeSimpleSelectors(node)
  }));
  if (!nodeSelectors.length) {
    return [];
  }
  const result = [];
  const targetNode = nodeSelectors[0].node;
  const targetSelectors = nodeSelectors[0].selectors;
  const targetSelectorsWithNthChild = targetSelectors.map((selector) => {
    const index = targetNode.parentElement ? Array.from(targetNode.parentElement.children).indexOf(targetNode) + 1 : 1;
    return `${selector}:nth-child(${index})`;
  });
  const allTargetSelectors = [
    ...targetSelectors,
    ...targetSelectorsWithNthChild
  ];
  logger.debug("Target Selectors", allTargetSelectors);
  for (const targetSelector of allTargetSelectors) {
    const matches = getMatchCount(dom, targetSelector);
    if (matches === 0) continue;
    if (matches === 1) {
      result.push(targetSelector);
    }
    let currentSelector = targetSelector;
    let currentMatches = matches;
    let lastAddedNode = targetNode;
    for (let i = 1; i < nodeSelectors.length; i++) {
      const ancestor = nodeSelectors[i].node;
      const ancestorSelectors = nodeSelectors[i].selectors;
      let bestSelector = null;
      let bestMatches = currentMatches;
      for (const ancestorSelector of ancestorSelectors) {
        const descendantOperator = Array.from(ancestor.children).indexOf(lastAddedNode) !== -1 ? " > " : " ";
        const possibleCombinedSelectors = [
          `${ancestorSelector} ${descendantOperator} ${currentSelector}`
        ];
        if (ancestor.tagName != "BODY" && ancestor.parentElement) {
          const elementIndex = Array.from(ancestor.parentElement.children).indexOf(ancestor) + 1;
          possibleCombinedSelectors.push(
            `${ancestorSelector}:nth-child(${elementIndex}) ${descendantOperator} ${currentSelector}`
          );
        }
        logger.debug("Possible Combined Selectors", possibleCombinedSelectors);
        for (const combinedSelector of possibleCombinedSelectors) {
          const newMatches = getMatchCount(dom, combinedSelector);
          if (newMatches === 0) continue;
          else if (newMatches === 1) {
            result.push(combinedSelector);
            bestSelector = null;
          } else if (newMatches < bestMatches) {
            bestSelector = combinedSelector;
            bestMatches = newMatches;
          }
        }
      }
      if (bestSelector && bestMatches < currentMatches) {
        currentSelector = bestSelector;
        currentMatches = bestMatches;
        lastAddedNode = ancestor;
      }
    }
  }
  return result;
};
var _getCssSelectors = (document2, element) => {
  const selectors = [];
  selectors.push(..._getParentPathSelectors(document2, element));
  selectors.push(..._getChildRelationshipSelectors(document2, element));
  selectors.push(..._getSiblingRelationshipSelectors(document2, element));
  return selectors;
};
var getSelectors = (document2, elementUUID) => {
  const element = document2.querySelector(`[uuid="${elementUUID}"]`);
  if (!element) {
    throw new Error(`Element with UUID ${elementUUID} not found`);
  }
  const selectors = _getCssSelectors(document2, element);
  logger.debug("All generated selectors:", selectors);
  const validateSelector = (selector) => {
    try {
      logger.debug("Validating selector", selector);
      const selectedElements = document2.querySelectorAll(selector);
      logger.debug("Selector", selector);
      logger.debug(
        "Selected elements",
        Array.from(selectedElements).map((el) => el.outerHTML)
      );
      logger.debug("Element", element.outerHTML);
      return selectedElements.length === 1 && selectedElements[0] === element;
    } catch (e) {
      logger.debug("Failed to validate selector", selector, e);
      return false;
    }
  };
  const validSelectors = selectors.filter(validateSelector);
  logger.debug("Valid selectors", validSelectors);
  return validSelectors.slice(0, 100);
};

// src/mcp/recording/utils.ts
import { JSDOM } from "jsdom";
var parseDom = (html) => {
  const dom = new JSDOM(html, {
    runScripts: "outside-only"
  });
  return dom.window.document;
};
var extractText = (element) => {
  if (element.childNodes.length === 0) {
    return element.textContent?.trim() || "";
  }
  const texts = Array.from(element.childNodes).map(
    (node) => extractText(node)
  );
  return texts.filter((text) => text.trim().length > 0).map((text) => text.trim()).join("\n");
};
var extractTextsFromSiblings = (element) => {
  const siblings = Array.from(element.parentElement?.childNodes || []);
  return siblings.map((sibling) => extractText(sibling)).map((text) => text.trim()).filter((text) => text.length > 0);
};
var preprocessBrowserEvent = (event) => {
  if (event.type === "click" /* Click */ || event.type === "input" /* Input */) {
    event.selectors = getSelectors(parseDom(event.dom), event.elementUUID);
    const dom = parseDom(event.dom);
    const element = dom.querySelector(`[uuid="${event.elementUUID}"]`);
    event.elementName = element ? getElementName(element) : "unknown";
    event.elementType = element ? getElementType(element) : "unknown";
    event.dom = "";
  }
};
var getElementName = (element) => {
  let text = "";
  const priorityAttrs = ["aria-label", "title", "placeholder", "name", "alt"];
  for (const attr of priorityAttrs) {
    if (!text) {
      text = element?.getAttribute(attr) || "";
    }
  }
  if (!text) {
    text = extractText(element);
  }
  if (!text) {
    text = extractTextsFromSiblings(element).join("\n");
  }
  if (!text) {
    text = "unknown";
  }
  return text;
};
var getElementType = (element) => {
  const tagName = element?.tagName.toLowerCase();
  let elementType = "element";
  if (tagName === "a") {
    elementType = "link";
  } else if (tagName === "button") {
    elementType = "button";
  } else if (tagName === "textarea") {
    elementType = "textarea";
  } else if (tagName === "input") {
    elementType = "input";
  }
  return elementType;
};

// src/mcp/index.ts
var browser;
var context;
var page;
var server = new McpServer({
  name: "playwright",
  version: "1.0.0"
});
server.prompt(
  "server-flow",
  "Get prompt on how to use this MCP server",
  () => {
    return {
      messages: [
        {
          role: "user",
          content: {
            type: "text",
            text: `Let me share the flow of how this MCP server works. We will initialise browser if we haven't done so. In the opened browser, user will navigate to page for which they want to write testcases and then record interactions with the page. This is context for writing the testcase.

Please follow this exact sequence of steps to write the testcase:
1. Use the "get-context" tool to obtain the context.
2. Use that context to write the testcase based on your prompt.
3. Once you have generated first version of the testcase, make sure you verify that all the selectors you've chosen are correct using the "validate-selectors" tool.
`
          }
        }
      ]
    };
  }
);
server.tool(
  "init-browser",
  "Initialize a browser with a URL",
  {
    url: z.string().url().describe("The URL to navigate to")
  },
  async ({ url: url2 }) => {
    if (context) {
      await context.close();
    }
    if (browser) {
      await browser.close();
    }
    browser = await chromium.launch({
      headless: false
    });
    context = await browser.newContext({
      viewport: null,
      userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36"
    });
    page = await context.newPage();
    await context.route("**/*.html", async (route) => {
      const response = await route.fetch();
      const headers = response.headers();
      const contentType = headers["content-type"] || "";
      if (contentType.includes("text/html")) {
        const currentCSP = headers["Content-Security-Policy"] || "";
        if (currentCSP) {
          if (currentCSP.includes("frame-src")) {
            headers["Content-Security-Policy"] = currentCSP.replace(
              /frame-src([^;]*)(;|$)/,
              "frame-src 'self' http://localhost:5174/$2"
            );
          } else {
            headers["Content-Security-Policy"] = currentCSP + " frame-src 'self' http://localhost:5174/;";
          }
        } else {
          headers["Content-Security-Policy"] = "frame-src 'self' http://localhost:5174/;";
        }
      }
      await route.fulfill({ response, headers });
    });
    await page.exposeFunction("triggerMcpStartPicking", (pickingType) => {
      page.evaluate((pickingType2) => {
        window.mcpStartPicking(pickingType2);
      }, pickingType);
    });
    await page.exposeFunction("triggerMcpStopPicking", () => {
      page.evaluate(() => {
        window.mcpStopPicking();
      });
    });
    await page.exposeFunction("onElementPicked", (message) => {
      const state = getState();
      state.messages.push(message);
      state.pickingType = null;
      updateState(page, state);
    });
    await page.exposeFunction("takeScreenshot", async (selector) => {
      try {
        const screenshot = await page.locator(selector).screenshot({
          timeout: 5e3
        });
        return screenshot.toString("base64");
      } catch (error) {
        console.error("Error taking screenshot", error);
        return null;
      }
    });
    await page.exposeFunction("executeCode", async (code) => {
      const result = await secureEvalAsync(page, code);
      return result;
    });
    await initState(page);
    await initRecording(page, (event) => {
      const state = getState();
      if (!state.recordingInteractions || state.pickingType) {
        return;
      }
      preprocessBrowserEvent(event);
      if (state.messages.length > 0) {
        const lastMessage = state.messages[state.messages.length - 1];
        if (lastMessage.type === "Interaction") {
          const lastInteraction = JSON.parse(lastMessage.content);
          if (lastInteraction.type === "input" && lastInteraction.elementUUID === event.elementUUID) {
            lastInteraction.typedText = event.typedText;
            state.messages[state.messages.length - 1] = {
              type: "Interaction",
              content: JSON.stringify(lastInteraction),
              windowUrl: event.windowUrl
            };
            updateState(page, state);
            return;
          }
        }
      }
      state.messages.push({
        type: "Interaction",
        content: JSON.stringify(event),
        windowUrl: event.windowUrl
      });
      updateState(page, state);
    });
    await page.addInitScript(injectToolbox);
    await page.goto(url2);
    return {
      content: [
        {
          type: "text",
          text: `Browser has been initialized and navigated to ${url2}`
        }
      ]
    };
  }
);
server.tool(
  "get-full-dom",
  "Get the full DOM of the current page. (Prefer using get-context instead)",
  {},
  async () => {
    const html = await page.content();
    return {
      content: [
        {
          type: "text",
          text: html
        }
      ]
    };
  }
);
server.tool(
  "get-screenshot",
  "Get a screenshot of the current page",
  {},
  async () => {
    const screenshot = await page.screenshot({
      type: "png"
    });
    return {
      content: [
        {
          type: "image",
          data: screenshot.toString("base64"),
          mimeType: "image/png"
        }
      ]
    };
  }
);
server.tool(
  "execute-code",
  "Execute custom Playwright JS code against the current page",
  {
    code: z.string().describe(`The Playwright code to execute. Must be an async function declaration that takes a page parameter.

Example:
async function run(page) {
  console.log(await page.title());
  return await page.title();
}

Returns an object with:
- result: The return value from your function
- logs: Array of console logs from execution
- errors: Array of any errors encountered

Example response:
{"result": "Google", "logs": ["[log] Google"], "errors": []}`)
  },
  async ({ code }) => {
    const result = await secureEvalAsync(page, code);
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(result, null, 2)
          // Pretty print the JSON
        }
      ]
    };
  }
);
server.tool(
  "get-context",
  "Get the website context which would be used to write the testcase",
  {},
  async () => {
    const state = getState();
    if (state.messages.length === 0) {
      return {
        content: [
          {
            type: "text",
            text: `No messages available`
          }
        ]
      };
    }
    const content = [];
    let totalLength = 0;
    let messagesProcessed = 0;
    while (messagesProcessed < state.messages.length && totalLength < 2e4) {
      const message = state.messages[messagesProcessed];
      let currentContent = message.content;
      if (message.type === "DOM") {
        currentContent = `DOM: ${message.content}

`;
      } else if (message.type === "Text") {
        currentContent = `Text: ${message.content}

`;
      } else if (message.type === "Interaction") {
        const interaction = JSON.parse(message.content);
        delete interaction.eventId;
        delete interaction.dom;
        delete interaction.elementUUID;
        if (interaction.selectors) {
          interaction.selectors = interaction.selectors.slice(0, 10);
        }
        currentContent = `Interaction: ${JSON.stringify(interaction)}

`;
      } else if (message.type === "Image") {
        currentContent = message.content;
      }
      totalLength += currentContent.length;
      const item = {};
      const isImage = message.type === "Image";
      if (isImage) {
        item.type = "image";
        item.data = message.content;
        item.mimeType = "image/png";
      } else {
        item.type = "text";
        item.text = currentContent;
      }
      content.push(item);
      messagesProcessed++;
    }
    state.messages.splice(0, messagesProcessed);
    updateState(page, state);
    const remainingCount = state.messages.length;
    if (remainingCount > 0) {
      content.push({
        type: "text",
        text: `Remaining ${remainingCount} messages, please fetch those in next requests.
`
      });
    }
    return {
      content
    };
  }
);
server.tool(
  "validate-selectors",
  "Validate multiple selectors. Returns validation results for each selector.  (Prefer using execute-code instead)",
  {
    selectors: z.array(z.string())
  },
  async ({ selectors }) => {
    const results = await Promise.all(
      selectors.map(async (selector) => {
        const locator = page.locator(selector);
        const count = await locator.count();
        return {
          selector,
          isValid: count === 1,
          count
        };
      })
    );
    const validationText = results.map(
      ({ selector, isValid, count }) => `${selector}: ${isValid ? "valid" : `invalid (${count} elements found)`}`
    ).join("\n");
    return {
      content: [
        {
          type: "text",
          text: validationText
        }
      ]
    };
  }
);

// src/web-server.ts
import http from "http";
import fs from "fs";
import path from "path";
import url, { fileURLToPath } from "url";
import { dirname } from "path";
import net from "net";
var __filename = fileURLToPath(import.meta.url);
var __dirname = dirname(__filename);
var SERVE_DIR = path.join(__dirname, "ui");
async function isPortInUse(port) {
  return new Promise((resolve) => {
    const tester = net.createServer().once("error", () => resolve(true)).once("listening", () => {
      tester.once("close", () => resolve(false));
      tester.close();
    }).listen(port);
  });
}
var server2 = http.createServer((req, res) => {
  const parsedUrl = url.parse(req.url || "");
  const pathname = parsedUrl.pathname || "/";
  let filePath = path.join(SERVE_DIR, pathname);
  if (!filePath.startsWith(SERVE_DIR)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("403 Forbidden: Access denied");
    return;
  }
  if (pathname.endsWith("/")) {
    filePath = path.join(filePath, "index.html");
  }
  fs.stat(filePath, (err, stats) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      res.end("404 Not Found");
      return;
    }
    if (stats.isDirectory()) {
      filePath = path.join(filePath, "index.html");
      fs.stat(filePath, (err2, stats2) => {
        if (err2) {
          res.writeHead(404, { "Content-Type": "text/plain" });
          res.end("404 Not Found");
          return;
        }
        serveFile(filePath, res);
      });
    } else {
      serveFile(filePath, res);
    }
  });
});
function serveFile(filePath, res) {
  const ext = path.extname(filePath);
  let contentType = "text/plain";
  switch (ext) {
    case ".html":
      contentType = "text/html";
      break;
    case ".css":
      contentType = "text/css";
      break;
    case ".js":
      contentType = "application/javascript";
      break;
    case ".json":
      contentType = "application/json";
      break;
    case ".png":
      contentType = "image/png";
      break;
    case ".jpg":
    case ".jpeg":
      contentType = "image/jpeg";
      break;
    case ".gif":
      contentType = "image/gif";
      break;
    case ".svg":
      contentType = "image/svg+xml";
      break;
    case ".pdf":
      contentType = "application/pdf";
      break;
  }
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(500, { "Content-Type": "text/plain" });
      res.end("Internal Server Error");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

// src/server.ts
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Server started");
  if (true) {
    const portInUse = await isPortInUse(5174);
    if (!portInUse) {
      server2.listen(5174, () => {
        console.error("Web server started");
      });
    } else {
      console.error("Port 5174 is in use, skipping web server");
    }
  }
}
main().catch((error) => {
  console.error("Fatal error in main", error);
  process.exit(1);
});
