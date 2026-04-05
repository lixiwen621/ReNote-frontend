<script setup>
import { Color } from '@tiptap/extension-color'
import { Highlight } from '@tiptap/extension-highlight'
import { TextStyle } from '@tiptap/extension-text-style'
import { Underline } from '@tiptap/extension-underline'
import { StarterKit } from '@tiptap/starter-kit'
import { EditorContent, useEditor } from '@tiptap/vue-3'
import { onBeforeUnmount, watch } from 'vue'

const props = defineProps({
  modelValue: {
    type: String,
    default: '',
  },
  editable: {
    type: Boolean,
    default: true,
  },
  placeholder: {
    type: String,
    default: '在此输入复习内容…',
  },
})

const emit = defineEmits(['update:modelValue'])

const editor = useEditor({
  content: props.modelValue || '',
  editable: props.editable,
  extensions: [
    StarterKit,
    Underline,
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
  ],
  editorProps: {
    attributes: {
      class: 'rich-content focus:outline-none min-h-[200px] p-3',
    },
  },
  onUpdate({ editor }) {
    emit('update:modelValue', editor.getHTML())
  },
})

watch(
  () => props.modelValue,
  (val) => {
    if (!editor.value) return
    const current = editor.value.getHTML()
    if (val !== current) {
      editor.value.commands.setContent(val || '', false)
    }
  },
)

watch(
  () => props.editable,
  (val) => {
    editor.value?.setEditable(val)
  },
)

onBeforeUnmount(() => {
  editor.value?.destroy()
})

const COLORS = [
  { label: '默认', value: '' },
  { label: '红', value: '#ef4444' },
  { label: '橙', value: '#f97316' },
  { label: '黄', value: '#eab308' },
  { label: '绿', value: '#22c55e' },
  { label: '蓝', value: '#3b82f6' },
  { label: '紫', value: '#a855f7' },
]

const HIGHLIGHTS = [
  { label: '无', value: '' },
  { label: '黄', value: '#fef08a' },
  { label: '绿', value: '#bbf7d0' },
  { label: '蓝', value: '#bfdbfe' },
  { label: '粉', value: '#fecdd3' },
]

function setColor(color) {
  if (!color) {
    editor.value?.chain().focus().unsetColor().run()
  } else {
    editor.value?.chain().focus().setColor(color).run()
  }
}

function setHighlight(color) {
  if (!color) {
    editor.value?.chain().focus().unsetHighlight().run()
  } else {
    editor.value?.chain().focus().toggleHighlight({ color }).run()
  }
}
</script>

