/**
 * ==========================================================================
 * Git 组件定义
 * ==========================================================================
 * 包含：GitPanel（主面板，内含 Toolbar/ChangesView/DiffView/CommitArea/TimelineView）
 * 依赖：Vue（全局 UMD）、Vuetify、useGitStore、useWorkspaceStore、useSettingStore、useSnackbarStore
 */

// Diff 虚拟滚动阈值
const DIFF_VIRTUAL_THRESHOLD = 1000;

// ==========================================================================
// GitDiffView - Diff 按行渲染与虚拟滚动
// ==========================================================================
const GitDiffView = defineComponent({
    name: 'GitDiffView',
    template: `
    <div class="git-diff-view d-flex flex-column" style="height:100%;">
        <div class="git-diff-header px-3 py-2 d-flex align-center" v-if="fileName">
            <v-icon size="small" class="mr-2">mdi-file-compare</v-icon>
            <span class="text-body-2 text-truncate">{{ fileName }}</span>
            <v-spacer></v-spacer>
            <v-btn icon size="x-small" variant="text" @click="$emit('close')"
                title="Close diff">
                <v-icon>mdi-close</v-icon>
            </v-btn>
        </div>
        <v-divider></v-divider>
        <div class="git-diff-content flex-grow-1 overflow-y-auto" ref="diffContainer">
            <div v-if="loading" class="d-flex align-center justify-center fill-height">
                <v-progress-circular indeterminate size="32"></v-progress-circular>
            </div>
            <div v-else-if="binary" class="d-flex align-center justify-center fill-height pa-4">
                <span class="text-body-2 text-grey">{{ $t('workspace.git.binaryFile') }}</span>
            </div>
            <div v-else-if="!patch" class="d-flex align-center justify-center fill-height pa-4">
                <span class="text-body-2 text-grey">{{ $t('workspace.git.noDiff') }}</span>
            </div>
            <div v-else class="git-diff-lines">
                <div v-for="(line, idx) in visibleLines" :key="idx"
                    class="git-diff-line d-flex"
                    :class="lineClass(line)">
                    <span class="git-diff-lineno text-caption text-grey px-2">{{ line.oldLineNo || '' }}</span>
                    <span class="git-diff-lineno text-caption text-grey px-2">{{ line.newLineNo || '' }}</span>
                    <span class="git-diff-content text-caption flex-grow-1" style="white-space:pre-wrap;word-break:break-all;">{{ line.text }}</span>
                </div>
                <div v-if="collapsed" class="git-diff-collapsed text-center py-2">
                    <v-btn size="small" variant="text" color="primary" @click="expanded = true">
                        {{ $t('workspace.git.expandAll') }} ({{ totalLines - visibleLines.length }} {{ $t('workspace.git.lines') }})
                    </v-btn>
                </div>
            </div>
        </div>
    </div>
    `,
    props: {
        patch: { type: String, default: '' },
        binary: { type: Boolean, default: false },
        loading: { type: Boolean, default: false },
        fileName: { type: String, default: '' },
    },
    emits: ['close'],
    setup(props) {
        const expanded = ref(false);
        const diffContainer = ref(null);

        const parsedLines = computed(() => {
            if (!props.patch) return [];
            const lines = props.patch.split('\n');
            const result = [];
            let oldLineNo = 0;
            let newLineNo = 0;
            for (const line of lines) {
                if (line.startsWith('@@')) {
                    const m = line.match(/@@\s+-(\d+)(?:,\d+)?\s+\+(\d+)(?:,\d+)?\s+@@/);
                    if (m) {
                        oldLineNo = parseInt(m[1], 10);
                        newLineNo = parseInt(m[2], 10);
                    }
                    result.push({ type: 'hunk', text: line, oldLineNo: '', newLineNo: '' });
                    continue;
                }
                if (line.startsWith('diff --git') || line.startsWith('index ') || line.startsWith('--- ') || line.startsWith('+++ ')) {
                    result.push({ type: 'meta', text: line, oldLineNo: '', newLineNo: '' });
                    continue;
                }
                if (line.startsWith('+')) {
                    result.push({ type: 'add', text: line.substring(1), oldLineNo: '', newLineNo: newLineNo++ });
                } else if (line.startsWith('-')) {
                    result.push({ type: 'del', text: line.substring(1), oldLineNo: oldLineNo++, newLineNo: '' });
                } else if (line.startsWith(' ')) {
                    result.push({ type: 'ctx', text: line.substring(1), oldLineNo: oldLineNo++, newLineNo: newLineNo++ });
                } else {
                    result.push({ type: 'meta', text: line, oldLineNo: '', newLineNo: '' });
                }
            }
            return result;
        });

        const totalLines = computed(() => parsedLines.value.length);
        const collapsed = computed(() => !expanded.value && totalLines.value > DIFF_VIRTUAL_THRESHOLD);

        const visibleLines = computed(() => {
            const all = parsedLines.value;
            if (!collapsed.value) return all;
            // 折叠中间无变化区域，仅展示首尾差异区域
            const keep = 200;
            const head = all.slice(0, keep);
            const tail = all.slice(Math.max(keep, all.length - keep));
            return [...head, { type: 'meta', text: '...', oldLineNo: '', newLineNo: '' }, ...tail];
        });

        function lineClass(line) {
            return {
                'git-diff-line--add': line.type === 'add',
                'git-diff-line--del': line.type === 'del',
                'git-diff-line--hunk': line.type === 'hunk',
                'git-diff-line--meta': line.type === 'meta',
            };
        }

        return { expanded, diffContainer, visibleLines, totalLines, collapsed, lineClass };
    },
});

