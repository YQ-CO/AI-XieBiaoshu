<template>
  <div style="max-width:900px;margin:24px auto;padding:16px;">
    <h2>我的文档</h2>
    <div style="margin-bottom:12px;">
      <a href="/account">返回账户页</a>
    </div>

    <button @click="load">刷新列表</button>

    <table style="width:100%;margin-top:12px;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">名称</th>
          <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">类型</th>
          <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">状态</th>
          <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">更新时间</th>
          <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="d in docs" :key="d.id">
          <td style="border-bottom:1px solid #f4f4f4;padding:8px;">{{ d.name }}</td>
          <td style="border-bottom:1px solid #f4f4f4;padding:8px;">{{ d.type }}</td>
          <td style="border-bottom:1px solid #f4f4f4;padding:8px;">{{ d.status }}</td>
          <td style="border-bottom:1px solid #f4f4f4;padding:8px;">{{ d.updatedAt }}</td>
          <td style="border-bottom:1px solid #f4f4f4;padding:8px;">
            <a :href="editLink(d)">继续编辑</a>
            <span style="margin:0 6px;color:#999;">|</span>
            <a :href="`/documents/preview?id=${encodeURIComponent(d.id)}`">预览/提交</a>
          </td>
        </tr>
      </tbody>
    </table>

    <pre v-if="debug" style="margin-top:12px;background:#f6f8fa;padding:8px;">{{ debug }}</pre>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from 'vue';
import { myDocuments } from '../api/documents';

export default defineComponent({
  setup() {
    const token = localStorage.getItem('token') || '';
    const docs = ref<any[]>([]);
    const debug = ref('');

    const load = async () => {
      try {
        docs.value = await myDocuments(token);
      } catch (e: any) {
        debug.value = '加载失败：' + (e.response?.data?.error || e.message);
      }
    };

    const editLink = (doc: any) => {
      if (doc.type === 'scoring') return `/write/scoring?id=${encodeURIComponent(doc.id)}`;
      if (doc.type === 'directory') return `/write/directory?id=${encodeURIComponent(doc.id)}`;
      return `/write/special?id=${encodeURIComponent(doc.id)}`;
    };

    onMounted(load);
    return { docs, debug, load, editLink };
  }
});
</script>
