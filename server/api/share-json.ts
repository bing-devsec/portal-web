import { defineEventHandler, readBody, getQuery, H3Event } from 'h3';
import { randomBytes } from 'crypto';
import { promises as fs } from 'fs';
import { join, resolve, normalize } from 'path';
import { existsSync, mkdirSync } from 'fs';

// 调用Go后端API解密浏览器指纹
async function decryptFingerprint(encryptedFingerprint: string, event: H3Event): Promise<string | null> {
  try {
    const config = useRuntimeConfig(event);
    const goBackendBase = config.ssrApiBase;
    
    // Go后端解密API端点
    const decryptEndpoint = '/fingerprint/decrypt';
    const decryptUrl = `${goBackendBase}${decryptEndpoint}`;
    
    const response = await $fetch<{
      code: number;
      message: string;
      data: Record<string, string> | null;
    }>(decryptUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-client-id': encryptedFingerprint, // 将加密的指纹放在请求头中
      },
    });
    
    // 检查响应码：2000 表示成功
    if (response.code !== 2000 || !response.data) {
      return null;
    }
    
    // 从 data 对象中获取指纹原始值
    // 根据Go后端代码，data的格式是: map[string]string{"xClientID": clientID}
    // 所以key是固定的"xClientID"，value是指纹原始值
    const fingerprint = response.data['xClientID'];
    
    if (!fingerprint || typeof fingerprint !== 'string') {
      return null;
    }
    
    // 验证指纹格式：Go后端期望32个字符的十六进制字符串
    if (!/^[a-f0-9]{32}$/i.test(fingerprint)) {
      return null;
    }
    
    return fingerprint;
  } catch (error: any) {
    return null;
  }
}

// 从请求中获取并解密浏览器指纹
async function getClientFingerprint(event: H3Event, body?: any): Promise<string | null> {
  // 优先从请求头获取加密的指纹
  const headers = event.node.req.headers;
  let encryptedFingerprint = headers['x-client-id'] as string;
  
  // 如果请求头没有，则从请求体获取（兼容性）
  if (!encryptedFingerprint && body && body.encryptedFingerprint) {
    encryptedFingerprint = body.encryptedFingerprint;
  }
  
  if (encryptedFingerprint) {
    const fingerprint = await decryptFingerprint(encryptedFingerprint, event);
    return fingerprint;
  }
  
  return null;
}

// 配置常量
const CONFIG = {
  MAX_SHARE_SIZE: 2 * 1024 * 1024, // 单个JSON文件最大2MB
  MAX_SHARES_PER_FINGERPRINT: 5, // 每个用户最多5个分享
  MAX_SIZE_PER_FINGERPRINT: 10 * 1024 * 1024, // 单个用户最大10MB存储空间
  MAX_USERS: 10000, // 最多支持10000个用户
  RATE_LIMIT_WINDOW: 60 * 1000,
  RATE_LIMIT_MAX: 3,
  MAX_EXPIRES_IN: 3 * 24 * 60 * 60 * 1000, // 最长保存3天
  AUTO_CLEANUP_INTERVAL: 10 * 60 * 1000, // 10分钟检查一次
  STORAGE_DIR: process.env.SHARE_STORAGE_DIR || '/tmp/shares', // 存储目录
  INDEX_FILE: 'index.json', // 索引文件名
};

// 分享数据接口
interface ShareData {
  id: string;
  jsonData: string;
  password?: string;
  expiresAt?: number;
  createdAt: number;
  shareName: string;
  creatorFingerprint?: string;
  accessCount: number;
  lastAccessedAt?: number;
}

// 索引条目接口
interface IndexEntry {
  id: string;
  createdAt: number;
  size: number;
  expiresAt?: number;
  creatorFingerprint?: string;
}

// 索引文件接口
interface IndexFile {
  shares: IndexEntry[];
  totalSize: number;
  lastCleanup: number;
}

// 确保存储目录存在
if (!existsSync(CONFIG.STORAGE_DIR)) {
  mkdirSync(CONFIG.STORAGE_DIR, { recursive: true });
}

// 内存中的索引缓存（仅缓存索引，不缓存数据）
let indexCache: IndexFile | null = null;
let indexCacheTime = 0;
const INDEX_CACHE_TTL = 30 * 1000; // 索引缓存30秒