<template>
  <div class="rounded-box border border-base-300 bg-base-100">
    <!-- Toolbar (only when editable) -->
    <div v-if="editable && editor" class="flex flex-wrap items-center gap-1 border-b border-base-300 bg-base-200/60 px-2 py-1.5">
      <!-- Bold -->
      <button
        type="button"
        class="btn btn-ghost btn-xs font-bold"
        :class="{ 'btn-active bg-base-300': editor.isActive('bold') }"
        title="粗体"
        @click="editor.chain().focus().toggleBold().run()"
      >B</button>

      <!-- Italic -->
      <button
        type="button"
        class="btn btn-ghost btn-xs italic"
        :class="{ 'btn-active bg-base-300': editor.isActive('italic') }"
        title="斜体"
        @click="editor.chain().focus().toggleItalic().run()"
      >I</button>

      <!-- Underline -->
      <button
        type="button"
        class="btn btn-ghost btn-xs underline"
        :class="{ 'btn-active bg-base-300': editor.isActive('underline') }"
        title="下划线"
        @click="editor.chain().focus().toggleUnderline().run()"
      >U</button>

      <!-- Strike -->
      <button
        type="button"
        class="btn btn-ghost btn-xs line-through"
        :class="{ 'btn-active bg-base-300': editor.isActive('strike') }"
        title="删除线"
        @click="editor.chain().focus().toggleStrike().run()"
      >S</button>

      <div class="divider divider-horizontal mx-0 h-5 w-px bg-base-300" />

      <!-- Bullet list -->
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        :class="{ 'btn-active bg-base-300': editor.isActive('bulletList') }"
        title="无序列表"
        @click="editor.chain().focus().toggleBulletList().run()"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M3 5a1 1 0 100-2 1 1 0 000 2zm0 6a1 1 0 100-2 1 1 0 000 2zm0 6a1 1 0 100-2 1 1 0 000 2zM7 4a1 1 0 010 1H17a1 1 0 010-2H7a1 1 0 01-1 1zm0 6a1 1 0 010 1H17a1 1 0 010-2H7a1 1 0 01-1 1zm0 6a1 1 0 010 1H17a1 1 0 010-2H7a1 1 0 01-1 1z" clip-rule="evenodd" />
        </svg>
      </button>

      <!-- Ordered list -->
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        :class="{ 'btn-active bg-base-300': editor.isActive('orderedList') }"
        title="有序列表"
        @click="editor.chain().focus().toggleOrderedList().run()"
      >
        <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" viewBox="0 0 20 20" fill="currentColor">
          <path fill-rule="evenodd" d="M5 4a1 1 0 000 2h10a1 1 0 000-2H5zm0 5a1 1 0 000 2h10a1 1 0 000-2H5zm0 5a1 1 0 000 2h10a1 1 0 000-2H5zM2 5a1 1 0 01.894-.553l1-.5a1 1 0 11.894 1.789l-.788.394V7a1 1 0 01-2 0V5zm0 5a1 1 0 012 0v.382l.276-.138a1 1 0 01.894 1.789l-1.5.75A1 1 0 012 12v-2zm.5 5H2a1 1 0 010-2h1v-.5a1 1 0 012 0v2.5a1 1 0 01-1 1H2a1 1 0 010-2h.5V15z" clip-rule="evenodd" />
        </svg>
      </button>

      <!-- Blockquote -->
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        :class="{ 'btn-active bg-base-300': editor.isActive('blockquote') }"
        title="引用"
        @click="editor.chain().focus().toggleBlockquote().run()"
      >"</button>

      <!-- Code block -->
      <button
        type="button"
        class="btn btn-ghost btn-xs font-mono"
        :class="{ 'btn-active bg-base-300': editor.isActive('codeBlock') }"
        title="代码块"
        @click="editor.chain().focus().toggleCodeBlock().run()"
      >&lt;/&gt;</button>

      <div class="divider divider-horizontal mx-0 h-5 w-px bg-base-300" />

      <!-- Text color -->
      <div class="dropdown dropdown-bottom">
        <button type="button" class="btn btn-ghost btn-xs gap-0.5" title="文字颜色">
          <span class="font-bold" :style="{ color: editor.getAttributes('textStyle').color || 'currentColor' }">A</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-2.5 w-2.5 opacity-60" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
          </svg>
        </button>
        <ul tabindex="0" class="dropdown-content menu rounded-box border border-base-300 bg-base-100 p-1 shadow z-10">
          <li v-for="c in COLORS" :key="c.value">
            <button type="button" class="flex items-center gap-2 text-xs" @click="setColor(c.value)">
              <span
                class="inline-block h-3.5 w-3.5 rounded-full border border-base-300"
                :style="{ background: c.value || 'transparent' }"
              />
              {{ c.label }}
            </button>
          </li>
        </ul>
      </div>

      <!-- Highlight -->
      <div class="dropdown dropdown-bottom">
        <button type="button" class="btn btn-ghost btn-xs gap-0.5" title="高亮">
          <span
            class="rounded px-0.5 font-bold text-xs"
            :class="editor.isActive('highlight') ? 'bg-yellow-200' : ''"
          >H</span>
          <svg xmlns="http://www.w3.org/2000/svg" class="h-2.5 w-2.5 opacity-60" viewBox="0 0 20 20" fill="currentColor">
            <path fill-rule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.168l3.71-3.938a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clip-rule="evenodd" />
          </svg>
        </button>
        <ul tabindex="0" class="dropdown-content menu rounded-box border border-base-300 bg-base-100 p-1 shadow z-10">
          <li v-for="h in HIGHLIGHTS" :key="h.value">
            <button type="button" class="flex items-center gap-2 text-xs" @click="setHighlight(h.value)">
              <span
                class="inline-block h-3.5 w-3.5 rounded border border-base-300"
                :style="{ background: h.value || 'transparent' }"
              />
              {{ h.label }}
            </button>
          </li>
        </ul>
      </div>

      <div class="divider divider-horizontal mx-0 h-5 w-px bg-base-300" />

      <!-- Undo / Redo -->
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        :disabled="!editor.can().undo()"
        title="撤销"
        @click="editor.chain().focus().undo().run()"
      >↩</button>
      <button
        type="button"
        class="btn btn-ghost btn-xs"
        :disabled="!editor.can().redo()"
        title="重做"
        @click="editor.chain().focus().redo().run()"
      >↪</button>
    </div>

    <!-- Editor content -->
    <EditorContent :editor="editor" />
  </div>
</template>

<style scoped>
:deep(.ProseMirror) {
  outline: none;
}

:deep(.ProseMirror p.is-editor-empty:first-child::before) {
  color: oklch(var(--bc) / 0.4);
  content: attr(data-placeholder);
  float: left;
  height: 0;
  pointer-events: none;
}

:deep(.rich-content ul),
:deep(.ProseMirror ul) {
  list-style-type: disc;
  padding-left: 1.25rem;
}

:deep(.rich-content ol),
:deep(.ProseMirror ol) {
  list-style-type: decimal;
  padding-left: 1.25rem;
}

:deep(.rich-content blockquote),
:deep(.ProseMirror blockquote) {
  border-left: 3px solid oklch(var(--bc) / 0.3);
  margin-left: 0;
  padding-left: 0.75rem;
  color: oklch(var(--bc) / 0.7);
}

:deep(.rich-content pre),
:deep(.ProseMirror pre) {
  background: oklch(var(--b2));
  border-radius: 0.375rem;
  padding: 0.5rem 0.75rem;
  font-family: ui-monospace, monospace;
  font-size: 0.85em;
}

:deep(.rich-content code:not(pre code)),
:deep(.ProseMirror code:not(pre code)) {
  background: oklch(var(--b2));
  border-radius: 0.25rem;
  padding: 0.1em 0.3em;
  font-family: ui-monospace, monospace;
  font-size: 0.85em;
}

:deep(.ProseMirror strong) {
  font-weight: 700;
}
</style>
