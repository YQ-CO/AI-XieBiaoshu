<template>
  <div style="max-width:980px;margin:24px auto;padding:16px;">
    <h2>后台管理（BMS）</h2>

    <div style="display:flex;gap:8px;align-items:center;margin-bottom:12px;">
      <select v-model="scopeMode" style="padding:6px;">
        <option value="platform">平台管理员</option>
        <option value="enterprise">企业管理员</option>
      </select>
      <input v-model="adminToken" placeholder="管理员Token (x-admin-token)" style="padding:6px;width:320px;" />
      <input v-if="scopeMode==='enterprise'" v-model="enterpriseId" placeholder="企业ID" style="padding:6px;width:240px;" />
      <button @click="loadAll">加载数据</button>
      <a href="/account">返回账户页</a>
    </div>

    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:8px;margin-bottom:12px;">
      <div style="border:1px solid #eee;padding:8px;">企业数：{{ dashboard.enterpriseCount || 0 }}</div>
      <div style="border:1px solid #eee;padding:8px;">成员数：{{ dashboard.memberCount || 0 }}</div>
      <div style="border:1px solid #eee;padding:8px;">订单数：{{ dashboard.orderCount || 0 }}</div>
      <div style="border:1px solid #eee;padding:8px;">待审发票：{{ dashboard.invoicePending || 0 }}</div>
    </div>

    <div v-if="scopeMode==='platform'" style="margin-bottom:12px;">
      <h3>模型健康（平台）</h3>
      <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
        <div style="border:1px solid #eee;padding:8px;">总调用：{{ dashboard.modelMetrics?.total ?? 0 }}</div>
        <div style="border:1px solid #eee;padding:8px;">成功率：{{ dashboard.modelMetrics?.successRate ?? 0 }}%</div>
        <div style="border:1px solid #eee;padding:8px;">平均耗时：{{ dashboard.modelMetrics?.avgLatencyMs ?? 0 }} ms</div>
        <div style="border:1px solid #eee;padding:8px;">最近窗口成功率：{{ dashboard.modelMetrics?.recentSuccessRate ?? 0 }}%</div>
      </div>
      <div style="color:#666;margin-top:6px;">
        最近窗口样本：{{ dashboard.modelMetrics?.recentWindow ?? 0 }}，最近平均耗时：{{ dashboard.modelMetrics?.recentAvgLatencyMs ?? 0 }} ms
      </div>
    </div>

    <div style="margin-bottom:12px;color:#555;display:flex;gap:12px;align-items:center;">
      <span>当前范围：{{ dashboard.scope === 'enterprise' ? `企业(${dashboard.enterpriseId || '-'})` : '平台' }}</span>
    </div>

    <h3>企业列表</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
      <thead>
        <tr>
          <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">企业名称</th>
          <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">信用代码</th>
          <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">成员数</th>
          <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">创建时间</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="e in enterprises" :key="e.id">
          <td style="border-bottom:1px solid #f5f5f5;padding:8px;">{{ e.name }}</td>
          <td style="border-bottom:1px solid #f5f5f5;padding:8px;">{{ e.creditCode || '-' }}</td>
          <td style="border-bottom:1px solid #f5f5f5;padding:8px;">{{ e.memberCount || 0 }}</td>
          <td style="border-bottom:1px solid #f5f5f5;padding:8px;">{{ e.createdAt }}</td>
        </tr>
      </tbody>
    </table>

    <h3>订单与发票审核</h3>
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
      <input
        v-if="scopeMode==='platform'"
        v-model="orderFilterEnterpriseId"
        placeholder="按企业ID筛选"
        style="padding:6px;width:220px;"
      />
      <select v-model="orderFilterInvoiceType" style="padding:6px;">
        <option value="">全部发票类型</option>
        <option value="special">增值税专用发票</option>
        <option value="normal">增值税普通发票</option>
      </select>
      <select v-model="orderFilterInvoiceStatus" style="padding:6px;">
        <option value="">全部状态</option>
        <option value="pending">待审核</option>
        <option value="approved">已通过</option>
        <option value="rejected">已驳回</option>
      </select>
      <button @click="loadAll">应用筛选</button>
      <button v-if="scopeMode==='platform'" @click="exportLedger">导出台账CSV</button>
    </div>
    <div v-if="scopeMode==='platform'" style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
      <span style="color:#666;">驳回原因：</span>
      <select v-model="rejectCode" style="padding:6px;min-width:220px;">
        <option v-for="item in rejectReasons" :key="item.code" :value="item.code">{{ item.label }}</option>
      </select>
      <input v-if="rejectCode==='other'" v-model="rejectRemark" placeholder="请输入补充说明" style="padding:6px;width:260px;" />
    </div>
    <table style="width:100%;border-collapse:collapse;">
      <thead>
        <tr>
          <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">订单ID</th>
          <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">企业ID</th>
          <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">用户</th>
          <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">金额</th>
          <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">发票类型</th>
          <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">发票状态</th>
          <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">操作</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="o in orders" :key="o.id">
          <td style="border-bottom:1px solid #f5f5f5;padding:8px;">{{ o.id }}</td>
          <td style="border-bottom:1px solid #f5f5f5;padding:8px;">{{ o.enterpriseId || '-' }}</td>
          <td style="border-bottom:1px solid #f5f5f5;padding:8px;">{{ o.userId }}</td>
          <td style="border-bottom:1px solid #f5f5f5;padding:8px;">{{ o.amount }}</td>
          <td style="border-bottom:1px solid #f5f5f5;padding:8px;">{{ o.invoiceType || '-' }}</td>
          <td style="border-bottom:1px solid #f5f5f5;padding:8px;">{{ o.invoiceStatus || '-' }}</td>
          <td style="border-bottom:1px solid #f5f5f5;padding:8px;">
            <button v-if="scopeMode==='platform' && o.invoiceType==='special' && o.invoiceStatus==='pending'" @click="review(o.id, 'approved')">通过</button>
            <button v-if="scopeMode==='platform' && o.invoiceType==='special' && o.invoiceStatus==='pending'" @click="review(o.id, 'rejected')" style="margin-left:6px;">驳回</button>
          </td>
        </tr>
      </tbody>
    </table>

    <div v-if="scopeMode==='platform'" style="margin-top:18px;">
      <h3>用户禁用/解封（平台）</h3>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;">
        <input v-model="disableReason" placeholder="禁用原因（可选）" style="padding:6px;width:260px;" />
        <button @click="loadUsers">刷新用户列表</button>
      </div>
      <table style="width:100%;border-collapse:collapse;">
        <thead>
          <tr>
            <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">用户ID</th>
            <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">状态</th>
            <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">禁用原因</th>
            <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">最近登录</th>
            <th style="text-align:left;border-bottom:1px solid #eee;padding:8px;">操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="u in users" :key="u.id">
            <td style="border-bottom:1px solid #f5f5f5;padding:8px;">{{ u.id }}</td>
            <td style="border-bottom:1px solid #f5f5f5;padding:8px;">{{ u.disabled ? '已禁用' : '正常' }}</td>
            <td style="border-bottom:1px solid #f5f5f5;padding:8px;">{{ u.disabledReason || '-' }}</td>
            <td style="border-bottom:1px solid #f5f5f5;padding:8px;">{{ u.lastLoginAt || '-' }}</td>
            <td style="border-bottom:1px solid #f5f5f5;padding:8px;">
              <button v-if="!u.disabled" @click="disableUser(u.id)">禁用</button>
              <button v-if="u.disabled" @click="enableUser(u.id)">解封</button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <pre v-if="debug" style="margin-top:12px;background:#f6f8fa;padding:8px;white-space:pre-wrap;">{{ debug }}</pre>
  </div>
