# 编码任务：messageStore 变量作用域引用修复

## 1. 修复 `createCompletion` 函数的 Store 引用

- [ ] 在 `createCompletion` 函数体开头（`src/renderer/js/app.js` 第426行）添加 Store 实例获取语句：
  - 在 `const conversation = ...` 之前插入以下5行：
    ```javascript
    const messageStore = useMessageStore();
    const chatbotStore = useChatbotStore();
    const snackbarStore = useSnackbarStore();
    const agentStore = useAgentStore();
    const mcpStore = useMcpStore();
    ```
  - 确保所有 Store 引用（第439-508行）从闭包变量变为函数内局部变量
  - 受影响引用点无需修改引用写法，仅改变变量来源

## 2. 修复 `read` 函数的 Store 引用

- [ ] 在 `read` 函数体开头（`src/renderer/js/app.js` 第520行）添加 `messageStore` 实例获取语句：
  - 在 `const decoder = ...` 之前插入：
    ```javascript
    const messageStore = useMessageStore();
    ```
  - 确保第524行 `messageStore.generating` 和第525行 `messageStore.generating = false` 从闭包变量变为函数内局部变量

## 3. 修复 `parseJson` 函数的 Store 引用

- [ ] 在 `parseJson` 函数体开头（`src/renderer/js/app.js` 第586行）添加 `chatbotStore` 实例获取语句：
  - 在 `try {` 之前插入：
    ```javascript
    const chatbotStore = useChatbotStore();
    ```
  - 确保第589行和第592行的 `chatbotStore.provider` 从闭包变量变为函数内局部变量

## 4. 确认 `parseTool` 函数无需修改

- [ ] 验证 `parseTool` 函数（`src/renderer/js/app.js` 第616行）内部未直接引用任何 Store 变量，确认无需修改

## 5. 确认 `setup()` 内变量声明保留不变

- [ ] 验证 `setup()` 函数内（`src/renderer/js/app.js` 第653行起）的 `messageStore`、`chatbotStore`、`snackbarStore`、`agentStore`、`mcpStore` 声明保留不变：
  - `setup()` 返回对象中包含这些 Store 引用，供模板绑定使用
  - `setup()` 内部定义的函数（如 `triggerFilePicker`、`onFilePickerChange` 等）通过闭包正确访问这些变量

## 6. 验证与测试

- [ ] 启动应用，发送一条消息，确认不再出现 `ReferenceError: messageStore is not defined`
- [ ] 验证消息发送流程正常：`messageStore.generating` 在发送时设为 `true`，完成后设为 `false`
- [ ] 验证 `messageStore.conversation` 正确追加助手回复消息
- [ ] 验证 API Key 缺失时正确显示错误提示
- [ ] 验证流式响应正常解析并显示
- [ ] 确认 Store 实例唯一性：`createCompletion` 内获取的实例与 `setup()` 内获取的实例为同一个对象