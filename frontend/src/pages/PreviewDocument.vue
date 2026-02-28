<template>
  <div style="max-width:900px;margin:24px auto;padding:16px;">
    <h2>文档预览</h2>
    <div style="margin-bottom:12px;display:flex;gap:12px;align-items:center;">
      <a href="/documents">返回我的文档</a>
      <a v-if="doc" :href="editLink(doc)">返回编辑</a>
    </div>

    <div v-if="doc" style="border:1px solid #eee;padding:12px;border-radius:6px;">
      <p><strong>名称：</strong>{{ doc.name }}</p>
      <p><strong>类型：</strong>{{ doc.type }}</p>
      <p><strong>状态：</strong>{{ doc.status }}</p>
      <p><strong>更新时间：</strong>{{ doc.updatedAt }}</p>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
        <button @click="submit" :disabled="doc.status==='submitted'">
        {{ doc.status === 'submitted' ? '已提交' : '提交文档' }}
        </button>
        <button @click="exportWord">导出 Word</button>
      </div>

      <h3>正文预览</h3>
      <pre style="white-space:pre-wrap;background:#f6f8fa;padding:12px;min-height:220px;">{{ doc.content || '暂无内容' }}</pre>
    </div>

    <pre v-if="debug" style="margin-top:12px;background:#f6f8fa;padding:8px;">{{ debug }}</pre>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { documentDetail, exportWordDocument, submitDocument } from '../api/documents';

export default defineComponent({
  setup() {
    const token = localStorage.getItem('token') || '';
    const route = useRoute();
    const doc = ref<any>(null);
    const debug = ref('');

    const load = async () => {
      const id = String(route.query.id || '');
      if (!id) {
        debug.value = '缺少文档ID';
        return;
      }
      try {
        doc.value = await documentDetail(id, token);
      } catch (e: any) {
        debug.value = '加载失败：' + (e.response?.data?.error || e.message);
      }
    };

    const submit = async () => {
      if (!doc.value?.id) return;
      try {
        doc.value = await submitDocument(doc.value.id, token);
        debug.value = '提交成功';
      } catch (e: any) {
        debug.value = '提交失败：' + (e.response?.data?.error || e.message);
      }
    };

    const exportWord = async () => {
      if (!doc.value?.id) return;
      try {
        await exportWordDocument(doc.value.id, token);
        debug.value = 'Word 导出成功';
      } catch (e: any) {
        debug.value = '导出失败：' + (e.response?.data?.error || e.message);
      }
    };

    const editLink = (d: any) => {
      if (d.type === 'scoring') return `/write/scoring?id=${encodeURIComponent(d.id)}`;
      if (d.type === 'directory') return `/write/directory?id=${encodeURIComponent(d.id)}`;
      return `/write/special?id=${encodeURIComponent(d.id)}`;
    };

    onMounted(load);
    return { doc, debug, submit, exportWord, editLink };
  }
});
</script>