// ==========================================================================
// GitChangesView - 变更文件列表 + 暂存/取消暂存
// ==========================================================================
const GitChangesView = defineComponent({
    name: 'GitChangesView',
    template: `
    <div class="git-changes-view d-flex flex-column" style="height:100%;">
        <div class="git-changes-header px-3 py-2 d-flex align-center">
            <span class="text-body-2">{{ $t('workspace.git.changes') }}</span>
            <v-spacer></v-spacer>
            <v-btn size="x-small" variant="text" color="primary"
                :disabled="gitStore.loading.stage || gitStore.statusGroup.unstaged.length === 0"
                @click="gitStore.stageAll()">
                <v-icon size="small" class="mr-1">mdi-check-all</v-icon>
                {{ $t('workspace.git.stageAll') }}
            </v-btn>
        </div>
        <v-divider></v-divider>
        <div class="git-changes-list flex-grow-1 overflow-y-auto">
            <div v-if="gitStore.loading.status" class="d-flex align-center justify-center pa-4">
                <v-progress-circular indeterminate size="24"></v-progress-circular>
            </div>
            <div v-else-if="gitStore.statusEntries.length === 0" class="d-flex align-center justify-center pa-4">
                <span class="text-body-2 text-grey">{{ $t('workspace.git.noChanges') }}</span>
            </div>
            <template v-else>
                <div class="git-changes-group">
                    <div class="git-changes-group-title px-3 py-1 text-caption text-grey">
                        {{ $t('workspace.git.stagedChanges') }} ({{ gitStore.statusGroup.staged.length }})
                    </div>
                    <div v-for="entry in gitStore.statusGroup.staged" :key="'staged-' + entry.file"
                        class="git-changes-item d-flex align-center px-3 py-1"
                        :class="{ 'git-changes-item--active': gitStore.selectedFile === entry.file }"
                        @click="gitStore.selectFile(entry)">
                        <v-icon size="small" class="mr-2" :color="statusColor(entry.status)">{{ statusIcon(entry.status) }}</v-icon>
                        <span class="text-body-2 text-truncate flex-grow-1">{{ entry.file }}</span>
                        <v-btn icon size="x-small" variant="text"
                            :disabled="gitStore.loading.unstage"
                            @click.stop="gitStore.unstageFiles([entry.file])"
                            :title="$t('workspace.git.unstage')">
                            <v-icon>mdi-minus</v-icon>
                        </v-btn>
                    </div>
                </div>
                <div class="git-changes-group">
                    <div class="git-changes-group-title px-3 py-1 text-caption text-grey">
                        {{ $t('workspace.git.unstagedChanges') }} ({{ gitStore.statusGroup.unstaged.length }})
                    </div>
                    <div v-for="entry in gitStore.statusGroup.unstaged" :key="'unstaged-' + entry.file"
                        class="git-changes-item d-flex align-center px-3 py-1"
                        :class="{ 'git-changes-item--active': gitStore.selectedFile === entry.file }"
                        @click="gitStore.selectFile(entry)">
                        <v-icon size="small" class="mr-2" :color="statusColor(entry.status)">{{ statusIcon(entry.status) }}</v-icon>
                        <span class="text-body-2 text-truncate flex-grow-1">{{ entry.file }}</span>
                        <v-btn icon size="x-small" variant="text"
                            :disabled="gitStore.loading.stage"
                            @click.stop="gitStore.stageFiles([entry.file])"
                            :title="$t('workspace.git.stage')">
                            <v-icon>mdi-plus</v-icon>
                        </v-btn>
                    </div>
                </div>
            </template>
        </div>
    </div>
    `,
    setup() {
        const gitStore = useGitStore();

        function statusIcon(status) {
            if (status.includes('A') || status === '??') return 'mdi-file-plus';
            if (status.includes('D')) return 'mdi-file-minus';
            if (status.includes('M')) return 'mdi-file-edit';
            return 'mdi-file';
        }
        function statusColor(status) {
            if (status.includes('A') || status === '??') return 'success';
            if (status.includes('D')) return 'error';
            if (status.includes('M')) return 'warning';
            return 'default';
        }

        return { gitStore, statusIcon, statusColor };
    },
});

