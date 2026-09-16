// ==========================================================================
// ModelSelector - 模型选择下拉组件
// 默认显示当前生效模型，支持下拉选择已配置模型，也可手动输入确认后变更
// ==========================================================================
const ModelSelector = defineComponent({
    name: 'ModelSelector',
    props: {
        model: {
            type: String,
            default: '',
        },
        placeholder: {
            type: String,
            default: MODEL_PLACEHOLDER,
        },
    },
    emits: ['update:model'],
    template: `
    <div class="model-selector" data-component-id="chat-mcp.model-selector">
        <v-combobox
            v-model="localValue"
            :items="modelItems"
            density="compact"
            variant="plain"
            hide-details
            single-line
            :placeholder="placeholder"
            @update:model-value="onSelect"
            @focus="onFocus"
            @blur="onConfirm"
            @keyup.enter="onConfirm"
            class="model-selector__input"
        ></v-combobox>
    </div>
    `,
    setup(props, { emit }) {
        const chatbotStore = useChatbotStore();
        const localValue = ref('');
        const isEditing = ref(false);

        const modelItems = computed(() => {
            const models = (chatbotStore.providers || [])
                .map(p => p.model)
                .filter(m => m && typeof m === 'string');
            return [...new Set(models)];
        });

        function initValue() {
            const currentModel = chatbotStore.activeProvider?.model || props.model || '';
            localValue.value = currentModel;
        }

        onMounted(() => {
            initValue();
        });

        watch(() => chatbotStore.activeProvider?.model, (newModel) => {
            if (!isEditing.value) {
                localValue.value = newModel || props.model || '';
            }
        });

        function onFocus() {
            isEditing.value = true;
        }

        function sanitizeInput(input) {
            if (!input || typeof input !== 'string') return '';
            return input
                .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
                .replace(/<iframe[^>]*>[\s\S]*?<\/iframe>/gi, '')
                .replace(/javascript:/gi, '')
                .replace(/on\w+\s*=/gi, '')
                .trim();
        }

        function confirmModel(raw) {
            isEditing.value = false;
            const sanitized = sanitizeInput(raw);
            if (sanitized && sanitized !== (chatbotStore.activeProvider?.model || '')) {
                if (chatbotStore.activeProvider) {
                    emit('update:model', sanitized);
                }
            } else if (!sanitized) {
                initValue();
            }
        }

        function onSelect(value) {
            if (typeof value !== 'string') return;
            if (modelItems.value.includes(value)) {
                confirmModel(value);
            }
        }

        function onConfirm() {
            confirmModel(localValue.value);
        }

        return { localValue, modelItems, onFocus, onSelect, onConfirm };
    },
});