// 指纹限流记录（内存中，轻量级）
const fingerprintRateLimit = new Map<string, { count: number; resetAt: number }>();

// 定时删除任务：在到期时立即删除（进程内，非持久）
const shareDeletionTimers = new Map<string, NodeJS.Timeout>();

// 验证分享ID格式（32位十六进制字符串）
function isValidShareId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }
  // 必须是32位十六进制字符串（16 bytes = 32 hex chars）
  return /^[a-f0-9]{32}$/i.test(id);
}

// 获取文件路径（带安全检查）
function getShareFilePath(id: string): string {
  // 验证ID格式
  if (!isValidShareId(id)) {
    throw new Error('Invalid share ID format');
  }
  
  // 使用规范化路径，确保在指定目录内
  const basePath = resolve(CONFIG.STORAGE_DIR);
  const filePath = resolve(basePath, `${id}.json`);
  
  // 安全检查：确保文件路径在基础目录内（防止路径遍历）
  // 使用规范化路径进行比较，兼容Windows和Unix系统
  const normalizedBasePath = normalize(basePath + '/');
  const normalizedFilePath = normalize(filePath);
  
  if (!normalizedFilePath.startsWith(normalizedBasePath)) {
    throw new Error('Path traversal detected');
  }
  
  return filePath;
}

// 获取索引文件路径
function getIndexFilePath(): string {
  return join(CONFIG.STORAGE_DIR, CONFIG.INDEX_FILE);
}

// 读取索引文件
async function readIndex(): Promise<IndexFile> {
  const now = Date.now();
  
  // 如果缓存有效，直接返回
  if (indexCache && now - indexCacheTime < INDEX_CACHE_TTL) {
    return indexCache;
  }
  
  const indexPath = getIndexFilePath();
  try {
    const content = await fs.readFile(indexPath, 'utf-8');
    const index = JSON.parse(content) as IndexFile;
    indexCache = index;
    indexCacheTime = now;
    return index;
  } catch (error: any) {
    // 如果文件不存在，创建新索引
    if (error.code === 'ENOENT') {
      const newIndex: IndexFile = {
        shares: [],
        totalSize: 0,
        lastCleanup: now,
      };
      indexCache = newIndex;
      indexCacheTime = now;
      return newIndex;
    }
    throw error;
  }
}

// 写入索引文件
async function writeIndex(index: IndexFile): Promise<void> {
  const indexPath = getIndexFilePath();
  await fs.writeFile(indexPath, JSON.stringify(index, null, 2), 'utf-8');
  indexCache = index;
  indexCacheTime = Date.now();
}

// 为某个分享安排到期删除
function scheduleShareDeletion(id: string, expiresAt?: number) {
  // 先清理旧的定时器
  const existing = shareDeletionTimers.get(id);
  if (existing) {
    clearTimeout(existing);
    shareDeletionTimers.delete(id);
  }
  if (!expiresAt) return;
  const delay = expiresAt - Date.now();
  if (delay <= 0) {
    // 已经过期，立即触发清理
    void deleteOnExpireNow(id);
    return;
  }
  const timer = setTimeout(() => {
    void deleteOnExpireNow(id);
  }, delay);
  // 避免阻止进程退出
  // @ts-ignore Node typings allow unref on Timeout
  if (typeof (timer as any).unref === 'function') {
    (timer as any).unref();
  }
  shareDeletionTimers.set(id, timer);
}

// 实际执行过期删除与索引更新
async function deleteOnExpireNow(id: string) {
  try {
    // 删除数据文件
    await deleteShareData(id);
    // 更新索引（根据id查找size以扣减）
    const index = await readIndex();
    const entry = index.shares.find(s => s.id === id);
    if (entry) {
      index.shares = index.shares.filter(s => s.id !== id);
      index.totalSize -= entry.size;
      if (index.totalSize < 0) index.totalSize = 0;
      await writeIndex(index);
    }
  } finally {
    const t = shareDeletionTimers.get(id);
    if (t) {
      clearTimeout(t);
      shareDeletionTimers.delete(id);
    }
  }
}

