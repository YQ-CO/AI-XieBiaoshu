<template>
  <div style="max-width:720px;margin:24px auto;padding:16px;">
    <h2>解析招标文件</h2>
    <input type="file" @change="onFileChange" />
    <button @click="submit" :disabled="!selectedFile">开始解析</button>

    <div v-if="result" style="margin-top:20px;">
      <h3>解析结果</h3>
      <p>文件名：{{ result.fileName }}</p>
      <div v-for="sec in result.sections" :key="sec.title" style="margin-bottom:12px;">
        <strong>{{ sec.title }}</strong>
        <p>{{ sec.content }}</p>
      </div>
    </div>

    <pre v-if="debug" style="margin-top:12px;background:#f6f8fa;padding:8px">{{ debug }}</pre>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref } from 'vue';
import { uploadFile } from '../api/parse';

export default defineComponent({
  setup() {
    const selectedFile = ref<File | null>(null);
    const result = ref<any>(null);
    const debug = ref('');
    const token = localStorage.getItem('token') || '';

    const onFileChange = (e: Event) => {
      const files = (e.target as HTMLInputElement).files;
      if (files && files.length) selectedFile.value = files[0];
    };
    const submit = async () => {
      if (!selectedFile.value) return;
      try {
        result.value = await uploadFile(selectedFile.value, token);
        debug.value = '';
      } catch (e: any) {
        debug.value = '解析失败：' + (e.response?.data?.error || e.message);
      }
    };

    return { selectedFile, onFileChange, submit, result, debug };
  }
});
</script>
