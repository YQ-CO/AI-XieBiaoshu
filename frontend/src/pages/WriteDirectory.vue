<template>
  <div style="max-width:800px;margin:24px auto;padding:16px;">
    <h2>上传目录编写</h2>
    <div v-if="!doc">
      <input v-model="name" placeholder="投标文件名称" style="padding:6px;width:300px;" />
      <select v-model="type">
        <option value="directory">上传目录</option>
      </select>
      <button @click="create">开始</button>
    </div>

    <div v-else>
      <p>文档ID: {{ doc.id }}</p>
      <textarea v-model="content" rows="10" style="width:100%;"></textarea>
      <div style="margin-top:8px;">
        <div style="margin-bottom:6px;">模型（可多选，最多3个，已选 {{ selectedModelChoices.length }}/3）：</div>
        <div style="display:flex;flex-wrap:wrap;gap:8px;">
          <button
            v-for="item in modelOptions"
            :key="item.id"
            type="button"
            @click="toggleModelChoice(item.id)"
            :style="{
              padding: '6px 10px',
              border: isModelSelected(item.id) ? '1px solid #1677ff' : '1px solid #d9d9d9',
              background: isModelSelected(item.id) ? '#e6f4ff' : '#fff',
              cursor: 'pointer'
            }"
          >
            {{ item.name || item.id }}
          </button>
        </div>
      </div>
      <div style="margin-top:8px;">
        <button @click="save">保存草稿</button>
        <button @click="complete">标为完成</button>
        <button @click="submit">提交文档</button>
        <a v-if="doc" :href="`/documents/preview?id=${encodeURIComponent(doc.id)}`" style="margin:0 8px;">预览</a>
        <button @click="gen">调用模型生成</button>
      </div>
      <div style="margin-top:8px;color:#555;display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
        <label>
          <input type="checkbox" v-model="enablePolishForMulti" />
          多模型最终润色
        </label>
        <span>仅在已选模型数≥2时生效，单模型默认不润色</span>
      </div>
      <div v-if="modelBusy" style="color:#888;margin-top:6px">生成中...</div>
    </div>

    <pre v-if="debug" style="margin-top:12px;background:#f6f8fa;padding:8px">{{ debug }}</pre>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from 'vue';
import { useRoute } from 'vue-router';
import { createDocument, documentDetail, submitDocument, updateDocument } from '../api/documents';
import { getGenerateTask, getModelOptions, startGenerateTask } from '../api/model';

