// ==========================================================================
// TitleBar - 顶部标题栏组件
// 包含：应用标题文本 + 窗口控制按钮（最小化/最大化/关闭）
// ==========================================================================
const TitleBar = defineComponent({
    name: 'TitleBar',
    template: `
    <div class="title-bar" data-component-id="chat-mcp.titlebar">
        <div class="title-bar__title">
            {{ titleText }}
        </div>
        <div class="title-bar__controls">
            <v-btn
                icon
                variant="text"
                size="small"
                @click="onControl('minimize')"
                data-component-id="chat-mcp.titlebar.minimize"
                :title="$t('$vuetify.window.minimize')">
                <v-icon size="small">mdi-window-minimize</v-icon>
            </v-btn>
            <v-btn
                icon
                variant="text"
                size="small"
                @click="onControl('maximize')"
                data-component-id="chat-mcp.titlebar.maximize"
                :title="$t('$vuetify.window.maximize')">
                <v-icon size="small">mdi-window-maximize</v-icon>
            </v-btn>
            <v-btn
                icon
                variant="text"
                size="small"
                @click="onControl('close')"
                data-component-id="chat-mcp.titlebar.close"
                :title="$t('$vuetify.window.close')">
                <v-icon size="small">mdi-close</v-icon>
            </v-btn>
        </div>
    </div>
    `,
    setup() {
        const titleText = APP_TITLE;

        function onControl(action) {
            try {
                if (window.windowAPI && typeof window.windowAPI[action] === 'function') {
                    window.windowAPI[action]().catch(err => {
                        console.error('Window control failed:', action, err);
                    });
                }
            } catch (err) {
                console.error('Window control error:', action, err);
            }
        }

        return { titleText, onControl };
    },
});