// ==========================================================================
// GitCommitArea - 提交消息输入 + AI 生成 + 提交按钮
// ==========================================================================
const GitCommitArea = defineComponent({
    name: 'GitCommitArea',
    template: `
    <div class="git-commit-area pa-3">
        <v-textarea
            v-model="gitStore.commitMessage"
            :label="$t('workspace.git.commitMessage')"
            :rows="2"
            density="compact"
            variant="outlined"
            @input="gitStore.commitSource = 'manual'"
            :disabled="gitStore.loading.aiGenerate">
        </v-textarea>
        <div class="d-flex align-center mt-2">
            <v-btn size="small" variant="text" color="primary"
                :disabled="gitStore.loading.aiGenerate || gitStore.statusGroup.staged.length === 0"
                @click="gitStore.generateAICommitMessage()"
                :loading="gitStore.loading.aiGenerate">
                <v-icon size="small" class="mr-1">mdi-robot</v-icon>
                {{ $t('workspace.git.aiGenerate') }}
            </v-btn>
            <v-btn v-if="gitStore.loading.aiGenerate" size="small" variant="text" color="error"
                @click="gitStore.abortAIGenerate()">
                <v-icon size="small" class="mr-1">mdi-stop</v-icon>
                {{ $t('workspace.git.abort') }}
            </v-btn>
            <v-spacer></v-spacer>
            <v-btn size="small" variant="flat" color="primary"
                :disabled="gitStore.loading.commit || !gitStore.commitMessage.trim() || gitStore.statusGroup.staged.length === 0"
                :loading="gitStore.loading.commit"
                @click="gitStore.commit()">
                {{ $t('workspace.git.commit') }}
            </v-btn>
        </div>
    </div>
    `,
    setup() {
        const gitStore = useGitStore();
        return { gitStore };
    },
});

