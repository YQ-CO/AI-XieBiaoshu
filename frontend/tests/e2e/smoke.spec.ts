import { expect, test } from '@playwright/test';

test('redirects unauthenticated user to login', async ({ page }: { page: any }) => {
  await page.goto('/orders');
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByRole('heading', { name: '登录' })).toBeVisible();
});

test('supports password login and redirects to account', async ({ page }: { page: any }) => {
  const username = `e2e_user_${Date.now()}`;

  await page.goto('/login');
  await page.locator('select').selectOption('password');
  await page.getByPlaceholder('用户名').fill(username);
  await page.getByPlaceholder('密码').fill('pwd');
  await page.getByRole('button', { name: '登录' }).click();

  await expect(page).toHaveURL(/\/account$/);
  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();
});

test('creates enterprise then recharges and submits invoice', async ({ page }: { page: any }) => {
  const username = `e2e_order_${Date.now()}`;
  const enterpriseName = `E2E企业_${Date.now()}`;

  await page.goto('/login');
  await page.locator('select').selectOption('password');
  await page.getByPlaceholder('用户名').fill(username);
  await page.getByPlaceholder('密码').fill('pwd');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.getByPlaceholder('企业名称').fill(enterpriseName);
  await page.getByPlaceholder('统一社会信用代码').fill(`9135${Date.now()}`);
  await page.getByRole('button', { name: '创建并加入' }).click();
  await expect(page.getByText('创建成功')).toBeVisible();

  await page.getByRole('button', { name: '切换到此企业' }).first().click();
  await expect(page.getByText('切换成功')).toBeVisible();

  await page.getByRole('link', { name: '查看订单与充值' }).click();
  await expect(page).toHaveURL(/\/orders$/);

  await page.locator('input[type="number"]').fill('88');
  await page.getByRole('button', { name: '充值' }).click();
  await expect(page.getByText('充值成功')).toBeVisible();

  await page.getByRole('button', { name: '申请发票' }).first().click();
  await page.getByRole('button', { name: '提交' }).click();
  await expect(page.getByText('发票申请已提交')).toBeVisible();
});

test('uploads a bid file and shows parsed sections', async ({ page }: { page: any }) => {
  const username = `e2e_parse_${Date.now()}`;

  await page.goto('/login');
  await page.locator('select').selectOption('password');
  await page.getByPlaceholder('用户名').fill(username);
  await page.getByPlaceholder('密码').fill('pwd');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.getByRole('link', { name: '解析招标文件' }).click();
  await expect(page).toHaveURL(/\/parse$/);

  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('tests/e2e/fixtures/bid-e2e.txt');

  await page.getByRole('button', { name: '开始解析' }).click();
  await expect(page.getByRole('heading', { name: '解析结果' })).toBeVisible();
  await expect(page.getByText(/文件名：.*bid-e2e\.txt/)).toBeVisible();
  await expect(page.getByText('基本信息')).toBeVisible();
  await expect(page.getByText('资格要求')).toBeVisible();
});

test('creates a document then verifies edit entry in my documents', async ({ page }: { page: any }) => {
  const username = `e2e_docs_${Date.now()}`;

  await page.goto('/login');
  await page.locator('select').selectOption('password');
  await page.getByPlaceholder('用户名').fill(username);
  await page.getByPlaceholder('密码').fill('pwd');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/account$/);

  const created = await page.evaluate(async () => {
    const token = localStorage.getItem('token') || '';
    const response = await fetch('/api/documents/create', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ name: 'E2E专项文档', type: 'special' })
    });
    return response.json();
  });

  expect(created?.id).toBeTruthy();

  await page.goto('/documents');
  await expect(page.getByRole('heading', { name: '我的文档' })).toBeVisible();
  await expect(page.getByText('E2E专项文档')).toBeVisible();

  const editLink = page.getByRole('link', { name: '继续编辑' }).first();
  await expect(editLink).toHaveAttribute('href', new RegExp(`/write/special\\?id=${created.id}`));
});

test('opens admin bms and loads dashboard data', async ({ page }: { page: any }) => {
  const username = `e2e_admin_${Date.now()}`;

  await page.goto('/login');
  await page.locator('select').selectOption('password');
  await page.getByPlaceholder('用户名').fill(username);
  await page.getByPlaceholder('密码').fill('pwd');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.evaluate(() => {
    localStorage.setItem('adminToken', 'admin-secret');
  });

  await page.goto('/admin/bms');
  await expect(page.getByRole('heading', { name: '后台管理（BMS）' })).toBeVisible();
  await page.getByRole('button', { name: '加载数据' }).click();
  await expect(page.getByText('后台数据已刷新')).toBeVisible();
});

test('redirects admin model to bms when admin token is missing', async ({ page }: { page: any }) => {
  const username = `e2e_no_admin_${Date.now()}`;

  await page.goto('/login');
  await page.locator('select').selectOption('password');
  await page.getByPlaceholder('用户名').fill(username);
  await page.getByPlaceholder('密码').fill('pwd');
  await page.getByRole('button', { name: '登录' }).click();
  await expect(page).toHaveURL(/\/account$/);

  await page.evaluate(() => {
    localStorage.removeItem('adminToken');
    localStorage.setItem('enterpriseId', 'ent-e2e-fallback');
  });

  await page.goto('/admin/model');
  await expect(page).toHaveURL(/\/admin\/bms$/);
  await expect(page.getByRole('heading', { name: '后台管理（BMS）' })).toBeVisible();
});