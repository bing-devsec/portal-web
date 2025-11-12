import { defineEventHandler, readBody } from 'h3';
import https from 'https';
import http from 'http';
import { URL } from 'url';

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

  // 提取URL（通常在最后，或者用引号包裹）
  const urlMatch = command.match(/['"](https?:\/\/[^'"]+)['"]|(https?:\/\/[^\s]+)/i);
  if (urlMatch) {
    result.url = urlMatch[1] || urlMatch[2];
    command = command.replace(urlMatch[0], '');
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

// 验证URL是否安全（防止SSRF）
function isUrlSafe(urlString: string): boolean {
  try {
    const url = new URL(urlString);
    
    // 只允许http和https协议
    if (!['http:', 'https:'].includes(url.protocol)) {
      return false;
    }

    // 禁止内网IP地址
    const hostname = url.hostname;
    const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
    const isPrivateIP = /^(10\.|172\.(1[6-9]|2[0-9]|3[01])\.|192\.168\.)/.test(hostname);
    
    if (isLocalhost || isPrivateIP) {
      return false;
    }

    return true;
  } catch {
    return false;
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

export default defineEventHandler(async (event) => {
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
    } else if (body.url) {
      url = body.url;
      method = body.method || 'GET';
      headers = body.headers || {};
      requestBody = body.body;
      cert = body.cert;
      key = body.key;
    } else {
      return {
        success: false,
        error: '缺少URL或cURL命令',
      };
    }

    // 验证URL
    if (!url) {
      return {
        success: false,
        error: 'URL不能为空',
      };
    }

    // 验证URL安全性
    if (!isUrlSafe(url)) {
      return {
        success: false,
        error: '不安全的URL，禁止访问内网地址',
      };
    }

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
        ...headers,
      },
      timeout: 10000, // 10秒超时
    };

    // 添加客户端证书（如果提供）
    if (cert && key && isHttps) {
      requestOptions.cert = cert;
      requestOptions.key = key;
    }

    // 发送请求
    return new Promise((resolve) => {
      const httpModule = isHttps ? https : http;
      const req = httpModule.request(requestOptions, (res) => {
        // 验证Content-Type
        const contentType = res.headers['content-type'];
        if (!isJsonContentType(contentType)) {
          res.destroy();
          resolve({
            success: false,
            error: `响应头Content-Type不是JSON格式，当前为: ${contentType || '未知'}`,
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
          try {
            // 验证是否为有效JSON
            const jsonData = JSON.parse(data);
            resolve({
              success: true,
              data: jsonData,
            });
          } catch (parseError) {
            resolve({
              success: false,
              error: '响应数据不是有效的JSON格式',
            });
          }
        });
      });

      req.on('error', (error) => {
        resolve({
          success: false,
          error: `请求失败: ${error.message}`,
        });
      });

      req.on('timeout', () => {
        req.destroy();
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
    return {
      success: false,
      error: error.message || '服务器错误',
    };
  }
});