// ==========================================================================
// GitTimelineView - 提交历史时间线
// ==========================================================================
const GitTimelineView = defineComponent({
    name: 'GitTimelineView',
    template: `
    <div class="git-timeline-view d-flex flex-column" style="height:100%;">
        <div class="git-timeline-header px-3 py-2 d-flex align-center">
            <v-icon size="small" class="mr-2">mdi-history</v-icon>
            <span class="text-body-2">{{ $t('workspace.git.timeline') }}</span>
        </div>
        <v-divider></v-divider>
        <div class="git-timeline-list flex-grow-1 overflow-y-auto" ref="timelineContainer" @scroll="onScroll">
            <div v-if="gitStore.loading.log && gitStore.logEntries.length === 0"
                class="d-flex align-center justify-center pa-4">
                <v-progress-circular indeterminate size="24"></v-progress-circular>
            </div>
            <div v-else-if="gitStore.logEntries.length === 0" class="d-flex align-center justify-center pa-4">
                <span class="text-body-2 text-grey">{{ $t('workspace.git.noCommits') }}</span>
            </div>
            <template v-else>
                <div v-for="entry in gitStore.logEntries" :key="entry.hash"
                    class="git-timeline-item px-3 py-2"
                    :class="{ 'git-timeline-item--active': gitStore.selectedCommit === entry.hash }"
                    @click="gitStore.showCommitDetail(entry.hash)">
                    <div class="d-flex align-center">
                        <span class="text-caption font-weight-mono mr-2" style="font-family:monospace;">{{ shortHash(entry.hash) }}</span>
                        <span class="text-body-2 text-truncate flex-grow-1">{{ entry.message }}</span>
                    </div>
                    <div class="text-caption text-grey mt-1">
                        {{ entry.author }} · {{ formatTime(entry.time) }}
                    </div>
                </div>
                <div v-if="gitStore.loading.log" class="d-flex align-center justify-center py-2">
                    <v-progress-circular indeterminate size="20"></v-progress-circular>
                </div>
            </template>
        </div>
        <v-divider></v-divider>
        <div v-if="gitStore.selectedCommit && gitStore.showResult" class="git-timeline-detail" style="max-height:40%;overflow-y:auto;">
            <div class="px-3 py-1 text-caption text-grey">
                {{ gitStore.selectedCommit.substring(0, 7) }} · {{ gitStore.showResult.files.length }} files
            </div>
            <div v-for="f in gitStore.showResult.files" :key="f.file" class="px-3 py-1 text-body-2 d-flex align-center">
                <v-icon size="small" class="mr-2">{{ fileStatusIcon(f.status) }}</v-icon>
                <span class="text-truncate">{{ f.file }}</span>
            </div>
            <git-diff-view :patch="gitStore.showResult.patch" :loading="gitStore.loading.show"
                @close="gitStore.selectedCommit = null; gitStore.showResult = null;">
            </git-diff-view>
        </div>
    </div>
    `,
    setup() {
        const gitStore = useGitStore();
        const timelineContainer = ref(null);

        function shortHash(hash) {
            return hash ? hash.substring(0, 7) : '';
        }
        function formatTime(time) {
            if (!time) return '';
            try {
                const d = new Date(time);
                return d.toLocaleString();
            } catch {
                return time;
            }
        }
        function fileStatusIcon(status) {
            if (status === 'A') return 'mdi-file-plus';
            if (status === 'D') return 'mdi-file-minus';
            return 'mdi-file-edit';
        }
        function onScroll() {
            const el = timelineContainer.value;
            if (!el) return;
            if (el.scrollTop + el.clientHeight >= el.scrollHeight - 50) {
                gitStore.loadMoreTimeline();
            }
        }

        return { gitStore, timelineContainer, shortHash, formatTime, fileStatusIcon, onScroll };
    },
});