export default defineComponent({
  setup() {
    const route = useRoute();
    const token = localStorage.getItem('token') || '';
    const enterpriseId = localStorage.getItem('enterpriseId') || '';
    const name = ref('');
    const type = ref('directory');
    const doc = ref<any>(null);
    const content = ref('');
    const debug = ref('');
    const modelBusy = ref(false);
    const enablePolishForMulti = ref(true);
    const modelOptions = ref<any[]>([]);
    const selectedModelChoices = ref<string[]>([]);
    const pollIntervalMs = 1000;
    const pollMaxTimes = 120;

    const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

    const runGenerateTaskAndWait = async (payload: any) => {
      const created = await startGenerateTask(payload, token);
      const taskId = String(created?.id || '');
      if (!taskId) throw new Error('task create failed');

      for (let i = 0; i < pollMaxTimes; i += 1) {
        const task = await getGenerateTask(taskId, token);
        const status = String(task?.status || '');
        if (status === 'queued' || status === 'running') {
          debug.value = status === 'queued' ? '生成任务排队中...' : '生成任务运行中...';
          await sleep(pollIntervalMs);
          continue;
        }
        if (status === 'success') {
          return task;
        }
        throw new Error(task?.error || 'model task failed');
      }
      throw new Error('model task timeout');
    };

    const isModelSelected = (id: string) => selectedModelChoices.value.includes(id);
    const toggleModelChoice = (id: string) => {
      const idx = selectedModelChoices.value.indexOf(id);
      if (idx >= 0) {
        selectedModelChoices.value.splice(idx, 1);
        return;
      }
      if (selectedModelChoices.value.length >= 3) {
        debug.value = '最多选择3个模型';
        return;
      }
      selectedModelChoices.value.push(id);
    };

    const loadModelChoices = async () => {
      try {
        const data = await getModelOptions(token);
        modelOptions.value = Array.isArray(data?.options) ? data.options : [];
        const defaultChoice = String(data?.defaultModelChoice || modelOptions.value?.[0]?.id || '');
        selectedModelChoices.value = defaultChoice ? [defaultChoice] : [];
      } catch (e: any) {
        modelOptions.value = [];
        selectedModelChoices.value = [];
      }
    };

    const loadDetail = async () => {
      const id = String(route.query.id || '');
      if (!id) return;
      try {
        const detail = await documentDetail(id, token);
        doc.value = detail;
        name.value = detail.name || '';
        content.value = detail.content || '';
        debug.value = '已加载历史文档';
      } catch (e: any) {
        debug.value = '加载文档失败：' + (e.response?.data?.error || e.message);
      }
    };

    const create = async () => {
      try {
        doc.value = await createDocument({ name: name.value, type: type.value, enterpriseId, fileCount:0, wordCount:0 }, token);
        debug.value = '创建成功';
      } catch (e: any) {
        debug.value = '创建失败：'+(e.response?.data?.error||e.message);
      }
    };

    const save = async () => {
      try {
        await updateDocument({ id: doc.value.id, content: content.value, status: 'draft' }, token);
        debug.value = '已保存';
      } catch (e: any) {
        debug.value = '保存失败：'+(e.response?.data?.error||e.message);
      }
    };

    const complete = async () => {
      try {
        await updateDocument({ id: doc.value.id, content: content.value, status: 'completed' }, token);
        debug.value = '已标记完成';
      } catch (e: any) {
        debug.value = '操作失败：'+(e.response?.data?.error||e.message);
      }
    };

    const submit = async () => {
      if (!doc.value) return;
      try {
        doc.value = await submitDocument(doc.value.id, token);
        debug.value = '提交成功';
      } catch (e: any) {
        debug.value = '提交失败：' + (e.response?.data?.error || e.message);
      }
    };

    const gen = async () => {
      if (!doc.value) return;
      modelBusy.value = true;
      try {
        const choiceList = selectedModelChoices.value.length
          ? [...selectedModelChoices.value]
          : (modelOptions.value[0]?.id ? [String(modelOptions.value[0].id)] : []);
        if (!choiceList.length) {
          debug.value = '暂无可用模型';
          return;
        }

        const sections: string[] = [];
        let successCount = 0;

        for (const choiceId of choiceList) {
          try {
            const payload: any = { prompt: content.value, docId: doc.value.id, modelChoice: choiceId };
            const resp = await runGenerateTaskAndWait(payload);
            if (typeof resp.text === 'string' && resp.text) {
              sections.push(resp.text.trim());
              successCount += 1;
            }
          } catch (e: any) {
            // ignore single model failure, continue with others
          }
        }

        if (sections.length) {
          const mergedText = sections.join('\n\n');
          if (successCount >= 2 && enablePolishForMulti.value) {
            try {
              const polishPrompt = `请将以下多模型生成内容融合为一份最终可交付文本，要求：\n1) 保留关键信息，去重并消除冲突；\n2) 语言风格统一、专业、简洁；\n3) 仅输出最终正文，不要解释。\n\n原始内容：\n${mergedText}`;
              const polished = await runGenerateTaskAndWait({ prompt: polishPrompt, docId: doc.value.id });
              const finalText = String(polished?.text || '').trim();
              if (finalText) {
                content.value += '\n\n' + finalText;
                debug.value = `已生成一份结果（${successCount}个模型融合并润色）`;
              } else {
                content.value += '\n\n' + mergedText;
                debug.value = `已生成一份结果（${successCount}个模型融合，润色返回为空）`;
              }
            } catch (e: any) {
              content.value += '\n\n' + mergedText;
              debug.value = `已生成一份结果（${successCount}个模型融合，润色失败已回退）`;
            }
          } else if (successCount >= 2) {
            content.value += '\n\n' + mergedText;
            debug.value = `已生成一份结果（${successCount}个模型融合，未启用润色）`;
          } else {
            content.value += '\n\n' + mergedText;
            debug.value = '已生成一份结果（单模型，无需润色）';
          }
        } else {
          debug.value = '生成失败：所选模型均调用失败';
        }
      } catch (e: any) {
        const apiName = e.response?.data?.apiName;
        const err = e.response?.data?.error || e.message;
        debug.value = apiName ? `${apiName} 生成失败：${err}` : `生成失败：${err}`;
      } finally {
        modelBusy.value = false;
      }
    };

    onMounted(async () => {
      await Promise.all([loadDetail(), loadModelChoices()]);
    });
    return {
      name,
      type,
      doc,
      content,
      create,
      save,
      complete,
      submit,
      debug,
      gen,
      modelBusy,
      enablePolishForMulti,
      modelOptions,
      selectedModelChoices,
      toggleModelChoice,
      isModelSelected
    };
  }
});
</script>