// 读取分享数据
async function readShareData(id: string): Promise<ShareData | null> {
  const filePath = getShareFilePath(id);
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(content) as ShareData;
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

// 写入分享数据
async function writeShareData(data: ShareData): Promise<void> {
  const filePath = getShareFilePath(data.id);
  // 使用适当的文件权限（0600 = 仅所有者可读写）
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), { 
    encoding: 'utf-8',
    mode: 0o600  // 仅所有者可读写，防止其他用户访问
  });
}

// 删除分享数据
async function deleteShareData(id: string): Promise<void> {
  const filePath = getShareFilePath(id);
  try {
    await fs.unlink(filePath);
  } catch (error: any) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

// 检查限流
function checkRateLimit(fingerprint: string): boolean {
  const now = Date.now();
  const record = fingerprintRateLimit.get(fingerprint);
  
  if (!record || record.resetAt < now) {
    fingerprintRateLimit.set(fingerprint, { count: 1, resetAt: now + CONFIG.RATE_LIMIT_WINDOW });
    return true;
  }
  
  if (record.count >= CONFIG.RATE_LIMIT_MAX) {
    return false;
  }
  
  record.count++;
  return true;
}

// 计算总存储大小（从索引）
async function getTotalSize(): Promise<number> {
  const index = await readIndex();
  return index.totalSize;
}

// 统计指纹的分享数量
async function countSharesByFingerprint(fingerprint: string): Promise<number> {
  const index = await readIndex();
  return index.shares.filter(share => share.creatorFingerprint === fingerprint).length;
}

// 计算单个用户的存储总大小
async function getSizeByFingerprint(fingerprint: string): Promise<number> {
  const index = await readIndex();
  return index.shares
    .filter(share => share.creatorFingerprint === fingerprint)
    .reduce((total, share) => total + share.size, 0);
}

// 统计当前有多少个不同的用户
async function countUniqueUsers(): Promise<number> {
  const index = await readIndex();
  const uniqueFingerprints = new Set<string>();
  for (const share of index.shares) {
    if (share.creatorFingerprint) {
      uniqueFingerprints.add(share.creatorFingerprint);
    }
  }
  return uniqueFingerprints.size;
}

// 检查用户是否已存在（是否有分享记录）
async function userExists(fingerprint: string): Promise<boolean> {
  const index = await readIndex();
  return index.shares.some(share => share.creatorFingerprint === fingerprint);
}

// 清理过期的数据
async function cleanupExpired(): Promise<number> {
  const now = Date.now();
  const index = await readIndex();
  let deletedCount = 0;
  const remainingShares: IndexEntry[] = [];
  let newTotalSize = 0;
  
  for (const entry of index.shares) {
    let shouldDelete = false;
    
    // 检查是否过期
    if (entry.expiresAt && entry.expiresAt < now) {
      shouldDelete = true;
    }
    
    if (shouldDelete) {
      await deleteShareData(entry.id);
      deletedCount++;
    } else {
      remainingShares.push(entry);
      newTotalSize += entry.size;
    }
  }
  
  // 更新索引
  if (deletedCount > 0) {
    index.shares = remainingShares;
    index.totalSize = newTotalSize;
    index.lastCleanup = now;
    await writeIndex(index);
  }
  
  // 清理限流记录
  for (const [fingerprint, record] of fingerprintRateLimit.entries()) {
    if (record.resetAt < now) {
      fingerprintRateLimit.delete(fingerprint);
    }
  }
  
  return deletedCount;
}

// 自动清理单个用户的存储空间
async function autoCleanupStorage(fingerprint: string, requiredSize: number): Promise<void> {
  const index = await readIndex();
  
  // 获取该用户的所有分享
  const userShares = index.shares.filter(share => share.creatorFingerprint === fingerprint);
  const currentSize = userShares.reduce((total, share) => total + share.size, 0);
  
  if (currentSize + requiredSize <= CONFIG.MAX_SIZE_PER_FINGERPRINT) {
    return;
  }
  
  // 按创建时间排序，删除最旧的
  const sorted = [...userShares].sort((a, b) => a.createdAt - b.createdAt);
  
  let deletedSize = 0;
  const remainingShares: IndexEntry[] = [];
  const deletedIds = new Set<string>();
  
  for (const entry of sorted) {
    if (currentSize - deletedSize + requiredSize > CONFIG.MAX_SIZE_PER_FINGERPRINT) {
      await deleteShareData(entry.id);
      deletedIds.add(entry.id);
      deletedSize += entry.size;
    } else {
      remainingShares.push(entry);
    }
  }
  
  if (deletedSize > 0) {
    // 更新索引：移除该用户被删除的分享，保留其他用户的分享
    index.shares = index.shares.filter(share => !deletedIds.has(share.id));
    index.totalSize = index.totalSize - deletedSize;
    await writeIndex(index);
  }
}

// 生成唯一ID
function generateShareId(): string {
  return randomBytes(16).toString('hex');
}

// 启动时：立即清理已过期，并为未过期的分享安排删除
(async () => {
  try {
    await cleanupExpired();
    const index = await readIndex();
    for (const entry of index.shares) {
      scheduleShareDeletion(entry.id, entry.expiresAt);
    }
  } catch {
    // 忽略启动初始化错误
  }
})();

// 创建分享
export default defineEventHandler(async (event: H3Event) => {
  try {
    const method = event.method;
    
    // GET请求：获取分享数据
    if (method === 'GET') {
      // 列出当前用户的分享（仅元信息）
      const queryAllMine = (getQuery(event).mine as string) || '';
      if (queryAllMine === '1') {
        // 需要客户端身份
        const clientFingerprint = await getClientFingerprint(event);
        if (!clientFingerprint) {
          return {
            success: false,
            error: '无法验证客户端身份，请刷新页面后重试',
          };
        }
        // 读取索引并过滤
        const index = await readIndex();
        const myShares = index.shares
          .filter(s => s.creatorFingerprint === clientFingerprint)
          .sort((a, b) => b.createdAt - a.createdAt);

        // 为每个分享构建元信息
        const result: Array<{
          id: string;
          createdAt: number;
          expiresAt?: number;
          size: number;
          shareName: string;
          shareUrl: string;
          hasPassword: boolean;
        }> = [];

        for (const entry of myShares) {
          const data = await readShareData(entry.id);

          result.push({
            id: entry.id,
            createdAt: entry.createdAt,
            expiresAt: entry.expiresAt,
            size: entry.size,
            shareName: data?.shareName || '',
            shareUrl: `${getRequestURL(event).origin}/tool/json?share=${entry.id}`,
            hasPassword: !!data?.password,
          });
        }

        return {
          success: true,
          data: result,
        };
      }

      const query = getQuery(event);
      const id = query.id as string;
      const password = query.password as string | undefined;
      
      if (!id) {
        return {
          success: false,
          error: '分享ID不能为空',
        };
      }

      // 验证ID格式（防止路径遍历攻击）
      if (!isValidShareId(id)) {
        return {
          success: false,
          error: '分享ID格式不正确',
        };
      }

      const shareData = await readShareData(id);
      
      if (!shareData) {
        return {
          success: false,
          error: '分享链接不存在或已过期',
        };
      }

      // 检查是否过期
      if (shareData.expiresAt && shareData.expiresAt < Date.now()) {
        await deleteShareData(id);
        // 更新索引
        const index = await readIndex();
        index.shares = index.shares.filter(s => s.id !== id);
        index.totalSize -= shareData.jsonData.length;
        await writeIndex(index);
        return {
          success: false,
          error: '分享链接已过期',
        };
      }

      // 验证密码
      if (shareData.password) {
        if (!password || shareData.password !== password) {
          return {
            success: false,
            error: '密码不正确',
            hasPassword: true,
          };
        }
      }

      // 更新访问统计
      shareData.accessCount = (shareData.accessCount || 0) + 1;
      shareData.lastAccessedAt = Date.now();
      await writeShareData(shareData);

      return {
        success: true,
        data: {
          id: shareData.id,
          jsonData: shareData.jsonData,
          createdAt: shareData.createdAt,
          expiresAt: shareData.expiresAt,
        },
      };
    }

    // POST请求：创建分享
    if (method === 'POST') {
      const body = await readBody(event);
      const { jsonData, password, expiresIn, shareName, encryptedFingerprint } = body;

      // 校验分享名称与密码
      const normalizedPassword: string | undefined = typeof password === 'string' ? String(password) : undefined;
      const normalizedShareName: string | undefined = typeof shareName === 'string' ? String(shareName).trim() : undefined;
      
      // 密码最长30位，限制字符集为字母数字及常用符号（不含空格）
      if (normalizedPassword) {
        if (normalizedPassword.length > 30) {
          return {
            success: false,
            error: '密码长度不能超过30位',
          };
        }
        const passwordAllowed = /^[A-Za-z0-9!@#\$%\^&\*\-_\.\+=:;,\?\(\)\[\]\{\}~]+$/;
        if (!passwordAllowed.test(normalizedPassword)) {
          return {
            success: false,
            error: '密码包含不被允许的字符',
          };
        }
      }

      // 1. 获取并验证浏览器指纹
      const clientFingerprint = await getClientFingerprint(event, body);
      if (!clientFingerprint) {
        return {
          success: false,
          error: '无法验证客户端身份，请刷新页面后重试',
        };
      }

      // 1.5. 验证分享名称（必填）
      if (!normalizedShareName || normalizedShareName.length === 0) {
        return {
          success: false,
          error: '分享名称不能为空',
        };
      }
      // 验证长度（最多10个字符）
      if (normalizedShareName.length > 10) {
        return {
          success: false,
          error: '分享名称长度不能超过10个字符',
        };
      }
      // 验证字符：只允许中英文、数字和常见连字符（-、_、.）
      // 中文字符范围：\u4e00-\u9fa5
      // 英文字母和数字：A-Za-z0-9
      // 常见连字符：-、_、.
      const shareNamePattern = /^[\u4e00-\u9fa5A-Za-z0-9\-_.]+$/;
      if (!shareNamePattern.test(normalizedShareName)) {
        return {
          success: false,
          error: '分享名称只能包含中英文、数字和常见连字符（-、_、.）',
        };
      }
      // 验证唯一性（对同一用户）
      const indexForUniquenessCheck = await readIndex();
      const userShares = indexForUniquenessCheck.shares.filter(s => s.creatorFingerprint === clientFingerprint);
      for (const entry of userShares) {
        const data = await readShareData(entry.id);
        if (data?.shareName === normalizedShareName) {
          return {
            success: false,
            error: '分享名称已存在，请使用其他名称',
          };
        }
      }

      // 2. 限流检查
      if (!checkRateLimit(clientFingerprint)) {
        return {
          success: false,
          error: '请求过于频繁，请稍后再试（每分钟最多3次）',
        };
      }

      // 3. 验证JSON数据
      if (!jsonData || typeof jsonData !== 'string') {
        return {
          success: false,
          error: 'JSON数据不能为空',
        };
      }

      // 4. 验证JSON格式
      try {
        JSON.parse(jsonData);
      } catch (error) {
        return {
          success: false,
          error: 'JSON格式不正确',
        };
      }

      // 5. 限制JSON数据大小
      if (jsonData.length > CONFIG.MAX_SHARE_SIZE) {
        return {
          success: false,
          error: `JSON数据过大（${(jsonData.length / 1024 / 1024).toFixed(2)} MB，最大 ${(CONFIG.MAX_SHARE_SIZE / 1024 / 1024).toFixed(0)} MB）`,
        };
      }

      // 6. 检查用户数量限制
      const isExistingUser = await userExists(clientFingerprint);
      if (!isExistingUser) {
        // 如果是新用户，检查是否超过用户数量上限
        const currentUserCount = await countUniqueUsers();
        if (currentUserCount >= CONFIG.MAX_USERS) {
          return {
            success: false,
            error: `系统用户数量已达到上限（${CONFIG.MAX_USERS} 个），暂时无法创建新用户，请稍后再试`,
          };
        }
      }

      // 7. 检查指纹分享数量限制
      const fingerprintShareCount = await countSharesByFingerprint(clientFingerprint);
      if (fingerprintShareCount >= CONFIG.MAX_SHARES_PER_FINGERPRINT) {
        return {
          success: false,
          error: `您创建的分享数量已达到上限（${fingerprintShareCount} 个，最大 ${CONFIG.MAX_SHARES_PER_FINGERPRINT} 个），请先删除一些分享或等待过期`,
        };
      }

      // 8. 检查单个用户的存储大小限制
      await autoCleanupStorage(clientFingerprint, jsonData.length);
      const currentUserSize = await getSizeByFingerprint(clientFingerprint);
      if (currentUserSize + jsonData.length > CONFIG.MAX_SIZE_PER_FINGERPRINT) {
        return {
          success: false,
          error: `您的存储空间不足（已使用 ${(currentUserSize / 1024 / 1024).toFixed(2)} MB，最大 ${(CONFIG.MAX_SIZE_PER_FINGERPRINT / 1024 / 1024).toFixed(0)} MB），请先删除一些分享或等待过期`,
        };
      }

      // 9. 验证过期时间
      let expiresAt: number | undefined;
      if (expiresIn) {
        const expiresInMs = parseInt(expiresIn);
        if (isNaN(expiresInMs) || expiresInMs <= 0) {
          return {
            success: false,
            error: '过期时间必须大于0',
          };
        }
        // 如果超过最大过期时间，明确拒绝
        if (expiresInMs > CONFIG.MAX_EXPIRES_IN) {
          return {
            success: false,
            error: `过期时间不能超过${CONFIG.MAX_EXPIRES_IN / (24 * 60 * 60 * 1000)}天`,
          };
        }
        expiresAt = Date.now() + expiresInMs;
      }

      // 10. 生成分享ID
      const id = generateShareId();

      // 11. 存储分享数据
      const shareData: ShareData = {
        id,
        jsonData,
        password: normalizedPassword || undefined,
        expiresAt,
        createdAt: Date.now(),
        shareName: normalizedShareName,
        creatorFingerprint: clientFingerprint,
        accessCount: 0,
      };

      await writeShareData(shareData);

      // 12. 更新索引
      const index = await readIndex();
      const indexEntry: IndexEntry = {
        id,
        createdAt: shareData.createdAt,
        size: jsonData.length,
        expiresAt,
        creatorFingerprint: clientFingerprint,
      };
      index.shares.push(indexEntry);
      index.totalSize += jsonData.length;
      await writeIndex(index);

      // 安排到期自动删除
      scheduleShareDeletion(id, expiresAt);

      return {
        success: true,
        data: {
          id,
          shareUrl: `${getRequestURL(event).origin}/tool/json?share=${id}`,
          expiresAt,
        },
      };
    }

    // DELETE请求：删除分享
    if (method === 'DELETE') {
      const query = getQuery(event);
      const id = query.id as string;
      const body = await readBody(event).catch(() => ({}));
      const password = body.password as string | undefined;
      const clientFingerprint = await getClientFingerprint(event, body).catch(() => null);

      if (!id) {
        return {
          success: false,
          error: '分享ID不能为空',
        };
      }

      // 验证ID格式（防止路径遍历攻击）
      if (!isValidShareId(id)) {
        return {
          success: false,
          error: '分享ID格式不正确',
        };
      }

      const shareData = await readShareData(id);
      
      if (!shareData) {
        return {
          success: false,
          error: '分享链接不存在',
        };
      }

      // 授权：创建者本人（指纹匹配）或提供正确密码（若有设置）
      const isOwner = clientFingerprint && shareData.creatorFingerprint && clientFingerprint === shareData.creatorFingerprint;
      const hasPasswordAccess = shareData.password ? (password && shareData.password === password) : true;
      if (!isOwner && !hasPasswordAccess) {
        return {
          success: false,
          error: '无权限删除该分享（需创建者身份或正确密码）',
        };
      }

      await deleteShareData(id);
      
      // 更新索引
      const index = await readIndex();
      const entry = index.shares.find(s => s.id === id);
      if (entry) {
        index.shares = index.shares.filter(s => s.id !== id);
        index.totalSize -= entry.size;
        await writeIndex(index);
      }
      // 取消定时器
      const t = shareDeletionTimers.get(id);
      if (t) {
        clearTimeout(t);
        shareDeletionTimers.delete(id);
      }

      return {
        success: true,
        message: '分享链接已删除',
      };
    }

    return {
      success: false,
      error: '不支持的请求方法',
    };
  } catch (error: any) {
    return {
      success: false,
      error: error.message || '服务器错误',
    };
  }
});