// ==========================================================================
// GitPanel - 主面板
// ==========================================================================
const GitPanel = defineComponent({
    name: 'GitPanel',
    template: `
    <div class="git-panel d-flex flex-column" style="height:100%;width:100%;">
        <div v-if="gitStore.loading.check && !gitStore.checkResult"
            class="d-flex align-center justify-center fill-height">
            <v-progress-circular indeterminate size="32"></v-progress-circular>
        </div>
        <div v-else-if="!activeWorkspace" class="d-flex align-center justify-center fill-height pa-4">
            <span class="text-body-2 text-grey">{{ $t('workspace.git.noWorkspace') }}</span>
        </div>
        <div v-else-if="gitStore.gitNotInstalled" class="d-flex align-center justify-center fill-height pa-4">
            <span class="text-body-2 text-grey">{{ $t('workspace.git.gitNotInstalled') }}</span>
        </div>
        <div v-else-if="gitStore.notRepo" class="d-flex align-center justify-center fill-height pa-4">
            <span class="text-body-2 text-grey">{{ $t('workspace.git.notRepo') }}</span>
        </div>
        <template v-else>
            <div class="git-toolbar px-3 py-2 d-flex align-center">
                <v-btn-toggle v-model="gitStore.view" density="compact" variant="text" mandatory>
                    <v-btn value="changes" size="small">
                        <v-icon size="small" class="mr-1">mdi-source-branch</v-icon>
                        {{ $t('workspace.git.changes') }}
                    </v-btn>
                    <v-btn value="timeline" size="small" @click="gitStore.switchView('timeline')">
                        <v-icon size="small" class="mr-1">mdi-history</v-icon>
                        {{ $t('workspace.git.timeline') }}
                    </v-btn>
                </v-btn-toggle>
                <v-spacer></v-spacer>
                <v-btn icon size="small" variant="text"
                    :disabled="gitStore.loading.pull"
                    :loading="gitStore.loading.pull"
                    @click="gitStore.pull()"
                    :title="$t('workspace.git.pull')">
                    <v-icon>mdi-source-pull</v-icon>
                </v-btn>
                <v-btn icon size="small" variant="text"
                    :disabled="gitStore.loading.push"
                    :loading="gitStore.loading.push"
                    @click="gitStore.openPushConfirm()"
                    :title="$t('workspace.git.push')">
                    <v-icon>mdi-source-push</v-icon>
                </v-btn>
                <v-btn icon size="small" variant="text"
                    @click="gitStore.refresh()"
                    :title="$t('workspace.git.refresh')">
                    <v-icon>mdi-refresh</v-icon>
                </v-btn>
            </div>
            <v-divider></v-divider>
            <div class="git-panel-body flex-grow-1 d-flex" style="min-height:0;">
                <template v-if="gitStore.view === 'changes'">
                    <div style="width:50%;border-right:1px solid rgba(var(--v-theme-on-surface),0.12);">
                        <git-changes-view></git-changes-view>
                    </div>
                    <div style="width:50%;">
                        <git-diff-view
                            :patch="gitStore.diffResult?.patch || ''"
                            :binary="gitStore.diffResult?.binary || false"
                            :loading="gitStore.loading.diff"
                            :file-name="gitStore.selectedFile || ''"
                            @close="gitStore.selectedFile = null; gitStore.diffResult = null;">
                        </git-diff-view>
                    </div>
                </template>
                <template v-else>
                    <git-timeline-view style="width:100%;"></git-timeline-view>
                </template>
            </div>
            <v-divider></v-divider>
            <git-commit-area v-if="gitStore.view === 'changes'"></git-commit-area>
        </template>
        <v-dialog v-model="gitStore.pushConfirmDialog" max-width="400">
            <v-card>
                <v-card-title class="text-h6">{{ $t('workspace.git.pushConfirmTitle') }}</v-card-title>
                <v-card-text>{{ $t('workspace.git.pushConfirmText') }}</v-card-text>
                <v-card-actions>
                    <v-spacer></v-spacer>
                    <v-btn variant="text" @click="gitStore.cancelPushConfirm()">{{ $t('workspace.git.cancel') }}</v-btn>
                    <v-btn color="primary" variant="flat"
                        :loading="gitStore.loading.push"
                        @click="gitStore.cancelPushConfirm(); gitStore.push();">
                        {{ $t('workspace.git.confirm') }}
                    </v-btn>
                </v-card-actions>
            </v-card>
        </v-dialog>
    </div>
    `,
    components: {
        'git-diff-view': GitDiffView,
        'git-changes-view': GitChangesView,
        'git-commit-area': GitCommitArea,
        'git-timeline-view': GitTimelineView,
    },
    setup() {
        const gitStore = useGitStore();
        const workspaceStore = useWorkspaceStore();

        const activeWorkspace = computed(() => workspaceStore.activeWorkspace);

        onMounted(() => {
            gitStore.refresh();
        });

        return { gitStore, activeWorkspace };
    },
});