</template>

<script lang="ts">
import { defineComponent, onMounted, ref } from 'vue';
import {
  disableAdminUser,
  enableAdminUser,
  getAdminDashboard,
  getAdminEnterprises,
  getAdminOrdersFiltered,
  getInvoiceRejectReasons,
  getAdminUsers,
  exportInvoiceLedgerCsv,
  reviewInvoice
} from '../api/admin';

export default defineComponent({
  setup() {
    const adminToken = ref(localStorage.getItem('adminToken') || 'admin-secret');
    const scopeMode = ref<'platform' | 'enterprise'>((localStorage.getItem('bmsScopeMode') as any) || 'platform');
    const enterpriseId = ref(localStorage.getItem('enterpriseId') || '');
    const dashboard = ref<any>({});
    const enterprises = ref<any[]>([]);
    const orders = ref<any[]>([]);
    const users = ref<any[]>([]);
    const orderFilterEnterpriseId = ref('');
    const orderFilterInvoiceType = ref<'' | 'normal' | 'special'>('special');
    const orderFilterInvoiceStatus = ref('pending');
    const disableReason = ref('');
    const rejectReasons = ref<Array<{ code: string; label: string }>>([]);
    const rejectCode = ref<'company_info_invalid' | 'taxpayer_info_invalid' | 'duplicate_request' | 'unsupported_scope' | 'other'>('company_info_invalid');
    const rejectRemark = ref('');
    const debug = ref('');

    const sortUsers = (list: any[]) => {
      return [...list].sort((a, b) => {
        const ad = a?.disabled ? 1 : 0;
        const bd = b?.disabled ? 1 : 0;
        if (ad !== bd) return bd - ad;
        const at = Date.parse(String(a?.lastLoginAt || ''));
        const bt = Date.parse(String(b?.lastLoginAt || ''));
        const av = Number.isFinite(at) ? at : 0;
        const bv = Number.isFinite(bt) ? bt : 0;
        return bv - av;
      });
    };

    const authContext = () => {
      if (scopeMode.value === 'platform') {
        return { mode: 'platform' as const, adminToken: adminToken.value };
      }
      return {
        mode: 'enterprise' as const,
        userToken: localStorage.getItem('token') || '',
        enterpriseId: enterpriseId.value
      };
    };

    const loadAll = async () => {
      try {
        localStorage.setItem('adminToken', adminToken.value);
        localStorage.setItem('bmsScopeMode', scopeMode.value);
        if (scopeMode.value === 'enterprise' && !enterpriseId.value) {
          debug.value = '企业管理员模式请填写企业ID';
          return;
        }
        const auth = authContext();
        const orderParams = {
          enterpriseId: scopeMode.value === 'platform' ? orderFilterEnterpriseId.value.trim() : '',
          invoiceType: orderFilterInvoiceType.value,
          invoiceStatus: orderFilterInvoiceStatus.value.trim()
        };
        const [dash, ents, ords] = await Promise.all([
          getAdminDashboard(auth),
          getAdminEnterprises(auth),
          getAdminOrdersFiltered(auth, orderParams)
        ]);
        dashboard.value = dash || {};
        enterprises.value = Array.isArray(ents) ? ents : [];
        orders.value = Array.isArray(ords) ? ords : [];
        if (scopeMode.value === 'platform') {
          const [list, reasons] = await Promise.all([
            getAdminUsers(auth),
            getInvoiceRejectReasons(auth)
          ]);
          users.value = Array.isArray(list) ? sortUsers(list) : [];
          rejectReasons.value = Array.isArray(reasons) && reasons.length ? reasons : [];
          if (rejectReasons.value.length && !rejectReasons.value.some(item => item.code === rejectCode.value)) {
            rejectCode.value = rejectReasons.value[0].code as any;
          }
        } else {
          users.value = [];
          rejectReasons.value = [];
        }
        debug.value = '后台数据已刷新';
      } catch (e: any) {
        debug.value = '加载失败：' + (e.response?.data?.error || e.message);
      }
    };

    const loadUsers = async () => {
      if (scopeMode.value !== 'platform') return;
      try {
        const list = await getAdminUsers(authContext());
        users.value = Array.isArray(list) ? sortUsers(list) : [];
      } catch (e: any) {
        debug.value = '加载用户失败：' + (e.response?.data?.error || e.message);
      }
    };

    const disableUser = async (userId: string) => {
      try {
        await disableAdminUser({ userId, reason: disableReason.value.trim() || undefined }, authContext());
        debug.value = `已禁用用户：${userId}`;
        await loadUsers();
      } catch (e: any) {
        debug.value = '禁用失败：' + (e.response?.data?.error || e.message);
      }
    };

    const enableUser = async (userId: string) => {
      try {
        await enableAdminUser({ userId }, authContext());
        debug.value = `已解封用户：${userId}`;
        await loadUsers();
      } catch (e: any) {
        debug.value = '解封失败：' + (e.response?.data?.error || e.message);
      }
    };

    const review = async (orderId: string, status: 'approved' | 'rejected') => {
      try {
        if (status === 'rejected' && rejectCode.value === 'other' && !rejectRemark.value.trim()) {
          debug.value = '驳回原因为“其他”时请填写补充说明';
          return;
        }
        await reviewInvoice(
          {
            orderId,
            status,
            rejectCode: status === 'rejected' ? rejectCode.value : undefined,
            rejectRemark: status === 'rejected' ? rejectRemark.value.trim() || undefined : undefined
          },
          authContext()
        );
        debug.value = status === 'approved' ? '发票审核通过' : '发票已驳回';
        if (status === 'rejected') {
          rejectRemark.value = '';
        }
        await loadAll();
      } catch (e: any) {
        debug.value = '审核失败：' + (e.response?.data?.error || e.message);
      }
    };

    const exportLedger = async () => {
      try {
        const auth = authContext();
        await exportInvoiceLedgerCsv(auth, {
          enterpriseId: scopeMode.value === 'platform' ? orderFilterEnterpriseId.value.trim() : '',
          invoiceType: orderFilterInvoiceType.value,
          invoiceStatus: orderFilterInvoiceStatus.value.trim()
        });
        debug.value = '台账导出成功';
      } catch (e: any) {
        debug.value = '导出台账失败：' + (e.response?.data?.error || e.message);
      }
    };

    onMounted(loadAll);
    return {
      scopeMode,
      enterpriseId,
      adminToken,
      dashboard,
      enterprises,
      orders,
      users,
      orderFilterEnterpriseId,
      orderFilterInvoiceType,
      orderFilterInvoiceStatus,
      disableReason,
      rejectReasons,
      rejectCode,
      rejectRemark,
      debug,
      loadAll,
      review,
      exportLedger,
      loadUsers,
      disableUser,
      enableUser
    };
  }
});
</script>
