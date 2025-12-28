import { defineEventHandler, readBody } from 'h3';
import https from 'https';
import http from 'http';
import { URL } from 'url';
import dns from 'dns';
import { promisify } from 'util';

interface FetchJsonRequest {
  url?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string;
  cert?: string; // 客户端证书（PEM格式）
  key?: string; // 客户端私钥（PEM格式）
  curlCommand?: string; // cURL命令
}

// 解析cURL命令
function parseCurlCommand(curlCommand: string): {
  url: string;
  method: string;
  headers: Record<string, string>;
  body?: string;
  cert?: string;
  key?: string;
} {
  const result: {
    url: string;
    method: string;
    headers: Record<string, string>;
    body?: string;
    cert?: string;
    key?: string;
  } = {
    url: '',
    method: 'GET',
    headers: {},
  };

  // 移除开头的curl和引号
  let command = curlCommand.trim().replace(/^curl\s+/i, '');

  // 提取URL（优先匹配带引号的，然后匹配不带引号的）
  // 匹配模式：'url' 或 "url" 或 url（不带引号，但不在参数中）
  const urlMatch = command.match(/['"](https?:\/\/[^'"]+)['"]|(https?:\/\/[^\s'"]+)/i);
  if (urlMatch) {
    result.url = urlMatch[1] || urlMatch[2];
    // 移除匹配到的URL部分
    if (urlMatch[0]) {
      command = command.replace(urlMatch[0], '').trim();
    }
  }

  // 提取请求方法
  const methodMatch = command.match(/-X\s+(\w+)/i);
  if (methodMatch) {
    result.method = methodMatch[1].toUpperCase();
  }

  // 提取请求头
  const headerMatches = command.matchAll(/-H\s+['"]([^'"]+)['"]/gi);
  for (const match of headerMatches) {
    const headerStr = match[1];
    const colonIndex = headerStr.indexOf(':');
    if (colonIndex > 0) {
      const key = headerStr.substring(0, colonIndex).trim();
      const value = headerStr.substring(colonIndex + 1).trim();
      result.headers[key] = value;
    }
  }

  // 提取请求体
  const dataMatch = command.match(/-d\s+['"]([^'"]+)['"]|--data\s+['"]([^'"]+)['"]/i);
  if (dataMatch) {
    result.body = dataMatch[1] || dataMatch[2];
  }

  // 提取证书（简化处理，实际cURL命令可能更复杂）
  const certMatch = command.match(/--cert\s+['"]?([^\s'"]+)['"]?/i);
  if (certMatch) {
    // 这里只是提取路径，实际需要读取文件内容
    // 为了简化，我们假设证书内容已经通过其他方式提供
  }

  return result;
}

const dnsLookup = promisify(dns.lookup);

// 检查是否为内网IP（IPv4和IPv6）
function isPrivateIP(ip: string): boolean {
  // IPv4 内网地址
  const ipv4Private = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.|127\.|169\.254\.|0\.0\.0\.0)/.test(ip);
  if (ipv4Private) return true;
  
  // IPv6 内网地址
  if (ip.startsWith('::1') || 
      ip.startsWith('fc00:') || 
      ip.startsWith('fe80:') ||
      ip.startsWith('fd00:') ||
      ip === '::') {
    return true;
  }
  
  return false;
}

// 危险端口列表
const DANGEROUS_PORTS = [
  22,    // SSH
  23,    // Telnet
  25,    // SMTP
  135,   // RPC
  139,   // NetBIOS
  445,   // SMB
  1433,  // SQL Server
  3306,  // MySQL
  3389,  // RDP
  5432,  // PostgreSQL
  6379,  // Redis
  8080,  // 常见内网服务
  16992, // Intel AMT
  27017, // MongoDB
];

// 增强的URL安全检查（防止SSRF）
async function isUrlSafe(urlString: string): Promise<{ safe: boolean; reason?: string }> {
  try {
    const url = new URL(urlString);
    
    // 只允许http和https协议
    if (!['http:', 'https:'].includes(url.protocol)) {
      return { safe: false, reason: '只允许http和https协议' };
    }

    const hostname = url.hostname;
    
    // 1. 检查hostname是否为localhost或内网域名
    const isLocalhost = hostname === 'localhost' || 
                       hostname === '127.0.0.1' || 
                       hostname === '::1' ||
                       hostname === '0.0.0.0';
    
    if (isLocalhost) {
      return { safe: false, reason: '禁止访问localhost' };
    }
    
    // 2. 检查hostname是否为内网IP（直接输入IP的情况）
    if (isPrivateIP(hostname)) {
      return { safe: false, reason: '禁止访问内网IP地址' };
    }
    
    // 3. 检查是否为内网域名模式
    const privateDomainPatterns = [
      /\.local$/i,
      /\.internal$/i,
      /\.lan$/i,
      /\.corp$/i,
      /\.localdomain$/i,
    ];
    
    for (const pattern of privateDomainPatterns) {
      if (pattern.test(hostname)) {
        return { safe: false, reason: '禁止访问内网域名' };
      }
    }
    
    // 4. 解析DNS并检查实际IP（防止DNS重绑定攻击）
    try {
      const { address } = await dnsLookup(hostname, { family: 4 });
      if (isPrivateIP(address)) {
        return { safe: false, reason: 'DNS解析后的IP为内网地址' };
      }
    } catch (dnsError) {
      // DNS解析失败，拒绝访问
      return { safe: false, reason: 'DNS解析失败' };
    }
    
    // 5. 检查端口（禁止访问危险端口）
    const port = url.port ? parseInt(url.port) : (url.protocol === 'https:' ? 443 : 80);
    if (DANGEROUS_PORTS.includes(port)) {
      return { safe: false, reason: '禁止访问危险端口' };
    }
    
    // 6. 检查端口范围（只允许常用HTTP/HTTPS端口）
    if (port < 1 || port > 65535) {
      return { safe: false, reason: '端口号无效' };
    }
    
    // 允许的端口：80, 443, 8080-8090（常见HTTP服务端口）
    const allowedPorts = [80, 443];
    const allowedPortRanges = [[8080, 8090], [8443, 8443]];
    let isAllowedPort = allowedPorts.includes(port);
    
    if (!isAllowedPort) {
      for (const [start, end] of allowedPortRanges) {
        if (port >= start && port <= end) {
          isAllowedPort = true;
          break;
        }
      }
    }
    
    if (!isAllowedPort) {
      return { safe: false, reason: '端口不在允许范围内' };
    }

    return { safe: true };
  } catch (error) {
    return { safe: false, reason: 'URL格式不正确' };
  }
}

// 验证Content-Type是否为JSON
function isJsonContentType(contentType: string | null | undefined): boolean {
  if (!contentType) {
    return false;
  }
  
  const normalized = contentType.toLowerCase().trim();
  return normalized.startsWith('application/json') || 
         normalized.includes('application/json');
}

// ========== 错误信息脱敏 ==========
function sanitizeError(error: any, isProduction: boolean = false): string {
  if (isProduction) {
    // 生产环境返回通用错误信息
    return '请求失败，请检查URL是否正确';
  }
  
  const errorMessage = error?.message || '未知错误';
  
  // 过滤敏感错误信息
  const sensitivePatterns = [
    /ECONNREFUSED/i,
    /ETIMEDOUT/i,
    /ENOTFOUND/i,
    /ECONNRESET/i,
    /EHOSTUNREACH/i,
  ];
  
  for (const pattern of sensitivePatterns) {
    if (pattern.test(errorMessage)) {
      return '网络连接失败，请检查URL是否正确';
    }
  }
  
  return errorMessage;
}

// ========== 请求头过滤 ==========
// 禁止的请求头（防止Host Header攻击等）
const FORBIDDEN_HEADERS = [
  'host',
  'connection',
  'upgrade',
  'expect',
  'transfer-encoding',
  'content-length', // 由系统自动设置
  'proxy-connection',
  'proxy-authenticate',
  'proxy-authorization',
];

function filterHeaders(headers: Record<string, string>): Record<string, string> {
  const filtered: Record<string, string> = {};
  
  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase();
    
    // 过滤禁止的请求头
    if (FORBIDDEN_HEADERS.includes(lowerKey)) {
      continue;
    }
    
    // 限制请求头值长度（防止过长请求头）
    if (value.length > 1000) {
      continue;
    }
    
    filtered[key] = value;
  }
  
  return filtered;
}

// ========== 日志记录 ==========
function logRequest(ip: string, url: string, method: string, success: boolean, error?: string) {
  const logEntry = {
    timestamp: new Date().toISOString(),
    ip: ip || 'unknown',
    url: url.substring(0, 200), // 限制URL长度
    method: method,
    success: success,
    error: error ? error.substring(0, 100) : undefined, // 限制错误信息长度
  };
}

// 获取客户端IP地址
function getClientIP(event: any): string {
  const req = event.node?.req;
  if (!req) return 'unknown';
  
  // 优先从X-Forwarded-For获取（经过代理时）
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (xForwardedFor) {
    const ips = Array.isArray(xForwardedFor) 
      ? xForwardedFor[0] 
      : xForwardedFor.split(',')[0].trim();
    return ips || 'unknown';
  }
  
  // 从X-Real-IP获取
  const xRealIP = req.headers['x-real-ip'];
  if (xRealIP) {
    return Array.isArray(xRealIP) ? xRealIP[0] : xRealIP;
  }
  
  // 从socket获取
  const remoteAddress = req.socket?.remoteAddress;
  if (remoteAddress) {
    return remoteAddress;
  }
  
  return 'unknown';
}

export default defineEventHandler(async (event) => {
  const clientIP = getClientIP(event);
  const isProduction = process.env.NODE_ENV === 'production';
  
  try {
    const body = await readBody<FetchJsonRequest>(event);

    let url: string;
    let method: string = 'GET';
    let headers: Record<string, string> = {};
    let requestBody: string | undefined;
    let cert: string | undefined;
    let key: string | undefined;

    // 处理cURL命令
    if (body.curlCommand) {
      const parsed = parseCurlCommand(body.curlCommand);
      url = parsed.url;
      method = parsed.method;
      headers = parsed.headers;
      requestBody = parsed.body;
      
      // 如果cURL命令解析后URL为空，说明命令格式不正确
      if (!url) {
        logRequest(clientIP, '', '', false, '无法从cURL命令中提取URL');
        return {
          success: false,
          error: '无法从cURL命令中提取URL，请检查命令格式是否正确（例如: curl https://example.com/api）',
        };
      }
    } else if (body.url) {
      url = body.url;
      method = body.method || 'GET';
      headers = body.headers || {};
      requestBody = body.body;
      cert = body.cert;
      key = body.key;
    } else {
      logRequest(clientIP, '', '', false, '缺少URL或cURL命令');
      return {
        success: false,
        error: '缺少URL或cURL命令',
      };
    }

    // 验证URL
    if (!url) {
      logRequest(clientIP, url, method, false, 'URL不能为空');
      return {
        success: false,
        error: 'URL不能为空',
      };
    }

    // 验证URL安全性（异步检查）
    const urlSafetyCheck = await isUrlSafe(url);
    if (!urlSafetyCheck.safe) {
      logRequest(clientIP, url, method, false, urlSafetyCheck.reason || '不安全的URL');
      return {
        success: false,
        error: `不安全的URL：${urlSafetyCheck.reason || '禁止访问内网地址'}`,
      };
    }

    // 过滤请求头
    const filteredHeaders = filterHeaders(headers);
    
    // 创建请求选项
    const urlObj = new URL(url);
    const isHttps = urlObj.protocol === 'https:';
    
    const requestOptions: any = {
      hostname: urlObj.hostname,
      port: urlObj.port || (isHttps ? 443 : 80),
      path: urlObj.pathname + urlObj.search,
      method: method,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; JSONTool/1.0)',
        ...filteredHeaders,
      },
      timeout: 10000, // 10秒超时
    };

    // 添加客户端证书（如果提供）- 注意：私钥传递存在安全风险，建议在生产环境禁用
    if (cert && key && isHttps) {
      // 生产环境可以禁用此功能以提高安全性
      if (isProduction && process.env.DISABLE_CLIENT_CERT === 'true') {
        logRequest(clientIP, url, method, false, '客户端证书功能已禁用');
        return {
          success: false,
          error: '客户端证书功能已禁用',
        };
      }
      requestOptions.cert = cert;
      requestOptions.key = key;
    }

    // 发送请求
    return new Promise((resolve) => {
      const httpModule = isHttps ? https : http;
      const req = httpModule.request(requestOptions, (res) => {
        // 检查HTTP状态码
        if (res.statusCode && res.statusCode >= 400) {
          // 对于错误状态码，仍然尝试读取响应体，可能包含错误信息
          let errorData = '';
          res.on('data', (chunk) => {
            errorData += chunk.toString();
            // 限制错误数据大小
            if (errorData.length > 500) {
              errorData = errorData.substring(0, 500);
            }
          });
          res.on('end', () => {
            const errorMsg = `HTTP ${res.statusCode}: ${res.statusMessage || '请求失败'}${errorData ? ` - ${errorData.substring(0, 200)}` : ''}`;
            logRequest(clientIP, url, method, false, errorMsg);
            resolve({
              success: false,
              error: errorMsg,
            });
          });
          return;
        }

        // 读取响应数据
        let data = '';
        res.on('data', (chunk) => {
          data += chunk.toString();
          if (data.length > 2 * 1024 * 1024) {
            res.destroy();
            resolve({
              success: false,
              error: '响应数据过大，超过2MB限制',
            });
          }
        });

        res.on('end', () => {
          // 如果没有数据，返回错误
          if (!data || !data.trim()) {
            logRequest(clientIP, url, method, false, '响应数据为空');
            resolve({
              success: false,
              error: '响应数据为空',
            });
            return;
          }

          try {
            // 尝试解析JSON，不强制要求Content-Type
            const jsonData = JSON.parse(data);
            logRequest(clientIP, url, method, true);
            resolve({
              success: true,
              data: jsonData,
            });
          } catch (parseError) {
            // 如果解析失败，检查Content-Type是否提示了问题
            const contentType = res.headers['content-type'];
            const errorMsg = contentType && !isJsonContentType(contentType)
              ? `响应数据不是有效的JSON格式。Content-Type: ${contentType}`
              : '响应数据不是有效的JSON格式';
            
            logRequest(clientIP, url, method, false, errorMsg);
            resolve({
              success: false,
              error: errorMsg,
            });
          }
        });
      });

      req.on('error', (error) => {
        const sanitizedError = sanitizeError(error, isProduction);
        logRequest(clientIP, url, method, false, sanitizedError);
        resolve({
          success: false,
          error: isProduction ? '请求失败，请检查URL是否正确' : `请求失败: ${sanitizedError}`,
        });
      });

      req.on('timeout', () => {
        req.destroy();
        logRequest(clientIP, url, method, false, '请求超时');
        resolve({
          success: false,
          error: '请求超时',
        });
      });

      // 发送请求体（如果有）
      if (requestBody) {
        req.write(requestBody);
      }

      req.end();
    });
  } catch (error: any) {
    const sanitizedError = sanitizeError(error, isProduction);
    logRequest(clientIP, '', '', false, sanitizedError);
    return {
      success: false,
      error: isProduction ? '服务器错误' : (sanitizedError || '服务器错误'),
    };
  }
});

