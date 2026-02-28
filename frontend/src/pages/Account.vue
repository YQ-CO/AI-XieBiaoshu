<template>
  <div style="max-width:720px;margin:24px auto;padding:16px;border:1px solid #eee;border-radius:6px;">
    <h2>账户与企业管理</h2>
    <div style="margin-bottom:12px;"><a href="/orders">查看订单与充值</a></div>
    <div style="margin-bottom:12px;"><a href="/parse">解析招标文件</a></div>
    <div style="margin-bottom:12px;"><a href="/documents">我的文档</a></div>
    <div style="margin-bottom:12px;"><a href="/write/scoring">对照评分点编写</a></div>
    <div style="margin-bottom:12px;"><a href="/write/directory">上传目录编写</a></div>
    <div style="margin-bottom:12px;"><a href="/write/special">专项内容编写</a></div>
    <div style="margin-bottom:12px;"><a href="/admin/bms">后台管理（BMS）</a></div>
    <div style="margin-bottom:12px;"><a href="/admin/model">模型配置管理</a></div>
    <div style="display:flex;gap:20px;">
      <div style="flex:1">
        <h3>创建企业</h3>
        <input v-model="name" placeholder="企业名称" style="width:100%;padding:8px;margin-bottom:8px;" />
        <input v-model="creditCode" placeholder="统一社会信用代码" style="width:100%;padding:8px;margin-bottom:8px;" />
        <button @click="create">创建并加入</button>
      </div>

      <div style="flex:1">
        <h3>加入企业</h3>
        <input v-model="inviteCode" placeholder="企业邀请码" style="width:100%;padding:8px;margin-bottom:8px;" />
        <button @click="join">加入</button>
      </div>
    </div>

    <div style="margin-top:20px;">
      <h3>我的企业</h3>
      <ul>
        <li v-for="e in enterprises" :key="e.id" style="display:flex;justify-content:space-between;align-items:center;padding:8px 0;border-bottom:1px solid #f0f0f0;">
          <div>
            <strong>{{ e.name }}</strong>
            <small style="color:#888;margin-left:8px">邀请码: {{ e.inviteCode }}</small>
            <small style="color:#888;margin-left:8px">角色: {{ e.myRole || '-' }}</small>
          </div>
          <div>
            <button @click="switchTo(e.id)">切换到此企业</button>
          </div>
        </li>
      </ul>
    </div>

    <div style="margin-top:20px;">
      <h3>企业成员与角色</h3>
      <div style="margin-bottom:8px;">
        <button @click="loadMembers">加载当前企业成员</button>
      </div>
      <ul>
        <li v-for="m in members" :key="m.userId" style="display:flex;gap:8px;align-items:center;padding:6px 0;border-bottom:1px solid #f0f0f0;">
          <span style="min-width:180px;">{{ m.userId }}</span>
          <span style="min-width:80px;color:#666;">{{ m.role }}</span>
          <button v-if="m.role !== 'owner'" @click="setRole(m.userId, 'admin')">设为管理员</button>
          <button v-if="m.role !== 'owner'" @click="setRole(m.userId, 'member')">设为成员</button>
        </li>
      </ul>
    </div>

    <pre v-if="debug" style="margin-top:12px;background:#f6f8fa;padding:8px">{{ debug }}</pre>
  </div>
</template>

<script lang="ts">
import { defineComponent, ref, onMounted } from 'vue';
import { createEnterprise, enterpriseMembers, joinEnterprise, myEnterprises, switchEnterprise, updateEnterpriseRole } from '../api/enterprise';

export default defineComponent({
  setup() {
    const token = localStorage.getItem('token') || '';
    const name = ref('');
    const creditCode = ref('');
    const inviteCode = ref('');
    const enterprises = ref<any[]>([]);
    const members = ref<any[]>([]);
    const debug = ref('');

    const load = async () => {
      try {
        enterprises.value = await myEnterprises(token);
      } catch (e: any) {
        debug.value = '加载企业失败: ' + (e.response?.data?.error || e.message);
      }
    };

    const create = async () => {
      try {
        const resp = await createEnterprise({ name: name.value, creditCode: creditCode.value }, token);
        debug.value = '创建成功: ' + JSON.stringify(resp);
        await load();
      } catch (e: any) {
        debug.value = '创建失败: ' + (e.response?.data?.error || e.message);
      }
    };

    const join = async () => {
      try {
        const resp = await joinEnterprise({ inviteCode: inviteCode.value }, token);
        debug.value = '加入成功: ' + JSON.stringify(resp.enterprise);
        await load();
      } catch (e: any) {
        debug.value = '加入失败: ' + (e.response?.data?.error || e.message);
      }
    };

    const switchTo = async (enterpriseId: string) => {
      try {
        const resp = await switchEnterprise({ enterpriseId }, token);
        localStorage.setItem('enterpriseId', enterpriseId);
        debug.value = '切换成功: ' + JSON.stringify(resp.enterprise);
        await loadMembers();
      } catch (e: any) {
        debug.value = '切换失败: ' + (e.response?.data?.error || e.message);
      }
    };

    const loadMembers = async () => {
      const enterpriseId = localStorage.getItem('enterpriseId') || '';
      if (!enterpriseId) {
        debug.value = '请先切换到企业后再加载成员';
        return;
      }
      try {
        const resp = await enterpriseMembers(enterpriseId, token);
        members.value = resp.members || [];
      } catch (e: any) {
        debug.value = '加载成员失败: ' + (e.response?.data?.error || e.message);
      }
    };

    const setRole = async (userId: string, role: 'admin' | 'member') => {
      const enterpriseId = localStorage.getItem('enterpriseId') || '';
      if (!enterpriseId) return;
      try {
        await updateEnterpriseRole({ enterpriseId, userId, role }, token);
        debug.value = `角色更新成功: ${userId} -> ${role}`;
        await loadMembers();
        await load();
      } catch (e: any) {
        debug.value = '角色更新失败: ' + (e.response?.data?.error || e.message);
      }
    };

    onMounted(load);
    return { name, creditCode, inviteCode, enterprises, members, create, join, switchTo, loadMembers, setRole, debug };
  }
});
</script>
